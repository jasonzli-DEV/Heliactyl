import { Router } from 'express';
import { prisma } from '../lib/database';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/error';

const router = Router();

// GET /api/store/packages - List available packages
router.get('/packages', asyncHandler(async (req, res) => {
  const packages = await prisma.package.findMany({
    where: { enabled: true },
    orderBy: { sortOrder: 'asc' },
  });

  res.json({ packages });
}));

// POST /api/store/purchase - Purchase a package
router.post('/purchase', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const { packageId } = req.body;

  if (!packageId) {
    throw createError('Package ID required', 400);
  }

  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
  });

  if (!pkg || !pkg.enabled) {
    throw createError('Package not found or disabled', 404);
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
  });

  if (!user) {
    throw createError('User not found', 404);
  }

  if (pkg.price && user.coins < pkg.price) {
    throw createError('Insufficient coins', 400);
  }

  // Apply package resources
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        coins: pkg.price ? { decrement: pkg.price } : undefined,
        ram: { increment: pkg.ram },
        disk: { increment: pkg.disk },
        cpu: { increment: pkg.cpu },
        servers: { increment: pkg.servers },
        databases: { increment: pkg.databases },
        backups: { increment: pkg.backups },
        allocations: { increment: pkg.allocations },
      },
    }),
    prisma.transaction.create({
      data: {
        userId: user.id,
        type: 'PURCHASE',
        amount: pkg.price ? -pkg.price : 0,
        description: `Purchased package: ${pkg.displayName}`,
        metadata: JSON.stringify({ packageId: pkg.id, packageName: pkg.name }),
      },
    }),
  ]);

  // Log action
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'PACKAGE_PURCHASED',
      details: JSON.stringify({ packageId: pkg.id, packageName: pkg.name }),
      ipAddress: req.ip || 'unknown',
    },
  });

  res.json({
    success: true,
    package: {
      name: pkg.displayName,
      ram: pkg.ram,
      disk: pkg.disk,
      cpu: pkg.cpu,
      servers: pkg.servers,
      databases: pkg.databases,
      backups: pkg.backups,
      allocations: pkg.allocations,
    },
  });
}));

// GET /api/store/locations - List available locations
router.get('/locations', asyncHandler(async (req, res) => {
  const locations = await prisma.location.findMany({
    where: { enabled: true },
    orderBy: { name: 'asc' },
  });

  res.json({ locations });
}));

// GET /api/store/eggs - List available eggs
router.get('/eggs', asyncHandler(async (req, res) => {
  const eggs = await prisma.egg.findMany({
    where: { enabled: true },
    orderBy: { displayName: 'asc' },
  });

  res.json({ eggs });
}));

export default router;
