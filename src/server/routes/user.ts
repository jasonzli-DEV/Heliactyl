import { Router } from 'express';
import { prisma } from '../lib/database';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/error';
import * as pterodactyl from '../lib/pterodactyl';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// GET /api/user - Get current user profile
router.get('/', asyncHandler(async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: {
      ownedServers: true,
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!user) {
    throw createError('User not found', 404);
  }

  res.json({ user });
}));

// GET /api/user/resources - Get user resources
router.get('/resources', asyncHandler(async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
  });

  if (!user) {
    throw createError('User not found', 404);
  }

  // Get used resources
  const usedServers = await prisma.server.count({
    where: { userId: req.user!.id },
  });

  // Calculate used resources from servers
  const serverAggregates = await prisma.server.aggregate({
    where: { userId: req.user!.id },
    _sum: {
      ram: true,
      disk: true,
      cpu: true,
      databases: true,
      backups: true,
      allocations: true,
    },
  });

  res.json({
    available: {
      coins: user.coins,
      ram: user.ram,
      disk: user.disk,
      cpu: user.cpu,
      servers: user.servers,
      databases: user.databases,
      backups: user.backups,
      allocations: user.allocations,
    },
    used: {
      servers: usedServers,
      ram: serverAggregates._sum?.ram || 0,
      disk: serverAggregates._sum?.disk || 0,
      cpu: serverAggregates._sum?.cpu || 0,
      databases: serverAggregates._sum?.databases || 0,
      backups: serverAggregates._sum?.backups || 0,
      allocations: serverAggregates._sum?.allocations || 0,
    },
  });
}));

// POST /api/user/link-pterodactyl - Link Pterodactyl account
router.post('/link-pterodactyl', asyncHandler(async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
  });

  if (!user) {
    throw createError('User not found', 404);
  }

  if (user.pterodactylId) {
    throw createError('Pterodactyl account already linked', 400);
  }

  // Create Pterodactyl user
  const pteroUser = await pterodactyl.createPteroUser(
    user.email || `${user.discordId}@enderbit.local`,
    user.username
  ) as { attributes: { id: number } };

  // Update user with Pterodactyl ID
  await prisma.user.update({
    where: { id: user.id },
    data: { pterodactylId: pteroUser.attributes.id },
  });

  // Log action
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'PTERODACTYL_LINKED',
      details: JSON.stringify({ pterodactylId: pteroUser.attributes.id }),
      ipAddress: req.ip || 'unknown',
    },
  });

  res.json({
    success: true,
    pterodactylId: pteroUser.attributes.id,
  });
}));

// GET /api/user/transactions - Get user transactions
router.get('/transactions', asyncHandler(async (req: AuthRequest, res) => {
  const { page = '1', limit = '20' } = req.query;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit as string),
    }),
    prisma.transaction.count({
      where: { userId: req.user!.id },
    }),
  ]);

  res.json({
    transactions,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      pages: Math.ceil(total / parseInt(limit as string)),
    },
  });
}));

// POST /api/user/redeem - Redeem a coupon code
router.post('/redeem', asyncHandler(async (req: AuthRequest, res) => {
  const { code } = req.body;

  if (!code) {
    throw createError('Coupon code required', 400);
  }

  const coupon = await prisma.coupon.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      uses: {
        where: { userId: req.user!.id },
      },
    },
  });

  if (!coupon) {
    throw createError('Invalid coupon code', 404);
  }

  if (!coupon.enabled) {
    throw createError('This coupon is disabled', 400);
  }

  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    throw createError('This coupon has expired', 400);
  }

  if (coupon.maxUses && coupon.usesCount >= coupon.maxUses) {
    throw createError('This coupon has reached its usage limit', 400);
  }

  if (coupon.uses.length > 0) {
    throw createError('You have already used this coupon', 400);
  }

  // Apply coupon rewards
  await prisma.$transaction([
    // Update user resources
    prisma.user.update({
      where: { id: req.user!.id },
      data: {
        coins: { increment: coupon.coins },
        ram: { increment: coupon.ram },
        disk: { increment: coupon.disk },
        cpu: { increment: coupon.cpu },
        servers: { increment: coupon.servers },
        databases: { increment: coupon.databases },
        backups: { increment: coupon.backups },
        allocations: { increment: coupon.allocations },
      },
    }),
    // Record coupon use
    prisma.couponUse.create({
      data: {
        couponId: coupon.id,
        userId: req.user!.id,
      },
    }),
    // Increment coupon usage count
    prisma.coupon.update({
      where: { id: coupon.id },
      data: { usesCount: { increment: 1 } },
    }),
    // Create transaction record
    prisma.transaction.create({
      data: {
        userId: req.user!.id,
        type: 'COUPON',
        amount: coupon.coins,
        description: `Redeemed coupon: ${coupon.code}`,
        metadata: JSON.stringify({
          couponId: coupon.id,
          rewards: {
            coins: coupon.coins,
            ram: coupon.ram,
            disk: coupon.disk,
            cpu: coupon.cpu,
            servers: coupon.servers,
          },
        }),
      },
    }),
  ]);

  res.json({
    success: true,
    rewards: {
      coins: coupon.coins,
      ram: coupon.ram,
      disk: coupon.disk,
      cpu: coupon.cpu,
      servers: coupon.servers,
      databases: coupon.databases,
      backups: coupon.backups,
      allocations: coupon.allocations,
    },
  });
}));

// POST /api/user/afk/claim - Claim AFK rewards
router.post('/afk/claim', asyncHandler(async (req: AuthRequest, res) => {
  const { minutes } = req.body;

  if (!minutes || minutes < 1) {
    throw createError('Invalid minutes', 400);
  }

  // Get user's last AFK claim time
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { lastAfkClaim: true },
  });

  if (!user) {
    throw createError('User not found', 404);
  }

  // Get AFK settings
  const afkSetting = await prisma.settings.findFirst();
  const coinsPerMinute = afkSetting?.afkCoinsPerMinute || 1;
  const maxMinutes = afkSetting?.afkMaxMinutes || 60;
  const afkInterval = afkSetting?.afkInterval || 60; // seconds between claims

  // Server-side rate limiting: Check if enough time has passed since last claim
  if (user.lastAfkClaim) {
    const timeSinceLastClaim = Date.now() - user.lastAfkClaim.getTime();
    const minTimeBetweenClaims = afkInterval * 1000; // Convert to milliseconds
    
    if (timeSinceLastClaim < minTimeBetweenClaims) {
      const secondsRemaining = Math.ceil((minTimeBetweenClaims - timeSinceLastClaim) / 1000);
      throw createError(`Please wait ${secondsRemaining} seconds before claiming again`, 429);
    }
    
    // Calculate actual minutes that could have passed (with some buffer)
    const actualMinutesPossible = Math.floor(timeSinceLastClaim / 60000) + 1;
    if (minutes > actualMinutesPossible + 5) { // Allow 5 minute grace for page load delays
      throw createError('Invalid claim: minutes exceed time since last claim', 400);
    }
  }

  // Cap minutes at max
  const clampedMinutes = Math.min(minutes, maxMinutes);
  const coinsEarned = Math.floor(clampedMinutes * coinsPerMinute);

  // Update user coins and last claim time
  await prisma.user.update({
    where: { id: req.user!.id },
    data: {
      coins: { increment: coinsEarned },
      lastAfkClaim: new Date(),
    },
  });

  // Create transaction record
  await prisma.transaction.create({
    data: {
      userId: req.user!.id,
      type: 'AFK',
      amount: coinsEarned,
      description: `AFK reward: ${clampedMinutes} minutes`,
    },
  });

  // Log action
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'AFK_CLAIM',
      details: JSON.stringify({ minutes: clampedMinutes, coinsEarned }),
      ipAddress: req.ip || 'unknown',
    },
  });

  res.json({
    success: true,
    coinsEarned,
    minutes: clampedMinutes,
  });
}));

// NOTE: The /api/user/earn/claim endpoint has been removed for security.
// All earn claims must go through the token-based /api/earn/claim endpoint.

// DELETE /api/user/account - Delete user account
router.delete('/account', asyncHandler(async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { ownedServers: true },
  });

  if (!user) {
    throw createError('User not found', 404);
  }

  // Delete Pterodactyl account if linked
  if (user.pterodactylId) {
    try {
      // First delete all servers
      for (const server of user.ownedServers) {
        try {
          await pterodactyl.deletePteroServer(server.pterodactylId);
        } catch (e) {
          console.error(`Failed to delete server ${server.pterodactylId}:`, e);
        }
      }
      
      // Then delete the user
      await pterodactyl.deletePteroUser(user.pterodactylId);
    } catch (error) {
      console.error('Failed to delete Pterodactyl account:', error);
      // Continue with local deletion even if Ptero fails
    }
  }

  // Log deletion before deleting
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'ACCOUNT_DELETED',
      details: JSON.stringify({ discordId: user.discordId, username: user.username }),
      ipAddress: req.ip || 'unknown',
    },
  });

  // Delete all related records
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await prisma.couponUse.deleteMany({ where: { userId: user.id } });
  await prisma.transaction.deleteMany({ where: { userId: user.id } });
  await prisma.server.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });

  res.clearCookie('token');
  res.json({ success: true, message: 'Account deleted successfully' });
}));

// POST /api/user/reset-password - Reset Pterodactyl password
router.post('/reset-password', asyncHandler(async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
  });

  if (!user) {
    throw createError('User not found', 404);
  }

  if (!user.pterodactylId) {
    throw createError('No Pterodactyl account linked', 400);
  }

  // Generate new password
  const newPassword = pterodactyl.generatePassword(16);

  try {
    // Update password in Pterodactyl
    await pterodactyl.updatePteroUserPassword(user.pterodactylId, newPassword);

    // Log action
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'PTERODACTYL_PASSWORD_RESET',
        details: JSON.stringify({ pterodactylId: user.pterodactylId }),
        ipAddress: req.ip || 'unknown',
      },
    });

    // Return the password (shown only once!)
    res.json({
      success: true,
      password: newPassword,
      message: 'Password reset successfully. Save this password - it will only be shown once!',
    });
  } catch (error) {
    throw createError('Failed to reset password', 500);
  }
}));

// GET /api/user/settings - Get user settings
router.get('/settings', asyncHandler(async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      username: true,
      email: true,
      avatar: true,
      discordId: true,
      pterodactylId: true,
      createdAt: true,
      lastLogin: true,
    },
  });

  if (!user) {
    throw createError('User not found', 404);
  }

  res.json({ user });
}));

export default router;
