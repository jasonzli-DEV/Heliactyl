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

// PATCH /api/servers/:id - Update server resources
router.patch('/:id', asyncHandler(async (req: AuthRequest, res) => {
  const { ram, disk, cpu, databases, backups, allocations } = req.body;

  // Get server
  const server = await prisma.server.findFirst({
    where: {
      id: req.params.id,
      userId: req.user!.id,
    },
  });

  if (!server) {
    throw createError('Server not found', 404);
  }

  // Get user
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
  });

  if (!user) {
    throw createError('User not found', 404);
  }

  // Get total resources used by ALL user's servers (including this one)
  const serverAggregates = await prisma.server.aggregate({
    where: { userId: user.id },
    _sum: {
      databases: true,
      backups: true,
      allocations: true,
    },
  });

  const usedDatabases = serverAggregates._sum?.databases || 0;
  const usedBackups = serverAggregates._sum?.backups || 0;
  const usedAllocations = serverAggregates._sum?.allocations || 0;

  // Calculate what the NEW totals would be after this update
  // (subtract current server values, add new values)
  const newTotalDatabases = usedDatabases - server.databases + databases;
  const newTotalBackups = usedBackups - server.backups + backups;
  const newTotalAllocations = usedAllocations - server.allocations + allocations;

  // Validate permanent resources against user's total limits
  if (newTotalDatabases > user.databases) {
    throw createError('Insufficient databases available', 400);
  }
  if (newTotalBackups > user.backups) {
    throw createError('Insufficient backups available', 400);
  }
  if (newTotalAllocations > user.allocations) {
    throw createError('Insufficient ports available', 400);
  }

  // Update Pterodactyl server
  try {
    await pterodactyl.updatePteroServer(server.pterodactylId, {
      memory: ram,
      disk: disk,
      cpu: cpu,
      databases: databases,
      backups: backups,
      allocations: allocations,
    });
  } catch (error) {
    console.error('Failed to update Pterodactyl server:', error);
    throw createError('Failed to update server in panel', 500);
  }

  // Update database - only update server, NOT user resources
  // (user.allocations etc represent the TOTAL limit, not available pool)
  await prisma.$transaction([
    // Update server
    prisma.server.update({
      where: { id: server.id },
      data: {
        ram,
        disk,
        cpu,
        databases,
        backups,
        allocations,
      },
    }),
    // Log action
    prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'SERVER_UPDATED',
        details: JSON.stringify({
          serverId: server.id,
          changes: { 
            ram: ram - server.ram, 
            disk: disk - server.disk, 
            cpu: cpu - server.cpu, 
            databases: databases - server.databases, 
            backups: backups - server.backups, 
            allocations: allocations - server.allocations 
          },
        }),
        ipAddress: req.ip || 'unknown',
      },
    }),
  ]);

  res.json({ success: true });
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
  // Use nullish coalescing (??) so 0 is not treated as falsy
  const requestedDatabases = databases ?? egg.databases;
  const requestedBackups = backups ?? egg.backups;
  const requestedAllocations = allocations ?? egg.allocations;

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

  // Validate permanent resources only (databases, backups, allocations)
  // RAM, Disk, CPU are billed hourly - no limits
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

  // Charge upfront for first hour (prepaid billing)
  const billing = await import('../lib/billing');
  const chargeResult = await billing.chargeUpfrontForServer(
    user.id,
    server.id,
    requestedRam,
    requestedCpu,
    requestedDisk,
    requestedDatabases,
    requestedAllocations,
    requestedBackups
  );

  if (!chargeResult.success) {
    // Failed to charge - delete the server
    try {
      await pterodactyl.deletePteroServer(server.pterodactylId);
      await prisma.server.delete({ where: { id: server.id } });
    } catch (err) {
      console.error('Failed to cleanup server after billing failure:', err);
    }
    throw createError(chargeResult.error || 'Failed to charge for server', 402);
  }

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

// POST /api/servers/:id/pause - Pause a server (suspend and stop billing)
router.post('/:id/pause', asyncHandler(async (req: AuthRequest, res) => {
  const server = await prisma.server.findFirst({
    where: {
      id: req.params.id,
      userId: req.user!.id,
    },
  });

  if (!server) {
    throw createError('Server not found', 404);
  }

  if (server.paused) {
    throw createError('Server is already paused', 400);
  }

  // Suspend server in Pterodactyl
  try {
    await pterodactyl.suspendPteroServer(server.pterodactylId);
  } catch (error) {
    console.error('Failed to suspend server in Pterodactyl:', error);
    throw createError('Failed to pause server', 500);
  }

  // Update server in database - set paused and clear nextBillingAt
  await prisma.server.update({
    where: { id: server.id },
    data: {
      paused: true,
      nextBillingAt: null, // Stop billing
      suspendedAt: new Date(),
    },
  });

  // Log action
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'SERVER_PAUSED',
      details: JSON.stringify({ serverId: server.id, name: server.name }),
      ipAddress: req.ip || 'unknown',
    },
  });

  res.json({ success: true, message: 'Server paused successfully' });
}));

// POST /api/servers/:id/unpause - Unpause a server (charge upfront and unsuspend)
router.post('/:id/unpause', asyncHandler(async (req: AuthRequest, res) => {
  const server = await prisma.server.findFirst({
    where: {
      id: req.params.id,
      userId: req.user!.id,
    },
  });

  if (!server) {
    throw createError('Server not found', 404);
  }

  if (!server.paused) {
    throw createError('Server is not paused', 400);
  }

  // Charge upfront for next hour
  const billing = await import('../lib/billing');
  const chargeResult = await billing.chargeUpfrontForServer(
    req.user!.id,
    server.id,
    server.ram,
    server.cpu,
    server.disk,
    server.databases,
    server.allocations,
    server.backups
  );

  if (!chargeResult.success) {
    throw createError(chargeResult.error || 'Insufficient balance to unpause server', 402);
  }

  // Unsuspend server in Pterodactyl
  try {
    await pterodactyl.unsuspendPteroServer(server.pterodactylId);
  } catch (error) {
    console.error('Failed to unsuspend server in Pterodactyl:', error);
    throw createError('Failed to unpause server', 500);
  }

  // Update server in database
  await prisma.server.update({
    where: { id: server.id },
    data: {
      paused: false,
      suspendedAt: null,
    },
  });

  // Log action
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'SERVER_UNPAUSED',
      details: JSON.stringify({ serverId: server.id, name: server.name }),
      ipAddress: req.ip || 'unknown',
    },
  });

  res.json({ 
    success: true, 
    message: 'Server unpaused successfully',
    nextBillingAt: chargeResult.nextBillingAt,
  });
}));

export default router;
