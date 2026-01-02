import { Client, GatewayIntentBits, Presence } from 'discord.js';
import { prisma } from './database';

let client: Client | null = null;
let checkInterval: NodeJS.Timeout | null = null;
let isInitialized = false;

// Minimum time between status checks per user (prevent spamming Discord API)
const MIN_CHECK_INTERVAL_MS = 5000;

export interface StatusCheckResult {
  online: boolean;
  inGuild: boolean;
  hasStatus: boolean;
  statusText?: string;
}

/**
 * Initialize Discord bot with token
 */
export async function initializeBot(): Promise<boolean> {
  try {
    const settings = await prisma.settings.findFirst();
    
    if (!settings?.discordBotToken || !settings?.discordGuildId) {
      console.log('[Discord Bot] Bot token or guild ID not configured');
      return false;
    }

    if (isInitialized && client) {
      console.log('[Discord Bot] Already initialized');
      return true;
    }

    // Create client with necessary intents
    client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
      ],
    });

    // Handle ready event
    client.once('ready', () => {
      console.log(`[Discord Bot] Logged in as ${client?.user?.tag}`);
      isInitialized = true;
    });

    // Handle errors
    client.on('error', (error) => {
      console.error('[Discord Bot] Client error:', error);
    });

    // Login
    await client.login(settings.discordBotToken);
    
    // Start the status checking loop
    startStatusCheckLoop();
    
    return true;
  } catch (error) {
    console.error('[Discord Bot] Failed to initialize:', error);
    return false;
  }
}

/**
 * Shutdown Discord bot
 */
export async function shutdownBot(): Promise<void> {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
  
  if (client) {
    client.destroy();
    client = null;
    isInitialized = false;
  }
  
  console.log('[Discord Bot] Shut down');
}

/**
 * Check if a user has the required status text
 */
export async function checkUserStatus(discordId: string): Promise<StatusCheckResult> {
  const result: StatusCheckResult = {
    online: false,
    inGuild: false,
    hasStatus: false,
  };

  try {
    if (!client || !isInitialized) {
      throw new Error('Bot not initialized');
    }

    const settings = await prisma.settings.findFirst();
    if (!settings?.discordGuildId || !settings?.statusEarnText) {
      throw new Error('Status earn not configured');
    }

    // Get the guild
    const guild = client.guilds.cache.get(settings.discordGuildId);
    if (!guild) {
      throw new Error('Guild not found');
    }

    // Fetch the member (this refreshes their presence)
    const member = await guild.members.fetch(discordId).catch(() => null);
    if (!member) {
      return result; // User not in guild
    }

    result.inGuild = true;

    // Check presence
    const presence = member.presence;
    if (!presence || presence.status === 'offline' || presence.status === 'invisible') {
      return result; // User is offline
    }

    result.online = true;

    // Check custom status
    const customStatus = presence.activities.find(
      (activity) => activity.type === 4 // Custom Status type
    );

    if (customStatus?.state) {
      result.statusText = customStatus.state;
      // Case-insensitive check for the required text
      if (customStatus.state.toLowerCase().includes(settings.statusEarnText.toLowerCase())) {
        result.hasStatus = true;
      }
    }

    return result;
  } catch (error) {
    console.error(`[Discord Bot] Error checking status for ${discordId}:`, error);
    return result;
  }
}

/**
 * Start the loop that checks active status earners
 */
function startStatusCheckLoop(): void {
  if (checkInterval) {
    clearInterval(checkInterval);
  }

  // Check every 5 seconds
  checkInterval = setInterval(async () => {
    try {
      await processStatusEarners();
    } catch (error) {
      console.error('[Discord Bot] Error in status check loop:', error);
    }
  }, MIN_CHECK_INTERVAL_MS);

  console.log('[Discord Bot] Status check loop started');
}

/**
 * Process all active status earners
 */
async function processStatusEarners(): Promise<void> {
  if (!client || !isInitialized) {
    return;
  }

  const settings = await prisma.settings.findFirst();
  if (!settings?.statusEarnEnabled || !settings?.statusEarnText) {
    return;
  }

  // Get all enabled status earners
  const earners = await prisma.statusEarn.findMany({
    where: { enabled: true },
    include: { user: { select: { id: true, discordId: true, banned: true } } },
  });

  const now = new Date();
  const intervalMs = (settings.statusEarnInterval || 300) * 1000;

  for (const earner of earners) {
    try {
      // Skip banned users
      if (earner.user.banned) {
        continue;
      }

      // Check their status
      const status = await checkUserStatus(earner.user.discordId);

      if (status.online && status.inGuild && status.hasStatus) {
        // User has valid status, add to consecutive time
        const newConsecutive = earner.consecutiveSec + Math.floor(MIN_CHECK_INTERVAL_MS / 1000);
        
        // Check if they should be rewarded
        const shouldReward = earner.lastRewarded 
          ? (now.getTime() - earner.lastRewarded.getTime() >= intervalMs)
          : true;

        if (shouldReward) {
          // Award coins
          await prisma.$transaction([
            prisma.user.update({
              where: { id: earner.userId },
              data: { coins: { increment: settings.statusEarnCoins } },
            }),
            prisma.statusEarn.update({
              where: { id: earner.id },
              data: {
                lastChecked: now,
                lastRewarded: now,
                consecutiveSec: newConsecutive,
              },
            }),
            prisma.transaction.create({
              data: {
                userId: earner.userId,
                type: 'EARN',
                amount: settings.statusEarnCoins,
                description: 'Discord status earning',
              },
            }),
          ]);
        } else {
          // Just update consecutive time
          await prisma.statusEarn.update({
            where: { id: earner.id },
            data: {
              lastChecked: now,
              consecutiveSec: newConsecutive,
            },
          });
        }
      } else {
        // Status not valid, reset consecutive time
        await prisma.statusEarn.update({
          where: { id: earner.id },
          data: {
            lastChecked: now,
            consecutiveSec: 0,
          },
        });
      }
    } catch (error) {
      console.error(`[Discord Bot] Error processing earner ${earner.userId}:`, error);
    }
  }
}

/**
 * Manually trigger a status check for a user (when they click "Start Earning")
 */
export async function activateStatusEarning(userId: string): Promise<{ 
  success: boolean; 
  error?: string;
  status?: StatusCheckResult;
}> {
  try {
    if (!client || !isInitialized) {
      // Try to initialize
      const initialized = await initializeBot();
      if (!initialized) {
        return { success: false, error: 'Discord bot is not configured' };
      }
    }

    const settings = await prisma.settings.findFirst();
    if (!settings?.statusEarnEnabled) {
      return { success: false, error: 'Status earning is disabled' };
    }

    if (!settings?.statusEarnText) {
      return { success: false, error: 'Status text not configured' };
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { discordId: true, banned: true },
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (user.banned) {
      return { success: false, error: 'Banned users cannot earn' };
    }

    // Check their current status
    const status = await checkUserStatus(user.discordId);

    if (!status.inGuild) {
      return { 
        success: false, 
        error: 'You must be in our Discord server to earn',
        status,
      };
    }

    if (!status.online) {
      return { 
        success: false, 
        error: 'You must be online on Discord to earn',
        status,
      };
    }

    if (!status.hasStatus) {
      return { 
        success: false, 
        error: `Your Discord status must contain "${settings.statusEarnText}"`,
        status,
      };
    }

    // Create or update status earn entry
    await prisma.statusEarn.upsert({
      where: { userId },
      create: {
        userId,
        enabled: true,
        lastChecked: new Date(),
        consecutiveSec: 0,
      },
      update: {
        enabled: true,
        lastChecked: new Date(),
        consecutiveSec: 0,
      },
    });

    return { 
      success: true,
      status,
    };
  } catch (error) {
    console.error('[Discord Bot] Error activating status earning:', error);
    return { success: false, error: 'Failed to activate status earning' };
  }
}

/**
 * Deactivate status earning for a user
 */
export async function deactivateStatusEarning(userId: string): Promise<void> {
  await prisma.statusEarn.updateMany({
    where: { userId },
    data: { enabled: false },
  });
}

/**
 * Get status earning info for a user
 */
export async function getStatusEarnInfo(userId: string): Promise<{
  active: boolean;
  lastRewarded?: Date;
  consecutiveSec: number;
} | null> {
  const earner = await prisma.statusEarn.findUnique({
    where: { userId },
  });

  if (!earner) {
    return null;
  }

  return {
    active: earner.enabled,
    lastRewarded: earner.lastRewarded || undefined,
    consecutiveSec: earner.consecutiveSec,
  };
}

/**
 * Check if bot is connected and operational
 */
export function isBotReady(): boolean {
  return isInitialized && client !== null && client.isReady();
}
