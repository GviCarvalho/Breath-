import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getConfig, isServerConfigured } from '@/lib/config';

interface User {
  userId: string;
  provider: string;
  displayName: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  serverConfigured: boolean;
  login: (provider: 'google' | 'discord') => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverConfigured, setServerConfigured] = useState(false);
  const [serverHttpUrl, setServerHttpUrl] = useState('');

  // Load config on mount
  useEffect(() => {
    getConfig().then((config) => {
      setServerHttpUrl(config.SERVER_HTTP_URL);
      setServerConfigured(isServerConfigured(config));
    });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!serverHttpUrl) {
        setUser(null);
        setLoading(false);
        return;
      }

      const response = await fetch(`${serverHttpUrl}/auth/me`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('[Auth] Failed to fetch user:', err);
      setError(err instanceof Error ? err.message : 'Failed to authenticate');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [serverHttpUrl]);

  useEffect(() => {
    if (serverHttpUrl) {
      refreshUser();
    } else {
      setLoading(false);
    }
  }, [serverHttpUrl, refreshUser]);

  const login = useCallback((provider: 'google' | 'discord') => {
    if (!serverHttpUrl) {
      setError('Servidor não configurado');
      return;
    }
    window.location.href = `${serverHttpUrl}/auth/${provider}`;
  }, [serverHttpUrl]);

  const logout = useCallback(async () => {
    try {
      setError(null);
      if (!serverHttpUrl) {
        setUser(null);
        return;
      }
      await fetch(`${serverHttpUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      setUser(null);
    } catch (err) {
      console.error('[Auth] Failed to logout:', err);
      setError(err instanceof Error ? err.message : 'Failed to logout');
    }
  }, [serverHttpUrl]);

  return (
    <AuthContext.Provider value={{ user, loading, error, serverConfigured, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
