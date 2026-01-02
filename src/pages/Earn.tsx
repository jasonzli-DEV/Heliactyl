import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Coins, Gift, CheckCircle, AlertCircle, Loader2, Clock, ExternalLink, Play, Square } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

// Simple Discord SVG icon component
const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

interface LinkEarnStatus {
  enabled: boolean;
  coins: number;
  cooldown: number;
  canEarn: boolean;
  cooldownRemaining: number;
}

interface StatusEarnInfo {
  enabled: boolean;
  botReady?: boolean;
  requiredText?: string;
  coins?: number;
  interval?: number;
  intervalDisplay?: string;
  coinsDisplay?: string;
  active?: boolean;
  lastRewarded?: string;
  consecutiveSec?: number;
  message?: string;
}

export default function Earn() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  
  // Link earning state
  const [linkStatus, setLinkStatus] = useState<LinkEarnStatus | null>(null);
  const [linkLoading, setLinkLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [cooldownTimer, setCooldownTimer] = useState(0);

  // Status earning state
  const [statusEarn, setStatusEarn] = useState<StatusEarnInfo | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [activating, setActivating] = useState(false);

  // Check for success from callback
  useEffect(() => {
    const success = searchParams.get('success');
    const coins = searchParams.get('coins');
    const error = searchParams.get('error');

    if (success === 'true' && coins) {
      setMessage({ type: 'success', text: `🎉 Congratulations! You earned ${coins} coins!` });
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Coins Earned!', {
          body: `You earned ${coins} coins!`,
          icon: '/favicon.ico',
        });
      }
      showToast(`🎉 Congratulations! You earned ${coins} coins!`, 'success');
      refreshUser();
      loadLinkStatus();
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

  const loadLinkStatus = async () => {
    try {
      const res = await fetch('/api/earn/status', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setLinkStatus(data);
        setCooldownTimer(data.cooldownRemaining || 0);
      }
    } catch (err) {
      console.error('Failed to load link earn status:', err);
    } finally {
      setLinkLoading(false);
    }
  };

  const loadStatusEarn = async () => {
    try {
      const res = await fetch('/api/status-earn/status', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStatusEarn(data);
      }
    } catch (err) {
      console.error('Failed to load status earn info:', err);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    loadLinkStatus();
    loadStatusEarn();
  }, []);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldownTimer <= 0) return;

    const interval = setInterval(() => {
      setCooldownTimer(prev => {
        if (prev <= 1) {
          loadLinkStatus();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldownTimer]);

  // Refresh status earn info every 10 seconds when active
  useEffect(() => {
    if (!statusEarn?.active) return;

    const interval = setInterval(() => {
      loadStatusEarn();
      refreshUser();
    }, 10000);

    return () => clearInterval(interval);
  }, [statusEarn?.active, refreshUser]);

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

  const toggleStatusEarn = async () => {
    setActivating(true);

    try {
      const endpoint = statusEarn?.active ? '/api/status-earn/deactivate' : '/api/status-earn/activate';
      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
      });

      const data = await res.json();

      if (res.ok) {
        showToast(data.message, 'success');
        loadStatusEarn();
      } else {
        showToast(data.error || 'Failed to update status earning', 'error');
      }
    } catch {
      showToast('Failed to update status earning', 'error');
    } finally {
      setActivating(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatConsecutiveTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  if (linkLoading && statusLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="card p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-accent-500" />
        </div>
      </div>
    );
  }

  const noEarningMethods = !linkStatus?.enabled && !statusEarn?.enabled;

  if (noEarningMethods) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto animate-fadeIn">
        <div className="card p-8 text-center">
          <Gift className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Earning Disabled</h2>
          <p className="text-gray-400">Earning coins is currently not available. Check back later!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Earn Free Coins</h1>
        <p className="text-gray-400">Complete tasks to earn coins for server hosting!</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Link Earning Card */}
        {linkStatus?.enabled && (
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-accent-500/20 flex items-center justify-center">
                <ExternalLink className="w-6 h-6 text-accent-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Link Earning</h2>
                <p className="text-sm text-gray-400">Complete short links</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-dark-700/50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Reward:</span>
                  <span className="text-white font-medium">
                    {linkStatus.coins} {linkStatus.coins === 1 ? 'coin' : 'coins'}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-400">Cooldown:</span>
                  <span className="text-white font-medium">{Math.floor(linkStatus.cooldown / 60)} min</span>
                </div>
              </div>

              {cooldownTimer > 0 ? (
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400">
                    <Clock className="w-4 h-4" />
                    <span className="font-mono">{formatTime(cooldownTimer)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Wait for cooldown</p>
                </div>
              ) : (
                <button
                  onClick={generateLink}
                  disabled={generating}
                  className="btn-primary w-full"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Gift className="w-4 h-4" />
                      Earn Now
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Discord Status Earning Card */}
        {statusEarn?.enabled && (
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                <DiscordIcon className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Discord Status</h2>
                <p className="text-sm text-gray-400">Earn while online</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-dark-700/50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Reward:</span>
                  <span className="text-white font-medium">{statusEarn.coinsDisplay}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-400">Every:</span>
                  <span className="text-white font-medium">{statusEarn.intervalDisplay}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-dark-600">
                  <p className="text-xs text-gray-400">Required status text:</p>
                  <p className="text-sm text-indigo-400 font-medium mt-1">"{statusEarn.requiredText}"</p>
                </div>
              </div>

              {statusEarn.active ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 text-green-400">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-sm font-medium">Active</span>
                  </div>
                  
                  {statusEarn.consecutiveSec !== undefined && statusEarn.consecutiveSec > 0 && (
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Time with valid status</p>
                      <p className="text-lg font-mono text-white">{formatConsecutiveTime(statusEarn.consecutiveSec)}</p>
                    </div>
                  )}

                  <button
                    onClick={toggleStatusEarn}
                    disabled={activating}
                    className="btn-secondary w-full"
                  >
                    {activating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Square className="w-4 h-4" />
                        Stop Earning
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-xs text-indigo-300">
                    <p className="font-medium mb-1">How it works:</p>
                    <ol className="list-decimal list-inside space-y-1 text-indigo-300/80">
                      <li>Set your Discord custom status to include the required text</li>
                      <li>Click "Start Earning" below</li>
                      <li>Stay online with the status to earn coins automatically!</li>
                    </ol>
                  </div>

                  <button
                    onClick={toggleStatusEarn}
                    disabled={activating || !statusEarn.botReady}
                    className="btn-primary w-full bg-indigo-600 hover:bg-indigo-700"
                  >
                    {activating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : !statusEarn.botReady ? (
                      <>
                        <AlertCircle className="w-4 h-4" />
                        Bot Offline
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Start Earning
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* How it works - only show if link earning is enabled */}
      {linkStatus?.enabled && (
        <div className="mt-6 card p-6 bg-dark-800/50">
          <h3 className="font-semibold text-white mb-3">How Link Earning Works</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-400">
            <li>Click "Earn Now" to start</li>
            <li>Complete the short link (takes ~10 seconds)</li>
            <li>You'll be automatically redirected back with your coins!</li>
            <li>Wait {Math.floor((linkStatus?.cooldown || 300) / 60)} minutes between each earn</li>
          </ol>
        </div>
      )}
    </div>
  );
}

