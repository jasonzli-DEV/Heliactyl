import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Server, Loader2, MapPin, Egg, ArrowLeft, ChevronDown, ChevronRight, Folder, Settings2, Cpu, HardDrive, MemoryStick, Database, Archive, Network } from 'lucide-react';
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
  displayName: string;
  description: string | null;
  nestId: number;
  nestName?: string;
  pterodactylId: number;
}

interface EggVariable {
  name: string;
  description: string;
  envVariable: string;
  defaultValue: string;
  userEditable: boolean;
  rules: string;
}

export default function CreateServer() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  
  const [locations, setLocations] = useState<Location[]>([]);
  const [eggs, setEggs] = useState<EggData[]>([]);
  const [variables, setVariables] = useState<EggVariable[]>([]);
  const [loadingVariables, setLoadingVariables] = useState(false);
  const [expandedNests, setExpandedNests] = useState<Set<number>>(new Set());
  const [sliderMaxes, setSliderMaxes] = useState({ maxRamSlider: 12288, maxDiskSlider: 51200, maxCpuSlider: 400 });
  
  const [form, setForm] = useState({
    name: '',
    locationId: '',
    eggId: '',
    ram: 1024,      // Minimum RAM
    disk: 2048,     // Minimum Disk
    cpu: 50,        // Minimum CPU
    databases: 0,
    backups: 0,
    allocations: 1,
    environment: {} as Record<string, string>,
  });

  // Group eggs by nestId
  const nestGroups = useMemo(() => {
    const groups = new Map<number, EggData[]>();
    eggs.forEach(egg => {
      const existing = groups.get(egg.nestId) || [];
      existing.push(egg);
      groups.set(egg.nestId, existing);
    });
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  }, [eggs]);

  // Get selected egg name for display
  const selectedEgg = eggs.find(e => e.id === form.eggId);

  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    try {
      const [locRes, eggRes, settingsRes] = await Promise.all([
        fetch('/api/store/locations', { credentials: 'include' }),
        fetch('/api/store/eggs', { credentials: 'include' }),
        fetch('/api/settings/public', { credentials: 'include' }),
      ]);

      const [locData, eggData, settingsData] = await Promise.all([locRes.json(), eggRes.json(), settingsRes.json()]);

      setLocations(locData.locations || []);
      setEggs(eggData.eggs || []);
      
      // Get slider maximums from settings (stored in MB, same as we use)
      if (settingsData) {
        setSliderMaxes({
          maxRamSlider: settingsData.maxRamSlider || 12288,
          maxDiskSlider: settingsData.maxDiskSlider || 51200,
          maxCpuSlider: settingsData.maxCpuSlider || 400,
        });
      }
    } catch (error) {
      console.error('Failed to fetch options:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch egg variables when egg is selected
  const fetchVariables = async (eggId: string) => {
    if (!eggId) {
      setVariables([]);
      return;
    }
    
    setLoadingVariables(true);
    try {
      const res = await fetch(`/api/store/eggs/${eggId}/variables`, { credentials: 'include' });
      const data = await res.json();
      setVariables(data.variables || []);
      
      // Initialize environment with default values
      const defaultEnv: Record<string, string> = {};
      (data.variables || []).forEach((v: EggVariable) => {
        defaultEnv[v.envVariable] = v.defaultValue;
      });
      setForm(prev => ({ ...prev, environment: defaultEnv }));
    } catch (error) {
      console.error('Failed to fetch variables:', error);
      setVariables([]);
    } finally {
      setLoadingVariables(false);
    }
  };

  const toggleNest = (nestId: number) => {
    setExpandedNests(prev => {
      const next = new Set(prev);
      if (next.has(nestId)) {
        next.delete(nestId);
      } else {
        next.add(nestId);
      }
      return next;
    });
  };

  const selectEgg = (egg: EggData) => {
    setForm(prev => ({ ...prev, eggId: egg.id }));
    fetchVariables(egg.id);
    // Auto-collapse all nest sections after selection
    setExpandedNests(new Set());
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
    <div className="p-6 lg:p-8 max-w-4xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="mb-8">
        <Link to="/servers" className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-200 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Servers
        </Link>
        <h1 className="text-2xl font-bold text-white">Create Server</h1>
        <p className="text-gray-400">Deploy a new game server.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Step 1: Server Type (Egg) */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Egg className="w-5 h-5 text-accent-400" />
            Step 1: Select Server Type
          </h2>
          
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="skeleton h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {nestGroups.map(([nestId, nestEggs]) => (
                <div key={nestId} className="border border-dark-600 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleNest(nestId)}
                    className="w-full flex items-center justify-between p-3 bg-dark-700/50 hover:bg-dark-700 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandedNests.has(nestId) ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                      <Folder className="w-4 h-4 text-accent-400" />
                      <span className="font-medium text-white">{nestEggs[0]?.nestName || `Nest #${nestId}`}</span>
                      <span className="text-sm text-gray-500">({nestEggs.length} types)</span>
                    </div>
                  </button>
                  
                  {expandedNests.has(nestId) && (
                    <div className="p-2 space-y-1 bg-dark-800/50">
                      {nestEggs.map((egg) => (
                        <button
                          key={egg.id}
                          type="button"
                          onClick={() => selectEgg(egg)}
                          className={`w-full text-left p-3 rounded-lg transition-colors ${
                            form.eggId === egg.id
                              ? 'bg-accent-500/20 border border-accent-500/50'
                              : 'hover:bg-dark-700 border border-transparent'
                          }`}
                        >
                          <p className="font-medium text-white">{egg.displayName || egg.name}</p>
                          {egg.description && (
                            <p className="text-sm text-gray-400 mt-1 line-clamp-2">{egg.description}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {selectedEgg && (
            <div className="mt-4 p-3 bg-accent-500/10 border border-accent-500/30 rounded-lg">
              <p className="text-sm text-accent-400">
                Selected: <span className="font-semibold">{selectedEgg.displayName || selectedEgg.name}</span>
              </p>
            </div>
          )}
        </div>

        {/* Step 2: Egg Variables (if any) */}
        {form.eggId && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-accent-400" />
              Step 2: Server Configuration
            </h2>

            {loadingVariables ? (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="skeleton h-16 w-full" />
                ))}
              </div>
            ) : variables.length > 0 ? (
              <div className="space-y-4">
                {variables.filter(v => v.userEditable).map((variable) => (
                  <div key={variable.envVariable}>
                    <label className="label">{variable.name}</label>
                    <input
                      type="text"
                      value={form.environment[variable.envVariable] || ''}
                      onChange={(e) => setForm(prev => ({
                        ...prev,
                        environment: { ...prev.environment, [variable.envVariable]: e.target.value }
                      }))}
                      placeholder={variable.defaultValue}
                      className="input"
                    />
                    {variable.description && (
                      <p className="text-xs text-gray-500 mt-1">{variable.description}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">No configurable options for this server type.</p>
            )}
          </div>
        )}

        {/* Step 3: Location */}
        {form.eggId && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-accent-400" />
              Step 3: Select Location
            </h2>
            
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
        )}

        {/* Step 4: Resources & Details */}
        {form.eggId && form.locationId && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-accent-400" />
              Step 4: Server Details
            </h2>

            {/* Server name */}
            <div className="mb-6">
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

            {/* Resources */}
            <div className="space-y-6 mb-6">
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
          </div>
        )}

        {/* Submit */}
        {form.eggId && form.locationId && (
          <div className="flex justify-end gap-3">
            <Link to="/servers" className="btn-secondary">
              Cancel
            </Link>
            <button type="submit" disabled={creating || !form.name} className="btn-primary">
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
        )}
      </form>
    </div>
  );
}
