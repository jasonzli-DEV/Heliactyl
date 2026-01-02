import { useState, useEffect, useMemo } from 'react';
import { Egg, Plus, Edit, Trash2, Loader2, RefreshCw, ChevronDown, ChevronRight, Folder } from 'lucide-react';

interface EggData {
  id: string;
  name: string;
  description: string | null;
  nestId: number;
  pterodactylId: number;
  dockerImage: string;
  startup: string;
  environment: string | null;
  enabled: boolean;
}

export default function AdminEggs() {
  const [eggs, setEggs] = useState<EggData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editing, setEditing] = useState<EggData | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedNests, setExpandedNests] = useState<Set<number>>(new Set());

  // Group eggs by nestId, sorted by nestId
  const nestGroups = useMemo(() => {
    const groups = new Map<number, EggData[]>();
    for (const egg of eggs) {
      if (!groups.has(egg.nestId)) {
        groups.set(egg.nestId, []);
      }
      groups.get(egg.nestId)!.push(egg);
    }
    // Sort each group's eggs by name
    for (const [, groupEggs] of groups) {
      groupEggs.sort((a, b) => a.name.localeCompare(b.name));
    }
    // Return sorted by nestId
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  }, [eggs]);

  useEffect(() => {
    fetchEggs();
  }, []);

  // Auto-expand all nests on load
  useEffect(() => {
    if (eggs.length > 0) {
      const nestIds = new Set(eggs.map(e => e.nestId));
      setExpandedNests(nestIds);
    }
  }, [eggs]);

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

  useEffect(() => {
    fetchEggs();
  }, []);

  const fetchEggs = async () => {
    try {
      const res = await fetch('/api/admin/eggs', { credentials: 'include' });
      const data = await res.json();
      setEggs(data.eggs || []);
    } catch (error) {
      console.error('Failed to fetch eggs:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveEgg = async (egg: Partial<EggData>) => {
    setSaving(true);
    try {
      const isNew = !egg.id;
      const res = await fetch(isNew ? '/api/admin/eggs' : `/api/admin/eggs/${egg.id}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(egg),
      });

      if (res.ok) {
        fetchEggs();
        setEditing(null);
        setCreating(false);
      }
    } catch (error) {
      console.error('Failed to save egg:', error);
    } finally {
      setSaving(false);
    }
  };

  const deleteEgg = async (id: string) => {
    if (!confirm('Delete this egg?')) return;
    try {
      await fetch(`/api/admin/eggs/${id}`, { method: 'DELETE', credentials: 'include' });
      fetchEggs();
    } catch (error) {
      console.error('Failed to delete egg:', error);
    }
  };

  const syncEggs = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/admin/eggs/sync', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.synced > 0) {
        alert(`Synced ${data.synced} eggs from Pterodactyl`);
        fetchEggs();
      } else {
        alert('No new eggs to sync');
      }
    } catch (error) {
      console.error('Failed to sync eggs:', error);
      alert('Failed to sync eggs from Pterodactyl');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fadeIn">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Eggs</h1>
          <p className="text-gray-400">Server types available for deployment.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={syncEggs}
            disabled={syncing}
            className="btn-secondary"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync from Pterodactyl
          </button>
          <button onClick={() => setCreating(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Egg
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-500" />
        </div>
      ) : eggs.length === 0 ? (
        <div className="card p-12 text-center">
          <Egg className="w-12 h-12 mx-auto text-gray-600 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No eggs</h2>
          <p className="text-gray-400 mb-6">Add server types for users to deploy.</p>
          <button onClick={() => setCreating(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Egg
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {nestGroups.map(([nestId, nestEggs]) => (
            <div key={nestId} className="card overflow-hidden">
              {/* Nest Header */}
              <button
                onClick={() => toggleNest(nestId)}
                className="w-full flex items-center justify-between p-4 bg-dark-700/50 hover:bg-dark-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expandedNests.has(nestId) ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                  <Folder className="w-5 h-5 text-accent-400" />
                  <span className="font-semibold text-white">Nest #{nestId}</span>
                  <span className="text-sm text-gray-500">({nestEggs.length} eggs)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${nestEggs.every(e => e.enabled) ? 'text-green-400' : nestEggs.some(e => e.enabled) ? 'text-yellow-400' : 'text-gray-500'}`}>
                    {nestEggs.filter(e => e.enabled).length} / {nestEggs.length} enabled
                  </span>
                </div>
              </button>
              
              {/* Eggs Table */}
              {expandedNests.has(nestId) && (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Pterodactyl ID</th>
                      <th>Docker Image</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nestEggs.map((egg) => (
                      <tr key={egg.id}>
                        <td>
                          <div>
                            <p className="font-medium text-white">{egg.name}</p>
                            <p className="text-xs text-gray-500 truncate max-w-[200px]">{egg.description}</p>
                          </div>
                        </td>
                        <td>{egg.pterodactylId}</td>
                        <td className="text-xs text-gray-400 truncate max-w-[150px]">{egg.dockerImage}</td>
                        <td>
                          <span className={egg.enabled ? 'badge-green' : 'badge-gray'}>
                            {egg.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <button onClick={() => setEditing(egg)} className="btn-ghost p-2">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => deleteEgg(egg.id)} className="btn-ghost p-2 text-red-400">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}

      {(editing || creating) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-dark-700">
              <h2 className="text-lg font-semibold text-white">
                {editing ? 'Edit Egg' : 'Add Egg'}
              </h2>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                saveEgg({
                  ...(editing?.id && { id: editing.id }),
                  name: fd.get('name') as string,
                  description: fd.get('description') as string,
                  nestId: parseInt(fd.get('nestId') as string),
                  pterodactylId: parseInt(fd.get('pterodactylId') as string),
                  dockerImage: fd.get('dockerImage') as string,
                  startup: fd.get('startup') as string,
                  environment: fd.get('environment') as string,
                  enabled: fd.get('enabled') === 'on',
                });
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="label">Name</label>
                <input type="text" name="name" defaultValue={editing?.name} className="input" required />
              </div>
              <div>
                <label className="label">Description</label>
                <input type="text" name="description" defaultValue={editing?.description || ''} className="input" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Nest ID</label>
                  <input type="number" name="nestId" defaultValue={editing?.nestId} className="input" required />
                </div>
                <div>
                  <label className="label">Pterodactyl Egg ID</label>
                  <input type="number" name="pterodactylId" defaultValue={editing?.pterodactylId} className="input" required />
                </div>
              </div>
              <div>
                <label className="label">Docker Image</label>
                <input type="text" name="dockerImage" defaultValue={editing?.dockerImage} className="input" required />
              </div>
              <div>
                <label className="label">Startup Command</label>
                <input type="text" name="startup" defaultValue={editing?.startup} className="input" required />
              </div>
              <div>
                <label className="label">Environment (JSON)</label>
                <textarea name="environment" defaultValue={editing?.environment || '{}'} className="input min-h-[100px]" />
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="enabled" defaultChecked={editing?.enabled ?? true} className="rounded" />
                <span className="text-sm text-gray-300">Enabled</span>
              </label>
              <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
                <button type="button" onClick={() => { setEditing(null); setCreating(false); }} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
