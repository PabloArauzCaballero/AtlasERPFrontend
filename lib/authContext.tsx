'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { clearAccessToken, getAccessToken, getSessionKind, setAccessToken } from '@/lib/apiClient';
import type { SessionKind } from '@/lib/apiClient';
import { authService } from '@/services/authService';
import { isPinChallenge } from '@/services/authTypes';
import type { InternalLoginOutcome, InternalUserProfile, MerchantUserProfile } from '@/services/authTypes';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * Dos poblaciones, dos sesiones. El personal interno tiene roles y permisos RBAC; el comercio no
 * tiene ninguno de los dos: lo que puede tocar lo decide el backend contra sus membresías. Se
 * modelan por separado para que ninguna pantalla pueda confundir "no tiene el permiso" con "es un
 * comercio", que son cosas distintas y llevan a UI distinta.
 */
interface AuthContextValue {
  user: InternalUserProfile | null;
  merchant: MerchantUserProfile | null;
  sessionKind: SessionKind;
  isMerchant: boolean;
  status: AuthStatus;
  hasPermission: (permissionCode: string) => boolean;
  /**
   * Devuelve el desenlace en vez de `void`: con el segundo factor obligatorio para todo actor
   * interno, "el login terminó bien" ya no implica "hay sesión", y la pantalla necesita saberlo
   * para pedir el código en vez de navegar a un portal al que todavía no se puede entrar.
   */
  login: (input: { email: string; password: string }) => Promise<InternalLoginOutcome>;
  verifyLoginPin: (input: { challengeToken: string; pin: string }) => Promise<void>;
  loginMerchant: (input: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, setUser] = useState<InternalUserProfile | null>(null);
  const [merchant, setMerchant] = useState<MerchantUserProfile | null>(null);
  const [sessionKind, setSessionKind] = useState<SessionKind>('internal');
  const [status, setStatus] = useState<AuthStatus>('loading');

  const loadSession = useCallback(async () => {
    if (!getAccessToken()) {
      setStatus('unauthenticated');
      return;
    }
    const kind = getSessionKind();
    try {
      // El perfil se relee del backend en cada arranque, no se guarda en el navegador: una
      // identidad suspendida entre dos visitas no debe seguir pintando una sesión válida.
      if (kind === 'merchant') {
        const profile = await authService.merchantMe();
        setMerchant(profile.user);
      } else {
        const profile = await authService.me();
        setUser(profile.user);
      }
      setSessionKind(kind);
      setStatus('authenticated');
    } catch {
      clearAccessToken();
      setUser(null);
      setMerchant(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    function handleForcedLogout() {
      setUser(null);
      setMerchant(null);
      setStatus('unauthenticated');
    }
    window.addEventListener('atlas:auth:logout', handleForcedLogout);
    return () => window.removeEventListener('atlas:auth:logout', handleForcedLogout);
  }, []);

  /** Deja la sesión interna en pie. Compartido por el login de un paso y por el canje del PIN. */
  const adoptInternalSession = useCallback((result: { accessToken: string; user: InternalUserProfile }) => {
    setAccessToken(result.accessToken, 'internal');
    setUser(result.user);
    setMerchant(null);
    setSessionKind('internal');
    setStatus('authenticated');
  }, []);

  const login = useCallback(
    async (input: { email: string; password: string }) => {
      const outcome = await authService.login(input);
      // Con el desafío pendiente NO se guarda token: no lo hay. Guardar `undefined` dejaba la
      // pantalla en "authenticated" y la primera llamada real devolvía 401.
      if (!isPinChallenge(outcome)) adoptInternalSession(outcome);
      return outcome;
    },
    [adoptInternalSession],
  );

  const verifyLoginPin = useCallback(
    async (input: { challengeToken: string; pin: string }) => {
      adoptInternalSession(await authService.loginPin(input));
    },
    [adoptInternalSession],
  );

  const loginMerchant = useCallback(async (input: { email: string; password: string }) => {
    const result = await authService.merchantLogin(input);
    setAccessToken(result.accessToken, 'merchant');
    setMerchant(result.user);
    setUser(null);
    setSessionKind('merchant');
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    const kind = getSessionKind();
    try {
      await (kind === 'merchant' ? authService.merchantLogout() : authService.logout());
    } catch {
      // Idempotente en el backend; si la llamada falla igual limpiamos la sesión local.
    }
    clearAccessToken();
    setUser(null);
    setMerchant(null);
    setSessionKind('internal');
    setStatus('unauthenticated');
  }, []);

  // Un comercio no tiene permisos RBAC: no le faltan, no aplican. Devolver `false` es correcto y
  // por eso las pantallas del portal no deben decidir nada con esto.
  const hasPermission = useCallback((permissionCode: string) => Boolean(user?.permissions.includes(permissionCode)), [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        merchant,
        sessionKind,
        isMerchant: sessionKind === 'merchant',
        status,
        hasPermission,
        login,
        verifyLoginPin,
        loginMerchant,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return context;
}
