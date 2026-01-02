import { useState, useEffect } from 'react';
import { CreditCard, Loader2, Save, Power, Sliders } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface BillingSettings {
  billingEnabled: boolean;
  billingRamRate: number;
  billingCpuRate: number;
  billingDiskRate: number;
  billingDatabaseRate: number;
  billingAllocationRate: number;
  billingBackupRate: number;
  maxRamSlider: number;
  maxDiskSlider: number;
  maxCpuSlider: number;
}

export default function AdminBilling() {
  const [settings, setSettings] = useState<BillingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings', { credentials: 'include' });
      if (!res.ok) {
        throw new Error('Failed to fetch settings');
      }
      const data = await res.json();
      setSettings({
        billingEnabled: data.settings?.billingEnabled ?? false,
        billingRamRate: data.settings?.billingRamRate ?? 1024,
        billingCpuRate: data.settings?.billingCpuRate ?? 100,
        billingDiskRate: data.settings?.billingDiskRate ?? 5120,
        billingDatabaseRate: data.settings?.billingDatabaseRate ?? 0,
        billingAllocationRate: data.settings?.billingAllocationRate ?? 0,
        billingBackupRate: data.settings?.billingBackupRate ?? 0,
        maxRamSlider: data.settings?.maxRamSlider ?? 12288,
        maxDiskSlider: data.settings?.maxDiskSlider ?? 51200,
        maxCpuSlider: data.settings?.maxCpuSlider ?? 400,
      });
    } catch (error) {
      console.error('Failed to load billing settings:', error);
      // Set defaults if fetch fails
      setSettings({
        billingEnabled: false,
        billingRamRate: 1024,
        billingCpuRate: 100,
        billingDiskRate: 5120,
        billingDatabaseRate: 0,
        billingAllocationRate: 0,
        billingBackupRate: 0,
        maxRamSlider: 12288,
        maxDiskSlider: 51200,
        maxCpuSlider: 400,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);

    try {
      const formData = new FormData(e.currentTarget);
      const data = {
        billingEnabled: formData.get('billingEnabled') === 'on',
        billingRamRate: Number(formData.get('billingRamRate')) || 1024,
        billingCpuRate: Number(formData.get('billingCpuRate')) || 100,
        billingDiskRate: Number(formData.get('billingDiskRate')) || 5120,
        billingDatabaseRate: Number(formData.get('billingDatabaseRate')) || 0,
        billingAllocationRate: Number(formData.get('billingAllocationRate')) || 0,
        billingBackupRate: Number(formData.get('billingBackupRate')) || 0,
        maxRamSlider: (Number(formData.get('maxRamSlider')) || 12) * 1024, // Convert GB to MB
        maxDiskSlider: (Number(formData.get('maxDiskSlider')) || 50) * 1024, // Convert GB to MB
        maxCpuSlider: Number(formData.get('maxCpuSlider')) || 400,
      };

      console.log('Saving billing settings:', data);

      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }

      showToast('Billing settings saved successfully', 'success');
      await fetchSettings();
    } catch (error) {
      console.error('Save error:', error);
      showToast(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
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
        <h1 className="text-2xl font-bold text-white mb-2">Billing Configuration</h1>
        <p className="text-gray-400">Configure hourly billing rates and resource limits.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Enable/Disable Billing */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Power className="w-5 h-5" />
            Billing Status
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            When enabled, servers are billed hourly using a prepaid coin system. Users must have coins to keep servers running.
            If they run out of coins, servers are automatically paused.
          </p>
          
          <label className="flex items-center gap-3 p-4 bg-dark-700/50 rounded-lg border border-dark-600 cursor-pointer hover:border-primary/50 transition-colors">
            <input 
              type="checkbox" 
              name="billingEnabled" 
              defaultChecked={settings?.billingEnabled} 
              className="w-5 h-5 rounded text-primary focus:ring-primary"
            />
            <div>
              <span className="text-white font-medium">Enable Hourly Billing</span>
              <p className="text-xs text-gray-400 mt-0.5">Users will be charged coins every hour for running servers</p>
            </div>
          </label>
        </div>

        {/* Hourly Rates */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Hourly Billing Rates
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            Set how many resources 1 coin provides per hour. Lower values = more expensive.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">RAM per Coin (MB)</label>
              <input 
                type="number" 
                name="billingRamRate" 
                defaultValue={settings?.billingRamRate ?? 1024} 
                className="input" 
                min="1"
                step="128"
              />
              <p className="text-xs text-gray-500 mt-1">MB of RAM per coin/hour</p>
              <p className="text-xs text-blue-400 mt-1">1024 = 1GB costs 1 coin/hr</p>
            </div>
            <div>
              <label className="label">CPU per Coin (%)</label>
              <input 
                type="number" 
                name="billingCpuRate" 
                defaultValue={settings?.billingCpuRate ?? 100} 
                className="input" 
                min="1"
                step="10"
              />
              <p className="text-xs text-gray-500 mt-1">% CPU per coin/hour</p>
              <p className="text-xs text-blue-400 mt-1">100 = 100% CPU costs 1 coin/hr</p>
            </div>
            <div>
              <label className="label">Disk per Coin (MB)</label>
              <input 
                type="number" 
                name="billingDiskRate" 
                defaultValue={settings?.billingDiskRate ?? 5120} 
                className="input" 
                min="1"
                step="512"
              />
              <p className="text-xs text-gray-500 mt-1">MB of disk per coin/hour</p>
              <p className="text-xs text-blue-400 mt-1">5120 = 5GB costs 1 coin/hr</p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg">
            <h3 className="text-sm font-medium text-blue-300 mb-2">Cost Example</h3>
            <p className="text-xs text-gray-400">
              A server with 2GB RAM, 100% CPU, 10GB disk would cost:{' '}
              <code className="text-blue-400">
                ({2048}/{settings?.billingRamRate ?? 1024}) + ({100}/{settings?.billingCpuRate ?? 100}) + ({10240}/{settings?.billingDiskRate ?? 5120}) = {
                  Math.ceil((2048/(settings?.billingRamRate ?? 1024)) + (100/(settings?.billingCpuRate ?? 100)) + (10240/(settings?.billingDiskRate ?? 5120)))
                } coins/hour
              </code>
            </p>
          </div>

          <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
            <p className="text-sm text-yellow-400">
              <strong>Note:</strong> Databases, backups, and extra ports are <strong>permanent purchases</strong> from the store and are NOT billed hourly.
            </p>
          </div>
        </div>

        {/* Max Slider Configuration */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Sliders className="w-5 h-5" />
            Slider Maximums
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            Maximum values for resource sliders when creating servers. Users can allocate up to these amounts (if they have enough coins).
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Max RAM (GB)</label>
              <input 
                type="number" 
                name="maxRamSlider" 
                defaultValue={Math.round((settings?.maxRamSlider ?? 12288) / 1024)} 
                className="input" 
                min="1"
                step="1"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum RAM users can allocate</p>
            </div>
            <div>
              <label className="label">Max Disk (GB)</label>
              <input 
                type="number" 
                name="maxDiskSlider" 
                defaultValue={Math.round((settings?.maxDiskSlider ?? 51200) / 1024)} 
                className="input" 
                min="1"
                step="1"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum disk users can allocate</p>
            </div>
            <div>
              <label className="label">Max CPU (%)</label>
              <input 
                type="number" 
                name="maxCpuSlider" 
                defaultValue={settings?.maxCpuSlider ?? 400} 
                className="input" 
                min="50"
                step="50"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum CPU % users can allocate</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Billing Settings
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
