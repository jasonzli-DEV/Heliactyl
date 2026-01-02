import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Key, 
  Trash2, 
  ExternalLink, 
  AlertTriangle, 
  Loader2, 
  CheckCircle, 
  Copy,
  Shield,
  Calendar,
  Mail
} from 'lucide-react';

export default function Account() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [copied, setCopied] = useState(false);

  const resetPassword = async () => {
    if (!confirm('Are you sure you want to reset your Pterodactyl password? You will need to use the new password to log into the panel.')) {
      return;
    }

    setLoading('password');
    setError(null);
    setNewPassword(null);

    try {
      const res = await fetch('/api/user/reset-password', {
        method: 'POST',
        credentials: 'include',
      });

      const data = await res.json();

      if (res.ok) {
        setNewPassword(data.password);
      } else {
        setError(data.error || 'Failed to reset password');
      }
    } catch {
      setError('Failed to reset password');
    } finally {
      setLoading(null);
    }
  };

  const deleteAccount = async () => {
    if (deleteConfirmText !== user?.username) {
      setError('Please type your username correctly to confirm deletion');
      return;
    }

    setLoading('delete');
    setError(null);

    try {
      const res = await fetch('/api/user/account', {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        logout();
        navigate('/login');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to delete account');
      }
    } catch {
      setError('Failed to delete account');
    } finally {
      setLoading(null);
    }
  };

  const copyPassword = () => {
    if (newPassword) {
      navigator.clipboard.writeText(newPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Account Settings</h1>
        <p className="text-gray-400">
          Manage your account and Pterodactyl panel access.
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-400">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Profile Card */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <User className="w-5 h-5" />
          Profile
        </h2>
        
        <div className="flex items-start gap-4">
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user.username}
              className="w-16 h-16 rounded-full"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-accent-500 flex items-center justify-center text-white text-xl font-bold">
              {user?.username?.[0]?.toUpperCase()}
            </div>
          )}
          
          <div className="flex-1 space-y-2">
            <div>
              <p className="text-lg font-medium text-white">{user?.username}</p>
              <p className="text-sm text-gray-400 flex items-center gap-1">
                <Mail className="w-4 h-4" />
                {user?.email || 'No email'}
              </p>
            </div>
            
            <div className="flex flex-wrap gap-4 text-sm text-gray-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Joined {new Date(user?.createdAt || '').toLocaleDateString()}
              </span>
              {user?.isAdmin && (
                <span className="flex items-center gap-1 text-accent-400">
                  <Shield className="w-4 h-4" />
                  Admin
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pterodactyl Panel Card */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <ExternalLink className="w-5 h-5" />
          Pterodactyl Panel
        </h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-dark-700 rounded-lg">
            <div>
              <p className="text-sm text-gray-400">Panel Account ID</p>
              <p className="text-white font-medium">
                {user?.pterodactylId ? `#${user.pterodactylId}` : 'Not linked'}
              </p>
            </div>
            {user?.pterodactylId && (
              <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-medium rounded">
                Linked
              </span>
            )}
          </div>

          {/* New password display */}
          {newPassword && (
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-green-400 mb-2">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Password Reset Successful!</span>
              </div>
              <p className="text-sm text-gray-400 mb-3">
                Your new password is shown below. <strong>Save it now</strong> - it will only be shown once!
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-3 bg-dark-800 rounded-lg text-white font-mono text-sm break-all">
                  {newPassword}
                </code>
                <button
                  onClick={copyPassword}
                  className="p-3 bg-dark-800 hover:bg-dark-700 rounded-lg text-gray-400 hover:text-white transition-colors"
                  title="Copy password"
                >
                  {copied ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>
          )}

          <button
            onClick={resetPassword}
            disabled={loading === 'password' || !user?.pterodactylId}
            className="btn-secondary w-full"
          >
            {loading === 'password' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Resetting...
              </>
            ) : (
              <>
                <Key className="w-4 h-4" />
                Forgot Password or Never Set?
              </>
            )}
          </button>
          
          {!user?.pterodactylId && (
            <p className="text-sm text-gray-500 text-center">
              You don't have a linked Pterodactyl account yet.
            </p>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card p-6 border-red-500/30">
        <h2 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Danger Zone
        </h2>
        
        <p className="text-sm text-gray-400 mb-4">
          Deleting your account is permanent and cannot be undone. All your servers, 
          data, and your Pterodactyl panel account will be permanently deleted.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="btn-secondary text-red-400 border-red-500/30 hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4" />
            Delete Account
          </button>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400 mb-3">
                To confirm deletion, type your username: <strong>{user?.username}</strong>
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="input"
                placeholder="Type your username"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={deleteAccount}
                disabled={loading === 'delete' || deleteConfirmText !== user?.username}
                className="btn-primary bg-red-500 hover:bg-red-600 flex-1"
              >
                {loading === 'delete' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Forever
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
