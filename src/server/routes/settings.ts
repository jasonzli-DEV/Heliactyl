import { Router } from 'express';
import { prisma } from '../lib/database';
import { requireAdmin, optionalAuth, type AuthRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/error';

const router = Router();

// GET /api/settings/public - Get public settings
router.get('/public', asyncHandler(async (req, res) => {
  const settings = await prisma.settings.findFirst();

  if (!settings) {
    return res.json({
      siteName: 'EnderBit',
      siteDescription: null,
      logo: null,
      favicon: null,
      theme: 'dark',
      accentColor: '#6366f1',
      allowNewUsers: true,
      maintenanceMode: false,
      maintenanceMessage: null,
      discordInvite: null,
      afkEnabled: true,
      afkCoinsPerMinute: 1,
      afkMaxMinutes: 60,
      afkInterval: 60,
      storeEnabled: true,
      earnEnabled: true,
      earnLinks: null,
    });
  }

  res.json({
    siteName: settings.siteName,
    siteDescription: settings.siteDescription,
    logo: settings.logo,
    favicon: settings.favicon,
    theme: settings.theme,
    accentColor: settings.accentColor,
    allowNewUsers: settings.allowNewUsers,
    maintenanceMode: settings.maintenanceMode,
    maintenanceMessage: settings.maintenanceMessage,
    discordInvite: settings.discordInvite,
    afkEnabled: settings.afkEnabled,
    afkCoinsPerMinute: settings.afkCoinsPerMinute,
    afkMaxMinutes: settings.afkMaxMinutes,
    afkInterval: settings.afkInterval,
    storeEnabled: settings.storeEnabled,
    earnEnabled: settings.earnEnabled,
    earnLinks: settings.earnLinks,
  });
}));

// GET /api/settings - Get all settings (admin only)
router.get('/', requireAdmin, asyncHandler(async (req: AuthRequest, res) => {
  const settings = await prisma.settings.findFirst();

  if (!settings) {
    throw createError('Settings not found', 404);
  }

  res.json({
    settings: {
      ...settings,
      pterodactylKey: settings.pterodactylKey ? '••••••••' : null,
      discordClientSecret: settings.discordClientSecret ? '••••••••' : null,
      cutyApiToken: settings.cutyApiToken ? '••••••••' : null,
    }
  });
}));

// GET /api/settings/full - Alias for admin settings (for compatibility)
router.get('/full', requireAdmin, asyncHandler(async (req: AuthRequest, res) => {
  const settings = await prisma.settings.findFirst();

  if (!settings) {
    throw createError('Settings not found', 404);
  }

  res.json({
    settings: {
      ...settings,
      pterodactylKey: settings.pterodactylKey ? '••••••••' : null,
      discordClientSecret: settings.discordClientSecret ? '••••••••' : null,
      cutyApiToken: settings.cutyApiToken ? '••••••••' : null,
    }
  });
}));

// Allowed settings fields (whitelist to prevent overwriting secrets like jwtSecret)
const ALLOWED_SETTINGS_FIELDS = [
  'siteName', 'siteDescription', 'logo', 'favicon', 'theme', 'accentColor', 'siteUrl',
  'pterodactylUrl', 'pterodactylKey',
  'discordClientId', 'discordClientSecret', 'discordRedirectUri', 'discordInvite', 'adminDiscordIds',
  'allowNewUsers', 'maintenanceMode', 'maintenanceMessage',
  'defaultRam', 'defaultDisk', 'defaultCpu', 'defaultServers', 'defaultDatabases', 'defaultBackups', 'defaultAllocations', 'defaultCoins',
  'afkEnabled', 'afkCoinsPerMinute', 'afkMaxMinutes', 'afkInterval',
  'storeEnabled', 'earnEnabled', 'earnLinks', 'cutyApiToken',
] as const;

// PATCH /api/settings - Update settings (admin only)
router.patch('/', requireAdmin, asyncHandler(async (req: AuthRequest, res) => {
  // Whitelist allowed fields to prevent privilege escalation
  const updates: Record<string, unknown> = {};
  
  for (const field of ALLOWED_SETTINGS_FIELDS) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  // Don't update secrets if they're masked
  if (updates.pterodactylKey === '••••••••') {
    delete updates.pterodactylKey;
  }
  if (updates.discordClientSecret === '••••••••') {
    delete updates.discordClientSecret;
  }
  if (updates.cutyApiToken === '••••••••') {
    delete updates.cutyApiToken;
  }

  const settings = await prisma.settings.upsert({
    where: { id: 'main' },
    update: updates,
    create: {
      id: 'main',
      ...updates,
    },
  });

  // Log action
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'SETTINGS_UPDATED',
      details: JSON.stringify(Object.keys(updates)),
      ipAddress: req.ip || 'unknown',
    },
  });

  res.json({
    settings: {
      ...settings,
      pterodactylKey: settings.pterodactylKey ? '••••••••' : null,
      discordClientSecret: settings.discordClientSecret ? '••••••••' : null,
      cutyApiToken: settings.cutyApiToken ? '••••••••' : null,
    }
  });
}));

// PUT /api/settings - Update settings (admin only)
router.put('/', requireAdmin, asyncHandler(async (req: AuthRequest, res) => {
  // Whitelist allowed fields to prevent privilege escalation
  const updates: Record<string, unknown> = {};
  
  for (const field of ALLOWED_SETTINGS_FIELDS) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  // Don't update secrets if they're masked
  if (updates.pterodactylKey === '••••••••') {
    delete updates.pterodactylKey;
  }
  if (updates.discordClientSecret === '••••••••') {
    delete updates.discordClientSecret;
  }
  if (updates.cutyApiToken === '••••••••') {
    delete updates.cutyApiToken;
  }

  const settings = await prisma.settings.upsert({
    where: { id: 'main' },
    update: updates,
    create: {
      id: 'main',
      ...updates,
    },
  });

  // Log action
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'SETTINGS_UPDATED',
      details: JSON.stringify(Object.keys(updates)),
      ipAddress: req.ip || 'unknown',
    },
  });

  res.json({
    ...settings,
    pterodactylKey: settings.pterodactylKey ? '••••••••' : null,
    discordClientSecret: settings.discordClientSecret ? '••••••••' : null,
    cutyApiToken: settings.cutyApiToken ? '••••••••' : null,
  });
}));

// GET /api/settings/status - Get setup status
router.get('/status', asyncHandler(async (req, res) => {
  const settings = await prisma.settings.findFirst();
  
  res.json({
    setupRequired: !settings || !settings.pterodactylUrl || !settings.discordClientId,
  });
}));

export default router;
