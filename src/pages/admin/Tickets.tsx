import { useState, useEffect } from 'react';
import { MessageSquare, Clock, User, Send, CheckCircle, Gavel } from 'lucide-react';

interface TicketMessage {
  id: string;
  message: string;
  isStaff: boolean;
  createdAt: string;
  user: { username: string };
}

interface Ticket {
  id: string;
  subject: string;
  status: 'open' | 'closed';
  priority: 'low' | 'normal' | 'high';
  type: 'support' | 'ban-appeal';
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    username: string;
    discordId: string;
  };
  messages: TicketMessage[];
}

export default function AdminTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [reply, setReply] = useState('');
  const [filter, setFilter] = useState<'open' | 'closed' | 'all'>('open');
  const [loading, setLoading] = useState(true);
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, [filter]);

  const fetchTickets = async () => {
    try {
      const res = await fetch(`/api/admin/tickets?status=${filter}`, {
        credentials: 'include',
      });
      const data = await res.json();
      setTickets(data.tickets || []);
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !reply.trim()) return;

    setReplying(true);
    try {
      const res = await fetch(`/api/admin/tickets/${selectedTicket.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: reply }),
      });

      if (res.ok) {
        const data = await res.json();
        setSelectedTicket({
          ...selectedTicket,
          messages: [...selectedTicket.messages, data.message],
        });
        setReply('');
        fetchTickets();
      }
    } catch (error) {
      console.error('Failed to send reply:', error);
    } finally {
      setReplying(false);
    }
  };

  const closeTicket = async (ticketId: string) => {
    try {
      const res = await fetch(`/api/admin/tickets/${ticketId}/close`, {
        method: 'PATCH',
        credentials: 'include',
      });

      if (res.ok) {
        fetchTickets();
        if (selectedTicket?.id === ticketId) {
          setSelectedTicket({ ...selectedTicket, status: 'closed' });
        }
      }
    } catch (error) {
      console.error('Failed to close ticket:', error);
    }
  };

  const priorityColors = {
    low: 'text-blue-400 bg-blue-400/10',
    normal: 'text-yellow-400 bg-yellow-400/10',
    high: 'text-red-400 bg-red-400/10',
  };

  const typeColors = {
    support: 'text-gray-400 bg-gray-400/10',
    'ban-appeal': 'text-orange-400 bg-orange-400/10',
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fadeIn">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Support Tickets</h1>
          <p className="text-gray-400">Manage user support requests.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('open')}
            className={`px-4 py-2 rounded-lg ${
              filter === 'open' ? 'bg-accent-500 text-white' : 'bg-dark-700 text-gray-400'
            }`}
          >
            Open
          </button>
          <button
            onClick={() => setFilter('closed')}
            className={`px-4 py-2 rounded-lg ${
              filter === 'closed' ? 'bg-accent-500 text-white' : 'bg-dark-700 text-gray-400'
            }`}
          >
            Closed
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg ${
              filter === 'all' ? 'bg-accent-500 text-white' : 'bg-dark-700 text-gray-400'
            }`}
          >
            All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticket List */}
        <div className="lg:col-span-1 space-y-4">
          {loading ? (
            <div className="card p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-500 mx-auto"></div>
            </div>
          ) : tickets.length === 0 ? (
            <div className="card p-8 text-center">
              <MessageSquare className="w-12 h-12 mx-auto text-gray-600 mb-4" />
              <p className="text-gray-400">No {filter !== 'all' && filter} tickets</p>
            </div>
          ) : (
            tickets.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => setSelectedTicket(ticket)}
                className={`card p-4 w-full text-left transition-all ${
                  selectedTicket?.id === ticket.id ? 'ring-2 ring-accent-500' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-white font-semibold truncate">{ticket.subject}</h3>
                  <div className="flex gap-1 flex-shrink-0">
                    {ticket.type === 'ban-appeal' && (
                      <span className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${typeColors['ban-appeal']}`}>
                        <Gavel className="w-3 h-3" />
                        Appeal
                      </span>
                    )}
                    <span
                      className={`text-xs px-2 py-1 rounded ${priorityColors[ticket.priority]}`}
                    >
                      {ticket.priority}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                  <User className="w-4 h-4" />
                  {ticket.user.username}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  {new Date(ticket.updatedAt).toLocaleString()}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Ticket Details */}
        <div className="lg:col-span-2">
          {selectedTicket ? (
            <div className="card flex flex-col h-[calc(100vh-16rem)]">
              {/* Header */}
              <div className="p-6 border-b border-dark-700">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-2">
                      {selectedTicket.subject}
                    </h2>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {selectedTicket.user.username}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {new Date(selectedTicket.createdAt).toLocaleString()}
                      </span>
                      {selectedTicket.type === 'ban-appeal' && (
                        <span className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${typeColors['ban-appeal']}`}>
                          <Gavel className="w-3 h-3" />
                          Ban Appeal
                        </span>
                      )}
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          priorityColors[selectedTicket.priority]
                        }`}
                      >
                        {selectedTicket.priority}
                      </span>
                    </div>
                  </div>
                  {selectedTicket.status === 'open' && (
                    <button
                      onClick={() => closeTicket(selectedTicket.id)}
                      className="btn-secondary flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Close Ticket
                    </button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {selectedTicket.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.isStaff ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-4 ${
                        msg.isStaff
                          ? 'bg-accent-500/20 border border-accent-500/30'
                          : 'bg-dark-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-white">
                          {msg.user.username}
                          {msg.isStaff && ' (Staff)'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(msg.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-gray-300 whitespace-pre-wrap">{msg.message}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply Form */}
              {selectedTicket.status === 'open' && (
                <form onSubmit={sendReply} className="p-6 border-t border-dark-700">
                  <div className="flex gap-3">
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Type your reply..."
                      className="input flex-1 min-h-[80px] resize-none"
                      disabled={replying}
                    />
                    <button
                      type="submit"
                      disabled={replying || !reply.trim()}
                      className="btn-primary h-[80px] px-6"
                    >
                      {replying ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <div className="card p-12 text-center">
              <MessageSquare className="w-16 h-16 mx-auto text-gray-600 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Select a Ticket</h3>
              <p className="text-gray-400">Choose a ticket from the list to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
