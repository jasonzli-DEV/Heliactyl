import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShoppingCart, MemoryStick, HardDrive, Cpu, Server, Database, Archive, Network, Loader2, Check } from 'lucide-react';

interface Package {
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
}

export default function Store() {
  const { user, refreshUser } = useAuth();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const res = await fetch('/api/store/packages', { credentials: 'include' });
      const data = await res.json();
      setPackages(data.packages || []);
    } catch (error) {
      console.error('Failed to fetch packages:', error);
    } finally {
      setLoading(false);
    }
  };

  const purchasePackage = async (pkg: Package) => {
    if ((user?.coins || 0) < pkg.price) {
      setError('Insufficient coins');
      return;
    }

    setPurchasing(pkg.id);
    setError('');
    setSuccess(null);

    try {
      const res = await fetch(`/api/store/purchase/${pkg.id}`, {
        method: 'POST',
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to purchase');
      }

      setSuccess(pkg.name);
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setPurchasing(null);
    }
  };

  const formatResource = (value: number, unit: string) => {
    if (value === 0) return null;
    return `+${value.toLocaleString()} ${unit}`;
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Coin Store</h1>
        <p className="text-gray-400">
          Purchase coins to pay for server hosting.
          <span className="ml-2 text-accent-400">
            Balance: {user?.coins?.toLocaleString() || 0} coins
          </span>
        </p>
        <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-sm text-blue-400">
            💡 Servers are billed hourly while running. Costs depend on RAM, Disk, and CPU allocated.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2">
          <Check className="w-4 h-4 text-green-400" />
          <p className="text-sm text-green-400">Successfully purchased {success}!</p>
        </div>
      )}

      {/* Packages grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-6">
              <div className="skeleton h-6 w-32 mb-2" />
              <div className="skeleton h-4 w-full mb-4" />
              <div className="skeleton h-10 w-24 mb-4" />
              <div className="space-y-2">
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : packages.length === 0 ? (
        <div className="card p-12 text-center">
          <ShoppingCart className="w-12 h-12 mx-auto text-gray-600 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No packages available</h2>
          <p className="text-gray-400">Check back later for resource packages.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map((pkg) => {
            const resources = [
              { icon: MemoryStick, value: formatResource(pkg.ram, 'MB RAM'), color: 'text-green-400' },
              { icon: HardDrive, value: formatResource(pkg.disk, 'MB Disk'), color: 'text-yellow-400' },
              { icon: Cpu, value: formatResource(pkg.cpu, '% CPU'), color: 'text-red-400' },
              { icon: Server, value: formatResource(pkg.servers, 'Servers'), color: 'text-blue-400' },
              { icon: Database, value: formatResource(pkg.databases, 'Databases'), color: 'text-purple-400' },
              { icon: Archive, value: formatResource(pkg.backups, 'Backups'), color: 'text-orange-400' },
              { icon: Network, value: formatResource(pkg.allocations, 'Allocations'), color: 'text-cyan-400' },
            ].filter((r) => r.value);

            return (
              <div key={pkg.id} className="card p-6 flex flex-col">
                <h3 className="text-lg font-semibold text-white">{pkg.name}</h3>
                {pkg.description && (
                  <p className="text-sm text-gray-400 mt-1">{pkg.description}</p>
                )}

                <div className="mt-4 mb-6">
                  <span className="text-3xl font-bold text-white">
                    {pkg.price.toLocaleString()}
                  </span>
                  <span className="text-gray-400 ml-1">coins</span>
                </div>

                <div className="flex-1 space-y-2 mb-6">
                  {resources.map(({ icon: Icon, value, color }, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Icon className={`w-4 h-4 ${color}`} />
                      <span className="text-gray-300">{value}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => purchasePackage(pkg)}
                  disabled={purchasing === pkg.id || (user?.coins || 0) < pkg.price}
                  className={`btn w-full ${
                    (user?.coins || 0) < pkg.price
                      ? 'bg-dark-700 text-gray-500 cursor-not-allowed'
                      : 'btn-primary'
                  }`}
                >
                  {purchasing === pkg.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Purchasing...
                    </>
                  ) : (user?.coins || 0) < pkg.price ? (
                    'Insufficient Coins'
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" />
                      Purchase
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
