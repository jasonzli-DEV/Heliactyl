import { useState, useEffect, useCallback } from 'react';
import { Users, Search, ChevronLeft, ChevronRight, Shield, Ban, Trash2, Loader2, Edit } from 'lucide-react';

interface User {
  id: string;
  discordId: string;
  username: string;
  email: string | null;
  avatar: string | null;
  isAdmin: boolean;
  banned: boolean;
  banReason: string | null;
  banExpiresAt: string | null;
  coins: number;
  servers: number;
  pterodactylId: number | null;
  createdAt: string;
  _count: { servers: number };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchUsers();
  }, [pagination.page, debouncedSearch]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: '20',
        ...(debouncedSearch && { search: debouncedSearch }),
      });
      const res = await fetch(`/api/admin/users?${params}`, { credentials: 'include' });
      const data = await res.json();
      setUsers(data.users || []);
      if (data.pagination) {
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (userId: string, updates: Partial<User>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        fetchUsers();
        setEditingUser(null);
      }
    } catch (error) {
      console.error('Failed to update user:', error);
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This will also delete all their servers.')) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        fetchUsers();
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Users</h1>
          <p className="text-gray-400">Manage user accounts and resources.</p>
        </div>
      </div>

      {/* Search */}
      <div className="card p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            placeholder="Search by username, email, or Discord ID..."
            className="input pl-10 w-full"
          />
        </div>
      </div>

      {/* Users table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Servers</th>
                <th>Coins</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-500" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        {user.avatar ? (
                          <img src={user.avatar} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-dark-600 flex items-center justify-center">
                            <Users className="w-4 h-4 text-gray-500" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-white">{user.username}</p>
                          <p className="text-xs text-gray-500">{user.email || user.discordId}</p>
                        </div>
                      </div>
                    </td>
                    <td>{user._count.servers}</td>
                    <td>{user.coins.toLocaleString()}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        {user.isAdmin && (
                          <span className="badge-blue">
                            <Shield className="w-3 h-3 mr-1" />
                            Admin
                          </span>
                        )}
                        {user.banned && (
                          <span className="badge-red">
                            <Ban className="w-3 h-3 mr-1" />
                            Banned
                          </span>
                        )}
                        {!user.isAdmin && !user.banned && (
                          <span className="badge-green">Active</span>
                        )}
                      </div>
                    </td>
                    <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingUser(user)}
                          className="btn-ghost p-2"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteUser(user.id)}
                          className="btn-ghost p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-dark-700">
            <p className="text-sm text-gray-500">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page === 1}
                className="btn-ghost p-2"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-400">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page === pagination.pages}
                className="btn-ghost p-2"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit user modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-dark-700">
              <h2 className="text-lg font-semibold text-white">Edit User: {editingUser.username}</h2>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const banned = formData.get('banned') === 'on';
                const banDuration = formData.get('banDuration') as string;
                
                // Calculate ban expiration date
                let banExpiresAt: string | null = null;
                if (banned && banDuration) {
                  const now = new Date();
                  const match = banDuration.match(/^(\d+)(h|d)$/);
                  if (match) {
                    const value = parseInt(match[1]);
                    const unit = match[2];
                    if (unit === 'h') {
                      now.setHours(now.getHours() + value);
                    } else if (unit === 'd') {
                      now.setDate(now.getDate() + value);
                    }
                    banExpiresAt = now.toISOString();
                  }
                }
                
                updateUser(editingUser.id, {
                  isAdmin: formData.get('isAdmin') === 'on',
                  banned,
                  banReason: formData.get('banReason') as string,
                  banExpiresAt,
                  coins: parseInt(formData.get('coins') as string) || 0,
                  servers: parseInt(formData.get('servers') as string) || 0,
                } as Partial<User>);
              }}
              className="p-6 space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="isAdmin"
                    defaultChecked={editingUser.isAdmin}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-300">Admin</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="banned"
                    defaultChecked={editingUser.banned}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-300">Banned</span>
                </label>
              </div>

              <div>
                <label className="label">Ban Reason</label>
                <input
                  type="text"
                  name="banReason"
                  defaultValue={editingUser.banReason || ''}
                  className="input"
                  placeholder="Reason for ban..."
                />
              </div>

              <div>
                <label className="label">Ban Duration</label>
                <select name="banDuration" className="input" defaultValue="">
                  <option value="">Permanent</option>
                  <option value="1h">1 Hour</option>
                  <option value="6h">6 Hours</option>
                  <option value="12h">12 Hours</option>
                  <option value="1d">1 Day</option>
                  <option value="3d">3 Days</option>
                  <option value="7d">7 Days</option>
                  <option value="14d">14 Days</option>
                  <option value="30d">30 Days</option>
                  <option value="90d">90 Days</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Leave as 'Permanent' for indefinite ban</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Coins</label>
                  <input
                    type="number"
                    name="coins"
                    defaultValue={editingUser.coins}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Servers</label>
                  <input
                    type="number"
                    name="servers"
                    defaultValue={editingUser.servers}
                    className="input"
                  />
                </div>

              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
