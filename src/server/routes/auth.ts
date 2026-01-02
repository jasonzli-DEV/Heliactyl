import { Router } from 'express';
import { prisma } from '../lib/database';
import { generateToken, requireAuth, type AuthRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/error';
import { findPteroUserByEmail, createPteroUserWithPassword } from '../lib/pterodactyl';

const router = Router();

// Helper to get Discord OAuth URL from settings
async function getDiscordAuthUrl(): Promise<string> {
  const settings = await prisma.settings.findFirst();
  if (!settings?.discordClientId || !settings?.discordRedirectUri) {
    throw new Error('Discord OAuth not configured');
  }
  
  const scopes = ['identify', 'email'].join(' ');
  return `https://discord.com/api/oauth2/authorize?client_id=${settings.discordClientId}&redirect_uri=${encodeURIComponent(settings.discordRedirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}`;
}

// GET /api/auth/login - Redirect to Discord OAuth
router.get('/login', asyncHandler(async (req, res) => {
  const url = await getDiscordAuthUrl();
  res.redirect(url);
}));

// GET /api/auth/callback - Discord OAuth callback
router.get('/callback', asyncHandler(async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    throw createError('No authorization code provided', 400);
  }

  // Get settings from database
  const settings = await prisma.settings.findFirst();
  if (!settings?.discordClientId || !settings?.discordClientSecret || !settings?.discordRedirectUri) {
    throw createError('Discord OAuth not configured', 500);
  }

  // Exchange code for tokens
  const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: settings.discordClientId,
      client_secret: settings.discordClientSecret,
      grant_type: 'authorization_code',
      code: code as string,
      redirect_uri: settings.discordRedirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    throw createError('Failed to exchange code for token', 400);
  }

  const tokens = await tokenResponse.json() as { access_token: string; refresh_token: string };

  // Get user info from Discord
  const userResponse = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userResponse.ok) {
    throw createError('Failed to get user info from Discord', 400);
  }

  const discordUser = await userResponse.json() as {
    id: string;
    username: string;
    email: string;
    avatar: string;
  };

  // Check if user exists
  let user = await prisma.user.findUnique({
    where: { discordId: discordUser.id },
  });

  if (!user) {
    // Check if registration is allowed
    if (!settings.allowNewUsers) {
      throw createError('New user registration is disabled', 403);
    }

    // Check if this is the admin Discord ID
    const isAdmin = discordUser.id === settings.adminDiscordId;

    // Try to link or create Pterodactyl account
    let pterodactylId: number | null = null;
    
    try {
      // Check if a Pterodactyl account with same email exists
      const existingPteroUser = await findPteroUserByEmail(discordUser.email);
      
      if (existingPteroUser) {
        // Link existing account
        pterodactylId = existingPteroUser.id;
      } else {
        // Create new Pterodactyl account
        const { userId } = await createPteroUserWithPassword(discordUser.email, discordUser.username);
        pterodactylId = userId;
      }
    } catch (error) {
      console.error('Failed to create/link Pterodactyl account:', error);
      // Continue without Pterodactyl link - can be set up later
    }

    // Create new user
    user = await prisma.user.create({
      data: {
        discordId: discordUser.id,
        username: discordUser.username,
        email: discordUser.email,
        avatar: discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : null,
        discordAccessToken: tokens.access_token,
        discordRefreshToken: tokens.refresh_token,
        isAdmin,
        pterodactylId,
        coins: settings.defaultCoins,
        ram: settings.defaultRam,
        disk: settings.defaultDisk,
        cpu: settings.defaultCpu,
        servers: settings.defaultServers,
        databases: settings.defaultDatabases,
        backups: settings.defaultBackups,
        allocations: settings.defaultAllocations,
        registrationIp: req.ip,
        lastIp: req.ip,
        lastLogin: new Date(),
      },
    });

    // Log registration
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_REGISTERED',
        details: JSON.stringify({ discordId: discordUser.id }),
        ipAddress: req.ip || 'unknown',
      },
    });
  } else {
    // Update existing user
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        username: discordUser.username,
        email: discordUser.email,
        avatar: discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : null,
        discordAccessToken: tokens.access_token,
        discordRefreshToken: tokens.refresh_token,
        lastIp: req.ip,
        lastLogin: new Date(),
      },
    });
  }

  // Check if banned
  if (user.banned) {
    throw createError(`Your account has been banned: ${user.banReason || 'No reason provided'}`, 403);
  }

  // Generate JWT
  const token = await generateToken(user);

  // Create session
  await prisma.session.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    },
  });

  // Set cookie and redirect
  res.cookie('token', token, {
    httpOnly: true,
    secure: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  });

  res.redirect(settings.siteUrl || '/');
}));

// GET /api/auth/me - Get current user
router.get('/me', asyncHandler(async (req, res) => {
  const token = req.cookies.token;
  
  if (!token) {
    return res.json({ user: null });
  }

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          discordId: true,
          username: true,
          email: true,
          avatar: true,
          isAdmin: true,
          banned: true,
          coins: true,
          ram: true,
          disk: true,
          cpu: true,
          servers: true,
          databases: true,
          backups: true,
          allocations: true,
          pterodactylId: true,
          createdAt: true,
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date()) {
    res.clearCookie('token');
    return res.json({ user: null });
  }

  if (session.user.banned) {
    res.clearCookie('token');
    return res.json({ user: null, banned: true });
  }

  res.json({ user: session.user });
}));

// POST /api/auth/logout - Logout
router.post('/logout', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const token = req.cookies.token;
  
  if (token) {
    await prisma.session.deleteMany({
      where: { token },
    });
  }

  res.clearCookie('token');
  res.json({ success: true });
}));

export default router;
