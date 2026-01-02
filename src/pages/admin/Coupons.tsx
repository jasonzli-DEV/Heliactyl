import { useState, useEffect } from 'react';
import { Tags, Plus, Edit, Trash2, Loader2 } from 'lucide-react';

interface Coupon {
  id: string;
  code: string;
  coins: number;
  ram: number;
  disk: number;
  cpu: number;
  servers: number;
  databases: number;
  backups: number;
  allocations: number;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  enabled: boolean;
  _count: { uses: number };
}

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const res = await fetch('/api/admin/coupons', { credentials: 'include' });
      const data = await res.json();
      setCoupons(data.coupons || []);
    } catch (error) {
      console.error('Failed to fetch coupons:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveCoupon = async (coupon: Partial<Coupon>) => {
    setSaving(true);
    try {
      const isNew = !coupon.id;
      const res = await fetch(isNew ? '/api/admin/coupons' : `/api/admin/coupons/${coupon.id}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(coupon),
      });

      if (res.ok) {
        fetchCoupons();
        setEditing(null);
        setCreating(false);
      }
    } catch (error) {
      console.error('Failed to save coupon:', error);
    } finally {
      setSaving(false);
    }
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm('Delete this coupon?')) return;
    try {
      await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE', credentials: 'include' });
      fetchCoupons();
    } catch (error) {
      console.error('Failed to delete coupon:', error);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fadeIn">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Coupons</h1>
          <p className="text-gray-400">Redeemable coupon codes.</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Create Coupon
        </button>
      </div>

      {loading ? (
        <div className="card p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-500" />
        </div>
      ) : coupons.length === 0 ? (
        <div className="card p-12 text-center">
          <Tags className="w-12 h-12 mx-auto text-gray-600 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No coupons</h2>
          <p className="text-gray-400 mb-6">Create coupon codes for users to redeem.</p>
          <button onClick={() => setCreating(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Create Coupon
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Rewards</th>
                <th>Uses</th>
                <th>Expires</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon.id}>
                  <td className="font-mono text-accent-400">{coupon.code}</td>
                  <td className="text-xs text-gray-400">
                    {coupon.coins > 0 && <span>+{coupon.coins} coins </span>}
                    {coupon.ram > 0 && <span>+{coupon.ram}MB RAM </span>}
                    {coupon.disk > 0 && <span>+{coupon.disk}MB Disk </span>}
                    {coupon.servers > 0 && <span>+{coupon.servers} servers </span>}
                  </td>
                  <td>
                    {coupon.usedCount}
                    {coupon.maxUses ? ` / ${coupon.maxUses}` : ' / ∞'}
                  </td>
                  <td>
                    {coupon.expiresAt
                      ? new Date(coupon.expiresAt).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td>
                    <span className={coupon.enabled ? 'badge-green' : 'badge-gray'}>
                      {coupon.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => setEditing(coupon)} className="btn-ghost p-2">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteCoupon(coupon.id)} className="btn-ghost p-2 text-red-400">
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
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-dark-700">
              <h2 className="text-lg font-semibold text-white">
                {editing ? 'Edit Coupon' : 'Create Coupon'}
              </h2>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                saveCoupon({
                  ...(editing?.id && { id: editing.id }),
                  code: fd.get('code') as string,
                  coins: parseInt(fd.get('coins') as string) || 0,
                  ram: parseInt(fd.get('ram') as string) || 0,
                  disk: parseInt(fd.get('disk') as string) || 0,
                  cpu: parseInt(fd.get('cpu') as string) || 0,
                  servers: parseInt(fd.get('servers') as string) || 0,
                  databases: parseInt(fd.get('databases') as string) || 0,
                  backups: parseInt(fd.get('backups') as string) || 0,
                  allocations: parseInt(fd.get('allocations') as string) || 0,
                  maxUses: parseInt(fd.get('maxUses') as string) || null,
                  expiresAt: fd.get('expiresAt') as string || null,
                  enabled: fd.get('enabled') === 'on',
                });
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="label">Coupon Code</label>
                <input type="text" name="code" defaultValue={editing?.code} className="input uppercase" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Coins</label>
                  <input type="number" name="coins" defaultValue={editing?.coins || 0} className="input" />
                </div>
                <div>
                  <label className="label">Servers</label>
                  <input type="number" name="servers" defaultValue={editing?.servers || 0} className="input" />
                </div>
                <div>
                  <label className="label">RAM (MB)</label>
                  <input type="number" name="ram" defaultValue={editing?.ram || 0} className="input" />
                </div>
                <div>
                  <label className="label">Disk (MB)</label>
                  <input type="number" name="disk" defaultValue={editing?.disk || 0} className="input" />
                </div>
                <div>
                  <label className="label">CPU (%)</label>
                  <input type="number" name="cpu" defaultValue={editing?.cpu || 0} className="input" />
                </div>
                <div>
                  <label className="label">Databases</label>
                  <input type="number" name="databases" defaultValue={editing?.databases || 0} className="input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Max Uses (0 = unlimited)</label>
                  <input type="number" name="maxUses" defaultValue={editing?.maxUses || 0} className="input" />
                </div>
                <div>
                  <label className="label">Expires At</label>
                  <input
                    type="date"
                    name="expiresAt"
                    defaultValue={editing?.expiresAt ? new Date(editing.expiresAt).toISOString().split('T')[0] : ''}
                    className="input"
                  />
                </div>
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
