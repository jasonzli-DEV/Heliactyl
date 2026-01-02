import { useAuth } from '../context/AuthContext';
import { Server, Cpu, HardDrive, MemoryStick, Database, Archive, Network, Coins, Plus, ShoppingCart, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

interface Resources {
  available: {
    coins: number;
    ram: number;
    disk: number;
    cpu: number;
    servers: number;
    databases: number;
    backups: number;
    allocations: number;
  };
  used: {
    servers: number;
    ram: number;
    disk: number;
    cpu: number;
    databases: number;
    backups: number;
    allocations: number;
  };
}

export default function Dashboard() {
  const { user } = useAuth();
  const [resources, setResources] = useState<Resources | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    try {
      const res = await fetch('/api/user/resources', { credentials: 'include' });
      const data = await res.json();
      setResources(data);
    } catch (error) {
      console.error('Failed to fetch resources:', error);
    } finally {
      setLoading(false);
    }
  };

  const resourceCards = resources
    ? [
        {
          label: 'Servers',
          icon: Server,
          used: resources.used.servers,
          total: resources.available.servers,
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/10',
        },
        {
          label: 'RAM',
          icon: MemoryStick,
          used: resources.used.ram,
          total: resources.available.ram,
          unit: 'MB',
          color: 'text-green-400',
          bgColor: 'bg-green-500/10',
        },
        {
          label: 'Disk',
          icon: HardDrive,
          used: resources.used.disk,
          total: resources.available.disk,
          unit: 'MB',
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-500/10',
        },
        {
          label: 'CPU',
          icon: Cpu,
          used: resources.used.cpu,
          total: resources.available.cpu,
          unit: '%',
          color: 'text-red-400',
          bgColor: 'bg-red-500/10',
        },
        {
          label: 'Databases',
          icon: Database,
          used: resources.used.databases,
          total: resources.available.databases,
          color: 'text-purple-400',
          bgColor: 'bg-purple-500/10',
        },
        {
          label: 'Backups',
          icon: Archive,
          used: resources.used.backups,
          total: resources.available.backups,
          color: 'text-orange-400',
          bgColor: 'bg-orange-500/10',
        },
      ]
    : [];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">
          Welcome back, {user?.username}!
        </h1>
        <p className="text-gray-400">
          Monitor your servers and billing from here.
        </p>
      </div>

      {/* Coins card with billing info */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-accent-500/10">
              <Coins className="w-6 h-6 text-accent-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Account Balance</p>
              <p className="text-2xl font-bold text-white">
                {user?.coins?.toLocaleString() || 0} coins
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Servers are billed hourly while running
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link to="/earn" className="btn-secondary">
              <Ticket className="w-4 h-4" />
              Earn Coins
            </Link>
            <Link to="/store" className="btn-primary">
              <ShoppingCart className="w-4 h-4" />
              Store
            </Link>
          </div>
        </div>
      </div>

      {/* Server limits info */}
      <div className="card p-6 mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Permanent Resources</h2>
        <p className="text-sm text-gray-400 mb-4">These resources last forever. Buy more in the store!</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-400 mb-1">Server Slots</p>
            <p className="text-2xl font-bold text-white">
              {resources?.used.servers || 0}
              <span className="text-gray-500 text-base font-normal">
                {' '}/ {resources?.available.servers || 0}
              </span>
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-1">Databases (per server)</p>
            <p className="text-2xl font-bold text-white">{resources?.available.databases || 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-1">Backups (per server)</p>
            <p className="text-2xl font-bold text-white">{resources?.available.backups || 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-1">Ports (per server)</p>
            <p className="text-2xl font-bold text-white">{resources?.available.allocations || 0}</p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link to="/servers/create" className="card-hover p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Plus className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="font-medium text-white">Create Server</p>
              <p className="text-sm text-gray-500">Deploy a new server</p>
            </div>
          </Link>
          <Link to="/servers" className="card-hover p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Server className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="font-medium text-white">Manage Servers</p>
              <p className="text-sm text-gray-500">View all servers</p>
            </div>
          </Link>
          <Link to="/store" className="card-hover p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <ShoppingCart className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="font-medium text-white">Buy Coins</p>
              <p className="text-sm text-gray-500">Top up balance</p>
            </div>
          </Link>
          <Link to="/redeem" className="card-hover p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <Ticket className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="font-medium text-white">Redeem Code</p>
              <p className="text-sm text-gray-500">Use coupon codes</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Pterodactyl link warning */}
      {user && !user.pterodactylId && (
        <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-yellow-400 text-sm">
            Your account is not linked to Pterodactyl. You need to link your account before you can create servers.
          </p>
          <button
            onClick={async () => {
              try {
                await fetch('/api/user/link-pterodactyl', {
                  method: 'POST',
                  credentials: 'include',
                });
                window.location.reload();
              } catch (error) {
                console.error('Failed to link Pterodactyl:', error);
              }
            }}
            className="mt-2 btn-primary text-sm"
          >
            Link Pterodactyl Account
          </button>
        </div>
      )}
    </div>
  );
}
