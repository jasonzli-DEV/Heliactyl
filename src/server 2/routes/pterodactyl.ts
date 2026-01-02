import { Router } from 'express';
import { requireAuth, requireAdmin, type AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import * as pterodactyl from '../lib/pterodactyl';

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);

// GET /api/pterodactyl/locations - Get locations from Pterodactyl
router.get('/locations', asyncHandler(async (req: AuthRequest, res) => {
  const locations = await pterodactyl.getLocations();
  res.json(locations);
}));

// GET /api/pterodactyl/nodes - Get nodes from Pterodactyl
router.get('/nodes', asyncHandler(async (req: AuthRequest, res) => {
  const nodes = await pterodactyl.getNodes();
  res.json(nodes);
}));

// GET /api/pterodactyl/nests - Get nests from Pterodactyl
router.get('/nests', asyncHandler(async (req: AuthRequest, res) => {
  const nests = await pterodactyl.getNests();
  res.json(nests);
}));

// GET /api/pterodactyl/nests/:id/eggs - Get eggs for a nest
router.get('/nests/:id/eggs', asyncHandler(async (req: AuthRequest, res) => {
  const eggs = await pterodactyl.getEggs(parseInt(req.params.id));
  res.json(eggs);
}));

export default router;
