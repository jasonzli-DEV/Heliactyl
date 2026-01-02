import { Router } from 'express';
import { prisma } from '../lib/database';
import { requireAdmin, type AuthRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/error';
import * as pterodactyl from '../lib/pterodactyl';

const router = Router();

// All routes require admin
router.use(requireAdmin);

// GET /api/admin/stats
router.get('/stats', asyncHandler(async (req: AuthRequest, res) => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const [totalUsers, totalServers, totalCoins, activeUsers, recentUsers, recentServers] = await Promise.all([
    prisma.user.count(),
    prisma.server.count(),
    prisma.user.aggregate({ _sum: { coins: true } }),
    prisma.user.count({ where: { lastLogin: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.server.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
  ]);

  res.json({
    totalUsers,
    totalServers,
    totalCoins: totalCoins._sum?.coins || 0,
    activeUsers,
    recentUsers,
    recentServers,
  });
}));

// GET /api/admin/users
router.get('/users', asyncHandler(async (req: AuthRequest, res) => {
  const { page = '1', limit = '20' } = req.query;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      include: { _count: { select: { ownedServers: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit as string),
    }),
    prisma.user.count(),
  ]);

  res.json({
    users: users.map(u => ({ ...u, serverCount: u._count.ownedServers })),
    pagination: { page: parseInt(page as string), limit: parseInt(limit as string), total, pages: Math.ceil(total / parseInt(limit as string)) },
  });
}));

// PUT /api/admin/users/:id - Whitelist allowed fields to prevent mass assignment
router.put('/users/:id', asyncHandler(async (req: AuthRequest, res) => {
  // Whitelist allowed fields to prevent privilege escalation
  const allowedFields = ['username', 'coins', 'ram', 'disk', 'cpu', 'servers', 'databases', 'backups', 'allocations', 'banned', 'banReason', 'packageId'] as const;
  const updates: Record<string, unknown> = {};
  
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }
  
  // Handle isAdmin separately with extra logging
  if (req.body.isAdmin !== undefined) {
    updates.isAdmin = req.body.isAdmin;
    // Log admin status change
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: req.body.isAdmin ? 'ADMIN_GRANTED' : 'ADMIN_REVOKED',
        details: JSON.stringify({ targetUserId: req.params.id }),
        ipAddress: req.ip || 'unknown',
      },
    });
  }
  
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: updates,
  });
  res.json({ user });
}));

// DELETE /api/admin/users/:id
router.delete('/users/:id', asyncHandler(async (req: AuthRequest, res) => {
  await prisma.user.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}));

// GET /api/admin/servers
router.get('/servers', asyncHandler(async (req: AuthRequest, res) => {
  const servers = await prisma.server.findMany({
    include: { user: { select: { id: true, username: true } }, location: true, egg: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ servers });
}));

// Packages
router.get('/packages', asyncHandler(async (req: AuthRequest, res) => {
  const packages = await prisma.package.findMany({ orderBy: { sortOrder: 'asc' } });
  res.json({ packages });
}));

router.post('/packages', asyncHandler(async (req: AuthRequest, res) => {
  const { name, displayName, price = 0, ram = 1024, disk = 5120, cpu = 100, servers = 1, databases = 1, backups = 1, allocations = 1 } = req.body;
  const pkg = await prisma.package.create({ data: { name, displayName: displayName || name, price, ram, disk, cpu, servers, databases, backups, allocations } });
  res.status(201).json({ package: pkg });
}));

router.put('/packages/:id', asyncHandler(async (req: AuthRequest, res) => {
  const pkg = await prisma.package.update({ where: { id: req.params.id }, data: req.body });
  res.json({ package: pkg });
}));

router.delete('/packages/:id', asyncHandler(async (req: AuthRequest, res) => {
  await prisma.package.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}));

// Locations
router.get('/locations', asyncHandler(async (req: AuthRequest, res) => {
  const locations = await prisma.location.findMany({ orderBy: { name: 'asc' } });
  res.json({ locations });
}));

router.post('/locations/sync', asyncHandler(async (req: AuthRequest, res) => {
  const pteroLocations = await pterodactyl.getLocations() as { data: Array<{ attributes: { id: number; short: string; long: string } }> };
  for (const loc of pteroLocations.data) {
    await prisma.location.upsert({
      where: { pterodactylId: loc.attributes.id },
      update: { name: loc.attributes.short, description: loc.attributes.long },
      create: { pterodactylId: loc.attributes.id, name: loc.attributes.short, description: loc.attributes.long, enabled: true },
    });
  }
  const locations = await prisma.location.findMany({ orderBy: { name: 'asc' } });
  res.json({ locations, synced: pteroLocations.data.length });
}));

router.put('/locations/:id', asyncHandler(async (req: AuthRequest, res) => {
  const location = await prisma.location.update({ where: { id: req.params.id }, data: req.body });
  res.json({ location });
}));

// Eggs
router.get('/eggs', asyncHandler(async (req: AuthRequest, res) => {
  const eggs = await prisma.egg.findMany({ orderBy: { displayName: 'asc' } });
  res.json({ eggs });
}));

router.post('/eggs/sync', asyncHandler(async (req: AuthRequest, res) => {
  const nests = await pterodactyl.getNests() as { data: Array<{ attributes: { id: number } }> };
  let syncedCount = 0;
  for (const nest of nests.data) {
    const eggs = await pterodactyl.getEggs(nest.attributes.id) as { data: Array<{ attributes: { id: number; name: string; description: string; docker_image: string; startup: string } }> };
    for (const egg of eggs.data) {
      await prisma.egg.upsert({
        where: { pterodactylId_nestId: { pterodactylId: egg.attributes.id, nestId: nest.attributes.id } },
        update: { name: egg.attributes.name, displayName: egg.attributes.name, dockerImage: egg.attributes.docker_image || '', startup: egg.attributes.startup || '' },
        create: { pterodactylId: egg.attributes.id, nestId: nest.attributes.id, name: egg.attributes.name, displayName: egg.attributes.name, dockerImage: egg.attributes.docker_image || '', startup: egg.attributes.startup || '', enabled: true },
      });
      syncedCount++;
    }
  }
  const eggs = await prisma.egg.findMany({ orderBy: { displayName: 'asc' } });
  res.json({ eggs, synced: syncedCount });
}));

router.put('/eggs/:id', asyncHandler(async (req: AuthRequest, res) => {
  const egg = await prisma.egg.update({ where: { id: req.params.id }, data: req.body });
  res.json({ egg });
}));

// Coupons
router.get('/coupons', asyncHandler(async (req: AuthRequest, res) => {
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ coupons });
}));

router.post('/coupons', asyncHandler(async (req: AuthRequest, res) => {
  const { code, coins = 0, ram = 0, disk = 0, cpu = 0, servers = 0, databases = 0, backups = 0, allocations = 0, maxUses, expiresAt, enabled = true } = req.body;
  const coupon = await prisma.coupon.create({
    data: { code: code.toUpperCase(), coins, ram, disk, cpu, servers, databases, backups, allocations, maxUses, expiresAt: expiresAt ? new Date(expiresAt) : null, enabled },
  });
  res.status(201).json({ coupon });
}));

router.put('/coupons/:id', asyncHandler(async (req: AuthRequest, res) => {
  const coupon = await prisma.coupon.update({ where: { id: req.params.id }, data: req.body });
  res.json({ coupon });
}));

router.delete('/coupons/:id', asyncHandler(async (req: AuthRequest, res) => {
  await prisma.coupon.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}));

// Audit logs
router.get('/audit-logs', asyncHandler(async (req: AuthRequest, res) => {
  const { page = '1', limit = '50' } = req.query;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, skip, take: parseInt(limit as string) }),
    prisma.auditLog.count(),
  ]);
  res.json({ logs, pagination: { page: parseInt(page as string), limit: parseInt(limit as string), total, pages: Math.ceil(total / parseInt(limit as string)) } });
}));

export default router;
