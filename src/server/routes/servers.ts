import { Router } from 'express';
import { prisma } from '../lib/database';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/error';
import * as pterodactyl from '../lib/pterodactyl';
import { calculateHourlyCost } from '../lib/billing';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// GET /api/servers - List user's servers with billing info
router.get('/', asyncHandler(async (req: AuthRequest, res) => {
  const servers = await prisma.server.findMany({
    where: { userId: req.user!.id },
    include: {
      location: true,
      egg: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Get billing rates
  const settings = await prisma.settings.findFirst();
  const billingEnabled = settings?.billingEnabled || false;
  
  // Add hourly cost to each server if billing is enabled
  const serversWithCost = servers.map(server => {
    let hourlyCost = 0;
    if (billingEnabled && settings) {
      hourlyCost = calculateHourlyCost(
        server.ram,
        server.cpu,
        server.disk,
        server.databases,
        server.allocations,
        server.backups,
        {
          ramRate: settings.billingRamRate || 1,
          cpuRate: settings.billingCpuRate || 1,
          diskRate: settings.billingDiskRate || 1,
          databaseRate: settings.billingDatabaseRate || 1,
          allocationRate: settings.billingAllocationRate || 1,
          backupRate: settings.billingBackupRate || 1,
          gracePeriod: settings.billingGracePeriod || 24,
        }
      );
    }
    return {
      ...server,
      hourlyCost: Math.ceil(hourlyCost),
    };
  });

  res.json({ servers: serversWithCost, billingEnabled });
}));

// GET /api/servers/:id - Get server details
router.get('/:id', asyncHandler(async (req: AuthRequest, res) => {
  const server = await prisma.server.findFirst({
    where: {
      id: req.params.id,
      userId: req.user!.id,
    },
    include: {
      location: true,
      egg: true,
    },
  });

  if (!server) {
    throw createError('Server not found', 404);
  }

  res.json({ server });
}));

// POST /api/servers - Create a new server
router.post('/', asyncHandler(async (req: AuthRequest, res) => {
  const { name, locationId, eggId, ram, disk, cpu, databases, backups, allocations, environment } = req.body;

  // Validate input
  if (!name || !locationId || !eggId) {
    throw createError('Name, location, and egg are required', 400);
  }

  // Get user
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
  });

  if (!user) {
    throw createError('User not found', 404);
  }

  // Check if user has Pterodactyl account
  if (!user.pterodactylId) {
    throw createError('You must link your Pterodactyl account first', 400);
  }

  // Get current server count
  const currentServers = await prisma.server.count({
    where: { userId: user.id },
  });

  if (currentServers >= user.servers) {
    throw createError('Server limit reached', 400);
  }

  // Get location and egg
  const [location, egg] = await Promise.all([
    prisma.location.findUnique({ where: { id: locationId } }),
    prisma.egg.findUnique({ where: { id: eggId } }),
  ]);

  if (!location || !location.enabled) {
    throw createError('Invalid or disabled location', 400);
  }

  if (!egg || !egg.enabled) {
    throw createError('Invalid or disabled egg', 400);
  }

  // Calculate requested resources
  const requestedRam = Math.max(ram || egg.minRam, egg.minRam);
  const requestedDisk = Math.max(disk || egg.minDisk, egg.minDisk);
  const requestedCpu = Math.max(cpu || egg.minCpu, egg.minCpu);
  const requestedDatabases = databases || egg.databases;
  const requestedBackups = backups || egg.backups;
  const requestedAllocations = allocations || egg.allocations;

  // Get used resources
  const serverAggregates = await prisma.server.aggregate({
    where: { userId: user.id },
    _sum: {
      ram: true,
      disk: true,
      cpu: true,
      databases: true,
      backups: true,
      allocations: true,
    },
  });

  const usedRam = serverAggregates._sum?.ram || 0;
  const usedDisk = serverAggregates._sum?.disk || 0;
  const usedCpu = serverAggregates._sum?.cpu || 0;
  const usedDatabases = serverAggregates._sum?.databases || 0;
  const usedBackups = serverAggregates._sum?.backups || 0;
  const usedAllocations = serverAggregates._sum?.allocations || 0;

  // Validate resources
  if (usedRam + requestedRam > user.ram) {
    throw createError(`Insufficient RAM. Available: ${user.ram - usedRam}MB`, 400);
  }
  if (usedDisk + requestedDisk > user.disk) {
    throw createError(`Insufficient disk space. Available: ${user.disk - usedDisk}MB`, 400);
  }
  if (usedCpu + requestedCpu > user.cpu) {
    throw createError(`Insufficient CPU. Available: ${user.cpu - usedCpu}%`, 400);
  }
  if (usedDatabases + requestedDatabases > user.databases) {
    throw createError('Insufficient database slots', 400);
  }
  if (usedBackups + requestedBackups > user.backups) {
    throw createError('Insufficient backup slots', 400);
  }
  if (usedAllocations + requestedAllocations > user.allocations) {
    throw createError('Insufficient allocation slots', 400);
  }

  // Create server on Pterodactyl
  // Merge default environment with user-provided environment variables
  const defaultEnvironment = JSON.parse(egg.environment || '{}');
  const mergedEnvironment = { ...defaultEnvironment, ...(environment || {}) };
  
  const pteroServer = await pterodactyl.createPteroServer({
    name,
    userId: user.pterodactylId,
    eggId: egg.pterodactylId,
    locationId: location.pterodactylId,
    ram: requestedRam,
    disk: requestedDisk,
    cpu: requestedCpu,
    databases: requestedDatabases,
    backups: requestedBackups,
    allocations: requestedAllocations,
    startup: egg.startup,
    environment: mergedEnvironment,
    dockerImage: egg.dockerImage,
    nestId: egg.nestId,
  }) as { attributes: { id: number; uuid?: string; identifier?: string } };

  // Create server in database
  const server = await prisma.server.create({
    data: {
      pterodactylId: pteroServer.attributes.id,
      pterodactylUuid: pteroServer.attributes.uuid || pteroServer.attributes.identifier || undefined,
      name,
      ram: requestedRam,
      disk: requestedDisk,
      cpu: requestedCpu,
      databases: requestedDatabases,
      backups: requestedBackups,
      allocations: requestedAllocations,
      userId: user.id,
      locationId: location.id,
      eggId: egg.id,
    },
  });

  // Log action
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'SERVER_CREATED',
      details: JSON.stringify({ serverId: server.id, name }),
      ipAddress: req.ip || 'unknown',
    },
  });

  res.status(201).json({ server });
}));

// DELETE /api/servers/:id - Delete a server
router.delete('/:id', asyncHandler(async (req: AuthRequest, res) => {
  const server = await prisma.server.findFirst({
    where: {
      id: req.params.id,
      userId: req.user!.id,
    },
  });

  if (!server) {
    throw createError('Server not found', 404);
  }

  // Delete from Pterodactyl
  try {
    await pterodactyl.deletePteroServer(server.pterodactylId);
  } catch (error) {
    console.error('Failed to delete server from Pterodactyl:', error);
    // Continue with local deletion even if Pterodactyl deletion fails
  }

  // Delete from database
  await prisma.server.delete({
    where: { id: server.id },
  });

  // Log action
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'SERVER_DELETED',
      details: JSON.stringify({ serverId: server.id, name: server.name }),
      ipAddress: req.ip || 'unknown',
    },
  });

  res.json({ success: true });
}));

export default router;
