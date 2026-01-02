import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import SetupRoute from './components/SetupRoute';

// Pages
import Login from './pages/Login';
import Setup from './pages/Setup';
import Maintenance from './pages/Maintenance';
import Dashboard from './pages/Dashboard';
import Servers from './pages/Servers';
import CreateServer from './pages/CreateServer';
import EditServer from './pages/EditServer';
import Store from './pages/Store';
import Redeem from './pages/Redeem';
import Earn from './pages/Earn';
import Tickets from './pages/Tickets';
import TicketView from './pages/TicketView';
import Account from './pages/Account';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminServers from './pages/admin/Servers';
import AdminPackages from './pages/admin/Packages';
import AdminLocations from './pages/admin/Locations';
import AdminEggs from './pages/admin/Eggs';
import AdminCoupons from './pages/admin/Coupons';
import AdminTickets from './pages/admin/Tickets';
import AdminBilling from './pages/admin/Billing';
import AdminSettings from './pages/admin/Settings';
import AdminAuditLogs from './pages/admin/AuditLogs';

function MaintenanceWrapper({ children }: { children: React.ReactNode }) {
  const { settings, loading } = useSettings();
  const { user } = useAuth();

  if (loading) {
    return null;
  }

  // Show maintenance page if enabled and user is not admin
  if (settings?.maintenanceMode && !user?.isAdmin) {
    return <Maintenance />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <ToastProvider>
          <MaintenanceWrapper>
            <Routes>
          {/* Setup route - shown if not configured */}
          <Route path="/setup" element={<Setup />} />
          
          {/* Public routes */}
          <Route element={<SetupRoute />}>
            <Route path="/login" element={<Login />} />
          </Route>

          {/* Protected routes */}
          <Route element={<SetupRoute />}>
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/servers" element={<Servers />} />
                <Route path="/servers/create" element={<CreateServer />} />
                <Route path="/servers/:id/edit" element={<EditServer />} />
                <Route path="/store" element={<Store />} />
                <Route path="/redeem" element={<Redeem />} />
                <Route path="/earn" element={<Earn />} />
                <Route path="/tickets" element={<Tickets />} />
                <Route path="/tickets/:id" element={<TicketView />} />
                <Route path="/account" element={<Account />} />
              </Route>
            </Route>
          </Route>

          {/* Admin routes */}
          <Route element={<SetupRoute />}>
            <Route element={<AdminRoute />}>
              <Route element={<Layout isAdmin />}>
                <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/servers" element={<AdminServers />} />
                <Route path="/admin/packages" element={<AdminPackages />} />
                <Route path="/admin/locations" element={<AdminLocations />} />
                <Route path="/admin/eggs" element={<AdminEggs />} />
                <Route path="/admin/coupons" element={<AdminCoupons />} />
                <Route path="/admin/tickets" element={<AdminTickets />} />
                <Route path="/admin/billing" element={<AdminBilling />} />
                <Route path="/admin/settings" element={<AdminSettings />} />
                <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
              </Route>
            </Route>
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
          </MaintenanceWrapper>
        </ToastProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
