import { useState, useEffect } from 'react';
import { Settings, Loader2, Save, ExternalLink } from 'lucide-react';

interface SettingsData {
  siteName: string;
  siteDescription: string | null;
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
  afkEnabled: boolean;
  afkCoins: number;
  afkInterval: number;
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchSettings();
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

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);

    const updates: Partial<SettingsData> = {
      siteName: fd.get('siteName') as string,
      siteDescription: fd.get('siteDescription') as string,
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
      afkEnabled: fd.get('afkEnabled') === 'on',
      afkCoins: parseInt(fd.get('afkCoins') as string) || 0,
      afkInterval: parseInt(fd.get('afkInterval') as string) || 60,
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
        <p className="text-gray-400">Configure your Heliactyl instance.</p>
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

        {/* AFK Settings */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">AFK Rewards</h2>
          <label className="flex items-center gap-2 mb-4">
            <input type="checkbox" name="afkEnabled" defaultChecked={settings?.afkEnabled} className="rounded" />
            <span className="text-sm text-gray-300">Enable AFK Rewards</span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Coins per Interval</label>
              <input type="number" name="afkCoins" defaultValue={settings?.afkCoins || 1} className="input" />
            </div>
            <div>
              <label className="label">Interval (seconds)</label>
              <input type="number" name="afkInterval" defaultValue={settings?.afkInterval || 60} className="input" />
            </div>
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
