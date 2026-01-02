import { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function SetupRoute() {
  const [loading, setLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const res = await fetch('/api/setup/status');
        const data = await res.json();
        setSetupComplete(data.setupComplete);
      } catch (err) {
        // If we can't reach the API, assume setup needed
        setSetupComplete(false);
      } finally {
        setLoading(false);
      }
    };

    checkSetup();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent-500 animate-spin" />
      </div>
    );
  }

  // If setup not complete, redirect to setup page
  if (!setupComplete) {
    return <Navigate to="/setup" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
