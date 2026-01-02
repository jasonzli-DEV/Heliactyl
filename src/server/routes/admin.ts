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
  const { page = '1', limit = '20', search = '' } = req.query;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

  // Build search filter
  const searchFilter = search ? {
    OR: [
      { username: { contains: search as string } },
      { email: { contains: search as string } },
      { discordId: { contains: search as string } },
    ],
  } : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: searchFilter,
      include: { _count: { select: { ownedServers: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit as string),
    }),
    prisma.user.count({ where: searchFilter }),
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
  const { page = '1', limit = '20' } = req.query;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  
  const [servers, total] = await Promise.all([
    prisma.server.findMany({
      include: { user: { select: { id: true, username: true, discordId: true } }, location: true, egg: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit as string),
    }),
    prisma.server.count(),
  ]);
  
  res.json({
    servers,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      pages: Math.ceil(total / parseInt(limit as string)),
    },
  });
}));

// DELETE /api/admin/servers/:id - Delete server from admin panel
router.delete('/servers/:id', asyncHandler(async (req: AuthRequest, res) => {
  const server = await prisma.server.findUnique({ where: { id: req.params.id } });
  
  if (!server) {
    throw createError('Server not found', 404);
  }

  // Delete from Pterodactyl first
  try {
    await pterodactyl.deletePteroServer(server.pterodactylId);
  } catch (error) {
    console.error('Failed to delete server from Pterodactyl:', error);
    // Continue with database deletion even if Pterodactyl deletion fails
  }

  // Delete from database
  await prisma.server.delete({ where: { id: server.id } });

  // Log action
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'ADMIN_SERVER_DELETED',
      details: JSON.stringify({ serverId: server.id, name: server.name, userId: server.userId }),
      ipAddress: req.ip || 'unknown',
    },
  });

  res.json({ success: true });
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

router.patch('/packages/:id', asyncHandler(async (req: AuthRequest, res) => {
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
  
  // Get capacity info from Pterodactyl
  let capacityMap: Record<number, { hasCapacity: boolean }> = {};
  try {
    const nodes = await pterodactyl.getNodesWithUsage();
    // Group nodes by location and check if any node has capacity
    for (const node of nodes) {
      if (!capacityMap[node.locationId]) {
        capacityMap[node.locationId] = { hasCapacity: false };
      }
      // Consider location has capacity if any node has at least 512MB RAM available
      if (node.availableMemory >= 512) {
        capacityMap[node.locationId].hasCapacity = true;
      }
    }
  } catch (err) {
    console.error('Failed to get node capacity:', err);
  }
  
  // Add capacity info to locations
  const locationsWithCapacity = locations.map(loc => ({
    ...loc,
    hasCapacity: capacityMap[loc.pterodactylId]?.hasCapacity ?? true, // Assume has capacity if unknown
  }));
  
  res.json({ locations: locationsWithCapacity });
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
  const nests = await pterodactyl.getNests() as { data: Array<{ attributes: { id: number; name?: string } }> };
  let syncedCount = 0;
  for (const nest of nests.data) {
    // Pterodactyl API sometimes doesn't include name in /nests, fetch individual nest if needed
    let nestName = nest.attributes.name;
    if (!nestName) {
      try {
        const nestDetail = await pterodactyl.getNest(nest.attributes.id) as { attributes: { name: string } };
        nestName = nestDetail.attributes.name;
      } catch {
        nestName = `Nest #${nest.attributes.id}`;
      }
    }
    
    const eggs = await pterodactyl.getEggs(nest.attributes.id) as { data: Array<{ attributes: { id: number; name: string; description: string; docker_image: string; startup: string } }> };
    for (const egg of eggs.data) {
      await prisma.egg.upsert({
        where: { pterodactylId_nestId: { pterodactylId: egg.attributes.id, nestId: nest.attributes.id } },
        update: { name: egg.attributes.name, displayName: egg.attributes.name, nestName, dockerImage: egg.attributes.docker_image || '', startup: egg.attributes.startup || '' },
        create: { pterodactylId: egg.attributes.id, nestId: nest.attributes.id, nestName, name: egg.attributes.name, displayName: egg.attributes.name, dockerImage: egg.attributes.docker_image || '', startup: egg.attributes.startup || '', enabled: true },
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

router.post('/eggs/nest-toggle', asyncHandler(async (req: AuthRequest, res) => {
  const { nestId, enabled } = req.body;
  await prisma.egg.updateMany({
    where: { nestId: parseInt(nestId) },
    data: { enabled, nestEnabled: enabled },
  });
  res.json({ success: true });
}));

// Coupons
router.get('/coupons', asyncHandler(async (req: AuthRequest, res) => {
  const coupons = await prisma.coupon.findMany({ 
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { uses: true } } },
  });
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

// Tickets Management
// GET /api/admin/tickets - Get all tickets
router.get('/tickets', asyncHandler(async (req: AuthRequest, res) => {
  const { status = 'open' } = req.query;
  
  const tickets = await prisma.ticket.findMany({
    where: status === 'all' ? {} : { status: status as string },
    include: {
      user: {
        select: { id: true, username: true, discordId: true }
      },
      messages: {
        orderBy: { createdAt: 'asc' },
        include: {
          user: {
            select: { username: true }
          }
        }
      }
    },
    orderBy: { updatedAt: 'desc' },
  });
  
  res.json({ tickets });
}));

// POST /api/admin/tickets/:id/reply - Reply to ticket as staff
router.post('/tickets/:id/reply', asyncHandler(async (req: AuthRequest, res) => {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id }
  });
  
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }
  
  const reply = await prisma.ticketMessage.create({
    data: {
      ticketId: req.params.id,
      userId: req.user!.id,
      message,
      isStaff: true,
    },
    include: {
      user: {
        select: { username: true }
      }
    }
  });
  
  await prisma.ticket.update({
    where: { id: req.params.id },
    data: { updatedAt: new Date() }
  });
  
  res.status(201).json({ message: reply });
}));

// PATCH /api/admin/tickets/:id/close - Close a ticket
router.patch('/tickets/:id/close', asyncHandler(async (req: AuthRequest, res) => {
  const ticket = await prisma.ticket.update({
    where: { id: req.params.id },
    data: { status: 'closed' }
  });
  
  res.json({ ticket });
}));

export default router;
