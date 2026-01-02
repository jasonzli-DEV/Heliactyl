import { useAuth } from '../context/AuthContext';
import { Server, Cpu, HardDrive, MemoryStick, Database, Archive, Network, Coins, Plus } from 'lucide-react';
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
          Manage your servers and resources from here.
        </p>
      </div>

      {/* Coins card */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-accent-500/10">
              <Coins className="w-6 h-6 text-accent-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Available Coins</p>
              <p className="text-2xl font-bold text-white">
                {user?.coins?.toLocaleString() || 0}
              </p>
            </div>
          </div>
          <Link to="/store" className="btn-primary">
            <ShoppingCart className="w-4 h-4" />
            Buy Resources
          </Link>
        </div>
      </div>

      {/* Resource cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card p-6">
                <div className="skeleton h-4 w-20 mb-3" />
                <div className="skeleton h-8 w-32 mb-3" />
                <div className="skeleton h-2 w-full" />
              </div>
            ))
          : resourceCards.map(({ label, icon: Icon, used, total, unit, color, bgColor }) => {
              const percentage = total > 0 ? Math.round((used / total) * 100) : 0;
              return (
                <div key={label} className="card p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2 rounded-lg ${bgColor}`}>
                      <Icon className={`w-5 h-5 ${color}`} />
                    </div>
                    <span className="text-sm font-medium text-gray-400">{label}</span>
                  </div>
                  <p className="text-2xl font-bold text-white mb-3">
                    {used.toLocaleString()}
                    <span className="text-gray-500 text-base font-normal">
                      {' '}
                      / {total.toLocaleString()} {unit || ''}
                    </span>
                  </p>
                  <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        percentage >= 90
                          ? 'bg-red-500'
                          : percentage >= 70
                          ? 'bg-yellow-500'
                          : 'bg-accent-500'
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
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
              <p className="font-medium text-white">Store</p>
              <p className="text-sm text-gray-500">Buy more resources</p>
            </div>
          </Link>
          <Link to="/redeem" className="card-hover p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <Ticket className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="font-medium text-white">Redeem Code</p>
              <p className="text-sm text-gray-500">Use a coupon code</p>
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

import { ShoppingCart, Ticket } from 'lucide-react';
