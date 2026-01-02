import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Ticket, Loader2, Check, Gift } from 'lucide-react';

interface RedeemResult {
  coins: number;
  ram: number;
  disk: number;
  cpu: number;
  servers: number;
  databases: number;
  backups: number;
  allocations: number;
}

export default function Redeem() {
  const { refreshUser } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<RedeemResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/user/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to redeem code');
      }

      setResult(data.rewards);
      setCode('');
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to redeem code');
    } finally {
      setLoading(false);
    }
  };

  const formatReward = (value: number, label: string, unit?: string) => {
    if (value === 0) return null;
    return `+${value.toLocaleString()} ${label}${unit ? ` ${unit}` : ''}`;
  };

  return (
    <div className="p-6 lg:p-8 max-w-xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="w-16 h-16 rounded-full bg-accent-500/10 flex items-center justify-center mx-auto mb-4">
          <Ticket className="w-8 h-8 text-accent-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Redeem Code</h1>
        <p className="text-gray-400">Enter a coupon code to claim your rewards.</p>
      </div>

      {/* Redeem form */}
      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Coupon Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ENTER-CODE-HERE"
              className="input text-center uppercase tracking-widest text-lg"
              autoComplete="off"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="btn-primary w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Redeeming...
              </>
            ) : (
              <>
                <Gift className="w-4 h-4" />
                Redeem Code
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-400 text-center">{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Check className="w-5 h-5 text-green-400" />
              <p className="font-medium text-green-400">Code redeemed successfully!</p>
            </div>
            <div className="space-y-1 text-sm text-gray-300">
              {formatReward(result.coins, 'Coins') && (
                <p>{formatReward(result.coins, 'Coins')}</p>
              )}
              {formatReward(result.ram, 'RAM', 'MB') && (
                <p>{formatReward(result.ram, 'RAM', 'MB')}</p>
              )}
              {formatReward(result.disk, 'Disk', 'MB') && (
                <p>{formatReward(result.disk, 'Disk', 'MB')}</p>
              )}
              {formatReward(result.cpu, 'CPU', '%') && (
                <p>{formatReward(result.cpu, 'CPU', '%')}</p>
              )}
              {formatReward(result.servers, 'Servers') && (
                <p>{formatReward(result.servers, 'Servers')}</p>
              )}
              {formatReward(result.databases, 'Databases') && (
                <p>{formatReward(result.databases, 'Databases')}</p>
              )}
              {formatReward(result.backups, 'Backups') && (
                <p>{formatReward(result.backups, 'Backups')}</p>
              )}
              {formatReward(result.allocations, 'Allocations') && (
                <p>{formatReward(result.allocations, 'Allocations')}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
