import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { prisma, initializeDatabase } from './lib/database';
import { errorHandler, notFound } from './middleware/error';
import { startBillingService, stopBillingService } from './lib/billing';
import { initializeBot, shutdownBot } from './lib/discordBot';

// Routes
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import serverRoutes from './routes/servers';
import storeRoutes from './routes/store';
import adminRoutes from './routes/admin';
import settingsRoutes from './routes/settings';
import pterodactylRoutes from './routes/pterodactyl';
import setupRoutes from './routes/setup';
import systemRoutes from './routes/system';
import earnRoutes from './routes/earn';
import ticketsRoutes from './routes/tickets';
import uploadRoutes from './routes/upload';
import banAppealRoutes from './routes/ban-appeal';
import statusEarnRoutes from './routes/status-earn';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for correct IP detection
app.set('trust proxy', 1);

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 auth attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

// Middleware
app.use(cors({
  origin: async (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    
    try {
      const settings = await prisma.settings.findFirst();
      const siteUrl = settings?.siteUrl;
      
      // Allow if siteUrl matches or is localhost for development
      if (siteUrl && origin === siteUrl) {
        return callback(null, true);
      }
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
      // Block other origins
      callback(new Error('CORS not allowed'), false);
    } catch {
      // If DB error, allow (setup might not be complete)
      callback(null, true);
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use('/api', apiLimiter);

// Global maintenance mode middleware - blocks all API requests except setup/auth
app.use('/api', async (req, res, next) => {
  // Allow setup and auth routes (so admins can login during maintenance)
  if (req.path.startsWith('/setup') || req.path.startsWith('/auth') || req.path.startsWith('/settings')) {
    return next();
  }
  
  try {
    const settings = await prisma.settings.findFirst();
    if (settings?.maintenanceMode) {
      // Check if user is admin
      const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, settings.jwtSecret) as { isAdmin?: boolean };
          if (decoded.isAdmin) {
            return next(); // Allow admin
          }
        } catch {
          // Invalid token, block
        }
      }
      
      return res.status(503).json({ 
        error: 'Maintenance mode',
        message: settings.maintenanceMessage || 'The panel is currently undergoing maintenance. Please try again later.'
      });
    }
  } catch {
    // If DB error, allow (setup might not be complete)
  }
  next();
});

// API Routes
app.use('/api/setup', setupRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/pterodactyl', pterodactylRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/earn', earnRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/ban-appeal', banAppealRoutes);
app.use('/api/status-earn', statusEarnRoutes);

// Serve uploaded files
const uploadsPath = path.join(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsPath));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../../dist/client');
  app.use(express.static(clientPath));
  
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return notFound(req, res, () => {});
    }
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server
async function start() {
  try {
    await initializeDatabase();
    
    // Start billing service
    startBillingService();
    
    // Initialize Discord bot (if configured)
    initializeBot().catch((err) => {
      console.log('[Discord Bot] Failed to initialize on startup:', err.message);
    });
    
    app.listen(PORT, () => {
      console.log(`🚀 EnderBit Dashboard running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  stopBillingService();
  await shutdownBot();
  await prisma.$disconnect();
  process.exit(0);
});

start();
