/**
 * Contexto de sesión: carga tokens de SecureStore al arrancar, expone
 * login/logout y reacciona a expiraciones (401 definitivo → welcome).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  api,
  clearSession,
  loadSession,
  onSessionExpired,
  saveSession,
  updateSavedUser,
  type TyUser,
} from '@/lib/api';

type SessionState = {
  ready: boolean;            // ya se leyó SecureStore
  user: TyUser | null;
  login: (email: string, password: string) => Promise<void>;
  adoptSession: (token: string, refresh: string | null, user: TyUser) => Promise<void>;
  setUser: (u: TyUser) => void;
  logout: () => Promise<void>;
};

const Ctx = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUserState] = useState<TyUser | null>(null);

  useEffect(() => {
    loadSession().then((s) => {
      setUserState(s?.user ?? null);
      setReady(true);
    });
    const off = onSessionExpired(() => setUserState(null));
    return () => { off(); };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api.post<never>('/auth/login', { email, password });
    if (!r.token || !r.user) throw new Error(r.message || 'No se pudo iniciar sesión');
    await saveSession(r.token, r.refresh_token ?? null, r.user);
    setUserState(r.user);
  }, []);

  const adoptSession = useCallback(async (token: string, refresh: string | null, u: TyUser) => {
    await saveSession(token, refresh, u);
    setUserState(u);
  }, []);

  const setUser = useCallback((u: TyUser) => {
    setUserState(u);
    updateSavedUser(u).catch(() => {});
  }, []);

  const logout = useCallback(async () => {
    api.post('/auth/logout').catch(() => {});
    await clearSession();
    setUserState(null);
  }, []);

  const value = useMemo(
    () => ({ ready, user, login, adoptSession, setUser, logout }),
    [ready, user, login, adoptSession, setUser, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession debe usarse dentro de <SessionProvider>');
  return ctx;
}
