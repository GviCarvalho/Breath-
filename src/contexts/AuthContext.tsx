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
  serverHttpUrl: string;
  login: (provider: 'google' | 'discord') => void;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
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
  // getConfig() is async, so serverHttpUrl starts out '' - indistinguishable
  // from "config loaded and there's genuinely no server". Without this flag,
  // the effect below saw the empty string on the very first render and
  // immediately set loading=false with user still null, before config had
  // a chance to load - any consumer's "if (!user) redirect" effect that
  // happened to run in that window (e.g. a direct link to a match) bounced
  // an already-logged-in player. `loading` now stays true until we actually
  // know one way or the other.
  const [configLoaded, setConfigLoaded] = useState(false);

  // Load config on mount
  useEffect(() => {
    getConfig().then((config) => {
      setServerHttpUrl(config.SERVER_HTTP_URL);
      setServerConfigured(isServerConfigured(config));
      setConfigLoaded(true);
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
    if (!configLoaded) return;
    if (serverHttpUrl) {
      refreshUser();
    } else {
      setLoading(false);
    }
  }, [configLoaded, serverHttpUrl, refreshUser]);

  const login = useCallback((provider: 'google' | 'discord') => {
    if (!serverHttpUrl) {
      setError('Servidor não configurado');
      return;
    }
    window.location.href = `${serverHttpUrl}/auth/${provider}`;
  }, [serverHttpUrl]);

  // Local email/password accounts hit the same JWT-cookie session the OAuth
  // routes already issue (see server/auth/routes.ts) - /auth/login and
  // /auth/register don't exist server-side yet, so these currently fail the
  // same way the OAuth buttons do until that lands, but nothing else in the
  // app needs to change once it does.
  const registerWithEmail = useCallback(async (email: string, password: string, displayName: string) => {
    if (!serverHttpUrl) throw new Error('Servidor não configurado');
    setError(null);
    const res = await fetch(`${serverHttpUrl}/auth/register`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({} as any));
      const msg = data.error || 'Não foi possível criar a conta.';
      setError(msg);
      throw new Error(msg);
    }
    await refreshUser();
  }, [serverHttpUrl, refreshUser]);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    if (!serverHttpUrl) throw new Error('Servidor não configurado');
    setError(null);
    const res = await fetch(`${serverHttpUrl}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({} as any));
      const msg = data.error || 'Email ou senha incorretos.';
      setError(msg);
      throw new Error(msg);
    }
    await refreshUser();
  }, [serverHttpUrl, refreshUser]);

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
    <AuthContext.Provider value={{ user, loading, error, serverConfigured, serverHttpUrl, login, loginWithEmail, registerWithEmail, logout, refreshUser }}>
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
