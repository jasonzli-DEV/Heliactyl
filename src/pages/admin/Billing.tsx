import { useState, useEffect } from 'react';
import { CreditCard, Loader2, Save } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface BillingSettings {
  billingRamRate: number;
  billingCpuRate: number;
  billingDiskRate: number;
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
        billingRamRate: data.settings?.billingRamRate || 1024,
        billingCpuRate: data.settings?.billingCpuRate || 50,
        billingDiskRate: data.settings?.billingDiskRate || 5120,
        maxRamSlider: data.settings?.maxRamSlider || 12288,
        maxDiskSlider: data.settings?.maxDiskSlider || 51200,
        maxCpuSlider: data.settings?.maxCpuSlider || 400,
      });
    } catch (error) {
      console.error('Failed to load billing settings:', error);
      // Set defaults if fetch fails
      setSettings({
        billingRamRate: 1024,
        billingCpuRate: 50,
        billingDiskRate: 5120,
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
        billingRamRate: parseFloat(formData.get('billingRamRate') as string) || 1024,
        billingCpuRate: parseFloat(formData.get('billingCpuRate') as string) || 50,
        billingDiskRate: parseFloat(formData.get('billingDiskRate') as string) || 5120,
        maxRamSlider: (parseInt(formData.get('maxRamSlider') as string) || 12) * 1024, // Convert GB to MB
        maxDiskSlider: (parseInt(formData.get('maxDiskSlider') as string) || 50) * 1024, // Convert GB to MB
        maxCpuSlider: parseInt(formData.get('maxCpuSlider') as string) || 400,
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
        <p className="text-gray-400">Configure hourly billing rates for server resources.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Hourly Billing Rates
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            Set how many MB/% of resources 1 credit provides per hour. Servers consume credits hourly based on allocated resources. After running out of credits, servers are automatically suspended after 24 hours and deleted after another 24 hours.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">RAM per Credit</label>
              <input 
                type="number" 
                name="billingRamRate" 
                defaultValue={settings?.billingRamRate || 1024} 
                className="input" 
                min="1"
                step="1"
              />
              <p className="text-xs text-gray-500 mt-1">MB of RAM per credit/hour</p>
              <p className="text-xs text-blue-400 mt-1">Example: 1024 = 1 credit gives 1GB RAM for 1 hour</p>
            </div>
            <div>
              <label className="label">CPU per Credit</label>
              <input 
                type="number" 
                name="billingCpuRate" 
                defaultValue={settings?.billingCpuRate || 50} 
                className="input" 
                min="1"
                step="1"
              />
              <p className="text-xs text-gray-500 mt-1">% CPU per credit/hour</p>
              <p className="text-xs text-blue-400 mt-1">Example: 50 = 1 credit gives 50% CPU for 1 hour</p>
            </div>
            <div>
              <label className="label">Disk per Credit</label>
              <input 
                type="number" 
                name="billingDiskRate" 
                defaultValue={settings?.billingDiskRate || 5120} 
                className="input" 
                min="1"
                step="1"
              />
              <p className="text-xs text-gray-500 mt-1">MB of disk per credit/hour</p>
              <p className="text-xs text-blue-400 mt-1">Example: 5120 = 1 credit gives 5GB disk for 1 hour</p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
            <p className="text-sm text-yellow-400">
              <strong>Note:</strong> Server slots, databases, backups, and allocations are <strong>permanent purchases</strong> from the store and are NOT billed hourly. Only RAM, CPU, and Disk resources consume credits while servers are running.
            </p>
          </div>
        </div>

        {/* Max Slider Configuration */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Slider Maximums</h2>
          <p className="text-sm text-gray-400 mb-4">
            Set maximum values for resource sliders when creating servers. Users can allocate up to these amounts.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Max RAM (GB)</label>
              <input 
                type="number" 
                name="maxRamSlider" 
                defaultValue={Math.round((settings?.maxRamSlider || 12288) / 1024)} 
                className="input" 
                min="1"
                step="1"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum GB users can allocate</p>
            </div>
            <div>
              <label className="label">Max Disk (GB)</label>
              <input 
                type="number" 
                name="maxDiskSlider" 
                defaultValue={Math.round((settings?.maxDiskSlider || 51200) / 1024)} 
                className="input" 
                min="1"
                step="1"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum GB users can allocate</p>
            </div>
            <div>
              <label className="label">Max CPU (%)</label>
              <input 
                type="number" 
                name="maxCpuSlider" 
                defaultValue={settings?.maxCpuSlider || 400} 
                className="input" 
                min="50"
                step="50"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum % users can allocate</p>
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
