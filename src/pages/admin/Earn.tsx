import { useState, useEffect } from 'react';
import { Gift, Loader2, Save, Link as LinkIcon, ExternalLink } from 'lucide-react';

// Simple Discord SVG icon component
const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

interface EarnSettings {
  earnEnabled: boolean;
  earnCoins: number;
  earnCooldown: number;
  cutyApiToken: string | null;
  discordBotToken: string | null;
  discordGuildId: string | null;
  statusEarnEnabled: boolean;
  statusEarnText: string | null;
  statusEarnCoins: number;
  statusEarnInterval: number;
}

export default function AdminEarn() {
  const [settings, setSettings] = useState<EarnSettings | null>(null);
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

    const updates: Partial<EarnSettings> = {
      earnEnabled: fd.get('earnEnabled') === 'on',
      earnCoins: parseInt(fd.get('earnCoins') as string) || 10,
      earnCooldown: parseInt(fd.get('earnCooldown') as string) || 300,
      statusEarnEnabled: fd.get('statusEarnEnabled') === 'on',
      statusEarnText: fd.get('statusEarnText') as string,
      statusEarnCoins: parseInt(fd.get('statusEarnCoins') as string) || 5,
      statusEarnInterval: parseInt(fd.get('statusEarnInterval') as string) || 300,
    };

    // Only include secrets if they were changed (not masked)
    const cutyToken = fd.get('cutyApiToken') as string;
    if (cutyToken && !cutyToken.includes('•')) {
      updates.cutyApiToken = cutyToken;
    }

    const botToken = fd.get('discordBotToken') as string;
    if (botToken && !botToken.includes('•')) {
      updates.discordBotToken = botToken;
    }

    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        setSaved(true);
        // Refresh page to apply settings
        setTimeout(() => {
          window.location.reload();
        }, 500);
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
        <h1 className="text-2xl font-bold text-white mb-2">Earn Settings</h1>
        <p className="text-gray-400">Configure how users can earn coins on your panel.</p>
      </div>

      <form onSubmit={saveSettings} className="space-y-6">
        {/* Cuty.io Earn Settings */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <LinkIcon className="w-5 h-5" />
            Link Shortener (Cuty.io)
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            Users click a button to generate a Cuty.io link. After completing the link, they get redirected back and receive coins automatically.
          </p>
          
          <label className="flex items-center gap-2 mb-6">
            <input type="checkbox" name="earnEnabled" defaultChecked={settings?.earnEnabled ?? true} className="rounded" />
            <span className="text-sm text-gray-300">Enable Link Shortener Earning</span>
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
              Get your API token from{' '}
              <a href="https://cuty.io/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-1">
                cuty.io/dashboard <ExternalLink className="w-3 h-3" />
              </a>. 
              This is required for the earn feature to work.
            </p>
          </div>
        </div>

        {/* Discord Status Earn Settings */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <DiscordIcon className="w-5 h-5" />
            Discord Status Earning
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            Users earn coins passively by being online in Discord with a custom status containing specific text.
            They must be in your Discord server and have the required status to earn.
          </p>
          
          <label className="flex items-center gap-2 mb-6">
            <input type="checkbox" name="statusEarnEnabled" defaultChecked={settings?.statusEarnEnabled ?? false} className="rounded" />
            <span className="text-sm text-gray-300">Enable Discord Status Earning</span>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="label">Required Status Text</label>
              <input 
                type="text" 
                name="statusEarnText" 
                defaultValue={settings?.statusEarnText || ''} 
                className="input" 
                placeholder="e.g. enderbit.com"
              />
              <p className="text-xs text-gray-500 mt-1">Text that must appear in the user's custom status (case-insensitive)</p>
            </div>
            <div>
              <label className="label">Coins Per Interval</label>
              <input 
                type="number" 
                name="statusEarnCoins" 
                defaultValue={settings?.statusEarnCoins || 5} 
                className="input" 
                min="1"
              />
              <p className="text-xs text-gray-500 mt-1">How many coins users earn per interval</p>
            </div>
            <div>
              <label className="label">Earn Interval (seconds)</label>
              <input 
                type="number" 
                name="statusEarnInterval" 
                defaultValue={settings?.statusEarnInterval || 300} 
                className="input" 
                min="60"
              />
              <p className="text-xs text-gray-500 mt-1">How often coins are awarded (300 = 5 minutes)</p>
            </div>
          </div>

          {/* Discord Bot Token */}
          <div className="p-4 bg-indigo-900/20 border border-indigo-700/30 rounded-lg mb-4">
            <label className="label">Discord Bot Token</label>
            <input 
              type="password" 
              name="discordBotToken" 
              defaultValue={settings?.discordBotToken || ''} 
              className="input" 
              placeholder="Enter your Discord bot token"
            />
            <p className="text-xs text-gray-500 mt-2">
              Create a bot at{' '}
              <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline inline-flex items-center gap-1">
                Discord Developer Portal <ExternalLink className="w-3 h-3" />
              </a>. 
              Enable <span className="text-indigo-400">Presence Intent</span> and <span className="text-indigo-400">Server Members Intent</span> in the bot settings.
            </p>
          </div>

          {!settings?.discordGuildId && (
            <div className="p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
              <p className="text-sm text-yellow-400">
                ⚠️ Discord Guild ID is not configured. Go to{' '}
                <a href="/admin/settings" className="underline">Settings</a> to set your Discord Guild ID.
              </p>
            </div>
          )}
        </div>

        {/* Save button */}
        <div className="flex items-center justify-end gap-4">
          {saved && (
            <span className="text-green-400 text-sm animate-fadeIn">Settings saved! Refreshing...</span>
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
