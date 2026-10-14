import { createContext, useContext } from 'react';
import type { Credentials, Session } from '@/modules/auth/models/session';

export interface AuthContextValue {
  session: Session | null;
  isLoading: boolean;
  error: string | null;
  login: (credentials: Credentials) => Promise<void>;
  /** Login de huésped con correo y contraseña contra backend real. */
  loginGuest: (credentials: Credentials) => Promise<void>;
  registerGuest: (code: string, email: string, password: string) => Promise<void>;
  /** Acceso de huésped con el código de su reserva (flujo secundario). */
  linkGuest: (code: string) => Promise<void>;
  logout: () => void;
  retry: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth requires AuthProvider');
  return auth;
}
