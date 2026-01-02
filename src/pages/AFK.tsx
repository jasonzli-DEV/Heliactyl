import { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, Coins, Play, Pause, CheckCircle, AlertCircle, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';

interface AFKSession {
  startedAt: number;
  totalSeconds: number;
  coinsEarned: number;
  isActive: boolean;
}

export default function AFK() {
  const { user, refreshUser } = useAuth();
  const [session, setSession] = useState<AFKSession>({
    startedAt: 0,
    totalSeconds: 0,
    coinsEarned: 0,
    isActive: false,
  });
  const [settings, setSettings] = useState({
    coinsPerMinute: 1,
    minInterval: 60,
    maxSessionMinutes: 60,
  });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [error, setError] = useState('');
  const [interactionRequired, setInteractionRequired] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const interactionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings/public');
        if (res.ok) {
          const data = await res.json();
          setSettings({
            coinsPerMinute: data.afkCoinsPerMinute || 1,
            minInterval: data.afkInterval || 60,
            maxSessionMinutes: data.afkMaxMinutes || 60,
          });
        }
      } catch (err) {
        console.error('Failed to load AFK settings:', err);
      }
    };
    loadSettings();
  }, []);

  // Create audio element for notifications
  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2telesBhBAAATJ3ovHo4CwNUqdO/dTs7R4S60Mp/OCdBhLfPt2gyP0F/qOG/Zi0wPXmr5cltGy47fabkzWonGTdvrebIbSEYMG6l5ctvIRgwb6blzHAiGTBwp+bMciQbMnKp581zJRwzdavp0HUmHTV3rerSdygfN3qw7NN4Kh84e7Hu1HkrIDl8s/DWei0hOn60');
    return () => {
      if (audioRef.current) {
        audioRef.current = null;
      }
    };
  }, []);

  const playNotification = useCallback(() => {
    if (soundEnabled && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  }, [soundEnabled]);

  // Handle interaction check
  const requestInteraction = useCallback(() => {
    setInteractionRequired(true);
    playNotification();
  }, [playNotification]);

  const confirmInteraction = async () => {
    setInteractionRequired(false);
    
    // Claim coins for the elapsed time
    const elapsedMinutes = Math.floor(session.totalSeconds / 60);
    if (elapsedMinutes > 0) {
      try {
        const res = await fetch('/api/user/afk/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ minutes: elapsedMinutes }),
        });
        
        if (res.ok) {
          const data = await res.json();
          setSession((prev) => ({
            ...prev,
            coinsEarned: prev.coinsEarned + data.coinsEarned,
            totalSeconds: prev.totalSeconds % 60, // Keep remaining seconds
          }));
          refreshUser();
        }
      } catch (err) {
        console.error('Failed to claim AFK coins:', err);
      }
    }

    // Schedule next interaction check
    scheduleInteractionCheck();
  };

  const scheduleInteractionCheck = useCallback(() => {
    if (interactionTimerRef.current) {
      clearTimeout(interactionTimerRef.current);
    }
    
    // Random interval between 2-5 minutes for anti-bot
    const randomDelay = (120 + Math.random() * 180) * 1000;
    interactionTimerRef.current = setTimeout(requestInteraction, randomDelay);
  }, [requestInteraction]);

  // Start AFK session
  const startSession = () => {
    if (interactionRequired) return;
    
    setSession({
      startedAt: Date.now(),
      totalSeconds: 0,
      coinsEarned: 0,
      isActive: true,
    });
    setError('');
    scheduleInteractionCheck();
  };

  // Stop AFK session
  const stopSession = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (interactionTimerRef.current) {
      clearTimeout(interactionTimerRef.current);
      interactionTimerRef.current = null;
    }

    // Claim remaining coins
    const elapsedMinutes = Math.floor(session.totalSeconds / 60);
    if (elapsedMinutes > 0) {
      try {
        const res = await fetch('/api/user/afk/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ minutes: elapsedMinutes }),
        });
        
        if (res.ok) {
          const data = await res.json();
          setSession((prev) => ({
            ...prev,
            coinsEarned: prev.coinsEarned + data.coinsEarned,
            isActive: false,
          }));
          refreshUser();
        }
      } catch (err) {
        console.error('Failed to claim AFK coins:', err);
      }
    } else {
      setSession((prev) => ({ ...prev, isActive: false }));
    }
    setInteractionRequired(false);
  };

  // Timer update
  useEffect(() => {
    if (!session.isActive) return;

    timerRef.current = setInterval(() => {
      setSession((prev) => {
        const newSeconds = prev.totalSeconds + 1;
        const maxSeconds = settings.maxSessionMinutes * 60;
        
        if (newSeconds >= maxSeconds) {
          stopSession();
          setError('Maximum session time reached');
          return prev;
        }
        
        return { ...prev, totalSeconds: newSeconds };
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [session.isActive, settings.maxSessionMinutes]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
    };
  }, []);

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const pendingCoins = Math.floor(session.totalSeconds / 60) * settings.coinsPerMinute;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">AFK Rewards</h1>
          <p className="text-gray-400">
            Earn coins passively by keeping this page open. You'll be asked to confirm
            you're still there periodically.
          </p>
        </div>

        {/* Settings Card */}
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Reward Settings</h2>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="btn-secondary p-2"
              title={soundEnabled ? 'Mute notifications' : 'Enable notifications'}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">{settings.coinsPerMinute}</p>
              <p className="text-sm text-gray-400">Coins/minute</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{settings.minInterval}s</p>
              <p className="text-sm text-gray-400">Min interval</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{settings.maxSessionMinutes}m</p>
              <p className="text-sm text-gray-400">Max session</p>
            </div>
          </div>
        </div>

        {/* Current Balance */}
        <div className="card p-6 mb-6 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
              <Coins className="text-primary" size={24} />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Current Balance</p>
              <p className="text-2xl font-bold text-white">{user?.coins?.toLocaleString() || 0} coins</p>
            </div>
          </div>
        </div>

        {/* Interaction Required Modal */}
        {interactionRequired && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="card p-8 max-w-md w-full mx-4 text-center animate-scale-in">
              <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="text-yellow-500" size={32} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Are you still there?</h2>
              <p className="text-gray-400 mb-6">
                Click the button below to continue earning rewards.
              </p>
              <button onClick={confirmInteraction} className="btn-primary w-full py-3 text-lg">
                <CheckCircle size={20} className="mr-2" />
                I'm still here!
              </button>
            </div>
          </div>
        )}

        {/* Main AFK Card */}
        <div className="card p-8 text-center">
          {/* Timer Display */}
          <div className="mb-8">
            <div className="w-32 h-32 rounded-full border-4 border-primary/30 flex items-center justify-center mx-auto mb-4 relative">
              {session.isActive && (
                <div className="absolute inset-0 rounded-full border-4 border-primary animate-pulse" />
              )}
              <div className="text-center">
                <Clock className={`mx-auto mb-1 ${session.isActive ? 'text-primary' : 'text-gray-500'}`} size={32} />
                <span className="text-2xl font-mono font-bold text-white">
                  {formatTime(session.totalSeconds)}
                </span>
              </div>
            </div>
            
            <p className={`text-lg ${session.isActive ? 'text-primary' : 'text-gray-400'}`}>
              {session.isActive ? 'Session Active' : 'Session Inactive'}
            </p>
          </div>

          {/* Pending Rewards */}
          {session.isActive && pendingCoins > 0 && (
            <div className="bg-dark-800/50 rounded-lg p-4 mb-6">
              <p className="text-gray-400 text-sm mb-1">Pending Rewards</p>
              <p className="text-xl font-bold text-primary">+{pendingCoins} coins</p>
            </div>
          )}

          {/* Session Stats */}
          {session.coinsEarned > 0 && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
              <p className="text-green-400 text-sm mb-1">Earned This Session</p>
              <p className="text-xl font-bold text-green-400">+{session.coinsEarned} coins</p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-4 mb-6">
              {error}
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex justify-center gap-4">
            {!session.isActive ? (
              <button onClick={startSession} className="btn-primary py-3 px-8 text-lg">
                <Play size={20} className="mr-2" />
                Start AFK Session
              </button>
            ) : (
              <button onClick={stopSession} className="btn-secondary py-3 px-8 text-lg">
                <Pause size={20} className="mr-2" />
                Stop & Claim
              </button>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p className="mb-1">💡 Keep this tab open and active to earn coins</p>
          <p>⚠️ You'll be asked to confirm periodically to prevent botting</p>
        </div>
      </div>
    </Layout>
  );
}
