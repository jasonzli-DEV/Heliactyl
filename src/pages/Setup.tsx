import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Shield, Server, CheckCircle, AlertCircle, Loader2, ExternalLink } from 'lucide-react';

interface SetupStep {
  id: number;
  title: string;
  description: string;
}

const steps: SetupStep[] = [
  { id: 1, title: 'Welcome', description: 'Let\'s configure your EnderBit dashboard' },
  { id: 2, title: 'Discord OAuth', description: 'Set up authentication with Discord' },
  { id: 3, title: 'Pterodactyl API', description: 'Connect to your Pterodactyl panel' },
  { id: 4, title: 'Admin Account', description: 'Configure the initial admin user' },
  { id: 5, title: 'Complete', description: 'Setup complete!' },
];

export default function Setup() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  // Check if setup is already complete - redirect to dashboard if so
  useEffect(() => {
    const checkSetup = async () => {
      try {
        const res = await fetch('/api/setup/status');
        const data = await res.json();
        if (data.setupComplete) {
          navigate('/');
        }
      } catch (err) {
        // If we can't reach the API, stay on setup page
      } finally {
        setChecking(false);
      }
    };
    checkSetup();
  }, [navigate]);

  const [config, setConfig] = useState({
    siteName: 'EnderBit',
    siteUrl: window.location.origin,
    discordClientId: '',
    discordClientSecret: '',
    discordRedirectUri: `${window.location.origin}/api/auth/callback`,
    pterodactylUrl: '',
    pterodactylApiKey: '',
    adminDiscordId: '',
  });

  const updateConfig = (key: string, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setError('');
    setTestResult(null);
  };

  const testPterodactyl = async () => {
    setLoading(true);
    setError('');
    setTestResult(null);

    try {
      const res = await fetch('/api/setup/test-pterodactyl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: config.pterodactylUrl,
          apiKey: config.pterodactylApiKey,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult('success');
      } else {
        setTestResult('error');
        setError(data.error || 'Failed to connect to Pterodactyl');
      }
    } catch (err) {
      setTestResult('error');
      setError('Failed to test connection');
    } finally {
      setLoading(false);
    }
  };

  const completeSetup = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentStep(5);
      } else {
        setError(data.error || 'Failed to complete setup');
      }
    } catch (err) {
      setError('Failed to complete setup');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent-500/20 mb-4">
                <Settings className="w-8 h-8 text-accent-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Welcome to EnderBit Dashboard</h2>
              <p className="text-gray-400">
                This wizard will help you configure your game server dashboard.
                You'll need your Discord application credentials and Pterodactyl API key.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Site Name</label>
                <input
                  type="text"
                  value={config.siteName}
                  onChange={e => updateConfig('siteName', e.target.value)}
                  className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent-500 focus:outline-none"
                  placeholder="My Game Hosting"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Site URL</label>
                <input
                  type="url"
                  value={config.siteUrl}
                  onChange={e => updateConfig('siteUrl', e.target.value)}
                  className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent-500 focus:outline-none"
                  placeholder="https://dash.example.com"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-500/20 mb-4">
                <Shield className="w-8 h-8 text-indigo-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Discord OAuth Setup</h2>
              <p className="text-gray-400">
                Create a Discord application at{' '}
                <a
                  href="https://discord.com/developers/applications"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-400 hover:text-accent-300 inline-flex items-center gap-1"
                >
                  Discord Developer Portal <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>

            <div className="bg-dark-700/50 rounded-lg p-4 border border-dark-600">
              <p className="text-sm text-gray-400 mb-2">Add this redirect URI to your Discord app:</p>
              <code className="block bg-dark-800 px-3 py-2 rounded text-accent-400 text-sm break-all">
                {config.discordRedirectUri}
              </code>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Client ID</label>
                <input
                  type="text"
                  value={config.discordClientId}
                  onChange={e => updateConfig('discordClientId', e.target.value)}
                  className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent-500 focus:outline-none font-mono"
                  placeholder="123456789012345678"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Client Secret</label>
                <input
                  type="password"
                  value={config.discordClientSecret}
                  onChange={e => updateConfig('discordClientSecret', e.target.value)}
                  className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent-500 focus:outline-none font-mono"
                  placeholder="••••••••••••••••••••••••••••••••"
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
                <Server className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Pterodactyl Connection</h2>
              <p className="text-gray-400">
                Enter your Pterodactyl panel URL and an Application API key with full permissions.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Panel URL</label>
                <input
                  type="url"
                  value={config.pterodactylUrl}
                  onChange={e => updateConfig('pterodactylUrl', e.target.value)}
                  className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent-500 focus:outline-none"
                  placeholder="https://panel.example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Application API Key</label>
                <input
                  type="password"
                  value={config.pterodactylApiKey}
                  onChange={e => updateConfig('pterodactylApiKey', e.target.value)}
                  className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent-500 focus:outline-none font-mono"
                  placeholder="ptla_xxxxxxxxxxxxxxxxxxxx"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Create an Application API key in your Pterodactyl admin panel under Application API.
                </p>
              </div>

              {testResult && (
                <div className={`flex items-center gap-2 p-3 rounded-lg ${
                  testResult === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  {testResult === 'success' ? (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      <span>Successfully connected to Pterodactyl!</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5" />
                      <span>{error || 'Connection failed'}</span>
                    </>
                  )}
                </div>
              )}

              <button
                onClick={testPterodactyl}
                disabled={loading || !config.pterodactylUrl || !config.pterodactylApiKey}
                className="w-full py-2.5 bg-dark-600 hover:bg-dark-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Test Connection
              </button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/20 mb-4">
                <Shield className="w-8 h-8 text-amber-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Admin Account</h2>
              <p className="text-gray-400">
                Enter your Discord User ID. This account will have full admin access.
              </p>
            </div>

            <div className="bg-dark-700/50 rounded-lg p-4 border border-dark-600">
              <p className="text-sm text-gray-400">
                To get your Discord User ID: Enable Developer Mode in Discord settings → 
                Right-click your profile → Copy User ID
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Admin Discord ID</label>
              <input
                type="text"
                value={config.adminDiscordId}
                onChange={e => updateConfig('adminDiscordId', e.target.value)}
                className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent-500 focus:outline-none font-mono"
                placeholder="123456789012345678"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-400">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-6 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20 mb-4">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Setup Complete!</h2>
            <p className="text-gray-400">
              Your EnderBit dashboard is now configured and ready to use.
              Click the button below to log in with Discord.
            </p>
            <button
              onClick={() => window.location.href = '/api/auth/login'}
              className="px-8 py-3 bg-accent-500 hover:bg-accent-600 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2"
            >
              <Shield className="w-5 h-5" />
              Login with Discord
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return config.siteName && config.siteUrl;
      case 2:
        return config.discordClientId && config.discordClientSecret;
      case 3:
        return config.pterodactylUrl && config.pterodactylApiKey && testResult === 'success';
      case 4:
        return config.adminDiscordId && config.adminDiscordId.length >= 17;
      default:
        return true;
    }
  };

  const handleNext = async () => {
    if (currentStep === 4) {
      await completeSetup();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  // Show loading while checking if setup is complete
  if (checking) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-accent-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        {currentStep < 5 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              {steps.slice(0, 4).map((step) => (
                <div
                  key={step.id}
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                    step.id < currentStep
                      ? 'bg-accent-500 border-accent-500 text-white'
                      : step.id === currentStep
                      ? 'border-accent-500 text-accent-400'
                      : 'border-dark-600 text-dark-500'
                  }`}
                >
                  {step.id < currentStep ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    step.id
                  )}
                </div>
              ))}
            </div>
            <div className="relative h-1 bg-dark-700 rounded-full">
              <div
                className="absolute left-0 top-0 h-full bg-accent-500 rounded-full transition-all"
                style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Card */}
        <div className="bg-dark-800 rounded-xl p-8 border border-dark-700">
          {renderStepContent()}

          {/* Navigation */}
          {currentStep < 5 && (
            <div className="flex gap-3 mt-8">
              {currentStep > 1 && (
                <button
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  className="flex-1 py-2.5 bg-dark-600 hover:bg-dark-500 text-white rounded-lg font-medium transition-colors"
                >
                  Back
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={!canProceed() || loading}
                className="flex-1 py-2.5 bg-accent-500 hover:bg-accent-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {currentStep === 4 ? 'Complete Setup' : 'Continue'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-sm mt-6">
          EnderBit Dashboard • © EnderBit Hosting 2025
        </p>
      </div>
    </div>
  );
}
