import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Server, Plus, Cpu, HardDrive, MemoryStick, ExternalLink, Trash2, Loader2, Coins } from 'lucide-react';

interface ServerData {
  id: string;
  pterodactylId: number;
  pterodactylUuid: string;
  name: string;
  ram: number;
  disk: number;
  cpu: number;
  databases: number;
  backups: number;
  allocations: number;
  hourlyCost?: number;
  location: {
    name: string;
    description: string | null;
  };
  egg: {
    name: string;
    description: string | null;
  };
  createdAt: string;
}

export default function Servers() {
  const [servers, setServers] = useState<ServerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [billingEnabled, setBillingEnabled] = useState(false);

  useEffect(() => {
    fetchServers();
  }, []);

  const fetchServers = async () => {
    try {
      const res = await fetch('/api/servers', { credentials: 'include' });
      const data = await res.json();
      setServers(data.servers || []);
      setBillingEnabled(data.billingEnabled || false);
    } catch (error) {
      console.error('Failed to fetch servers:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteServer = async (serverId: string) => {
    if (!confirm('Are you sure you want to delete this server? This action cannot be undone.')) {
      return;
    }

    setDeleting(serverId);
    try {
      const res = await fetch(`/api/servers/${serverId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        setServers(servers.filter((s) => s.id !== serverId));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete server');
      }
    } catch (error) {
      console.error('Failed to delete server:', error);
      alert('Failed to delete server');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Your Servers</h1>
          <p className="text-gray-400">Manage and monitor your game servers.</p>
        </div>
        <Link to="/servers/create" className="btn-primary">
          <Plus className="w-4 h-4" />
          Create Server
        </Link>
      </div>

      {/* Server list */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-6">
              <div className="skeleton h-6 w-48 mb-4" />
              <div className="skeleton h-4 w-32 mb-2" />
              <div className="skeleton h-4 w-24" />
            </div>
          ))}
        </div>
      ) : servers.length === 0 ? (
        <div className="card p-12 text-center">
          <Server className="w-12 h-12 mx-auto text-gray-600 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No servers yet</h2>
          <p className="text-gray-400 mb-6">
            Create your first server to get started.
          </p>
          <Link to="/servers/create" className="btn-primary">
            <Plus className="w-4 h-4" />
            Create Server
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {servers.map((server) => (
            <div key={server.id} className="card p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{server.name}</h3>
                  <p className="text-sm text-gray-500">
                    {server.egg?.name} • {server.location?.name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`${process.env.PTERODACTYL_URL || ''}/server/${server.pterodactylUuid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost p-2"
                    title="Open in Panel"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => deleteServer(server.id)}
                    disabled={deleting === server.id}
                    className="btn-ghost p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    title="Delete Server"
                  >
                    {deleting === server.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <MemoryStick className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-gray-400">
                    {server.ram} MB
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm text-gray-400">
                    {server.disk} MB
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-gray-400">
                    {server.cpu}%
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-gray-600">
                  Created {new Date(server.createdAt).toLocaleDateString()}
                </p>
                {billingEnabled && server.hourlyCost !== undefined && server.hourlyCost > 0 && (
                  <div className="flex items-center gap-1 text-xs text-amber-400">
                    <Coins className="w-3 h-3" />
                    <span>{server.hourlyCost}/hr</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
