import { useSettings } from '../context/SettingsContext';
import { Wrench } from 'lucide-react';

export default function Maintenance() {
  const { settings } = useSettings();

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="card p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-500/10 mb-6">
            <Wrench className="w-8 h-8 text-yellow-400" />
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-3">
            Maintenance Mode
          </h1>
          
          <p className="text-gray-400 mb-6">
            {settings?.maintenanceMessage || 'We are currently performing scheduled maintenance. Please check back soon.'}
          </p>
          
          <div className="text-sm text-gray-500">
            {settings?.siteName || 'EnderBit'}
          </div>
        </div>
      </div>
    </div>
  );
}
