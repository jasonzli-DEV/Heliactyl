import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface User {
  id: string;
  discordId: string;
  username: string;
  email: string;
  avatar: string | null;
  isAdmin: boolean;
  coins: number;
  ram: number;
  disk: number;
  cpu: number;
  servers: number;
  databases: number;
  backups: number;
  allocations: number;
  pterodactylId: number | null;
  createdAt: string;
  banned?: boolean;
  banReason?: string | null;
  banExpiresAt?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  banned: boolean;
  banReason: string | null;
  banExpiresAt: string | null;
  login: () => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [banned, setBanned] = useState(false);
  const [banReason, setBanReason] = useState<string | null>(null);
  const [banExpiresAt, setBanExpiresAt] = useState<string | null>(null);

  const refreshUser = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      const data = await res.json();
      
      if (data.banned) {
        setBanned(true);
        setBanReason(data.banReason || null);
        setBanExpiresAt(data.banExpiresAt || null);
        setUser({ 
          id: data.user?.id || '',
          discordId: data.user?.discordId || '',
          username: data.user?.username || 'Banned User',
          email: data.user?.email || '',
          avatar: data.user?.avatar || null,
          isAdmin: false,
          coins: 0,
          ram: 0,
          disk: 0,
          cpu: 0,
          servers: 0,
          databases: 0,
          backups: 0,
          allocations: 0,
          pterodactylId: null,
          createdAt: new Date().toISOString(),
          banned: true,
          banReason: data.banReason,
          banExpiresAt: data.banExpiresAt,
        });
      } else {
        setBanned(false);
        setBanReason(null);
        setBanExpiresAt(null);
        setUser(data.user);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = () => {
    window.location.href = '/api/auth/discord';
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      setUser(null);
      setBanned(false);
      setBanReason(null);
      setBanExpiresAt(null);
      window.location.href = '/login';
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, banned, banReason, banExpiresAt, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
