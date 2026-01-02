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
  }

  console.log('✓ Database initialized');
}
