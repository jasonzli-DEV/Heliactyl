import { Router } from 'express';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import path from 'path';
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

// POST /api/system/update - Execute update.sh script
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
    // Execute the update script safely - use absolute resolved path
    const projectRoot = path.resolve(process.cwd());
    const updateScript = path.join(projectRoot, 'update.sh');
    
    // SECURITY: Verify the script is within project directory and exists
    if (!updateScript.startsWith(projectRoot) || !existsSync(updateScript)) {
      throw new Error('Update script not found or invalid path.');
    }

    // Start update in background using spawn (safer than exec with shell)
    const updateProcess = spawn('bash', [updateScript], {
      cwd: projectRoot,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    
    updateProcess.unref(); // Allow parent to exit independently
    
    updateProcess.on('error', (err) => {
      console.error('Update script error:', err);
    });

    // Log update started (completion will be logged by script)
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'SYSTEM_UPDATE_INITIATED',
        details: JSON.stringify({ message: 'Update script started' }),
        ipAddress: req.ip || 'unknown',
      },
    });

    res.json({
      success: true,
      message: 'Update started! Server will restart automatically in ~60 seconds. Please refresh after restart.',
      restartRequired: true,
    });

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
