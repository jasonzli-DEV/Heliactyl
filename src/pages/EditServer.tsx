import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Server, Loader2, ArrowLeft, Cpu, HardDrive, MemoryStick, Save } from 'lucide-react';

interface ServerData {
  id: string;
  name: string;
  ram: number;
  disk: number;
  cpu: number;
  databases: number;
  backups: number;
  allocations: number;
}

export default function EditServer() {
  const { id } = useParams<{ id: string }>();
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [server, setServer] = useState<ServerData | null>(null);
  const [form, setForm] = useState({
    ram: 1024,
    disk: 2048,
    cpu: 50,
    databases: 0,
    backups: 0,
    allocations: 1,
  });

  useEffect(() => {
    fetchServer();
  }, [id]);

  const fetchServer = async () => {
    try {
      const res = await fetch(`/api/servers/${id}`, { credentials: 'include' });
      if (!res.ok) {
        navigate('/servers');
        return;
      }
      const data = await res.json();
      setServer(data.server);
      setForm({
        ram: data.server.ram,
        disk: data.server.disk,
        cpu: data.server.cpu,
        databases: data.server.databases,
        backups: data.server.backups,
        allocations: data.server.allocations,
      });
    } catch (error) {
      console.error('Failed to fetch server:', error);
      navigate('/servers');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(`/api/servers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update server');
      }

      showToast('Server updated successfully', 'success');
      await refreshUser();
      navigate('/servers');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update server', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="card p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-500" />
        </div>
      </div>
    );
  }

  if (!server) {
    return null;
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto animate-fadeIn">
      <Link to="/servers" className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-200 mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back to Servers
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Edit Server</h1>
        <p className="text-gray-400">{server.name}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Resource Allocation</h2>
          <p className="text-sm text-gray-400 mb-6">
            Adjust resources for this server. Increasing resources will deduct from your available balance. Decreasing resources will refund to your account.
          </p>

          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label flex items-center gap-2">
                  <MemoryStick className="w-4 h-4 text-green-400" />
                  RAM
                </label>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${form.ram > (user?.ram || 0) + server.ram ? 'text-red-400' : 'text-white'}`}>
                    {(form.ram / 1024).toFixed(1)} GB
                  </span>
                  <span className="text-xs text-gray-500">
                    / {(((user?.ram || 0) + server.ram) / 1024).toFixed(1)} GB available
                  </span>
                </div>
              </div>
              <input
                type="range"
                value={form.ram}
                onChange={(e) => setForm({ ...form, ram: parseInt(e.target.value) })}
                min={1024}
                max={Math.max((user?.ram || 0) + server.ram, 1024)}
                step={1024}
                className="slider w-full"
                style={{
                  background: `linear-gradient(to right, rgb(74, 222, 128) 0%, rgb(74, 222, 128) ${((form.ram - 1024) / (Math.max((user?.ram || 0) + server.ram, 1024) - 1024)) * 100}%, rgb(31, 41, 55) ${((form.ram - 1024) / (Math.max((user?.ram || 0) + server.ram, 1024) - 1024)) * 100}%, rgb(31, 41, 55) 100%)`
                }}
              />
              {form.ram > (user?.ram || 0) + server.ram && (
                <p className="text-xs text-red-400 mt-1">⚠️ Insufficient RAM available</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-yellow-400" />
                  Disk
                </label>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${form.disk > (user?.disk || 0) + server.disk ? 'text-red-400' : 'text-white'}`}>
                    {(form.disk / 1024).toFixed(1)} GB
                  </span>
                  <span className="text-xs text-gray-500">
                    / {(((user?.disk || 0) + server.disk) / 1024).toFixed(1)} GB available
                  </span>
                </div>
              </div>
              <input
                type="range"
                value={form.disk}
                onChange={(e) => setForm({ ...form, disk: parseInt(e.target.value) })}
                min={2048}
                max={Math.max((user?.disk || 0) + server.disk, 2048)}
                step={1024}
                className="slider w-full"
                style={{
                  background: `linear-gradient(to right, rgb(250, 204, 21) 0%, rgb(250, 204, 21) ${((form.disk - 2048) / (Math.max((user?.disk || 0) + server.disk, 2048) - 2048)) * 100}%, rgb(31, 41, 55) ${((form.disk - 2048) / (Math.max((user?.disk || 0) + server.disk, 2048) - 2048)) * 100}%, rgb(31, 41, 55) 100%)`
                }}
              />
              {form.disk > (user?.disk || 0) + server.disk && (
                <p className="text-xs text-red-400 mt-1">⚠️ Insufficient disk available</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-red-400" />
                  CPU
                </label>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${form.cpu > (user?.cpu || 0) + server.cpu ? 'text-red-400' : 'text-white'}`}>
                    {form.cpu}%
                  </span>
                  <span className="text-xs text-gray-500">
                    / {(user?.cpu || 0) + server.cpu}% available
                  </span>
                </div>
              </div>
              <input
                type="range"
                value={form.cpu}
                onChange={(e) => setForm({ ...form, cpu: parseInt(e.target.value) })}
                min={50}
                max={Math.max((user?.cpu || 0) + server.cpu, 50)}
                step={50}
                className="slider w-full"
                style={{
                  background: `linear-gradient(to right, rgb(248, 113, 113) 0%, rgb(248, 113, 113) ${((form.cpu - 50) / (Math.max((user?.cpu || 0) + server.cpu, 50) - 50)) * 100}%, rgb(31, 41, 55) ${((form.cpu - 50) / (Math.max((user?.cpu || 0) + server.cpu, 50) - 50)) * 100}%, rgb(31, 41, 55) 100%)`
                }}
              />
              {form.cpu > (user?.cpu || 0) + server.cpu && (
                <p className="text-xs text-red-400 mt-1">⚠️ Insufficient CPU available</p>
              )}
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg">
            <p className="text-sm text-blue-400">
              <strong>Note:</strong> Changes to RAM, CPU, and Disk will affect your hourly billing cost. Increasing resources costs more, decreasing refunds the difference to your account.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link to="/servers" className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
