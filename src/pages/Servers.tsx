import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Server, Plus, Cpu, HardDrive, MemoryStick, ExternalLink, Trash2, Loader2, Coins, Key, Mail, Copy, CheckCircle, Edit, Pause, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../context/ToastContext';

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
  paused?: boolean;
  nextBillingAt?: string;
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
  const { user } = useAuth();
  const { showToast } = useToast();
  const [servers, setServers] = useState<ServerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pausing, setPausing] = useState<string | null>(null);
  const [billingEnabled, setBillingEnabled] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);

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
    setDeleting(serverId);
    try {
      const res = await fetch(`/api/servers/${serverId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        setServers(servers.filter((s) => s.id !== serverId));
        showToast('Server deleted successfully', 'success');
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to delete server', 'error');
      }
    } catch (error) {
      console.error('Failed to delete server:', error);
      showToast('Failed to delete server', 'error');
    } finally {
      setDeleting(null);
      setShowDeleteModal(null);
    }
  };

  const resetPassword = async () => {
    setResettingPassword(true);
    setNewPassword(null);
    try {
      const res = await fetch('/api/user/reset-password', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setNewPassword(data.password);
        showToast('Password reset successfully! Copy it below.', 'success');
      } else {
        showToast(data.error || 'Failed to reset password', 'error');
      }
    } catch (error) {
      console.error('Failed to reset password:', error);
      showToast('Failed to reset password', 'error');
    } finally {
      setResettingPassword(false);
    }
  };

  const copyPassword = () => {
    if (newPassword) {
      navigator.clipboard.writeText(newPassword);
      setCopied(true);
      showToast('Password copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const togglePauseServer = async (serverId: string, currentlyPaused: boolean) => {
    setPausing(serverId);
    try {
      const action = currentlyPaused ? 'unpause' : 'pause';
      const res = await fetch(`/api/servers/${serverId}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });

      const data = await res.json();

      if (res.ok) {
        showToast(data.message || `Server ${action}d successfully`, 'success');
        await fetchServers();
      } else {
        showToast(data.error || `Failed to ${action} server`, 'error');
      }
    } catch (error) {
      console.error('Failed to toggle pause server:', error);
      showToast('Failed to toggle pause state', 'error');
    } finally {
      setPausing(null);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Your Servers</h1>
          <p className="text-gray-400">Manage your game servers.</p>
        </div>
        <Link to="/servers/create" className="btn-primary">
          <Plus className="w-4 h-4" />
          Create Server
        </Link>
      </div>

      {/* Pterodactyl Panel Info */}
      {user?.pterodactylId && (
        <div className="card p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Panel Access</h2>
          <p className="text-gray-400 mb-4">
            Use the following credentials to login to your EnderBit panel.
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-2">Email:</label>
              <div className="flex items-center gap-2 p-3 bg-dark-700 rounded-lg">
                <Mail className="w-4 h-4 text-gray-500" />
                <span className="text-white font-mono">{user.email || 'Not set'}</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Forgot your password or never generated it? Reset it below!
              </p>
            </div>

            {newPassword && (
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-green-400 mb-2">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Password Reset Successful!</span>
                </div>
                <p className="text-sm text-gray-400 mb-3">
                  Your new password is shown below. <strong>Save it now</strong> - it will only be shown once!
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-3 bg-dark-800 rounded-lg text-white font-mono text-sm break-all">
                    {newPassword}
                  </code>
                  <button
                    onClick={copyPassword}
                    className="p-3 bg-dark-800 hover:bg-dark-700 rounded-lg text-gray-400 hover:text-white transition-colors"
                    title="Copy password"
                  >
                    {copied ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={resetPassword}
                disabled={resettingPassword}
                className="btn-secondary flex items-center gap-2"
              >
                {resettingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    Reset Password
                  </>
                )}
              </button>
              <a
                href="https://panel.enderbit.com"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Open Game Panel
              </a>
            </div>
          </div>
        </div>
      )}

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
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-white">{server.name}</h3>
                    {server.paused && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-yellow-500/20 text-yellow-400 rounded-full">
                        Paused
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {server.egg?.name} • {server.location?.name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to={`/servers/${server.id}/edit`}
                    className="btn-ghost p-2"
                    title="Edit Resources"
                  >
                    <Edit className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => togglePauseServer(server.id, server.paused || false)}
                    disabled={pausing === server.id}
                    className={`btn-ghost p-2 ${
                      server.paused 
                        ? 'text-green-400 hover:text-green-300 hover:bg-green-500/10' 
                        : 'text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10'
                    }`}
                    title={server.paused ? 'Unpause (charge 1 hour upfront)' : 'Pause (stop billing)'}
                  >
                    {pausing === server.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : server.paused ? (
                      <Play className="w-4 h-4" />
                    ) : (
                      <Pause className="w-4 h-4" />
                    )}
                  </button>
                  <a
                    href={`https://panel.enderbit.com/server/${server.pterodactylUuid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost p-2"
                    title="Open in Panel"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => setShowDeleteModal(server.id)}
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

              {billingEnabled && server.hourlyCost !== undefined && server.hourlyCost > 0 && (
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-medium text-amber-400">Hourly Cost</span>
                  </div>
                  <span className="text-lg font-bold text-white">{server.hourlyCost} coins/hr</span>
                </div>
              )}

              <div className="mt-3">
                <p className="text-xs text-gray-600">
                  Created {new Date(server.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal !== null}
        onClose={() => setShowDeleteModal(null)}
        onConfirm={() => showDeleteModal && deleteServer(showDeleteModal)}
        title="Delete Server"
        message="Are you sure you want to delete this server? This action cannot be undone and all data will be permanently lost."
        confirmText="Delete Server"
        confirmButtonClass="btn-danger"
        isLoading={deleting !== null}
      />
    </div>
  );
}
