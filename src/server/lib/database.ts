import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export async function initializeDatabase() {
  // Check if settings exist, if not create default
  const settings = await prisma.settings.findUnique({
    where: { id: 'main' },
  });

  if (!settings) {
    await prisma.settings.create({
      data: {
        id: 'main',
        siteName: 'EnderBit',
        allowNewUsers: true,
        storeEnabled: true,
        afkEnabled: true,
        afkCoinsPerMinute: 1,
        afkMaxMinutes: 60,
        afkInterval: 60,
        defaultCoins: 100,
        defaultRam: 1024,
        defaultDisk: 5120,
        defaultCpu: 100,
        defaultServers: 1,
        defaultDatabases: 1,
        defaultBackups: 1,
        defaultAllocations: 1,
        ramPrice: 10,
        diskPrice: 10,
        cpuPrice: 20,
        serverPrice: 100,
      },
    });
    console.log('✓ Created default settings');
  } else {
    // Migrate old billing defaults (1) to new sensible defaults
    // This fixes existing databases that had the old @default(1) values
    if (settings.billingRamRate === 1 && settings.billingCpuRate === 1 && settings.billingDiskRate === 1) {
      await prisma.settings.update({
        where: { id: 'main' },
        data: {
          billingRamRate: 1024,    // 1GB RAM = 1 coin/hr
          billingCpuRate: 100,     // 100% CPU = 1 coin/hr
          billingDiskRate: 5120,   // 5GB disk = 1 coin/hr
          billingDatabaseRate: 0,  // Not billed hourly
          billingAllocationRate: 0,
          billingBackupRate: 0,
        },
      });
      console.log('✓ Migrated billing rates to sensible defaults');
    }
  }

  console.log('✓ Database initialized');
}
