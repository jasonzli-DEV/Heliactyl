import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Loader2, Clock, CheckCircle2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';

interface TicketMessage {
  id: string;
  userId: string;
  isStaff: boolean;
  message: string;
  createdAt: string;
}

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
  user: {
    username: string;
    avatar: string | null;
  };
}

export default function TicketView() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [message, setMessage] = useState('');
  const [showCloseModal, setShowCloseModal] = useState(false);

  useEffect(() => {
    fetchTicket();
  }, [id]);

  const fetchTicket = async () => {
    try {
      const res = await fetch(`/api/tickets/${id}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTicket(data.ticket);
      } else {
        navigate('/tickets');
      }
    } catch (error) {
      console.error('Failed to fetch ticket:', error);
      navigate('/tickets');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSending(true);
    try {
      const res = await fetch(`/api/tickets/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message }),
      });

      if (res.ok) {
        setMessage('');
        fetchTicket();
        showToast('Message sent successfully', 'success');
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to send message', 'error');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      showToast('Failed to send message', 'error');
    } finally {
      setSending(false);
    }
  };

  const closeTicket = async () => {
    setClosing(true);
    try {
      const res = await fetch(`/api/tickets/${id}/close`, {
        method: 'PATCH',
        credentials: 'include',
      });

      if (res.ok) {
        fetchTicket();
        showToast('Ticket closed successfully', 'success');
      } else {
        showToast('Failed to close ticket', 'error');
      }
    } catch (error) {
      console.error('Failed to close ticket:', error);
      showToast('Failed to close ticket', 'error');
    } finally {
      setClosing(false);
      setShowCloseModal(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="card p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-500" />
        </div>
      </div>
    );
  }

  if (!ticket) {
    return null;
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/tickets" className="btn-ghost p-2">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white mb-1">{ticket.subject}</h1>
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span>Ticket #{ticket.id.slice(0, 8)}</span>
            <span>•</span>
            <span>Created {new Date(ticket.createdAt).toLocaleString()}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`badge ${
              ticket.status === 'open' ? 'badge-blue' : 'badge-gray'
            }`}
          >
            {ticket.status === 'open' ? (
              <Clock className="w-3 h-3" />
            ) : (
              <CheckCircle2 className="w-3 h-3" />
            )}
            {ticket.status}
          </span>
          {ticket.status === 'open' && (
            <button
              onClick={() => setShowCloseModal(true)}
              disabled={closing}
              className="btn-ghost text-red-400 hover:text-red-300"
            >
              {closing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <X className="w-4 h-4" />
                  Close
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-4 mb-6">
        {ticket.messages.map((msg) => (
          <div
            key={msg.id}
            className={`card p-4 ${
              msg.isStaff ? 'bg-accent-500/5 border-accent-500/20' : ''
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {msg.isStaff ? 'S' : ticket.user.username[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">
                  {msg.isStaff ? 'Support Staff' : ticket.user.username}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(msg.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
            <p className="text-gray-300 whitespace-pre-wrap">{msg.message}</p>
          </div>
        ))}
      </div>

      {/* Reply Form */}
      {ticket.status === 'open' && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Reply to Ticket</h3>
          <form onSubmit={sendMessage} className="space-y-4">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="input min-h-[120px]"
              placeholder="Type your message..."
              disabled={sending}
            />
            <div className="flex justify-end">
              <button type="submit" className="btn-primary" disabled={sending || !message.trim()}>
                {sending ? (
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
            </div>
          </form>
        </div>
      )}

      {ticket.status === 'closed' && (
        <div className="card p-6 bg-gray-500/5 text-center">
          <p className="text-gray-400">
            This ticket is closed. Create a new ticket if you need further assistance.
          </p>
        </div>
      )}
      
      {/* Close Ticket Confirmation Modal */}
      <ConfirmModal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        onConfirm={closeTicket}
        title="Close Ticket"
        message="Are you sure you want to close this ticket? Once closed, you cannot reopen it or add more messages."
        confirmText="Close Ticket"
        confirmButtonClass="btn-danger"
        isLoading={closing}
      />
    </div>
  );
}
