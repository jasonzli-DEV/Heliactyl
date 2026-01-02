import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Coins, Gift, CheckCircle, AlertCircle, Loader2, Clock, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface EarnStatus {
  enabled: boolean;
  coins: number;
  cooldown: number;
  canEarn: boolean;
  cooldownRemaining: number;
}

export default function Earn() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<EarnStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [cooldownTimer, setCooldownTimer] = useState(0);

  // Check for success from callback
  useEffect(() => {
    const success = searchParams.get('success');
    const coins = searchParams.get('coins');
    const error = searchParams.get('error');

    if (success === 'true' && coins) {
      setMessage({ type: 'success', text: `🎉 Congratulations! You earned ${coins} coins!` });
      // Show browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Coins Earned!', {
          body: `You earned ${coins} coins!`,
          icon: '/favicon.ico',
        });
      }
      // Show success toast
      showToast(`🎉 Congratulations! You earned ${coins} coins!`, 'success');
      refreshUser();
      loadStatus(); // Refresh status to get new cooldown
      window.history.replaceState({}, '', '/earn');
    } else if (error) {
      const errorMessages: Record<string, string> = {
        invalid_token: 'Invalid earn link',
        token_not_found: 'Link not found or expired',
        already_claimed: 'This reward has already been claimed',
        token_expired: 'This earn link has expired',
      };
      setMessage({ type: 'error', text: errorMessages[error] || 'An error occurred' });
      window.history.replaceState({}, '', '/earn');
    }
  }, [searchParams, refreshUser]);

  const loadStatus = async () => {
    try {
      const res = await fetch('/api/earn/status', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setCooldownTimer(data.cooldownRemaining || 0);
      }
    } catch (err) {
      console.error('Failed to load earn status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldownTimer <= 0) return;

    const interval = setInterval(() => {
      setCooldownTimer(prev => {
        if (prev <= 1) {
          loadStatus(); // Refresh when cooldown ends
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldownTimer]);

  const generateLink = async () => {
    setGenerating(true);
    setMessage(null);

    try {
      const res = await fetch('/api/earn/generate', {
        method: 'POST',
        credentials: 'include',
      });

      const data = await res.json();

      if (res.ok && data.url) {
        // Redirect user to Cuty.io link
        window.location.href = data.url;
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to generate earn link' });
        setGenerating(false);
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to generate earn link' });
      setGenerating(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto">
        <div className="card p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-accent-500" />
        </div>
      </div>
    );
  }

  if (!status?.enabled) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto animate-fadeIn">
        <div className="card p-8 text-center">
          <Gift className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Earning Disabled</h2>
          <p className="text-gray-400">Earning coins is currently not available. Check back later!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Earn Free Coins</h1>
        <p className="text-gray-400">Complete short links to earn coins for server hosting!</p>
      </div>

      {/* Balance Card */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Coins className="w-7 h-7 text-amber-400" />
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-400">Your Balance</p>
            <p className="text-3xl font-bold text-white">{user?.coins?.toLocaleString() || 0}</p>
            <p className="text-xs text-gray-500">coins</p>
          </div>
        </div>
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-center">
          <p className="text-xs text-blue-400">
            💡 Servers cost coins per hour while running. Keep earning to keep your servers online!
          </p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 animate-fadeIn ${
          message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {/* Main Earn Card */}
      <div className="card p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-accent-500/20 flex items-center justify-center mx-auto mb-6">
          <Gift className="w-10 h-10 text-accent-400" />
        </div>

        <h2 className="text-xl font-semibold text-white mb-2">
          Earn {status.coins} {status.coins === 1 ? 'Coin' : 'Coins'}
        </h2>
        <p className="text-gray-400 mb-6">
          Click the button below to start. You'll be redirected to complete a short link, then automatically return here with your coins!
        </p>

        {cooldownTimer > 0 ? (
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400">
              <Clock className="w-5 h-5" />
              <span className="font-mono text-lg">{formatTime(cooldownTimer)}</span>
            </div>
            <p className="text-sm text-gray-500">Wait for the cooldown to earn again</p>
          </div>
        ) : (
          <button
            onClick={generateLink}
            disabled={generating}
            className="btn-primary text-lg px-8 py-3"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <ExternalLink className="w-5 h-5" />
                Earn Coins Now
              </>
            )}
          </button>
        )}
      </div>

      {/* How it works */}
      <div className="mt-6 card p-6 bg-dark-800/50">
        <h3 className="font-semibold text-white mb-3">How it works</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-400">
          <li>Click "Earn Coins Now" to start</li>
          <li>Complete the short link (takes ~10 seconds)</li>
          <li>You'll be automatically redirected back with your coins!</li>
          <li>Wait {Math.floor(status.cooldown / 60)} minutes between each earn</li>
        </ol>
      </div>
    </div>
  );
}

