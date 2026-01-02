import { prisma } from './database';

interface PteroRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: object;
}

async function getCredentials() {
  const settings = await prisma.settings.findFirst();
  if (!settings?.pterodactylUrl || !settings?.pterodactylApiKey) {
    throw new Error('Pterodactyl not configured');
  }
  return {
    url: settings.pterodactylUrl.replace(/\/+$/, ''),
    key: settings.pterodactylApiKey,
  };
}

async function pteroRequest(endpoint: string, options: PteroRequestOptions = {}) {
  const { method = 'GET', body } = options;
  const { url, key } = await getCredentials();

  const response = await fetch(`${url}/api/application${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${key}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Pterodactyl API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// User management
export async function createPteroUser(email: string, username: string) {
  return pteroRequest('/users', {
    method: 'POST',
    body: {
      email,
      username,
      first_name: username,
      last_name: 'User',
      password: generatePassword(),
    },
  });
}

export async function getPteroUser(userId: number) {
  return pteroRequest(`/users/${userId}`);
}

export async function deletePteroUser(userId: number) {
  return pteroRequest(`/users/${userId}`, { method: 'DELETE' });
}

// Server management
export async function createPteroServer(options: {
  name: string;
  userId: number;
  eggId: number;
  nestId: number;
  locationId: number;
  ram: number;
  disk: number;
  cpu: number;
  databases: number;
  backups: number;
  allocations: number;
  dockerImage: string;
  startup: string;
  environment: Record<string, string>;
}) {
  return pteroRequest('/servers', {
    method: 'POST',
    body: {
      name: options.name,
      user: options.userId,
      nest: options.nestId,
      egg: options.eggId,
      docker_image: options.dockerImage,
      startup: options.startup,
      environment: options.environment,
      limits: {
        memory: options.ram,
        swap: 0,
        disk: options.disk,
        io: 500,
        cpu: options.cpu,
      },
      feature_limits: {
        databases: options.databases,
        backups: options.backups,
        allocations: options.allocations,
      },
      deploy: {
        locations: [options.locationId],
        dedicated_ip: false,
        port_range: [],
      },
    },
  });
}

export async function getPteroServer(serverId: number) {
  return pteroRequest(`/servers/${serverId}`);
}

export async function deletePteroServer(serverId: number) {
  return pteroRequest(`/servers/${serverId}`, { method: 'DELETE' });
}

export async function suspendPteroServer(serverId: number) {
  return pteroRequest(`/servers/${serverId}/suspend`, { method: 'POST' });
}

export async function unsuspendPteroServer(serverId: number) {
  return pteroRequest(`/servers/${serverId}/unsuspend`, { method: 'POST' });
}

// Location management
export async function getLocations() {
  return pteroRequest('/locations');
}

export async function getNodes() {
  return pteroRequest('/nodes');
}

// Get nodes with their usage info
export async function getNodesWithUsage(): Promise<Array<{
  id: number;
  name: string;
  locationId: number;
  memory: number;
  memoryOverallocate: number;
  disk: number;
  diskOverallocate: number;
  usedMemory: number;
  usedDisk: number;
  availableMemory: number;
  availableDisk: number;
}>> {
  const response = await pteroRequest('/nodes?include=servers') as {
    data: Array<{
      attributes: {
        id: number;
        name: string;
        location_id: number;
        memory: number;
        memory_overallocate: number;
        disk: number;
        disk_overallocate: number;
        allocated_resources: {
          memory: number;
          disk: number;
        };
      };
    }>;
  };
  
  return response.data.map(node => {
    const attrs = node.attributes;
    const maxMemory = attrs.memory * (1 + attrs.memory_overallocate / 100);
    const maxDisk = attrs.disk * (1 + attrs.disk_overallocate / 100);
    const usedMemory = attrs.allocated_resources?.memory || 0;
    const usedDisk = attrs.allocated_resources?.disk || 0;
    
    return {
      id: attrs.id,
      name: attrs.name,
      locationId: attrs.location_id,
      memory: attrs.memory,
      memoryOverallocate: attrs.memory_overallocate,
      disk: attrs.disk,
      diskOverallocate: attrs.disk_overallocate,
      usedMemory,
      usedDisk,
      availableMemory: maxMemory - usedMemory,
      availableDisk: maxDisk - usedDisk,
    };
  });
}

// Find best node for deployment based on location and required resources
export async function findBestNode(locationId: number, requiredRam: number, requiredDisk: number): Promise<number | null> {
  const nodes = await getNodesWithUsage();
  
  // Filter nodes by location and available capacity
  const availableNodes = nodes.filter(node => 
    node.locationId === locationId &&
    node.availableMemory >= requiredRam &&
    node.availableDisk >= requiredDisk
  );
  
  if (availableNodes.length === 0) {
    return null;
  }
  
  // Return the node with most available memory (simple load balancing)
  availableNodes.sort((a, b) => b.availableMemory - a.availableMemory);
  return availableNodes[0].id;
}

// Nest/Egg management
export async function getNests() {
  return pteroRequest('/nests');
}

export async function getEggs(nestId: number) {
  return pteroRequest(`/nests/${nestId}/eggs`);
}

export async function getEgg(nestId: number, eggId: number) {
  return pteroRequest(`/nests/${nestId}/eggs/${eggId}?include=variables`);
}

// Find user by email
export async function findPteroUserByEmail(email: string): Promise<{ id: number; username: string } | null> {
  try {
    const response = await pteroRequest(`/users?filter[email]=${encodeURIComponent(email)}`) as {
      data: Array<{ attributes: { id: number; username: string } }>;
    };
    if (response.data && response.data.length > 0) {
      return {
        id: response.data[0].attributes.id,
        username: response.data[0].attributes.username,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Update user password
export async function updatePteroUserPassword(userId: number, password: string) {
  return pteroRequest(`/users/${userId}`, {
    method: 'PATCH',
    body: { password },
  });
}

// Get all users (for username conflict check)
export async function getAllPteroUsers(): Promise<Array<{ username: string }>> {
  try {
    const response = await pteroRequest('/users?per_page=1000') as {
      data: Array<{ attributes: { username: string } }>;
    };
    return response.data.map((u) => ({
      username: u.attributes.username,
    }));
  } catch {
    return [];
  }
}

// Generate unique username
export async function generateUniqueUsername(baseUsername: string): Promise<string> {
  const users = await getAllPteroUsers();
  const existingUsernames = new Set(users.map(u => u.username.toLowerCase()));
  
  // Clean username (only alphanumeric and underscore)
  let cleanUsername = baseUsername.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 20);
  if (cleanUsername.length < 3) {
    cleanUsername = 'user';
  }
  
  if (!existingUsernames.has(cleanUsername.toLowerCase())) {
    return cleanUsername;
  }
  
  // Add numbers until unique
  let counter = 1;
  while (existingUsernames.has(`${cleanUsername}${counter}`.toLowerCase())) {
    counter++;
  }
  return `${cleanUsername}${counter}`;
}

// Create user with generated password (returns password)
export async function createPteroUserWithPassword(email: string, username: string): Promise<{ userId: number; password: string }> {
  const password = generatePassword(16);
  const uniqueUsername = await generateUniqueUsername(username);
  
  const response = await pteroRequest('/users', {
    method: 'POST',
    body: {
      email,
      username: uniqueUsername,
      first_name: uniqueUsername,
      last_name: 'User',
      password,
    },
  }) as { attributes: { id: number } };
  
  return {
    userId: response.attributes.id,
    password,
  };
}

// Helper functions
export function generatePassword(length = 16): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
