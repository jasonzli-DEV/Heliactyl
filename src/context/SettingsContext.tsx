import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface Settings {
  siteName: string;
  siteDescription: string | null;
  logo: string | null;
  favicon: string | null;
  theme: string;
  accentColor: string;
  allowNewUsers: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  footerText: string | null;
  discordInvite: string | null;
}

interface SettingsContextType {
  settings: Settings | null;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const defaultSettings: Settings = {
  siteName: 'EnderBit',
  siteDescription: null,
  logo: null,
  favicon: null,
  theme: 'dark',
  accentColor: '#8b5cf6',
  allowNewUsers: true,
  maintenanceMode: false,
  maintenanceMessage: null,
  footerText: '© EnderBit Hosting 2025',
  discordInvite: null,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setSettings(data.settings || defaultSettings);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  // Update document title and favicon when settings change
  useEffect(() => {
    if (settings) {
      document.title = settings.siteName || 'EnderBit';
      if (settings.favicon) {
        const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
        if (link) {
          link.href = settings.favicon;
        }
      }
    }
  }, [settings]);

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
