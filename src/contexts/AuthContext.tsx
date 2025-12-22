import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

interface User {
  userId: string;
  provider: string;
  displayName: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (provider: 'google' | 'discord') => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const SERVER_HTTP_URL = (import.meta as any).env?.VITE_SERVER_HTTP_URL || 'http://localhost:3001';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${SERVER_HTTP_URL}/auth/me`, {
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
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback((provider: 'google' | 'discord') => {
    window.location.href = `${SERVER_HTTP_URL}/auth/${provider}`;
  }, []);

  const logout = useCallback(async () => {
    try {
      setError(null);
      await fetch(`${SERVER_HTTP_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      setUser(null);
    } catch (err) {
      console.error('[Auth] Failed to logout:', err);
      setError(err instanceof Error ? err.message : 'Failed to logout');
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, refreshUser }}>
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
