import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Server, Loader2, MapPin, Egg, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Location {
  id: string;
  name: string;
  description: string | null;
  pterodactylId: number;
}

interface EggData {
  id: string;
  name: string;
  description: string | null;
  nestId: number;
  pterodactylId: number;
}

export default function CreateServer() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  
  const [locations, setLocations] = useState<Location[]>([]);
  const [eggs, setEggs] = useState<EggData[]>([]);
  
  const [form, setForm] = useState({
    name: '',
    locationId: '',
    eggId: '',
    ram: 1024,
    disk: 5120,
    cpu: 100,
    databases: 0,
    backups: 0,
    allocations: 1,
  });

  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    try {
      const [locRes, eggRes] = await Promise.all([
        fetch('/api/store/locations', { credentials: 'include' }),
        fetch('/api/store/eggs', { credentials: 'include' }),
      ]);

      const [locData, eggData] = await Promise.all([locRes.json(), eggRes.json()]);

      setLocations(locData.locations || []);
      setEggs(eggData.eggs || []);
    } catch (error) {
      console.error('Failed to fetch options:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);

    try {
      const res = await fetch('/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create server');
      }

      await refreshUser();
      navigate('/servers');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create server');
    } finally {
      setCreating(false);
    }
  };

  if (!user?.pterodactylId) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto animate-fadeIn">
        <div className="card p-8 text-center">
          <Server className="w-12 h-12 mx-auto text-yellow-400 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Link Required</h2>
          <p className="text-gray-400 mb-6">
            You need to link your Pterodactyl account before creating servers.
          </p>
          <button
            onClick={async () => {
              try {
                await fetch('/api/user/link-pterodactyl', {
                  method: 'POST',
                  credentials: 'include',
                });
                await refreshUser();
              } catch (error) {
                console.error('Failed to link:', error);
              }
            }}
            className="btn-primary"
          >
            Link Pterodactyl Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="mb-8">
        <Link to="/servers" className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-200 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Servers
        </Link>
        <h1 className="text-2xl font-bold text-white">Create Server</h1>
        <p className="text-gray-400">Deploy a new game server.</p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-6">
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Server name */}
        <div>
          <label className="label">Server Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="My Awesome Server"
            className="input"
            required
          />
        </div>

        {/* Location */}
        <div>
          <label className="label">
            <MapPin className="w-4 h-4 inline mr-1" />
            Location
          </label>
          {loading ? (
            <div className="skeleton h-11 w-full" />
          ) : (
            <select
              value={form.locationId}
              onChange={(e) => setForm({ ...form, locationId: e.target.value })}
              className="input"
              required
            >
              <option value="">Select a location</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} {loc.description ? `- ${loc.description}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Egg */}
        <div>
          <label className="label">
            <Egg className="w-4 h-4 inline mr-1" />
            Server Type (Egg)
          </label>
          {loading ? (
            <div className="skeleton h-11 w-full" />
          ) : (
            <select
              value={form.eggId}
              onChange={(e) => setForm({ ...form, eggId: e.target.value })}
              className="input"
              required
            >
              <option value="">Select a server type</option>
              {eggs.map((egg) => (
                <option key={egg.id} value={egg.id}>
                  {egg.name} {egg.description ? `- ${egg.description}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Resources */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">RAM (MB)</label>
            <input
              type="number"
              value={form.ram}
              onChange={(e) => setForm({ ...form, ram: parseInt(e.target.value) || 0 })}
              min={128}
              step={128}
              className="input"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Available: {(user?.ram || 0).toLocaleString()} MB
            </p>
          </div>
          <div>
            <label className="label">Disk (MB)</label>
            <input
              type="number"
              value={form.disk}
              onChange={(e) => setForm({ ...form, disk: parseInt(e.target.value) || 0 })}
              min={256}
              step={256}
              className="input"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Available: {(user?.disk || 0).toLocaleString()} MB
            </p>
          </div>
          <div>
            <label className="label">CPU (%)</label>
            <input
              type="number"
              value={form.cpu}
              onChange={(e) => setForm({ ...form, cpu: parseInt(e.target.value) || 0 })}
              min={25}
              step={25}
              className="input"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Available: {user?.cpu || 0}%
            </p>
          </div>
        </div>

        {/* Feature limits */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Databases</label>
            <input
              type="number"
              value={form.databases}
              onChange={(e) => setForm({ ...form, databases: parseInt(e.target.value) || 0 })}
              min={0}
              className="input"
            />
          </div>
          <div>
            <label className="label">Backups</label>
            <input
              type="number"
              value={form.backups}
              onChange={(e) => setForm({ ...form, backups: parseInt(e.target.value) || 0 })}
              min={0}
              className="input"
            />
          </div>
          <div>
            <label className="label">Allocations</label>
            <input
              type="number"
              value={form.allocations}
              onChange={(e) => setForm({ ...form, allocations: parseInt(e.target.value) || 0 })}
              min={1}
              className="input"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
          <Link to="/servers" className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={creating} className="btn-primary">
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Server className="w-4 h-4" />
                Create Server
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
