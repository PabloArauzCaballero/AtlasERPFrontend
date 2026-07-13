'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { clearAccessToken, getAccessToken, setAccessToken } from '@/lib/apiClient';
import { authService } from '@/services/authService';
import type { InternalUserProfile } from '@/services/authTypes';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  user: InternalUserProfile | null;
  status: AuthStatus;
  hasPermission: (permissionCode: string) => boolean;
  login: (input: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, setUser] = useState<InternalUserProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const loadSession = useCallback(async () => {
    if (!getAccessToken()) {
      setStatus('unauthenticated');
      return;
    }
    try {
      const profile = await authService.me();
      setUser(profile.user);
      setStatus('authenticated');
    } catch {
      clearAccessToken();
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    function handleForcedLogout() {
      setUser(null);
      setStatus('unauthenticated');
    }
    window.addEventListener('atlas:auth:logout', handleForcedLogout);
    return () => window.removeEventListener('atlas:auth:logout', handleForcedLogout);
  }, []);

  const login = useCallback(async (input: { email: string; password: string }) => {
    const result = await authService.login(input);
    setAccessToken(result.accessToken);
    setUser(result.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Idempotente en el backend; si la llamada falla igual limpiamos la sesión local.
    }
    clearAccessToken();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const hasPermission = useCallback((permissionCode: string) => Boolean(user?.permissions.includes(permissionCode)), [user]);

  return (
    <AuthContext.Provider value={{ user, status, hasPermission, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return context;
}
