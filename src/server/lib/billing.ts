import { prisma } from './database';
import * as pterodactyl from './pterodactyl';

interface BillingRates {
  ramRate: number;      // Credits per hour per 1024MB RAM
  cpuRate: number;      // Credits per hour per 50% CPU
  diskRate: number;     // Credits per hour per 5120MB disk
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
  // RAM: 1 credit per 1GB (1024MB)
  const ramCost = (ram / 1024) * rates.ramRate;
  
  // CPU: 1 credit per 50%
  const cpuCost = (cpu / 50) * rates.cpuRate;
  
  // Disk: 1 credit per 5GB (5120MB)
  const diskCost = (disk / 5120) * rates.diskRate;
  
  // Features
  const databaseCost = databases * rates.databaseRate;
  const allocationCost = allocations * rates.allocationRate;
  const backupCost = backups * rates.backupRate;
  
  return ramCost + cpuCost + diskCost + databaseCost + allocationCost + backupCost;
}

// Process billing for all servers
export async function processBilling() {
  const settings = await prisma.settings.findFirst();
  
  if (!settings?.billingEnabled) {
    console.log('[Billing] Billing is disabled');
    return;
  }
  
  const rates: BillingRates = {
    ramRate: settings.billingRamRate || 1,
    cpuRate: settings.billingCpuRate || 1,
    diskRate: settings.billingDiskRate || 1,
    databaseRate: settings.billingDatabaseRate || 1,
    allocationRate: settings.billingAllocationRate || 1,
    backupRate: settings.billingBackupRate || 1,
    gracePeriod: settings.billingGracePeriod || 24,
  };
  
  const now = new Date();
  
  // Get all non-suspended servers
  const servers = await prisma.server.findMany({
    where: { suspended: false },
    include: { user: true },
  });
  
  console.log(`[Billing] Processing ${servers.length} servers`);
  
  for (const server of servers) {
    try {
      // Calculate hours since last billing
      const lastBilled = new Date(server.lastBilledAt);
      const hoursSinceLastBill = Math.floor((now.getTime() - lastBilled.getTime()) / (1000 * 60 * 60));
      
      if (hoursSinceLastBill < 1) {
        continue; // Less than 1 hour since last bill
      }
      
      // Calculate cost for this billing period
      const hourlyCost = calculateHourlyCost(
        server.ram,
        server.cpu,
        server.disk,
        server.databases,
        server.allocations,
        server.backups,
        rates
      );
      
      const totalCost = Math.ceil(hourlyCost * hoursSinceLastBill);
      
      // Check if user has enough coins
      if (server.user.coins >= totalCost) {
        // Deduct coins and update last billed time
        await prisma.$transaction([
          prisma.user.update({
            where: { id: server.userId },
            data: { coins: { decrement: totalCost } },
          }),
          prisma.server.update({
            where: { id: server.id },
            data: { 
              lastBilledAt: now,
              billingBalance: 0,
            },
          }),
          prisma.transaction.create({
            data: {
              userId: server.userId,
              type: 'BILLING',
              amount: -totalCost,
              description: `Hourly billing for server "${server.name}" (${hoursSinceLastBill}h)`,
            },
          }),
        ]);
        
        console.log(`[Billing] Charged ${totalCost} coins from user ${server.userId} for server ${server.name}`);
      } else {
        // User doesn't have enough coins - accumulate balance
        const newBalance = server.billingBalance + totalCost;
        const hoursInDebt = Math.ceil(newBalance / hourlyCost);
        
        await prisma.server.update({
          where: { id: server.id },
          data: {
            lastBilledAt: now,
            billingBalance: newBalance,
          },
        });
        
        console.log(`[Billing] User ${server.userId} cannot afford ${totalCost} coins. Balance: ${newBalance}, Hours in debt: ${hoursInDebt}`);
        
        // Suspend if over grace period
        if (hoursInDebt >= rates.gracePeriod) {
          console.log(`[Billing] Suspending server ${server.name} - exceeded grace period`);
          
          try {
            await pterodactyl.suspendPteroServer(server.pterodactylId);
            await prisma.server.update({
              where: { id: server.id },
              data: { suspended: true },
            });
          } catch (err) {
            console.error(`[Billing] Failed to suspend server ${server.pterodactylId}:`, err);
          }
        }
      }
    } catch (err) {
      console.error(`[Billing] Error processing server ${server.id}:`, err);
    }
  }
  
  console.log('[Billing] Processing complete');
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
