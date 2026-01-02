import { useState, useEffect } from 'react';
import { Server, Trash2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

interface ServerData {
  id: string;
  pterodactylId: number;
  pterodactylUuid: string;
  name: string;
  ram: number;
  disk: number;
  cpu: number;
  user: { id: string; username: string; discordId: string };
  location: { name: string } | null;
  egg: { name: string } | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function AdminServers() {
  const [servers, setServers] = useState<ServerData[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchServers();
  }, [pagination.page]);

  const fetchServers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/servers?page=${pagination.page}`, { credentials: 'include' });
      const data = await res.json();
      setServers(data.servers || []);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Failed to fetch servers:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteServer = async (serverId: string) => {
    if (!confirm('Are you sure you want to delete this server?')) return;

    setDeleting(serverId);
    try {
      const res = await fetch(`/api/admin/servers/${serverId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        fetchServers();
      }
    } catch (error) {
      console.error('Failed to delete server:', error);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fadeIn">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Servers</h1>
        <p className="text-gray-400">Manage all servers across users.</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Server</th>
                <th>Owner</th>
                <th>Location</th>
                <th>Resources</th>
                <th>Created</th>
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
              ) : servers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    No servers found
                  </td>
                </tr>
              ) : (
                servers.map((server) => (
                  <tr key={server.id}>
                    <td>
                      <div>
                        <p className="font-medium text-white">{server.name}</p>
                        <p className="text-xs text-gray-500">{server.egg?.name}</p>
                      </div>
                    </td>
                    <td>
                      <p className="text-sm">{server.user.username}</p>
                    </td>
                    <td>{server.location?.name || '-'}</td>
                    <td>
                      <p className="text-xs text-gray-400">
                        {server.ram}MB / {server.disk}MB / {server.cpu}%
                      </p>
                    </td>
                    <td>{new Date(server.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button
                        onClick={() => deleteServer(server.id)}
                        disabled={deleting === server.id}
                        className="btn-ghost p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        {deleting === server.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

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
    </div>
  );
}
