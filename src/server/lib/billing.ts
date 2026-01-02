import { prisma } from './database';
import * as pterodactyl from './pterodactyl';

interface BillingRates {
  ramRate: number;      // MB of RAM per credit/hour
  cpuRate: number;      // % CPU per credit/hour
  diskRate: number;     // MB of disk per credit/hour
  databaseRate: number; // Credits per hour per database
  allocationRate: number; // Credits per hour per allocation
  backupRate: number;   // Credits per hour per backup
  gracePeriod: number;  // Hours before suspension
}

// Calculate hourly cost for a server
export function calculateHourlyCost(
  ram: number,
  cpu: number,
  disk: number,
  databases: number,
  allocations: number,
  backups: number,
  rates: BillingRates
): number {
  // RAM: MB / (MB per credit) = credits needed
  const ramCost = ram / rates.ramRate;
  
  // CPU: % / (% per credit) = credits needed
  const cpuCost = cpu / rates.cpuRate;
  
  // Disk: MB / (MB per credit) = credits needed
  const diskCost = disk / rates.diskRate;
  
  // Databases, allocations, and backups are now permanent resources (not billed hourly)
  
  return ramCost + cpuCost + diskCost;
}

// Process billing for all servers (Prepaid System)
export async function processBilling() {
  const settings = await prisma.settings.findFirst();
  
  if (!settings?.billingEnabled) {
    console.log('[Billing] Billing is disabled');
    return;
  }
  
  const rates: BillingRates = {
    ramRate: settings.billingRamRate || 1024,
    cpuRate: settings.billingCpuRate || 100,
    diskRate: settings.billingDiskRate || 5120,
    databaseRate: settings.billingDatabaseRate || 0,
    allocationRate: settings.billingAllocationRate || 0,
    backupRate: settings.billingBackupRate || 0,
    gracePeriod: settings.billingGracePeriod || 24,
  };
  
  const now = new Date();
  
  // Get all non-paused, non-suspended servers with expired prepaid hours
  const servers = await prisma.server.findMany({
    where: { 
      suspended: false,
      paused: false,
      nextBillingAt: {
        lte: now, // Prepaid hour has expired
      },
    },
    include: { user: true },
  });
  
  console.log(`[Billing] Processing ${servers.length} servers with expired prepaid hours`);
  
  for (const server of servers) {
    try {
      // Calculate cost for next hour
      const hourlyCost = calculateHourlyCost(
        server.ram,
        server.cpu,
        server.disk,
        server.databases,
        server.allocations,
        server.backups,
        rates
      );
      
      const costForNextHour = Math.ceil(hourlyCost);
      
      // Check if user has enough coins for next hour
      if (server.user.coins >= costForNextHour) {
        // Charge user for next hour and extend nextBillingAt
        const nextBilling = new Date(now.getTime() + 60 * 60 * 1000); // +1 hour
        
        await prisma.$transaction([
          prisma.user.update({
            where: { id: server.userId },
            data: { coins: { decrement: costForNextHour } },
          }),
          prisma.server.update({
            where: { id: server.id },
            data: { 
              lastBilledAt: now,
              nextBillingAt: nextBilling,
              billingBalance: 0,
            },
          }),
          prisma.transaction.create({
            data: {
              userId: server.userId,
              type: 'BILLING',
              amount: -costForNextHour,
              description: `Prepaid billing for server "${server.name}" (1h)`,
            },
          }),
        ]);
        
        console.log(`[Billing] Charged ${costForNextHour} coins from user ${server.userId} for server ${server.name} - next billing at ${nextBilling.toISOString()}`);
      } else {
        // User can't afford next hour - pause server
        console.log(`[Billing] User ${server.userId} cannot afford ${costForNextHour} coins. Auto-pausing server ${server.name}`);
        
        try {
          await pterodactyl.suspendPteroServer(server.pterodactylId);
          await prisma.server.update({
            where: { id: server.id },
            data: { 
              paused: true,
              nextBillingAt: null, // Clear next billing time
              suspendedAt: now,
            },
          });
          
          // Create audit log
          await prisma.auditLog.create({
            data: {
              userId: server.userId,
              action: 'SERVER_AUTO_PAUSED',
              details: JSON.stringify({ 
                serverId: server.id, 
                serverName: server.name,
                reason: 'Insufficient balance',
                requiredCoins: costForNextHour,
                userBalance: server.user.coins,
              }),
              ipAddress: 'system',
            },
          });
        } catch (err) {
          console.error(`[Billing] Failed to pause server ${server.pterodactylId}:`, err);
        }
      }
    } catch (err) {
      console.error(`[Billing] Error processing server ${server.id}:`, err);
    }
  }
  
  console.log('[Billing] Processing complete');
}

// Charge user upfront for next hour (used when creating or unpausing server)
export async function chargeUpfrontForServer(
  userId: string, 
  serverId: string,
  ram: number,
  cpu: number,
  disk: number,
  databases: number,
  allocations: number,
  backups: number
): Promise<{ success: boolean; error?: string; nextBillingAt?: Date }> {
  const settings = await prisma.settings.findFirst();
  
  if (!settings?.billingEnabled) {
    // Billing disabled - allow without charge
    const nextBilling = new Date(Date.now() + 60 * 60 * 1000);
    return { success: true, nextBillingAt: nextBilling };
  }
  
  const rates: BillingRates = {
    ramRate: settings.billingRamRate || 1024,
    cpuRate: settings.billingCpuRate || 100,
    diskRate: settings.billingDiskRate || 5120,
    databaseRate: settings.billingDatabaseRate || 0,
    allocationRate: settings.billingAllocationRate || 0,
    backupRate: settings.billingBackupRate || 0,
    gracePeriod: settings.billingGracePeriod || 24,
  };
  
  const hourlyCost = calculateHourlyCost(ram, cpu, disk, databases, allocations, backups, rates);
  const costForNextHour = Math.ceil(hourlyCost);
  
  const user = await prisma.user.findUnique({ where: { id: userId } });
  
  if (!user) {
    return { success: false, error: 'User not found' };
  }
  
  if (user.coins < costForNextHour) {
    return { 
      success: false, 
      error: `Insufficient balance. Need ${costForNextHour} coins for next hour, you have ${user.coins} coins.` 
    };
  }
  
  // Charge user and set next billing time
  const now = new Date();
  const nextBilling = new Date(now.getTime() + 60 * 60 * 1000); // +1 hour
  
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { coins: { decrement: costForNextHour } },
    }),
    prisma.server.update({
      where: { id: serverId },
      data: { 
        lastBilledAt: now,
        nextBillingAt: nextBilling,
      },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: 'BILLING',
        amount: -costForNextHour,
        description: `Prepaid billing for server (1h upfront)`,
      },
    }),
  ]);
  
  return { success: true, nextBillingAt: nextBilling };
}

// Start billing interval (runs every hour)
let billingInterval: ReturnType<typeof setInterval> | null = null;

export function startBillingService() {
  if (billingInterval) {
    clearInterval(billingInterval);
  }
  
  console.log('[Billing] Starting billing service (1 hour interval)');
  
  // Run immediately on startup
  processBilling().catch(console.error);
  
  // Then run every hour
  billingInterval = setInterval(() => {
    processBilling().catch(console.error);
  }, 60 * 60 * 1000); // 1 hour
}

export function stopBillingService() {
  if (billingInterval) {
    clearInterval(billingInterval);
    billingInterval = null;
    console.log('[Billing] Billing service stopped');
  }
}
