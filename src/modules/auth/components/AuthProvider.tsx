import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AuthContext } from './auth-context';
import type { Credentials, Session } from '@/modules/auth/models/session';
import { authService, sessionStorageKey } from '@/modules/auth/services/auth-service';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const request = useRef<AbortController | null>(null);

  const retry = useCallback(async () => {
    const current = ++requestId.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setIsLoading(true);
    setSession(null);
    setError(null);
    try {
      const restored = await authService.restore(controller.signal);
      if (current === requestId.current) setSession(restored);
    } catch {
      if (current === requestId.current)
        setError('No se pudo recuperar la sesión. Intenta nuevamente.');
    } finally {
      if (current === requestId.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const requests = requestId;
    const controller = request;
    void retry();
    const onStorage = (event: StorageEvent) => {
      if (event.key === sessionStorageKey || event.key === null) void retry();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      ++requests.current;
      controller.current?.abort();
      window.removeEventListener('storage', onStorage);
    };
  }, [retry]);

  const logout = useCallback(() => {
    ++requestId.current;
    request.current?.abort();
    setSession(null);
    setIsLoading(false);
    setError(null);
    const current = requestId.current;
    void authService.logout().catch((reason: unknown) => {
      if (current === requestId.current)
        setError(reason instanceof Error ? reason.message : 'No se pudo cerrar la sesión.');
    });
  }, []);

  useEffect(() => {
    if (!session) return;
    const expire = () => {
      // La sesión de huésped vence con su token: se le pedirá de nuevo el código.
      if (session.role === 'GUEST') authService.markGuestAccessExpired();
      logout();
    };
    const timer = window.setTimeout(expire, Math.max(0, session.expiresAt.getTime() - Date.now()));
    return () => window.clearTimeout(timer);
  }, [session, logout]);

  async function login(credentials: Credentials) {
    const current = ++requestId.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const next = await authService.login(credentials, controller.signal);
    if (current !== requestId.current) return;
    setSession(next);
    setError(null);
  }

  async function loginGuest(credentials: Credentials) {
    const current = ++requestId.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const next = await authService.loginGuest(credentials, controller.signal);
    if (current !== requestId.current) return;
    setSession(next);
    setError(null);
  }

  async function registerGuest(code: string, email: string, password: string) {
    const current = ++requestId.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const next = await authService.registerGuest(code, email, password, controller.signal);
    if (current !== requestId.current) return;
    setSession(next);
    setError(null);
  }

  async function linkGuest(code: string) {
    const current = ++requestId.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const next = await authService.linkGuest(code, controller.signal);
    if (current !== requestId.current) return;
    setSession(next);
    setError(null);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        error,
        login,
        loginGuest,
        registerGuest,
        linkGuest,
        logout,
        retry,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
