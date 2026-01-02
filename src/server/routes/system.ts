import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { requireAuth, requireAdmin, type AuthRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/error';
import { prisma } from '../lib/database';

const execAsync = promisify(exec);
const router = Router();

// All routes require admin
router.use(requireAuth);
router.use(requireAdmin);

// GET /api/system/version - Get current version and check for updates
router.get('/version', asyncHandler(async (req: AuthRequest, res) => {
  try {
    // Get version from package.json
    let currentVersion = 'unknown';
    let packageJson: any = null;
    try {
      packageJson = require('../../../package.json');
      currentVersion = packageJson.version;
    } catch {
      currentVersion = 'unknown';
    }

    // Get current commit
    let currentCommit = currentVersion;
    let remoteCommit = currentVersion;
    let branch = 'main';
    
    try {
      const result1 = await execAsync('git rev-parse HEAD', { cwd: process.cwd() });
      currentCommit = result1.stdout.trim().substring(0, 7);
    } catch {
      // Use version
    }

    // Fetch latest from remote (ignore errors)
    try {
      await execAsync('git fetch origin main 2>/dev/null', { cwd: process.cwd() });
    } catch {
      // Remote fetch failed, continue anyway
    }

    // Get remote commit
    try {
      const result2 = await execAsync('git rev-parse origin/main', { cwd: process.cwd() });
      remoteCommit = result2.stdout.trim().substring(0, 7);
    } catch {
      remoteCommit = currentCommit; // Assume up to date if can't fetch
    }

    // Get current branch
    try {
      const result3 = await execAsync('git branch --show-current', { cwd: process.cwd() });
      branch = result3.stdout.trim() || 'main';
    } catch {
      // Use default
    }

    // Check if update available
    const updateAvailable = currentCommit !== remoteCommit;

    // Get commit log if update available
    let changelog = '';
    if (updateAvailable) {
      try {
        const { stdout } = await execAsync(
          'git log HEAD..origin/main --pretty=format:"%h - %s (%cr)"',
          { cwd: process.cwd() }
        );
        changelog = stdout;
      } catch {
        changelog = '';
      }
    }

    res.json({
      version: currentVersion,
      currentCommit,
      remoteCommit,
      branch,
      updateAvailable,
      changelog,
    });
  } catch (error: any) {
    // Git not initialized or other error - return sensible defaults
    res.json({
      version: 'unknown',
      currentCommit: 'unknown',
      remoteCommit: 'unknown',
      branch: 'main',
      updateAvailable: false,
      changelog: '',
      error: error.message,
    });
  }
}));

// POST /api/system/update - Pull latest from GitHub and rebuild
router.post('/update', asyncHandler(async (req: AuthRequest, res) => {
  // Log the update attempt
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'SYSTEM_UPDATE_STARTED',
      details: JSON.stringify({ initiatedBy: req.user!.username }),
      ipAddress: req.ip || 'unknown',
    },
  });

  try {
    const steps: string[] = [];

    // Step 1: Stash any local changes
    try {
      await execAsync('git stash', { cwd: process.cwd() });
      steps.push('Stashed local changes');
    } catch {
      steps.push('No local changes to stash');
    }

    // Step 2: Pull latest from GitHub
    const { stdout: pullOutput } = await execAsync('git pull origin main', {
      cwd: process.cwd(),
    });
    steps.push(`Pulled latest: ${pullOutput.trim()}`);

    // Step 3: Install dependencies (use npm install to preserve optional deps)
    const { stdout: npmOutput } = await execAsync('npm install --production=false', {
      cwd: process.cwd(),
      timeout: 120000, // 2 minute timeout
    });
    steps.push('Installed dependencies');

    // Step 4: Generate Prisma client
    await execAsync('npx prisma generate', { cwd: process.cwd() });
    steps.push('Generated Prisma client');

    // Step 5: Run database migrations
    await execAsync('npx prisma db push --accept-data-loss', { cwd: process.cwd() });
    steps.push('Applied database migrations');

    // Step 6: Build frontend (critical for UI changes)
    const { stdout: buildClientOutput } = await execAsync('npm run build:client', {
      cwd: process.cwd(),
      timeout: 180000, // 3 minute timeout
    });
    steps.push('Built frontend');

    // Step 7: Build backend
    const { stdout: buildServerOutput } = await execAsync('npm run build:server', {
      cwd: process.cwd(),
      timeout: 60000, // 1 minute timeout
    });
    steps.push('Built backend');

    // Log success
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'SYSTEM_UPDATE_COMPLETED',
        details: JSON.stringify({ steps }),
        ipAddress: req.ip || 'unknown',
      },
    });

    res.json({
      success: true,
      message: 'Update completed! The server will restart shortly.',
      steps,
      restartRequired: true,
    });

    // Restart the process after response is sent
    setTimeout(() => {
      process.exit(0); // systemd will restart the service
    }, 1000);

  } catch (error: any) {
    // Log failure
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'SYSTEM_UPDATE_FAILED',
        details: JSON.stringify({ error: error.message }),
        ipAddress: req.ip || 'unknown',
      },
    });

    throw createError(`Update failed: ${error.message}`, 500);
  }
}));

export default router;
