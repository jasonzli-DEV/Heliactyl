import { Router } from 'express';
import { prisma } from '../lib/database';
import { asyncHandler, createError } from '../middleware/error';
import crypto from 'crypto';

const router = Router();

// GET /api/setup/status - Check if setup is complete
router.get('/status', asyncHandler(async (req, res) => {
  const settings = await prisma.settings.findFirst();
  
  // Setup is complete if we have Discord and Pterodactyl configured
  const isComplete = settings && 
    settings.discordClientId && 
    settings.discordClientSecret &&
    settings.pterodactylUrl && 
    settings.pterodactylApiKey;

  res.json({
    setupComplete: !!isComplete,
    siteName: settings?.siteName || 'Heliactyl',
  });
}));

// POST /api/setup/test-pterodactyl - Test Pterodactyl connection
router.post('/test-pterodactyl', asyncHandler(async (req, res) => {
  const { url, apiKey } = req.body;

  if (!url || !apiKey) {
    throw createError('URL and API key are required', 400);
  }

  // Normalize URL
  const baseUrl = url.replace(/\/+$/, '');

  try {
    const response = await fetch(`${baseUrl}/api/application/users`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 401 || status === 403) {
        throw createError('Invalid API key or insufficient permissions', 401);
      }
      throw createError(`Pterodactyl returned error: ${status}`, 400);
    }

    const data = await response.json() as { meta?: { pagination?: { total?: number } } };
    res.json({
      success: true,
      message: 'Successfully connected to Pterodactyl',
      userCount: data.meta?.pagination?.total || 0,
    });
  } catch (err: any) {
    if (err.statusCode) throw err;
    throw createError(`Failed to connect: ${err.message}`, 400);
  }
}));

// POST /api/setup/complete - Complete setup
router.post('/complete', asyncHandler(async (req, res) => {
  const {
    siteName,
    siteUrl,
    discordClientId,
    discordClientSecret,
    discordRedirectUri,
    pterodactylUrl,
    pterodactylApiKey,
    adminDiscordId,
  } = req.body;

  // Validate required fields
  if (!discordClientId || !discordClientSecret) {
    throw createError('Discord credentials are required', 400);
  }
  if (!pterodactylUrl || !pterodactylApiKey) {
    throw createError('Pterodactyl credentials are required', 400);
  }
  if (!adminDiscordId) {
    throw createError('Admin Discord ID is required', 400);
  }

  // Generate secrets
  const jwtSecret = crypto.randomBytes(64).toString('hex');
  const sessionSecret = crypto.randomBytes(64).toString('hex');

  // Normalize URLs
  const normalizedPteroUrl = pterodactylUrl.replace(/\/+$/, '');
  const normalizedSiteUrl = siteUrl.replace(/\/+$/, '');

  // Update or create settings
  await prisma.settings.upsert({
    where: { id: 'main' },
    update: {
      siteName: siteName || 'Heliactyl',
      siteUrl: normalizedSiteUrl,
      discordClientId,
      discordClientSecret,
      discordRedirectUri: discordRedirectUri || `${normalizedSiteUrl}/api/auth/callback`,
      pterodactylUrl: normalizedPteroUrl,
      pterodactylApiKey,
      adminDiscordId,
      jwtSecret,
      sessionSecret,
    },
    create: {
      id: 'main',
      siteName: siteName || 'Heliactyl',
      siteUrl: normalizedSiteUrl,
      discordClientId,
      discordClientSecret,
      discordRedirectUri: discordRedirectUri || `${normalizedSiteUrl}/api/auth/callback`,
      pterodactylUrl: normalizedPteroUrl,
      pterodactylApiKey,
      adminDiscordId,
      jwtSecret,
      sessionSecret,
      allowNewUsers: true,
      storeEnabled: true,
      afkEnabled: true,
      afkCoinsPerMinute: 1,
      afkMaxMinutes: 60,
      afkInterval: 60,
      defaultCoins: 100,
      defaultRam: 1024,
      defaultDisk: 5120,
      defaultCpu: 100,
      defaultServers: 1,
      defaultDatabases: 1,
      defaultBackups: 1,
      defaultAllocations: 1,
      ramPrice: 10,
      diskPrice: 10,
      cpuPrice: 20,
      serverPrice: 100,
    },
  });

  // Log audit
  await prisma.auditLog.create({
    data: {
      action: 'SETUP_COMPLETED',
      details: JSON.stringify({
        siteName,
        siteUrl: normalizedSiteUrl,
        adminDiscordId,
      }),
      ipAddress: req.ip || 'unknown',
    },
  });

  res.json({ success: true });
}));

export default router;
