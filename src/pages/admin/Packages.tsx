import { useState, useEffect } from 'react';
import { Package, Plus, Edit, Trash2, Loader2 } from 'lucide-react';

interface PackageData {
  id: string;
  name: string;
  description: string | null;
  price: number;
  ram: number;
  disk: number;
  cpu: number;
  servers: number;
  databases: number;
  backups: number;
  allocations: number;
  enabled: boolean;
}

export default function AdminPackages() {
  const [packages, setPackages] = useState<PackageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PackageData | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const res = await fetch('/api/admin/packages', { credentials: 'include' });
      const data = await res.json();
      setPackages(data.packages || []);
    } catch (error) {
      console.error('Failed to fetch packages:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePackage = async (pkg: Partial<PackageData>) => {
    setSaving(true);
    try {
      const isNew = !pkg.id;
      const res = await fetch(isNew ? '/api/admin/packages' : `/api/admin/packages/${pkg.id}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(pkg),
      });

      if (res.ok) {
        fetchPackages();
        setEditing(null);
        setCreating(false);
      }
    } catch (error) {
      console.error('Failed to save package:', error);
    } finally {
      setSaving(false);
    }
  };

  const deletePackage = async (id: string) => {
    if (!confirm('Delete this package?')) return;

    try {
      await fetch(`/api/admin/packages/${id}`, { method: 'DELETE', credentials: 'include' });
      fetchPackages();
    } catch (error) {
      console.error('Failed to delete package:', error);
    }
  };

  const PackageForm = ({ pkg, onCancel }: { pkg?: PackageData; onCancel: () => void }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-dark-700">
          <h2 className="text-lg font-semibold text-white">
            {pkg ? 'Edit Package' : 'Create Package'}
          </h2>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            savePackage({
              ...(pkg?.id && { id: pkg.id }),
              name: fd.get('name') as string,
              description: fd.get('description') as string,
              price: parseInt(fd.get('price') as string) || 0,
              ram: parseInt(fd.get('ram') as string) || 0,
              disk: parseInt(fd.get('disk') as string) || 0,
              cpu: parseInt(fd.get('cpu') as string) || 0,
              servers: parseInt(fd.get('servers') as string) || 0,
              databases: parseInt(fd.get('databases') as string) || 0,
              backups: parseInt(fd.get('backups') as string) || 0,
              allocations: parseInt(fd.get('allocations') as string) || 0,
              enabled: fd.get('enabled') === 'on',
            });
          }}
          className="p-6 space-y-4"
        >
          <div>
            <label className="label">Name</label>
            <input type="text" name="name" defaultValue={pkg?.name} className="input" required />
          </div>
          <div>
            <label className="label">Description</label>
            <input type="text" name="description" defaultValue={pkg?.description || ''} className="input" />
          </div>
          <div>
            <label className="label">Price (coins)</label>
            <input type="number" name="price" min="0" defaultValue={pkg?.price || 0} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">RAM (MB)</label>
              <input type="number" name="ram" defaultValue={pkg?.ram || 0} className="input" />
            </div>
            <div>
              <label className="label">Disk (MB)</label>
              <input type="number" name="disk" defaultValue={pkg?.disk || 0} className="input" />
            </div>
            <div>
              <label className="label">CPU (%)</label>
              <input type="number" name="cpu" defaultValue={pkg?.cpu || 0} className="input" />
            </div>
            <div>
              <label className="label">Servers</label>
              <input type="number" name="servers" defaultValue={pkg?.servers || 0} className="input" />
            </div>
            <div>
              <label className="label">Databases</label>
              <input type="number" name="databases" defaultValue={pkg?.databases || 0} className="input" />
            </div>
            <div>
              <label className="label">Backups</label>
              <input type="number" name="backups" defaultValue={pkg?.backups || 0} className="input" />
            </div>
            <div>
              <label className="label">Ports</label>
              <input type="number" name="allocations" defaultValue={pkg?.allocations || 0} className="input" />
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="enabled" defaultChecked={pkg?.enabled ?? true} className="rounded" />
            <span className="text-sm text-gray-300">Enabled</span>
          </label>
          <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
            <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fadeIn">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Packages</h1>
          <p className="text-gray-400">Resource packages for the store.</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Package
        </button>
      </div>

      {loading ? (
        <div className="card p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-500" />
        </div>
      ) : packages.length === 0 ? (
        <div className="card p-12 text-center">
          <Package className="w-12 h-12 mx-auto text-gray-600 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No packages</h2>
          <p className="text-gray-400 mb-6">Create your first store package.</p>
          <button onClick={() => setCreating(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Create Package
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map((pkg) => (
            <div key={pkg.id} className={`card p-6 ${!pkg.enabled ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-white">{pkg.name}</h3>
                  <p className="text-sm text-gray-500">{pkg.description}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditing(pkg)} className="btn-ghost p-2">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => deletePackage(pkg.id)} className="btn-ghost p-2 text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-2xl font-bold text-accent-400 mb-4">{pkg.price} coins</p>
              <div className="text-xs text-gray-400 space-y-1">
                {pkg.ram > 0 && <p>+{pkg.ram} MB RAM</p>}
                {pkg.disk > 0 && <p>+{pkg.disk} MB Disk</p>}
                {pkg.cpu > 0 && <p>+{pkg.cpu}% CPU</p>}
                {pkg.servers > 0 && <p>+{pkg.servers} Servers</p>}
                {pkg.databases > 0 && <p>+{pkg.databases} Databases</p>}
                {pkg.backups > 0 && <p>+{pkg.backups} Backups</p>}
                {pkg.allocations > 0 && <p>+{pkg.allocations} Ports</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {(editing || creating) && (
        <PackageForm
          pkg={editing || undefined}
          onCancel={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}
