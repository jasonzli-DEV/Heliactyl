import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Plus, Loader2, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
}

export default function Tickets() {
  const { showToast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const res = await fetch('/api/tickets', { credentials: 'include' });
      const data = await res.json();
      setTickets(data.tickets || []);
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTicket = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          subject: formData.get('subject'),
          message: formData.get('message'),
          priority: formData.get('priority'),
        }),
      });

      if (res.ok) {
        setCreating(false);
        fetchTickets();
        showToast('Ticket created successfully', 'success');
      } else {
        showToast('Failed to create ticket', 'error');
      }
    } catch (error) {
      console.error('Failed to create ticket:', error);
      showToast('Failed to create ticket', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-400';
      case 'normal': return 'text-yellow-400';
      case 'low': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === 'open') return <Clock className="w-4 h-4 text-blue-400" />;
    return <CheckCircle2 className="w-4 h-4 text-green-400" />;
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Support Tickets</h1>
          <p className="text-gray-400">Get help from our support team.</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          New Ticket
        </button>
      </div>

      {/* Create Ticket Modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card w-full max-w-2xl">
            <div className="p-6 border-b border-dark-700">
              <h2 className="text-lg font-semibold text-white">Create Support Ticket</h2>
            </div>
            <form onSubmit={createTicket} className="p-6 space-y-4">
              <div>
                <label className="label">Subject</label>
                <input
                  type="text"
                  name="subject"
                  className="input"
                  placeholder="Brief description of your issue"
                  required
                />
              </div>
              <div>
                <label className="label">Priority</label>
                <select name="priority" className="input" defaultValue="normal">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="label">Message</label>
                <textarea
                  name="message"
                  className="input min-h-[150px]"
                  placeholder="Describe your issue in detail..."
                  required
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Ticket'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tickets List */}
      {loading ? (
        <div className="card p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-500" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="card p-12 text-center">
          <MessageSquare className="w-12 h-12 mx-auto text-gray-600 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No tickets yet</h2>
          <p className="text-gray-400 mb-6">
            Need help? Create a support ticket and our team will assist you.
          </p>
          <button onClick={() => setCreating(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            Create Ticket
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              to={`/tickets/${ticket.id}`}
              className="card p-6 hover:border-accent-500/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {getStatusIcon(ticket.status)}
                  <h3 className="text-lg font-semibold text-white">{ticket.subject}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium uppercase ${getPriorityColor(ticket.priority)}`}>
                    {ticket.priority}
                  </span>
                  <span
                    className={`badge ${
                      ticket.status === 'open' ? 'badge-blue' : 'badge-gray'
                    }`}
                  >
                    {ticket.status}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>{ticket._count.messages} messages</span>
                <span>•</span>
                <span>Created {new Date(ticket.createdAt).toLocaleDateString()}</span>
                <span>•</span>
                <span>Updated {new Date(ticket.updatedAt).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
