import { Router } from 'express';
import { prisma } from '../lib/database';
import { generateToken, requireAuth, type AuthRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/error';
import { createPteroUserWithPassword, findPteroUserByEmail } from '../lib/pterodactyl';

const router = Router();

// Helper to get Discord OAuth URL from settings
async function getDiscordAuthUrl(): Promise<string> {
  const settings = await prisma.settings.findFirst();
  if (!settings?.discordClientId || !settings?.discordRedirectUri) {
    throw new Error('Discord OAuth not configured');
  }
  
  // Add guilds.join scope if auto-join is enabled
  const scopes = settings.discordAutoJoin 
    ? ['identify', 'email', 'guilds.join'].join(' ')
    : ['identify', 'email'].join(' ');
  return `https://discord.com/api/oauth2/authorize?client_id=${settings.discordClientId}&redirect_uri=${encodeURIComponent(settings.discordRedirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}`;
}

// GET /api/auth/login - Redirect to Discord OAuth
router.get('/login', asyncHandler(async (req, res) => {
  const url = await getDiscordAuthUrl();
  res.redirect(url);
}));

// GET /api/auth/discord - Alias for login
router.get('/discord', asyncHandler(async (req, res) => {
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

    // Try to link existing Pterodactyl account or create new one
    let pterodactylId: number | null = null;
    
    try {
      // First check if a Pterodactyl account with this email already exists
      const existingPteroUser = await findPteroUserByEmail(discordUser.email);
      
      if (existingPteroUser) {
        // Link to existing account
        pterodactylId = existingPteroUser.id;
        console.log(`Linked existing Pterodactyl account ${existingPteroUser.id} for ${discordUser.email}`);
      } else {
        // Create new Pterodactyl account
        const { userId } = await createPteroUserWithPassword(discordUser.email, discordUser.username);
        pterodactylId = userId;
        console.log(`Created new Pterodactyl account ${userId} for ${discordUser.email}`);
      }
    } catch (error) {
      console.error('Failed to create/link Pterodactyl account:', error);
      // Continue without Pterodactyl account - can be set up later
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

    // Auto-join Discord server if enabled
    if (settings.discordAutoJoin && settings.discordGuildId && settings.discordBotToken) {
      try {
        await fetch(`https://discord.com/api/v10/guilds/${settings.discordGuildId}/members/${discordUser.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bot ${settings.discordBotToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            access_token: tokens.access_token,
          }),
        });
        console.log(`Auto-joined user ${discordUser.username} to Discord server`);
      } catch (error) {
        console.error('Failed to auto-join Discord server:', error);
        // Don't throw error - registration should still succeed
      }
    }
  } else {
    // Existing user - check if they need a Pterodactyl account
    let pterodactylId = user.pterodactylId;
    
    if (!pterodactylId) {
      // User doesn't have a Pterodactyl account yet - create or link one
      try {
        const existingPteroUser = await findPteroUserByEmail(discordUser.email);
        
        if (existingPteroUser) {
          pterodactylId = existingPteroUser.id;
          console.log(`Linked existing Pterodactyl account ${existingPteroUser.id} for returning user ${discordUser.email}`);
        } else {
          const { userId } = await createPteroUserWithPassword(discordUser.email, discordUser.username);
          pterodactylId = userId;
          console.log(`Created new Pterodactyl account ${userId} for returning user ${discordUser.email}`);
        }
      } catch (error) {
        console.error('Failed to create/link Pterodactyl account for existing user:', error);
      }
    }
    
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
        ...(pterodactylId && { pterodactylId }), // Update pterodactylId if we got one
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
          banReason: true,
          banExpiresAt: true,
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

  // Check if ban expired
  if (session.user.banned && session.user.banExpiresAt && new Date(session.user.banExpiresAt) < new Date()) {
    // Auto unban
    await prisma.user.update({
      where: { id: session.user.id },
      data: { banned: false, banReason: null, banExpiresAt: null },
    });
    // Refresh user data
    const updatedUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    return res.json({ user: updatedUser });
  }

  if (session.user.banned) {
    // Don't clear cookie - let them access the banned page
    return res.json({ 
      user: {
        id: session.user.id,
        discordId: session.user.discordId,
        username: session.user.username,
        avatar: session.user.avatar,
      },
      banned: true,
      banReason: session.user.banReason,
      banExpiresAt: session.user.banExpiresAt,
    });
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
