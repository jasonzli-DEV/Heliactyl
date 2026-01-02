import { useState, useEffect } from 'react';
import { Users, Server, Coins, TrendingUp, UserPlus, ServerCog } from 'lucide-react';

interface Stats {
  totalUsers: number;
  totalServers: number;
  activeUsers: number;
  totalCoins: number;
  recentUsers: number;
  recentServers: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats', { credentials: 'include' });
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = stats
    ? [
        {
          label: 'Total Users',
          value: stats.totalUsers,
          icon: Users,
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/10',
        },
        {
          label: 'Total Servers',
          value: stats.totalServers,
          icon: Server,
          color: 'text-green-400',
          bgColor: 'bg-green-500/10',
        },
        {
          label: 'Active Users',
          value: stats.activeUsers,
          icon: TrendingUp,
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-500/10',
        },
        {
          label: 'Total Coins',
          value: stats.totalCoins,
          icon: Coins,
          color: 'text-purple-400',
          bgColor: 'bg-purple-500/10',
        },
        {
          label: 'New Users (7d)',
          value: stats.recentUsers,
          icon: UserPlus,
          color: 'text-cyan-400',
          bgColor: 'bg-cyan-500/10',
        },
        {
          label: 'New Servers (7d)',
          value: stats.recentServers,
          icon: ServerCog,
          color: 'text-orange-400',
          bgColor: 'bg-orange-500/10',
        },
      ]
    : [];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Admin Dashboard</h1>
        <p className="text-gray-400">Overview of your EnderBit dashboard.</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card p-6">
                <div className="skeleton h-4 w-24 mb-2" />
                <div className="skeleton h-8 w-32" />
              </div>
            ))
          : statCards.map(({ label, value, icon: Icon, color, bgColor }) => (
              <div key={label} className="card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${bgColor}`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-400">{label}</span>
                </div>
                <p className="text-3xl font-bold text-white">
                  {(value ?? 0).toLocaleString()}
                </p>
              </div>
            ))}
      </div>
    </div>
  );
}
