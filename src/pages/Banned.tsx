import { useState, useEffect } from 'react';
import { Ban, MessageSquare, Loader2, Clock, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface TicketMessage {
  id: string;
  message: string;
  isStaff: boolean;
  createdAt: string;
  user: {
    id: string;
    username: string;
    isAdmin: boolean;
  };
}

interface Appeal {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  messages: TicketMessage[];
}

function formatTimeRemaining(expiresAt: string | null): string {
  if (!expiresAt) return 'Permanent';
  
  const now = new Date().getTime();
  const expires = new Date(expiresAt).getTime();
  const diff = expires - now;
  
  if (diff <= 0) return 'Expired';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default function Banned() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [appealMessage, setAppealMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [existingAppeal, setExistingAppeal] = useState<Appeal | null>(null);
  const [loadingAppeal, setLoadingAppeal] = useState(true);
  const [replyMessage, setReplyMessage] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(formatTimeRemaining(user?.banExpiresAt || null));

  useEffect(() => {
    const fetchExistingAppeal = async () => {
      try {
        const res = await fetch('/api/ban-appeal', {
          credentials: 'include',
        });
        
        if (res.ok) {
          const data = await res.json();
          setExistingAppeal(data.appeal);
        }
      } catch (error) {
        console.error('Failed to fetch existing appeal:', error);
      } finally {
        setLoadingAppeal(false);
      }
    };
    
    fetchExistingAppeal();
  }, []);

  useEffect(() => {
    if (!user?.banExpiresAt) {
      setTimeRemaining('Permanent');
      return;
    }
    
    const interval = setInterval(() => {
      setTimeRemaining(formatTimeRemaining(user.banExpiresAt));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [user?.banExpiresAt]);

  const handleAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealMessage.trim()) {
      showToast('Please enter a message for your appeal', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/ban-appeal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: appealMessage }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit appeal');
      }

      setSubmitted(true);
      showToast('Your ban appeal has been submitted', 'success');
      // Refresh to show the new appeal
      window.location.reload();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to submit appeal', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim()) {
      showToast('Please enter a message', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/ban-appeal/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: replyMessage }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send reply');
      }

      const data = await res.json();
      // Add the new message to the existing appeal
      if (existingAppeal) {
        setExistingAppeal({
          ...existingAppeal,
          messages: [...existingAppeal.messages, data.message],
        });
      }
      setReplyMessage('');
      showToast('Reply sent', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to send reply', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
      <div className="card w-full max-w-2xl p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/10 rounded-full mb-4">
          <Ban className="w-8 h-8 text-red-400" />
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-2">Account Banned</h1>
        
        {user?.banReason && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-700/30 rounded-lg">
            <p className="text-sm font-medium text-red-400 mb-1">Reason:</p>
            <p className="text-gray-300">{user.banReason}</p>
          </div>
        )}
        
        <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
          <p className="text-sm font-medium text-yellow-400 mb-1 flex items-center justify-center gap-2">
            <Clock className="w-4 h-4" />
            {timeRemaining === 'Permanent' ? 'Ban Duration:' : 'Time Remaining:'}
          </p>
          <p className="text-xl font-bold text-white">{timeRemaining}</p>
        </div>

        {loadingAppeal ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
          </div>
        ) : existingAppeal ? (
          <>
            <div className="mb-6 p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg">
              <p className="text-sm font-medium text-blue-400 mb-1">Appeal Status:</p>
              <p className="text-white">Your appeal is currently <span className="font-bold">open</span> and being reviewed.</p>
            </div>

            <div className="mb-6 max-h-96 overflow-y-auto space-y-3 text-left">
              {existingAppeal.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-4 rounded-lg ${
                    msg.isStaff
                      ? 'bg-primary-900/20 border border-primary-700/30'
                      : 'bg-dark-700 border border-dark-600'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-sm font-medium ${
                      msg.user.isAdmin ? 'text-red-400' : 'text-gray-300'
                    }`}>
                      {msg.user.username}
                      {msg.user.isAdmin && ' (Admin)'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(msg.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-gray-300 whitespace-pre-wrap">{msg.message}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleReply} className="space-y-4">
              <div>
                <label className="label text-left">
                  <MessageSquare className="w-4 h-4 inline mr-2" />
                  Reply to Appeal
                </label>
                <textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Add additional information or respond to admin questions..."
                  className="input min-h-[100px]"
                  required
                  disabled={submitting}
                />
              </div>

              <div className="flex gap-3 justify-center">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Reply
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="btn-ghost"
                  disabled={submitting}
                >
                  Logout
                </button>
              </div>
            </form>
          </>
        ) : !submitted ? (
          <>
            <p className="text-gray-400 mb-6">
              Your account has been banned. If you believe this is a mistake, you can submit a ban appeal below.
            </p>

            <form onSubmit={handleAppeal} className="space-y-4">
              <div>
                <label className="label text-left">
                  <MessageSquare className="w-4 h-4 inline mr-2" />
                  Appeal Message
                </label>
                <textarea
                  value={appealMessage}
                  onChange={(e) => setAppealMessage(e.target.value)}
                  placeholder="Explain why you think your ban should be lifted..."
                  className="input min-h-[120px]"
                  required
                  disabled={submitting}
                />
              </div>

              <div className="flex gap-3 justify-center">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Appeal'
                  )}
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="btn-ghost"
                  disabled={submitting}
                >
                  Logout
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="mb-6 p-4 bg-green-900/20 border border-green-700/30 rounded-lg">
              <p className="text-green-400">
                Your appeal has been submitted successfully. A staff member will review it and respond via a ticket.
              </p>
            </div>
            <button onClick={logout} className="btn-primary">
              Logout
            </button>
          </>
        )}
      </div>
    </div>
  );
}
