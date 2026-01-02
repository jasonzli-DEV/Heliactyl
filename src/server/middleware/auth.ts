import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/database';

// Cache for JWT secret (reloaded when null)
let cachedJwtSecret: string | null = null;

async function getJwtSecret(): Promise<string> {
  if (cachedJwtSecret) return cachedJwtSecret;
  
  const settings = await prisma.settings.findFirst();
  if (!settings?.jwtSecret) {
    throw new Error('JWT secret not configured. Please complete setup first.');
  }
  cachedJwtSecret = settings.jwtSecret;
  return cachedJwtSecret;
}

// Clear cache (call when settings are updated)
export function clearSecretCache() {
  cachedJwtSecret = null;
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    discordId: string;
    username: string;
    email: string;
    isAdmin: boolean;
  };
}

export async function generateToken(user: {
  id: string;
  discordId: string;
  username: string;
  email: string | null;
  isAdmin: boolean;
}): Promise<string> {
  const secret = await getJwtSecret();
  return jwt.sign(
    {
      id: user.id,
      discordId: user.discordId,
      username: user.username,
      email: user.email || '',
      isAdmin: user.isAdmin,
    },
    secret,
    { expiresIn: '7d' }
  );
}

export async function verifyToken(token: string) {
  try {
    const secret = await getJwtSecret();
    return jwt.verify(token, secret) as {
      id: string;
      discordId: string;
      username: string;
      email: string;
      isAdmin: boolean;
    };
  } catch {
    return null;
  }
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const decoded = await verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Verify user still exists and is not banned
  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
  });

  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  // Check if ban has expired
  if (user.banned && user.banExpiresAt && new Date(user.banExpiresAt) < new Date()) {
    // Ban has expired, automatically unban
    await prisma.user.update({
      where: { id: user.id },
      data: { banned: false, banReason: null, banExpiresAt: null },
    });
  } else if (user.banned) {
    return res.status(403).json({ 
      error: 'Account banned', 
      reason: user.banReason,
      expiresAt: user.banExpiresAt,
    });
  }

  req.user = {
    id: user.id,
    discordId: user.discordId,
    username: user.username,
    email: user.email || '',
    isAdmin: user.isAdmin,
  };

  // Check maintenance mode - only allow admins
  if (!user.isAdmin) {
    const settings = await prisma.settings.findFirst();
    if (settings?.maintenanceMode) {
      return res.status(503).json({ 
        error: 'Maintenance mode',
        message: settings.maintenanceMessage || 'The panel is currently undergoing maintenance. Please try again later.'
      });
    }
  }

  next();
}

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  // First authenticate the user
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const decoded = await verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Verify user still exists and is not banned
  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
  });

  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  // Check if ban has expired
  if (user.banned && user.banExpiresAt && new Date(user.banExpiresAt) < new Date()) {
    // Ban has expired, automatically unban
    await prisma.user.update({
      where: { id: user.id },
      data: { banned: false, banReason: null, banExpiresAt: null },
    });
  } else if (user.banned) {
    return res.status(403).json({ 
      error: 'Account banned', 
      reason: user.banReason,
      expiresAt: user.banExpiresAt,
    });
  }

  // Check admin status from database (not JWT)
  if (!user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  req.user = {
    id: user.id,
    discordId: user.discordId,
    username: user.username,
    email: user.email || '',
    isAdmin: user.isAdmin,
  };

  next();
}

export async function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (token) {
    const decoded = await verifyToken(token);
    if (decoded) {
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });

      // Allow banned users to authenticate (they need auth for ban appeals)
      if (user) {
        req.user = {
          id: user.id,
          discordId: user.discordId,
          username: user.username,
          email: user.email || '',
          isAdmin: user.isAdmin,
        };
      }
    }
  }

  next();
}
