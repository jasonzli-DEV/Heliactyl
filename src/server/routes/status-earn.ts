import { Router } from 'express';
import { prisma } from '../lib/database';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/error';
import { 
  activateStatusEarning, 
  deactivateStatusEarning, 
  getStatusEarnInfo,
  checkUserStatus,
  isBotReady,
} from '../lib/discordBot';

const router = Router();

// GET /api/status-earn/status - Get status earning info
router.get('/status', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const settings = await prisma.settings.findFirst();
  
  if (!settings?.statusEarnEnabled) {
    return res.json({ 
      enabled: false,
      message: 'Status earning is disabled',
    });
  }

  if (!settings?.statusEarnText || !settings?.discordBotToken || !settings?.discordGuildId) {
    return res.json({ 
      enabled: false,
      message: 'Status earning is not configured',
    });
  }

  const earnInfo = await getStatusEarnInfo(req.user!.id);
  const botReady = isBotReady();

  // Format the interval for display
  const intervalSec = settings.statusEarnInterval || 300;
  let intervalDisplay: string;
  if (intervalSec >= 86400) {
    intervalDisplay = `${Math.floor(intervalSec / 86400)} day${Math.floor(intervalSec / 86400) !== 1 ? 's' : ''}`;
  } else if (intervalSec >= 3600) {
    intervalDisplay = `${Math.floor(intervalSec / 3600)} hour${Math.floor(intervalSec / 3600) !== 1 ? 's' : ''}`;
  } else if (intervalSec >= 60) {
    intervalDisplay = `${Math.floor(intervalSec / 60)} minute${Math.floor(intervalSec / 60) !== 1 ? 's' : ''}`;
  } else {
    intervalDisplay = `${intervalSec} second${intervalSec !== 1 ? 's' : ''}`;
  }

  res.json({
    enabled: true,
    botReady,
    requiredText: settings.statusEarnText,
    coins: settings.statusEarnCoins,
    interval: intervalSec,
    intervalDisplay,
    // Properly handle grammar for coin vs coins
    coinsDisplay: `${settings.statusEarnCoins} ${settings.statusEarnCoins === 1 ? 'coin' : 'coins'}`,
    active: earnInfo?.active || false,
    lastRewarded: earnInfo?.lastRewarded?.toISOString() || null,
    consecutiveSec: earnInfo?.consecutiveSec || 0,
  });
}));

// POST /api/status-earn/activate - Start status earning
router.post('/activate', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const result = await activateStatusEarning(req.user!.id);
  
  if (!result.success) {
    throw createError(result.error || 'Failed to activate', 400);
  }

  res.json({ 
    success: true,
    message: 'Status earning activated! Keep the required text in your Discord status to earn.',
    status: result.status,
  });
}));

// POST /api/status-earn/deactivate - Stop status earning
router.post('/deactivate', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  await deactivateStatusEarning(req.user!.id);
  
  res.json({ 
    success: true,
    message: 'Status earning deactivated',
  });
}));

// GET /api/status-earn/check - Check current Discord status (for preview)
router.get('/check', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  if (!isBotReady()) {
    throw createError('Discord bot is not ready', 503);
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { discordId: true },
  });

  if (!user) {
    throw createError('User not found', 404);
  }

  const status = await checkUserStatus(user.discordId);
  
  res.json(status);
}));

export default router;
