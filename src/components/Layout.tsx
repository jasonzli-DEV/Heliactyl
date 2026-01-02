import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import {
  LayoutDashboard,
  Server,
  ShoppingCart,
  Ticket,
  Settings,
  Users,
  Package,
  MapPin,
  Egg,
  Tags,
  ClipboardList,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Shield,
  ExternalLink,
  Gift,
  User,
  Key,
  Trash2,
  ChevronDown,
  MessageSquare,
  CreditCard,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

import { parseMarkdown } from '../lib/markdown';

interface LayoutProps {
  isAdmin?: boolean;
}

const userNavItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/servers', icon: Server, label: 'Servers' },
  { to: '/store', icon: ShoppingCart, label: 'Store' },
  { to: '/redeem', icon: Ticket, label: 'Redeem' },
  { to: '/earn', icon: Gift, label: 'Earn Coins' },
  { to: '/tickets', icon: MessageSquare, label: 'Support' },
];

const adminNavItems = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/servers', icon: Server, label: 'Servers' },
  { to: '/admin/packages', icon: Package, label: 'Packages' },
  { to: '/admin/locations', icon: MapPin, label: 'Locations' },
  { to: '/admin/eggs', icon: Egg, label: 'Eggs' },
  { to: '/admin/coupons', icon: Tags, label: 'Coupons' },
  { to: '/admin/tickets', icon: MessageSquare, label: 'Tickets' },
  { to: '/admin/earn', icon: Gift, label: 'Earn' },
  { to: '/admin/billing', icon: CreditCard, label: 'Billing' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
  { to: '/admin/audit-logs', icon: ClipboardList, label: 'Audit Logs' },
];

export default function Layout({ isAdmin = false }: LayoutProps) {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const navItems = isAdmin ? adminNavItems : userNavItems;

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-dark-900 flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-dark-800 border-r border-dark-700">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-dark-700">
          {settings?.logo ? (
            <img src={settings.logo} alt={settings.siteName} className="h-8" />
          ) : (
            <span className="text-xl font-bold text-white">
              {settings?.siteName || 'EnderBit'}
            </span>
          )}
          {isAdmin && (
            <span className="ml-2 px-2 py-0.5 bg-accent-500/20 text-accent-400 text-xs font-medium rounded">
              Admin
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  isActive
                    ? 'bg-accent-500/20 text-accent-400'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-dark-700'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-dark-700">
          {/* Switch mode button */}
          {user?.isAdmin && (
            <button
              onClick={() => navigate(isAdmin ? '/dashboard' : '/admin')}
              className="w-full flex items-center gap-3 px-3 py-2.5 mb-2 text-gray-400 hover:text-gray-200 hover:bg-dark-700 rounded-lg transition-all"
            >
              {isAdmin ? (
                <>
                  <ExternalLink className="w-5 h-5" />
                  <span className="font-medium">User Panel</span>
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  <span className="font-medium">Admin Panel</span>
                </>
              )}
            </button>
          )}

          {/* User info - Clickable dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-dark-700 transition-all"
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.username}
                  className="w-9 h-9 rounded-full"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-accent-500 flex items-center justify-center text-white font-medium">
                  {user?.username?.[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-gray-200 truncate">
                  {user?.username}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user?.coins?.toLocaleString() || 0} coins
                </p>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* User dropdown menu */}
            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-dark-700 rounded-lg border border-dark-600 shadow-xl animate-fadeIn overflow-hidden">
                <button
                  onClick={() => {
                    navigate('/account');
                    setUserMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-dark-600 transition-colors"
                >
                  <User className="w-4 h-4" />
                  <span className="text-sm">Account Settings</span>
                </button>
                <div className="border-t border-dark-600">
                  <button
                    onClick={() => {
                      logout();
                      setUserMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm">Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-dark-800 border-b border-dark-700 z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          {settings?.logo ? (
            <img src={settings.logo} alt={settings.siteName} className="h-8" />
          ) : (
            <span className="text-lg font-bold text-white">
              {settings?.siteName || 'EnderBit'}
            </span>
          )}
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-gray-400 hover:text-gray-200"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-dark-900/90 backdrop-blur-sm pt-16">
          <nav className="p-4 space-y-1">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? 'bg-accent-500/20 text-accent-400'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-dark-700'
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{label}</span>
                <ChevronRight className="w-4 h-4 ml-auto" />
              </NavLink>
            ))}

            {user?.isAdmin && (
              <button
                onClick={() => {
                  navigate(isAdmin ? '/dashboard' : '/admin');
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-gray-200 hover:bg-dark-700 rounded-lg transition-all"
              >
                {isAdmin ? (
                  <>
                    <ExternalLink className="w-5 h-5" />
                    <span className="font-medium">User Panel</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5" />
                    <span className="font-medium">Admin Panel</span>
                  </>
                )}
                <ChevronRight className="w-4 h-4 ml-auto" />
              </button>
            )}

            <NavLink
              to="/account"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-gray-200 hover:bg-dark-700 rounded-lg transition-all"
            >
              <User className="w-5 h-5" />
              <span className="font-medium">Account Settings</span>
              <ChevronRight className="w-4 h-4 ml-auto" />
            </NavLink>

            <button
              onClick={() => {
                logout();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Logout</span>
              <ChevronRight className="w-4 h-4 ml-auto" />
            </button>
          </nav>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto lg:h-screen">
        <div className="pt-16 lg:pt-0 min-h-full flex flex-col">
          <div className="flex-1">
            <Outlet />
          </div>
          <footer className="px-6 py-4 text-center text-gray-600 text-sm border-t border-dark-700">
            {parseMarkdown(settings?.footerText || '© EnderBit Hosting 2025')}
          </footer>
        </div>
      </main>
    </div>
  );
}
