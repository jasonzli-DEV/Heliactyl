import { Router } from 'express';
import { prisma } from '../lib/database';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/error';
import { randomBytes } from 'crypto';

const router = Router();

// Generate a short random token (8 chars)
function generateShortToken(): string {
  return randomBytes(4).toString('hex').toUpperCase();
}

// POST /api/earn/generate - Generate a new earn link for the user
router.post('/generate', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const settings = await prisma.settings.findFirst();
  
  if (!settings?.earnEnabled) {
    throw createError('Earning is currently disabled', 400);
  }

  if (!settings.cutyApiToken) {
    throw createError('Cuty.io is not configured', 400);
  }

  const earnCoins = settings.earnCoins || 10;
  const earnCooldown = settings.earnCooldown || 300; // 5 minutes default

  // Check cooldown - find user's last completed earn
  const lastEarn = await prisma.earnToken.findFirst({
    where: {
      userId: req.user!.id,
      claimed: true,
    },
    orderBy: { claimedAt: 'desc' },
  });

  if (lastEarn?.claimedAt) {
    const cooldownMs = earnCooldown * 1000;
    const timeSinceLast = Date.now() - lastEarn.claimedAt.getTime();
    
    if (timeSinceLast < cooldownMs) {
      const remainingSeconds = Math.ceil((cooldownMs - timeSinceLast) / 1000);
      throw createError(`Please wait ${remainingSeconds} seconds before earning again`, 429);
    }
  }

  // Generate a short token for the callback URL
  const token = generateShortToken();

  // Create the earn token in database
  await prisma.earnToken.create({
    data: {
      token,
      userId: req.user!.id,
      coins: earnCoins,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour expiry
    },
  });

  // Build the callback URL (the secret endpoint)
  const siteUrl = settings.siteUrl || `${req.protocol}://${req.get('host')}`;
  const callbackUrl = `${siteUrl}/api/earn/callback/${token}`;

  // Build the Cuty.io quick link
  const cutyUrl = `https://cuty.io/quick?token=${settings.cutyApiToken}&url=${encodeURIComponent(callbackUrl)}`;

  res.json({
    url: cutyUrl,
    coins: earnCoins,
  });
}));

// GET /api/earn/callback/:token - Callback endpoint when user completes Cuty.io link
router.get('/callback/:token', asyncHandler(async (req, res) => {
  const { token } = req.params;

  if (!token || token.length !== 8) {
    return res.redirect('/?error=invalid_token');
  }

  // Find the earn token
  const earnToken = await prisma.earnToken.findUnique({
    where: { token },
  });

  if (!earnToken) {
    return res.redirect('/?error=token_not_found');
  }

  if (earnToken.claimed) {
    return res.redirect('/?error=already_claimed');
  }

  if (earnToken.expiresAt < new Date()) {
    // Delete expired token
    await prisma.earnToken.delete({ where: { id: earnToken.id } });
    return res.redirect('/?error=token_expired');
  }

  // Award the coins!
  await prisma.$transaction([
    prisma.earnToken.update({
      where: { id: earnToken.id },
      data: {
        claimed: true,
        claimedAt: new Date(),
      },
    }),
    prisma.user.update({
      where: { id: earnToken.userId },
      data: {
        coins: { increment: earnToken.coins },
      },
    }),
    prisma.transaction.create({
      data: {
        userId: earnToken.userId,
        type: 'EARN',
        amount: earnToken.coins,
        description: 'Completed Cuty.io link',
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: earnToken.userId,
        action: 'EARN_COMPLETED',
        details: JSON.stringify({ coins: earnToken.coins }),
        ipAddress: req.ip || 'unknown',
      },
    }),
  ]);

  // Redirect to earn page with success
  res.redirect(`/earn?success=true&coins=${earnToken.coins}`);
}));

// GET /api/earn/status - Get earn status for user
router.get('/status', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const settings = await prisma.settings.findFirst();
  
  const earnEnabled = settings?.earnEnabled ?? false;
  const earnCoins = settings?.earnCoins || 10;
  const earnCooldown = settings?.earnCooldown || 300;
  const configured = !!settings?.cutyApiToken;

  // Check cooldown
  let canEarn = true;
  let cooldownRemaining = 0;

  const lastEarn = await prisma.earnToken.findFirst({
    where: {
      userId: req.user!.id,
      claimed: true,
    },
    orderBy: { claimedAt: 'desc' },
  });

  if (lastEarn?.claimedAt) {
    const cooldownMs = earnCooldown * 1000;
    const timeSinceLast = Date.now() - lastEarn.claimedAt.getTime();
    
    if (timeSinceLast < cooldownMs) {
      canEarn = false;
      cooldownRemaining = Math.ceil((cooldownMs - timeSinceLast) / 1000);
    }
  }

  res.json({
    enabled: earnEnabled && configured,
    coins: earnCoins,
    cooldown: earnCooldown,
    canEarn,
    cooldownRemaining,
  });
}));

// Cleanup: Delete expired unclaimed tokens
router.delete('/cleanup', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  if (!req.user!.isAdmin) {
    throw createError('Admin access required', 403);
  }

  const result = await prisma.earnToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() }, claimed: false },
        { claimed: true, claimedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      ],
    },
  });

  res.json({ deleted: result.count });
}));

export default router;
