import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink, Coins, Gift, Link2, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface EarnLink {
  id: string;
  title: string;
  description: string;
  url: string;
  coins: number;
  cooldown: number;
  earnToken: string;
}

export default function Earn() {
  const { user, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [links, setLinks] = useState<EarnLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasCuty, setHasCuty] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [visitedLinks, setVisitedLinks] = useState<Set<string>>(new Set());
  const [claiming, setClaiming] = useState<string | null>(null);

  // Check for success from callback
  useEffect(() => {
    const success = searchParams.get('success');
    const coins = searchParams.get('coins');
    const error = searchParams.get('error');

    if (success === 'true' && coins) {
      setMessage({ type: 'success', text: `Congratulations! You earned ${coins} coins!` });
      refreshUser();
      // Clear URL params
      window.history.replaceState({}, '', '/earn');
    } else if (error) {
      const errorMessages: Record<string, string> = {
        invalid_token: 'Invalid earn token',
        token_not_found: 'Token not found',
        already_claimed: 'This reward has already been claimed',
        token_expired: 'This earn link has expired',
      };
      setMessage({ type: 'error', text: errorMessages[error] || 'An error occurred' });
      window.history.replaceState({}, '', '/earn');
    }
  }, [searchParams, refreshUser]);

  const loadEarnLinks = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/earn/links', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setLinks(data.links || []);
        setHasCuty(data.hasCuty || false);
      }
    } catch (err) {
      console.error('Failed to load earn links:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEarnLinks();
  }, []);

  const openLink = (link: EarnLink) => {
    window.open(link.url, '_blank');
    setVisitedLinks(prev => new Set(prev).add(link.id));
  };

  // Direct claim (for non-Cuty.io links)
  const claimReward = async (link: EarnLink) => {
    setClaiming(link.id);
    setMessage(null);

    try {
      const res = await fetch('/api/earn/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: link.earnToken }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessage({ type: 'success', text: `Earned ${data.coins} coins!` });
        refreshUser();
        // Reload links to get fresh tokens
        loadEarnLinks();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to claim reward' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to claim reward' });
    } finally {
      setClaiming(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="card p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-accent-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Earn Coins</h1>
        <p className="text-gray-400">
          {hasCuty
            ? 'Complete links through Cuty.io to earn coins! Each link can only be used once.'
            : 'Visit links to earn coins! Click a link, then claim your reward.'}
        </p>
      </div>

      {/* Stats Card */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Coins className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Your Balance</p>
              <p className="text-2xl font-bold text-white">{user?.coins?.toLocaleString() || 0} coins</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Available Links</p>
            <p className="text-2xl font-bold text-white">{links.length}</p>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 animate-fadeIn ${
          message.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      {/* Earn Links */}
      {links.length === 0 ? (
        <div className="card p-8 text-center">
          <Gift className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-400 mb-2">No Earn Links Available</h3>
          <p className="text-gray-500">Check back later for ways to earn coins!</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {links.map((link) => {
            const visited = visitedLinks.has(link.id);

            return (
              <div key={link.id} className="card p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Link2 className="w-4 h-4 text-accent-400" />
                      <h3 className="font-semibold text-white">{link.title}</h3>
                    </div>
                    <p className="text-sm text-gray-400 mb-3">{link.description}</p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1 text-amber-400">
                        <Coins className="w-4 h-4" />
                        {link.coins} coins
                      </span>
                      {hasCuty && (
                        <span className="flex items-center gap-1 text-blue-400">
                          <CheckCircle className="w-4 h-4" />
                          One-time use
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => openLink(link)}
                      className="btn-primary text-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {hasCuty ? 'Complete Link' : 'Visit Link'}
                    </button>
                    
                    {/* Show claim button only for non-Cuty.io setup */}
                    {!hasCuty && (
                      <button
                        onClick={() => claimReward(link)}
                        disabled={!visited || claiming === link.id}
                        className={`btn-secondary text-sm ${!visited ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {claiming === link.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Gift className="w-4 h-4" />
                            {visited ? 'Claim Reward' : 'Visit First'}
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info */}
      <div className="mt-8 card p-6 bg-dark-800/50">
        <h3 className="font-semibold text-white mb-2">How it works</h3>
        {hasCuty ? (
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-400">
            <li>Click "Complete Link" to open the Cuty.io shortened link</li>
            <li>Complete the link (pass through the shortener page)</li>
            <li>You'll be automatically redirected back and receive your coins</li>
            <li>Each link can only be used once - refresh the page for new links</li>
          </ol>
        ) : (
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-400">
            <li>Click "Visit Link" to open the earning link in a new tab</li>
            <li>Complete any required actions on the page</li>
            <li>Return here and click "Claim Reward" to receive your coins</li>
            <li>Each link can only be claimed once per session</li>
          </ol>
        )}
      </div>

      {/* Refresh button */}
      <div className="mt-4 text-center">
        <button
          onClick={loadEarnLinks}
          className="btn-secondary"
        >
          <Gift className="w-4 h-4" />
          Load New Links
        </button>
      </div>
    </div>
  );
}
