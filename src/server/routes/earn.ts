import { Router } from 'express';
import { prisma } from '../lib/database';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/error';
import { randomBytes } from 'crypto';

const router = Router();

// Generate unique token
function generateToken(): string {
  return randomBytes(32).toString('hex');
}

// GET /api/earn/links - Get earn links for user (with Cuty.io quick links)
router.get('/links', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const settings = await prisma.settings.findFirst();
  
  if (!settings?.earnEnabled) {
    return res.json({ links: [], enabled: false });
  }

  // Parse earn links from settings
  let links: Array<{
    id: string;
    title: string;
    description: string;
    coins: number;
    cooldown: number;
  }> = [];

  if (settings.earnLinks) {
    try {
      links = JSON.parse(settings.earnLinks);
    } catch {
      links = [];
    }
  }

  // For each link, generate a Cuty.io quick link if API token is configured
  const cutyToken = settings.cutyApiToken;
  const linksWithUrls = await Promise.all(links.map(async (link) => {
    // Create a one-time earn token
    const earnToken = await prisma.earnToken.create({
      data: {
        token: generateToken(),
        userId: req.user!.id,
        coins: link.coins,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    // Build callback URL
    const siteUrl = settings.siteUrl || `${req.protocol}://${req.get('host')}`;
    const callbackUrl = `${siteUrl}/api/earn/callback?token=${earnToken.token}`;

    // If Cuty.io is configured, create quick link
    let url: string;
    if (cutyToken) {
      url = `https://cuty.io/quick?token=${cutyToken}&url=${encodeURIComponent(callbackUrl)}`;
    } else {
      // Direct link without Cuty.io
      url = callbackUrl;
    }

    return {
      ...link,
      url,
      earnToken: earnToken.token,
    };
  }));

  res.json({
    links: linksWithUrls,
    enabled: true,
    hasCuty: !!cutyToken,
  });
}));

// GET /api/earn/callback - Callback for completing earn link
router.get('/callback', asyncHandler(async (req, res) => {
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.redirect('/?error=invalid_token');
  }

  // Find earn token
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
    return res.redirect('/?error=token_expired');
  }

  // Mark as claimed and give coins
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
        description: 'Earned from link completion',
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: earnToken.userId,
        action: 'EARN_LINK_COMPLETED',
        details: JSON.stringify({ coins: earnToken.coins, tokenId: earnToken.id }),
        ipAddress: req.ip || 'unknown',
      },
    }),
  ]);

  // Redirect to success page
  res.redirect(`/earn?success=true&coins=${earnToken.coins}`);
}));

// POST /api/earn/claim - Manual claim (for direct links without Cuty.io)
router.post('/claim', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const { token } = req.body;

  if (!token) {
    throw createError('Token is required', 400);
  }

  const earnToken = await prisma.earnToken.findUnique({
    where: { token },
  });

  if (!earnToken) {
    throw createError('Token not found', 404);
  }

  if (earnToken.userId !== req.user!.id) {
    throw createError('Invalid token', 403);
  }

  if (earnToken.claimed) {
    throw createError('Already claimed', 400);
  }

  if (earnToken.expiresAt < new Date()) {
    throw createError('Token expired', 400);
  }

  // Claim the tokens
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
        description: 'Earned from link completion',
      },
    }),
  ]);

  res.json({
    success: true,
    coins: earnToken.coins,
  });
}));

// Cleanup expired tokens (can be called periodically)
router.delete('/cleanup', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  // Only allow admins to cleanup
  if (!req.user!.isAdmin) {
    throw createError('Admin access required', 403);
  }

  const result = await prisma.earnToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { claimed: true, claimedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }, // Claimed over 7 days ago
      ],
    },
  });

  res.json({
    success: true,
    deleted: result.count,
  });
}));

export default router;
