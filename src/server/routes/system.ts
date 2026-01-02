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
    // Get current commit
    const { stdout: currentCommit } = await execAsync('git rev-parse HEAD', {
      cwd: process.cwd(),
    });

    // Fetch latest from remote
    await execAsync('git fetch origin main', { cwd: process.cwd() });

    // Get remote commit
    const { stdout: remoteCommit } = await execAsync('git rev-parse origin/main', {
      cwd: process.cwd(),
    });

    // Get current branch
    const { stdout: branch } = await execAsync('git branch --show-current', {
      cwd: process.cwd(),
    });

    // Check if update available
    const updateAvailable = currentCommit.trim() !== remoteCommit.trim();

    // Get commit log if update available
    let changelog = '';
    if (updateAvailable) {
      const { stdout } = await execAsync(
        'git log HEAD..origin/main --pretty=format:"%h - %s (%cr)"',
        { cwd: process.cwd() }
      );
      changelog = stdout;
    }

    res.json({
      currentCommit: currentCommit.trim().substring(0, 7),
      remoteCommit: remoteCommit.trim().substring(0, 7),
      branch: branch.trim(),
      updateAvailable,
      changelog,
    });
  } catch (error: any) {
    // Git not initialized or other error
    res.json({
      currentCommit: 'unknown',
      remoteCommit: 'unknown',
      branch: 'unknown',
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

    // Step 3: Install dependencies
    const { stdout: npmOutput } = await execAsync('npm ci', {
      cwd: process.cwd(),
      timeout: 120000, // 2 minute timeout
    });
    steps.push('Installed dependencies');

    // Step 4: Generate Prisma client
    await execAsync('npx prisma generate', { cwd: process.cwd() });
    steps.push('Generated Prisma client');

    // Step 5: Run database migrations
    await execAsync('npx prisma db push', { cwd: process.cwd() });
    steps.push('Applied database migrations');

    // Step 6: Build application
    const { stdout: buildOutput } = await execAsync('npm run build', {
      cwd: process.cwd(),
      timeout: 180000, // 3 minute timeout
    });
    steps.push('Built application');

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
