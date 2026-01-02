import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin, type AuthRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/error';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const router = Router();

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Allowed MIME types for images
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/x-icon', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// POST /api/upload - Upload a file (admin only)
router.post('/', requireAuth, requireAdmin, asyncHandler(async (_req: AuthRequest, _res: Response) => {
  // For simplicity, we use base64 encoding from the frontend
  throw createError('Use /api/upload/base64 endpoint for file uploads', 400);
}));

// POST /api/upload/base64 - Upload a file as base64 (admin only)
router.post('/base64', requireAuth, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { data, filename, type } = req.body;
  
  if (!data || !filename || !type) {
    throw createError('Missing required fields: data, filename, type', 400);
  }
  
  // Validate MIME type
  if (!ALLOWED_TYPES.includes(type)) {
    throw createError(`Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}`, 400);
  }
  
  // Validate base64 data
  const base64Match = data.match(/^data:([^;]+);base64,(.+)$/);
  if (!base64Match) {
    throw createError('Invalid base64 data format', 400);
  }
  
  const mimeType = base64Match[1];
  const base64Data = base64Match[2];
  
  if (!ALLOWED_TYPES.includes(mimeType)) {
    throw createError(`Invalid MIME type in data. Allowed: ${ALLOWED_TYPES.join(', ')}`, 400);
  }
  
  // Decode and validate size
  const buffer = Buffer.from(base64Data, 'base64');
  if (buffer.length > MAX_SIZE) {
    throw createError(`File too large. Maximum size: ${MAX_SIZE / 1024 / 1024}MB`, 400);
  }
  
  // Generate unique filename
  const ext = getExtensionFromMime(mimeType);
  const uniqueId = crypto.randomBytes(8).toString('hex');
  const safeFilename = `${uniqueId}${ext}`;
  const filePath = path.join(uploadsDir, safeFilename);
  
  // Save file
  fs.writeFileSync(filePath, buffer);
  
  // Return URL
  const url = `/uploads/${safeFilename}`;
  
  res.json({ 
    success: true, 
    url,
    filename: safeFilename,
  });
}));

// GET /api/upload/:filename - Get uploaded file info
router.get('/:filename', asyncHandler(async (req: Request, res: Response) => {
  const { filename } = req.params;
  const filePath = path.join(uploadsDir, filename);
  
  // Sanitize filename to prevent directory traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw createError('Invalid filename', 400);
  }
  
  if (!fs.existsSync(filePath)) {
    throw createError('File not found', 404);
  }
  
  const stats = fs.statSync(filePath);
  res.json({
    filename,
    size: stats.size,
    created: stats.birthtime,
  });
}));

// DELETE /api/upload/:filename - Delete uploaded file (admin only)
router.delete('/:filename', requireAuth, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { filename } = req.params;
  const filePath = path.join(uploadsDir, filename);
  
  // Sanitize filename to prevent directory traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw createError('Invalid filename', 400);
  }
  
  if (!fs.existsSync(filePath)) {
    throw createError('File not found', 404);
  }
  
  fs.unlinkSync(filePath);
  
  res.json({ success: true });
}));

function getExtensionFromMime(mimeType: string): string {
  const extensions: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
    'image/x-icon': '.ico',
    'image/webp': '.webp',
  };
  return extensions[mimeType] || '.bin';
}

export default router;
