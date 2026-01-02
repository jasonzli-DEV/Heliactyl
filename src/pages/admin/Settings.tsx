import { useState, useEffect, useRef } from 'react';
import { Settings, Loader2, Save, ExternalLink, Download, RefreshCw, CheckCircle, AlertCircle, Link as LinkIcon, CreditCard, Upload, ImageIcon } from 'lucide-react';

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
  footerText: string | null;
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
  // Billing settings
  billingEnabled: boolean;
  billingRamRate: number;
  billingCpuRate: number;
  billingDiskRate: number;
  billingDatabaseRate: number;
  billingAllocationRate: number;
  billingBackupRate: number;
  billingGracePeriod: number;
}

interface VersionInfo {
  version: string;
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
  
  // File upload state
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  
  // Update system state
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchSettings();
    checkForUpdates();
  }, []);

  const handleFileUpload = async (file: File, type: 'logo' | 'favicon') => {
    if (type === 'logo') setUploadingLogo(true);
    else setUploadingFavicon(true);
    
    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;
      
      // Upload to server
      const res = await fetch('/api/upload/base64', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          data: base64Data,
          filename: file.name,
          type: file.type,
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      
      // Update settings with new URL
      if (settings) {
        setSettings({
          ...settings,
          [type]: data.url,
        });
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      if (type === 'logo') setUploadingLogo(false);
      else setUploadingFavicon(false);
    }
  };

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
      footerText: fd.get('footerText') as string,
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
      // Billing settings
      billingEnabled: fd.get('billingEnabled') === 'on',
      billingRamRate: parseFloat(fd.get('billingRamRate') as string) || 1,
      billingCpuRate: parseFloat(fd.get('billingCpuRate') as string) || 1,
      billingDiskRate: parseFloat(fd.get('billingDiskRate') as string) || 1,
      billingDatabaseRate: parseFloat(fd.get('billingDatabaseRate') as string) || 0,
      billingAllocationRate: parseFloat(fd.get('billingAllocationRate') as string) || 0,
      billingBackupRate: parseFloat(fd.get('billingBackupRate') as string) || 0,
      billingGracePeriod: parseInt(fd.get('billingGracePeriod') as string) || 24,
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
        <p className="text-sm text-gray-400 mb-4">
          Keep your dashboard up-to-date with the latest features and bug fixes from GitHub.
        </p>
        
        <div className="space-y-4">
          {versionInfo && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3 bg-dark-700/50 rounded-lg">
                <span className="text-xs text-gray-400 block mb-1">Version</span>
                <code className="text-sm text-purple-400 font-mono">{versionInfo.version}</code>
              </div>
              <div className="p-3 bg-dark-700/50 rounded-lg">
                <span className="text-xs text-gray-400 block mb-1">Current Commit</span>
                <code className="text-sm text-blue-400 font-mono">{versionInfo.currentCommit}</code>
              </div>
              <div className="p-3 bg-dark-700/50 rounded-lg">
                <span className="text-xs text-gray-400 block mb-1">Latest Commit</span>
                <code className="text-sm text-green-400 font-mono">{versionInfo.remoteCommit}</code>
              </div>
              <div className="p-3 bg-dark-700/50 rounded-lg">
                <span className="text-xs text-gray-400 block mb-1">Branch</span>
                <code className="text-sm text-yellow-400 font-mono">{versionInfo.branch}</code>
              </div>
            </div>
          )}

          {versionInfo?.updateAvailable && (
            <div className="p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-blue-400 mb-1">New Update Available!</p>
                  {versionInfo.changelog && (
                    <>
                      <p className="text-sm text-gray-400 mb-2">Changelog:</p>
                      <pre className="text-xs text-gray-300 bg-dark-800 p-3 rounded whitespace-pre-wrap max-h-40 overflow-auto">
                        {versionInfo.changelog}
                      </pre>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {!versionInfo?.updateAvailable && versionInfo && (
            <div className="p-3 bg-green-900/20 border border-green-700/50 rounded-lg flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-400">You're running the latest version!</span>
            </div>
          )}

          {updateResult && (
            <div className={`p-4 rounded-lg ${
              updateResult.success 
                ? 'bg-green-900/30 border border-green-700' 
                : 'bg-red-900/30 border border-red-700'
            }`}>
              <div className="flex items-start gap-3">
                {updateResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${updateResult.success ? 'text-green-400' : 'text-red-400'}`}>
                    {updateResult.message}
                  </p>
                </div>
              </div>
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
                    Updating & Restarting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Install Update Now
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
              <label className="label">Logo</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  name="logo" 
                  value={settings?.logo || ''} 
                  onChange={(e) => setSettings(s => s ? {...s, logo: e.target.value} : s)}
                  className="input flex-1" 
                  placeholder="Enter URL or upload file"
                />
                <input
                  type="file"
                  ref={logoInputRef}
                  accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'logo')}
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="btn-secondary px-3"
                  title="Upload logo"
                >
                  {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                </button>
              </div>
              {settings?.logo && (
                <div className="mt-2 flex items-center gap-2">
                  <img src={settings.logo} alt="Logo preview" className="h-8 rounded" />
                  <span className="text-xs text-gray-500">Preview</span>
                </div>
              )}
            </div>
            <div>
              <label className="label">Favicon</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  name="favicon" 
                  value={settings?.favicon || ''} 
                  onChange={(e) => setSettings(s => s ? {...s, favicon: e.target.value} : s)}
                  className="input flex-1" 
                  placeholder="Enter URL or upload file"
                />
                <input
                  type="file"
                  ref={faviconInputRef}
                  accept="image/png,image/jpeg,image/x-icon,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'favicon')}
                />
                <button
                  type="button"
                  onClick={() => faviconInputRef.current?.click()}
                  disabled={uploadingFavicon}
                  className="btn-secondary px-3"
                  title="Upload favicon"
                >
                  {uploadingFavicon ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                </button>
              </div>
              {settings?.favicon && (
                <div className="mt-2 flex items-center gap-2">
                  <img src={settings.favicon} alt="Favicon preview" className="h-6 rounded" />
                  <span className="text-xs text-gray-500">Preview</span>
                </div>
              )}
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
          <div className="mt-4">
            <label className="label">Footer Text</label>
            <input 
              type="text" 
              name="footerText" 
              defaultValue={settings?.footerText || '© EnderBit Hosting 2025'} 
              className="input" 
              placeholder="© Your Site 2025"
            />
            <p className="text-xs text-gray-500 mt-1">
              Supports markdown: <code className="text-gray-400">**bold**</code>, <code className="text-gray-400">[link text](url)</code>
            </p>
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

        {/* Billing Settings */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Hourly Billing Settings
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            Servers are billed hourly using a prepaid system. Users must have coins to keep servers running. 
            If they run out of coins, the server is automatically paused.
          </p>
          
          <label className="flex items-center gap-2 mb-6">
            <input type="checkbox" name="billingEnabled" defaultChecked={settings?.billingEnabled} className="rounded" />
            <span className="text-sm text-gray-300">Enable Hourly Billing</span>
          </label>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="label">RAM Rate (MB per coin/hr)</label>
              <input 
                type="number" 
                name="billingRamRate" 
                defaultValue={settings?.billingRamRate || 1024} 
                className="input" 
                min="1"
                step="128"
              />
              <p className="text-xs text-gray-500 mt-1">e.g. 1024 = 1GB costs 1 coin/hr</p>
            </div>
            <div>
              <label className="label">CPU Rate (% per coin/hr)</label>
              <input 
                type="number" 
                name="billingCpuRate" 
                defaultValue={settings?.billingCpuRate || 100} 
                className="input" 
                min="1"
                step="10"
              />
              <p className="text-xs text-gray-500 mt-1">e.g. 100 = 100% costs 1 coin/hr</p>
            </div>
            <div>
              <label className="label">Disk Rate (MB per coin/hr)</label>
              <input 
                type="number" 
                name="billingDiskRate" 
                defaultValue={settings?.billingDiskRate || 5120} 
                className="input" 
                min="1"
                step="512"
              />
              <p className="text-xs text-gray-500 mt-1">e.g. 5120 = 5GB costs 1 coin/hr</p>
            </div>
            <div>
              <label className="label">Database Rate (coins/hr)</label>
              <input 
                type="number" 
                name="billingDatabaseRate" 
                defaultValue={settings?.billingDatabaseRate || 0} 
                className="input" 
                min="0"
                step="0.1"
              />
              <p className="text-xs text-gray-500 mt-1">0 = databases are free (permanent resource)</p>
            </div>
            <div>
              <label className="label">Port Rate (coins/hr)</label>
              <input 
                type="number" 
                name="billingAllocationRate" 
                defaultValue={settings?.billingAllocationRate || 0} 
                className="input" 
                min="0"
                step="0.1"
              />
              <p className="text-xs text-gray-500 mt-1">0 = ports are free (permanent resource)</p>
            </div>
            <div>
              <label className="label">Backup Rate (coins/hr)</label>
              <input 
                type="number" 
                name="billingBackupRate" 
                defaultValue={settings?.billingBackupRate || 0} 
                className="input" 
                min="0"
                step="0.1"
              />
              <p className="text-xs text-gray-500 mt-1">0 = backups are free (permanent resource)</p>
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg">
            <h3 className="text-sm font-medium text-blue-300 mb-2">Cost Calculation Example</h3>
            <p className="text-xs text-gray-400">
              A server with 2GB RAM, 100% CPU, 10GB disk at current rates would cost: <br />
              <code className="text-blue-400">
                ({2048}/{settings?.billingRamRate || 1024}) + ({100}/{settings?.billingCpuRate || 100}) + ({10240}/{settings?.billingDiskRate || 5120}) = {
                  Math.ceil((2048/(settings?.billingRamRate || 1024)) + (100/(settings?.billingCpuRate || 100)) + (10240/(settings?.billingDiskRate || 5120)))
                } coins/hour
              </code>
            </p>
          </div>
        </div>

        {/* Default Resources */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Default Resources (New Users)</h2>
          <p className="text-sm text-gray-400 mb-4">
            ⚠️ <strong>Important:</strong> RAM/Disk/CPU are NOT given to users - servers are billed hourly for these resources. 
            Only set <strong>Coins, Servers, Databases, Backups, and Allocations</strong> as defaults.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="label">Coins</label>
              <input type="number" name="defaultCoins" defaultValue={settings?.defaultCoins || 60} className="input" min="0" />
              <p className="text-xs text-gray-500 mt-1">Starting balance</p>
            </div>
            <div className="bg-dark-700/50 p-3 rounded-lg opacity-60">
              <label className="label">RAM (MB)</label>
              <input type="number" name="defaultRam" value={0} className="input" disabled />
              <p className="text-xs text-red-400 mt-1">Billed hourly, not given</p>
            </div>
            <div className="bg-dark-700/50 p-3 rounded-lg opacity-60">
              <label className="label">Disk (MB)</label>
              <input type="number" name="defaultDisk" value={0} className="input" disabled />
              <p className="text-xs text-red-400 mt-1">Billed hourly, not given</p>
            </div>
            <div className="bg-dark-700/50 p-3 rounded-lg opacity-60">
              <label className="label">CPU (%)</label>
              <input type="number" name="defaultCpu" value={0} className="input" disabled />
              <p className="text-xs text-red-400 mt-1">Billed hourly, not given</p>
            </div>
            <div>
              <label className="label">Server Slots</label>
              <input type="number" name="defaultServers" defaultValue={settings?.defaultServers || 1} className="input" min="0" />
              <p className="text-xs text-gray-500 mt-1">Permanent slots</p>
            </div>
            <div>
              <label className="label">Databases (per server)</label>
              <input type="number" name="defaultDatabases" defaultValue={settings?.defaultDatabases || 1} className="input" min="0" />
              <p className="text-xs text-gray-500 mt-1">Permanent limit</p>
            </div>
            <div>
              <label className="label">Backups (per server)</label>
              <input type="number" name="defaultBackups" defaultValue={settings?.defaultBackups || 1} className="input" min="0" />
              <p className="text-xs text-gray-500 mt-1">Permanent limit</p>
            </div>
            <div>
              <label className="label">Ports (per server)</label>
              <input type="number" name="defaultAllocations" defaultValue={settings?.defaultAllocations || 1} className="input" min="0" />
              <p className="text-xs text-gray-500 mt-1">Permanent limit</p>
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
