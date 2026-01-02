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
  const [sliderMaxes, setSliderMaxes] = useState({
    maxRamSlider: 12288,
    maxDiskSlider: 51200,
    maxCpuSlider: 400,
  });
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
    fetchSettings();
  }, [id]);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings/public', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSliderMaxes({
          maxRamSlider: data.maxRamSlider || 12288,
          maxDiskSlider: data.maxDiskSlider || 51200,
          maxCpuSlider: data.maxCpuSlider || 400,
        });
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

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
            Adjust resources for this server. Resources are billed hourly while the server runs.
          </p>

          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label flex items-center gap-2">
                  <MemoryStick className="w-4 h-4 text-green-400" />
                  RAM
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">
                    {(form.ram / 1024).toFixed(1)} GB
                  </span>
                  <span className="text-xs text-gray-500">
                    / {(sliderMaxes.maxRamSlider / 1024).toFixed(1)} GB max
                  </span>
                </div>
              </div>
              <input
                type="range"
                value={form.ram}
                onChange={(e) => setForm({ ...form, ram: parseInt(e.target.value) })}
                min={1024}
                max={sliderMaxes.maxRamSlider}
                step={1024}
                className="slider w-full"
                style={{
                  background: `linear-gradient(to right, rgb(74, 222, 128) 0%, rgb(74, 222, 128) ${((form.ram - 1024) / (sliderMaxes.maxRamSlider - 1024)) * 100}%, rgb(31, 41, 55) ${((form.ram - 1024) / (sliderMaxes.maxRamSlider - 1024)) * 100}%, rgb(31, 41, 55) 100%)`
                }}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-yellow-400" />
                  Disk
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">
                    {(form.disk / 1024).toFixed(1)} GB
                  </span>
                  <span className="text-xs text-gray-500">
                    / {(sliderMaxes.maxDiskSlider / 1024).toFixed(1)} GB max
                  </span>
                </div>
              </div>
              <input
                type="range"
                value={form.disk}
                onChange={(e) => setForm({ ...form, disk: parseInt(e.target.value) })}
                min={2048}
                max={sliderMaxes.maxDiskSlider}
                step={1024}
                className="slider w-full"
                style={{
                  background: `linear-gradient(to right, rgb(250, 204, 21) 0%, rgb(250, 204, 21) ${((form.disk - 2048) / (sliderMaxes.maxDiskSlider - 2048)) * 100}%, rgb(31, 41, 55) ${((form.disk - 2048) / (sliderMaxes.maxDiskSlider - 2048)) * 100}%, rgb(31, 41, 55) 100%)`
                }}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-red-400" />
                  CPU
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">
                    {form.cpu}%
                  </span>
                  <span className="text-xs text-gray-500">
                    / {sliderMaxes.maxCpuSlider}% max
                  </span>
                </div>
              </div>
              <input
                type="range"
                value={form.cpu}
                onChange={(e) => setForm({ ...form, cpu: parseInt(e.target.value) })}
                min={50}
                max={sliderMaxes.maxCpuSlider}
                step={50}
                className="slider w-full"
                style={{
                  background: `linear-gradient(to right, rgb(248, 113, 113) 0%, rgb(248, 113, 113) ${((form.cpu - 50) / (sliderMaxes.maxCpuSlider - 50)) * 100}%, rgb(31, 41, 55) ${((form.cpu - 50) / (sliderMaxes.maxCpuSlider - 50)) * 100}%, rgb(31, 41, 55) 100%)`
                }}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label">Databases</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{form.databases}</span>
                  <span className="text-xs text-gray-500">
                    / {user?.databases || 0} available
                  </span>
                </div>
              </div>
              <input
                type="range"
                value={form.databases}
                onChange={(e) => setForm({ ...form, databases: parseInt(e.target.value) })}
                min={0}
                max={Math.max(form.databases, user?.databases || 0)}
                step={1}
                className="slider w-full"
                style={{
                  background: `linear-gradient(to right, rgb(168, 85, 247) 0%, rgb(168, 85, 247) ${(form.databases / Math.max(1, Math.max(form.databases, user?.databases || 0))) * 100}%, rgb(31, 41, 55) ${(form.databases / Math.max(1, Math.max(form.databases, user?.databases || 0))) * 100}%, rgb(31, 41, 55) 100%)`
                }}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label">Backups</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{form.backups}</span>
                  <span className="text-xs text-gray-500">
                    / {user?.backups || 0} available
                  </span>
                </div>
              </div>
              <input
                type="range"
                value={form.backups}
                onChange={(e) => setForm({ ...form, backups: parseInt(e.target.value) })}
                min={0}
                max={Math.max(form.backups, user?.backups || 0)}
                step={1}
                className="slider w-full"
                style={{
                  background: `linear-gradient(to right, rgb(34, 197, 94) 0%, rgb(34, 197, 94) ${(form.backups / Math.max(1, Math.max(form.backups, user?.backups || 0))) * 100}%, rgb(31, 41, 55) ${(form.backups / Math.max(1, Math.max(form.backups, user?.backups || 0))) * 100}%, rgb(31, 41, 55) 100%)`
                }}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label">Ports (Allocations)</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{form.allocations}</span>
                  <span className="text-xs text-gray-500">
                    / {user?.allocations || 0} available
                  </span>
                </div>
              </div>
              <input
                type="range"
                value={form.allocations}
                onChange={(e) => setForm({ ...form, allocations: parseInt(e.target.value) })}
                min={1}
                max={Math.max(form.allocations, Math.max(1, user?.allocations || 0))}
                step={1}
                className="slider w-full"
                style={{
                  background: `linear-gradient(to right, rgb(234, 179, 8) 0%, rgb(234, 179, 8) ${((form.allocations - 1) / Math.max(1, Math.max(form.allocations, Math.max(1, user?.allocations || 0)) - 1)) * 100}%, rgb(31, 41, 55) ${((form.allocations - 1) / Math.max(1, Math.max(form.allocations, Math.max(1, user?.allocations || 0)) - 1)) * 100}%, rgb(31, 41, 55) 100%)`
                }}
              />
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg">
            <p className="text-sm text-blue-400">
              <strong>Note:</strong> Changes to RAM, CPU, and Disk will affect your hourly billing cost. Databases, backups, and ports are permanent resources.
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
