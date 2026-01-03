import { Router } from 'express';
import { prisma } from '../lib/database';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/error';
import * as pterodactyl from '../lib/pterodactyl';

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
router.get('/locations', asyncHandler(async (_req, res) => {
  const locations = await prisma.location.findMany({
    where: { enabled: true },
    orderBy: { name: 'asc' },
  });

  // Check capacity and mark locations as full if 90% or more
  const locationsWithCapacity = await Promise.all(
    locations.map(async (loc) => {
      try {
        // Check if location has capacity via Pterodactyl API
        const nodes = await pterodactyl.getNodes() as any[];
        const locationNodes = nodes.filter((n: any) => n.attributes.location_id === loc.pterodactylId);
        
        // Calculate overall capacity for the location
        let totalMemory = 0;
        let allocatedMemory = 0;
        
        locationNodes.forEach((node: any) => {
          totalMemory += node.attributes.memory || 0;
          allocatedMemory += node.attributes.allocated_resources?.memory || 0;
        });
        
        const capacityPercent = totalMemory > 0 ? (allocatedMemory / totalMemory) * 100 : 0;
        const isFull = capacityPercent >= 90;
        
        return {
          ...loc,
          isFull,
          capacityPercent: Math.round(capacityPercent),
        };
      } catch (error) {
        // If error checking capacity, include location without full flag
        return { ...loc, isFull: false, capacityPercent: 0 };
      }
    })
  );

  res.json({ locations: locationsWithCapacity });
}));

// GET /api/store/eggs - List available eggs
router.get('/eggs', asyncHandler(async (req, res) => {
  const eggs = await prisma.egg.findMany({
    where: { enabled: true },
    orderBy: { displayName: 'asc' },
  });

  res.json({ eggs });
}));

// GET /api/store/eggs/:id/variables - Get egg variables from Pterodactyl
router.get('/eggs/:id/variables', asyncHandler(async (req, res) => {
  const egg = await prisma.egg.findUnique({
    where: { id: req.params.id },
  });

  if (!egg) {
    throw createError('Egg not found', 404);
  }

  try {
    // Get egg details with variables from Pterodactyl
    const pteroEgg = await pterodactyl.getEgg(egg.nestId, egg.pterodactylId) as {
      attributes: {
        relationships?: {
          variables?: {
            data: Array<{
              attributes: {
                name: string;
                description: string;
                env_variable: string;
                default_value: string;
                user_viewable: boolean;
                user_editable: boolean;
                rules: string;
              };
            }>;
          };
        };
      };
    };

    // Filter to only user-editable variables
    const variables = pteroEgg.attributes?.relationships?.variables?.data
      ?.filter(v => v.attributes.user_viewable)
      ?.map(v => ({
        name: v.attributes.name,
        description: v.attributes.description,
        envVariable: v.attributes.env_variable,
        defaultValue: v.attributes.default_value,
        userEditable: v.attributes.user_editable,
        rules: v.attributes.rules,
      })) || [];

    res.json({ variables });
  } catch (error) {
    console.error('Failed to get egg variables:', error);
    res.json({ variables: [] }); // Return empty if can't get from Pterodactyl
  }
}));

export default router;
