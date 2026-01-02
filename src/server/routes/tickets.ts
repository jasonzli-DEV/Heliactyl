import { Router } from 'express';
import { prisma } from '../lib/database';
import { asyncHandler } from '../middleware/error';
import type { AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/tickets - Get all tickets for current user
router.get('/', asyncHandler(async (req: AuthRequest, res) => {
  const tickets = await prisma.ticket.findMany({
    where: { userId: req.user!.id },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
      _count: {
        select: { messages: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ tickets });
}));

// GET /api/tickets/:id - Get single ticket with messages
router.get('/:id', asyncHandler(async (req: AuthRequest, res) => {
  const ticket = await prisma.ticket.findFirst({
    where: {
      id: req.params.id,
      userId: req.user!.id,
    },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
      user: {
        select: {
          username: true,
          avatar: true,
        },
      },
    },
  });

  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  res.json({ ticket });
}));

// POST /api/tickets - Create new ticket
router.post('/', asyncHandler(async (req: AuthRequest, res) => {
  const { subject, message, priority = 'normal' } = req.body;

  if (!subject || !message) {
    return res.status(400).json({ error: 'Subject and message are required' });
  }

  const ticket = await prisma.ticket.create({
    data: {
      userId: req.user!.id,
      subject,
      priority,
      messages: {
        create: {
          userId: req.user!.id,
          message,
          isStaff: false,
        },
      },
    },
    include: {
      messages: true,
    },
  });

  res.status(201).json({ ticket });
}));

// POST /api/tickets/:id/messages - Add message to ticket
router.post('/:id/messages', asyncHandler(async (req: AuthRequest, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Verify ticket ownership
  const ticket = await prisma.ticket.findFirst({
    where: {
      id: req.params.id,
      userId: req.user!.id,
    },
  });

  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  if (ticket.status === 'closed') {
    return res.status(400).json({ error: 'Cannot reply to closed ticket' });
  }

  const ticketMessage = await prisma.ticketMessage.create({
    data: {
      ticketId: req.params.id,
      userId: req.user!.id,
      message,
      isStaff: false,
    },
  });

  // Update ticket updatedAt
  await prisma.ticket.update({
    where: { id: req.params.id },
    data: { updatedAt: new Date() },
  });

  res.status(201).json({ message: ticketMessage });
}));

// PATCH /api/tickets/:id/close - Close ticket
router.patch('/:id/close', asyncHandler(async (req: AuthRequest, res) => {
  const ticket = await prisma.ticket.findFirst({
    where: {
      id: req.params.id,
      userId: req.user!.id,
    },
  });

  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  if (ticket.status === 'closed') {
    return res.status(400).json({ error: 'Ticket is already closed' });
  }

  await prisma.ticket.update({
    where: { id: req.params.id },
    data: {
      status: 'closed',
      closedAt: new Date(),
    },
  });

  res.json({ success: true });
}));

export default router;
