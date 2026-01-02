import { useState } from 'react';
import { Ban, MessageSquare, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Banned() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [appealMessage, setAppealMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to submit appeal', 'error');
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

        {!submitted ? (
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
