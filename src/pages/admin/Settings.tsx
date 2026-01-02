import { useState, useEffect } from 'react';
import { Settings, Loader2, Save, ExternalLink, Download, RefreshCw, CheckCircle, AlertCircle, Link as LinkIcon } from 'lucide-react';

interface SettingsData {
  siteName: string;
  siteDescription: string | null;
  siteUrl: string | null;
  logo: string | null;
  favicon: string | null;
  theme: string;
  accentColor: string;
  pterodactylUrl: string | null;
  pterodactylKey: string | null;
  discordClientId: string | null;
  discordClientSecret: string | null;
  discordGuildId: string | null;
  discordInvite: string | null;
  allowNewUsers: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  defaultCoins: number;
  defaultRam: number;
  defaultDisk: number;
  defaultCpu: number;
  defaultServers: number;
  defaultDatabases: number;
  defaultBackups: number;
  defaultAllocations: number;
  earnEnabled: boolean;
  earnCoins: number;
  earnCooldown: number;
  cutyApiToken: string | null;
}

interface VersionInfo {
  currentCommit: string;
  remoteCommit: string;
  branch: string;
  updateAvailable: boolean;
  changelog: string;
  error?: string;
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  // Update system state
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchSettings();
    checkForUpdates();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings/full', { credentials: 'include' });
      const data = await res.json();
      setSettings(data.settings);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkForUpdates = async () => {
    setCheckingUpdate(true);
    try {
      const res = await fetch('/api/system/version', { credentials: 'include' });
      const data = await res.json();
      setVersionInfo(data);
    } catch (error) {
      console.error('Failed to check for updates:', error);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const performUpdate = async () => {
    if (!confirm('Are you sure you want to update? This will restart the server.')) return;
    
    setUpdating(true);
    setUpdateResult(null);
    try {
      const res = await fetch('/api/system/update', { 
        method: 'POST',
        credentials: 'include' 
      });
      const data = await res.json();
      setUpdateResult({ success: data.success, message: data.message });
      
      if (data.restartRequired) {
        // Server will restart, show message
        setUpdateResult({ 
          success: true, 
          message: 'Update complete! Server is restarting... Please refresh in a few seconds.' 
        });
      }
    } catch (error) {
      setUpdateResult({ success: false, message: 'Update failed. Please check server logs.' });
    } finally {
      setUpdating(false);
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);

    const updates: Partial<SettingsData> = {
      siteName: fd.get('siteName') as string,
      siteDescription: fd.get('siteDescription') as string,
      siteUrl: fd.get('siteUrl') as string,
      logo: fd.get('logo') as string,
      favicon: fd.get('favicon') as string,
      pterodactylUrl: fd.get('pterodactylUrl') as string,
      discordClientId: fd.get('discordClientId') as string,
      discordGuildId: fd.get('discordGuildId') as string,
      discordInvite: fd.get('discordInvite') as string,
      allowNewUsers: fd.get('allowNewUsers') === 'on',
      maintenanceMode: fd.get('maintenanceMode') === 'on',
      maintenanceMessage: fd.get('maintenanceMessage') as string,
      defaultCoins: parseInt(fd.get('defaultCoins') as string) || 0,
      defaultRam: parseInt(fd.get('defaultRam') as string) || 0,
      defaultDisk: parseInt(fd.get('defaultDisk') as string) || 0,
      defaultCpu: parseInt(fd.get('defaultCpu') as string) || 0,
      defaultServers: parseInt(fd.get('defaultServers') as string) || 0,
      defaultDatabases: parseInt(fd.get('defaultDatabases') as string) || 0,
      defaultBackups: parseInt(fd.get('defaultBackups') as string) || 0,
      defaultAllocations: parseInt(fd.get('defaultAllocations') as string) || 0,
      earnEnabled: fd.get('earnEnabled') === 'on',
      earnCoins: parseInt(fd.get('earnCoins') as string) || 10,
      earnCooldown: parseInt(fd.get('earnCooldown') as string) || 300,
    };

    // Only include secrets if they were changed (not masked)
    const pteroKey = fd.get('pterodactylKey') as string;
    if (pteroKey && !pteroKey.includes('•')) {
      updates.pterodactylKey = pteroKey;
    }

    const discordSecret = fd.get('discordClientSecret') as string;
    if (discordSecret && !discordSecret.includes('•')) {
      updates.discordClientSecret = discordSecret;
    }

    const cutyToken = fd.get('cutyApiToken') as string;
    if (cutyToken && !cutyToken.includes('•')) {
      updates.cutyApiToken = cutyToken;
    }

    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="card p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto animate-fadeIn">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-400">Configure your EnderBit dashboard.</p>
      </div>

      {/* System Update Card */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Download className="w-5 h-5" />
          System Updates
        </h2>
        
        <div className="space-y-4">
          {versionInfo && (
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Current:</span>
                <code className="px-2 py-1 bg-gray-800 rounded text-blue-400">{versionInfo.currentCommit}</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Latest:</span>
                <code className="px-2 py-1 bg-gray-800 rounded text-green-400">{versionInfo.remoteCommit}</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Branch:</span>
                <code className="px-2 py-1 bg-gray-800 rounded text-purple-400">{versionInfo.branch}</code>
              </div>
            </div>
          )}

          {versionInfo?.updateAvailable && (
            <div className="p-3 bg-blue-900/30 border border-blue-700 rounded-lg">
              <div className="flex items-center gap-2 text-blue-400 mb-2">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">Update Available!</span>
              </div>
              {versionInfo.changelog && (
                <pre className="text-xs text-gray-400 whitespace-pre-wrap max-h-32 overflow-auto">
                  {versionInfo.changelog}
                </pre>
              )}
            </div>
          )}

          {updateResult && (
            <div className={`p-3 rounded-lg flex items-center gap-2 ${
              updateResult.success 
                ? 'bg-green-900/30 border border-green-700 text-green-400' 
                : 'bg-red-900/30 border border-red-700 text-red-400'
            }`}>
              {updateResult.success ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {updateResult.message}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={checkForUpdates}
              disabled={checkingUpdate}
              className="btn-secondary"
            >
              {checkingUpdate ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Check for Updates
                </>
              )}
            </button>
            
            {versionInfo?.updateAvailable && (
              <button
                type="button"
                onClick={performUpdate}
                disabled={updating}
                className="btn-primary"
              >
                {updating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Update Now
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={saveSettings} className="space-y-6">
        {/* Site Settings */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Site Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Site Name</label>
              <input type="text" name="siteName" defaultValue={settings?.siteName || ''} className="input" />
            </div>
            <div>
              <label className="label">Site URL</label>
              <input type="url" name="siteUrl" defaultValue={settings?.siteUrl || ''} className="input" placeholder="https://dash.example.com" />
            </div>
            <div>
              <label className="label">Site Description</label>
              <input type="text" name="siteDescription" defaultValue={settings?.siteDescription || ''} className="input" />
            </div>
            <div>
              <label className="label">Logo URL</label>
              <input type="text" name="logo" defaultValue={settings?.logo || ''} className="input" />
            </div>
            <div>
              <label className="label">Favicon URL</label>
              <input type="text" name="favicon" defaultValue={settings?.favicon || ''} className="input" />
            </div>
          </div>
          <div className="mt-4 flex gap-4">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="allowNewUsers" defaultChecked={settings?.allowNewUsers ?? true} className="rounded" />
              <span className="text-sm text-gray-300">Allow New Registrations</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="maintenanceMode" defaultChecked={settings?.maintenanceMode} className="rounded" />
              <span className="text-sm text-gray-300">Maintenance Mode</span>
            </label>
          </div>
          <div className="mt-4">
            <label className="label">Maintenance Message</label>
            <input type="text" name="maintenanceMessage" defaultValue={settings?.maintenanceMessage || ''} className="input" />
          </div>
        </div>

        {/* Pterodactyl Settings */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Pterodactyl Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Panel URL</label>
              <input type="url" name="pterodactylUrl" defaultValue={settings?.pterodactylUrl || ''} className="input" placeholder="https://panel.example.com" />
            </div>
            <div>
              <label className="label">API Key (Application)</label>
              <input type="password" name="pterodactylKey" defaultValue={settings?.pterodactylKey || ''} className="input" placeholder="Leave empty to keep current" />
            </div>
          </div>
        </div>

        {/* Discord Settings */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Discord OAuth Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Client ID</label>
              <input type="text" name="discordClientId" defaultValue={settings?.discordClientId || ''} className="input" />
            </div>
            <div>
              <label className="label">Client Secret</label>
              <input type="password" name="discordClientSecret" defaultValue={settings?.discordClientSecret || ''} className="input" placeholder="Leave empty to keep current" />
            </div>
            <div>
              <label className="label">Guild ID (optional)</label>
              <input type="text" name="discordGuildId" defaultValue={settings?.discordGuildId || ''} className="input" />
            </div>
            <div>
              <label className="label">Discord Invite Link</label>
              <input type="url" name="discordInvite" defaultValue={settings?.discordInvite || ''} className="input" placeholder="https://discord.gg/..." />
            </div>
          </div>
        </div>

        {/* Default Resources */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Default Resources (New Users)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="label">Coins</label>
              <input type="number" name="defaultCoins" defaultValue={settings?.defaultCoins || 0} className="input" />
            </div>
            <div>
              <label className="label">RAM (MB)</label>
              <input type="number" name="defaultRam" defaultValue={settings?.defaultRam || 0} className="input" />
            </div>
            <div>
              <label className="label">Disk (MB)</label>
              <input type="number" name="defaultDisk" defaultValue={settings?.defaultDisk || 0} className="input" />
            </div>
            <div>
              <label className="label">CPU (%)</label>
              <input type="number" name="defaultCpu" defaultValue={settings?.defaultCpu || 0} className="input" />
            </div>
            <div>
              <label className="label">Servers</label>
              <input type="number" name="defaultServers" defaultValue={settings?.defaultServers || 0} className="input" />
            </div>
            <div>
              <label className="label">Databases</label>
              <input type="number" name="defaultDatabases" defaultValue={settings?.defaultDatabases || 0} className="input" />
            </div>
            <div>
              <label className="label">Backups</label>
              <input type="number" name="defaultBackups" defaultValue={settings?.defaultBackups || 0} className="input" />
            </div>
            <div>
              <label className="label">Allocations</label>
              <input type="number" name="defaultAllocations" defaultValue={settings?.defaultAllocations || 0} className="input" />
            </div>
          </div>
        </div>

        {/* Earn Coins Settings */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <LinkIcon className="w-5 h-5" />
            Earn Coins (Cuty.io)
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            Users click a button to generate a Cuty.io link. After completing the link, they get redirected back and receive coins automatically.
          </p>
          
          <label className="flex items-center gap-2 mb-6">
            <input type="checkbox" name="earnEnabled" defaultChecked={settings?.earnEnabled ?? true} className="rounded" />
            <span className="text-sm text-gray-300">Enable Earn Page</span>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="label">Coins Per Earn</label>
              <input 
                type="number" 
                name="earnCoins" 
                defaultValue={settings?.earnCoins || 10} 
                className="input" 
                min="1"
              />
              <p className="text-xs text-gray-500 mt-1">How many coins users get each time they complete a link</p>
            </div>
            <div>
              <label className="label">Cooldown (seconds)</label>
              <input 
                type="number" 
                name="earnCooldown" 
                defaultValue={settings?.earnCooldown || 300} 
                className="input" 
                min="60"
              />
              <p className="text-xs text-gray-500 mt-1">Time between earns (300 = 5 minutes)</p>
            </div>
          </div>

          {/* Cuty.io API Token */}
          <div className="p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg">
            <label className="label">Cuty.io API Token</label>
            <input 
              type="password" 
              name="cutyApiToken" 
              defaultValue={settings?.cutyApiToken || ''} 
              className="input" 
              placeholder="Enter your Cuty.io API token"
            />
            <p className="text-xs text-gray-500 mt-2">
              Get your API token from <a href="https://cuty.io/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">cuty.io/dashboard</a>. 
              This is required for the earn feature to work.
            </p>
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center justify-end gap-4">
          {saved && (
            <span className="text-green-400 text-sm animate-fadeIn">Settings saved!</span>
          )}
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
