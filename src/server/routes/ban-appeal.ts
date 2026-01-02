import { Router } from 'express';
import { prisma } from '../lib/database';
import { optionalAuth, type AuthRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/error';

const router = Router();

// POST /api/ban-appeal - Submit a ban appeal (creates a ticket)
router.post('/', optionalAuth, asyncHandler(async (req: AuthRequest, res) => {
  if (!req.user) {
    throw createError('Authentication required', 401);
  }

  const { message } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    throw createError('Appeal message is required', 400);
  }

  // Check if user is actually banned
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
  });

  if (!user?.banned) {
    throw createError('You are not banned', 400);
  }

  // Check if there's already an open ban appeal
  const existingAppeal = await prisma.ticket.findFirst({
    where: {
      userId: req.user.id,
      type: 'ban-appeal',
      status: 'open',
    },
  });

  if (existingAppeal) {
    throw createError('You already have an open ban appeal', 400);
  }

  // Create ticket for ban appeal
  const ticket = await prisma.ticket.create({
    data: {
      userId: req.user.id,
      subject: `Ban Appeal - ${user.username}`,
      type: 'ban-appeal',
      priority: 'high',
      messages: {
        create: {
          userId: req.user.id,
          isStaff: false,
          message: `**Ban Reason:** ${user.banReason || 'No reason provided'}\n\n**Appeal:**\n${message.trim()}`,
        },
      },
    },
  });

  res.json({ success: true, ticketId: ticket.id });
}));

export default router;
