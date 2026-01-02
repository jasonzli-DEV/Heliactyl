import { useState, useEffect } from 'react';
import { MapPin, Plus, Edit, Trash2, Loader2, RefreshCw } from 'lucide-react';

interface Location {
  id: string;
  name: string;
  description: string | null;
  pterodactylId: number;
  enabled: boolean;
  hasCapacity?: boolean;
}

export default function AdminLocations() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/admin/locations', { credentials: 'include' });
      const data = await res.json();
      setLocations(data.locations || []);
    } catch (error) {
      console.error('Failed to fetch locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncLocations = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/admin/locations/sync', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.synced?.length > 0) {
        alert(`Synced ${data.synced.length} new locations from Pterodactyl`);
        fetchLocations();
      } else {
        alert('No new locations to sync');
      }
    } catch (error) {
      console.error('Failed to sync locations:', error);
    } finally {
      setSyncing(false);
    }
  };

  const saveLocation = async (loc: Partial<Location>) => {
    setSaving(true);
    try {
      const isNew = !loc.id;
      const res = await fetch(isNew ? '/api/admin/locations' : `/api/admin/locations/${loc.id}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(loc),
      });

      if (res.ok) {
        fetchLocations();
        setEditing(null);
        setCreating(false);
      }
    } catch (error) {
      console.error('Failed to save location:', error);
    } finally {
      setSaving(false);
    }
  };

  const deleteLocation = async (id: string) => {
    if (!confirm('Delete this location?')) return;
    try {
      await fetch(`/api/admin/locations/${id}`, { method: 'DELETE', credentials: 'include' });
      fetchLocations();
    } catch (error) {
      console.error('Failed to delete location:', error);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fadeIn">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Locations</h1>
          <p className="text-gray-400">Server deployment locations.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={syncLocations} disabled={syncing} className="btn-secondary">
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync from Pterodactyl
          </button>
          <button onClick={() => setCreating(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Location
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-500" />
        </div>
      ) : locations.length === 0 ? (
        <div className="card p-12 text-center">
          <MapPin className="w-12 h-12 mx-auto text-gray-600 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No locations</h2>
          <p className="text-gray-400 mb-6">Sync locations from Pterodactyl or add manually.</p>
          <button onClick={syncLocations} disabled={syncing} className="btn-primary">
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync from Pterodactyl
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Pterodactyl ID</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc) => (
                <tr key={loc.id}>
                  <td className="font-medium text-white">{loc.name}</td>
                  <td>{loc.description || '-'}</td>
                  <td>{loc.pterodactylId}</td>
                  <td>
                    {!loc.enabled ? (
                      <span className="badge-gray">Disabled</span>
                    ) : loc.hasCapacity === false ? (
                      <span className="badge-red">Full</span>
                    ) : (
                      <span className="badge-green">Enabled</span>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => setEditing(loc)} className="btn-ghost p-2">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteLocation(loc.id)} className="btn-ghost p-2 text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(editing || creating) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card w-full max-w-md">
            <div className="p-6 border-b border-dark-700">
              <h2 className="text-lg font-semibold text-white">
                {editing ? 'Edit Location' : 'Add Location'}
              </h2>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                saveLocation({
                  ...(editing?.id && { id: editing.id }),
                  name: fd.get('name') as string,
                  description: fd.get('description') as string,
                  pterodactylId: parseInt(fd.get('pterodactylId') as string),
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
              <div>
                <label className="label">Pterodactyl Location ID</label>
                <input type="number" name="pterodactylId" defaultValue={editing?.pterodactylId} className="input" required />
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
