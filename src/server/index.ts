import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { prisma, initializeDatabase } from './lib/database';
import { errorHandler, notFound } from './middleware/error';
import { startBillingService, stopBillingService } from './lib/billing';

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

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for correct IP detection
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: true, // Allow all origins, we'll validate via settings
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// API Routes
app.use('/api/setup', setupRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/pterodactyl', pterodactylRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/earn', earnRoutes);

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
  await prisma.$disconnect();
  process.exit(0);
});

start();
