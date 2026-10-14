import { authService as sharedAuthService } from '@/services/authService';
import { toSession } from '@/modules/auth/mappers/session-mapper';
import type { Credentials, Session } from '@/modules/auth/models/session';

export { sessionStorageKey } from '@/services/authService';

// UI facade only: persistence, tokens, fixtures and transport belong to WEB-05.
export const authService = {
  async login(credentials: Credentials, signal?: AbortSignal): Promise<Session> {
    try {
      return toSession(
        await sharedAuthService.loginGuest(credentials.email, credentials.password, signal),
      );
    } catch (error) {
      // Only invalid credentials mean "not a guest". Preserve stay, permission and
      // connectivity errors instead of masking them with a second login request.
      if (!(error instanceof Error) || error.message !== 'Correo o contraseña incorrectos.') {
        throw error;
      }
    }

    return toSession(
      await sharedAuthService.login(credentials.email, credentials.password, signal),
    );
  },
  async loginGuest(credentials: Credentials, signal?: AbortSignal): Promise<Session> {
    return toSession(
      await sharedAuthService.loginGuest(credentials.email, credentials.password, signal),
    );
  },
  async registerGuest(
    code: string,
    email: string,
    password: string,
    signal?: AbortSignal,
  ): Promise<Session> {
    return toSession(await sharedAuthService.registerGuest(code, email, password, signal));
  },
  async linkGuest(code: string, signal?: AbortSignal): Promise<Session> {
    return toSession(await sharedAuthService.linkGuest(code, signal));
  },
  async restore(signal?: AbortSignal): Promise<Session | null> {
    const session = await sharedAuthService.getCurrentSession(signal);
    return session ? toSession(session) : null;
  },
  logout: () => sharedAuthService.logout(),
  markGuestAccessExpired: () => sharedAuthService.markGuestAccessExpired(),
  isGuestAccessExpired: () => sharedAuthService.isGuestAccessExpired(),
  clearGuestAccessExpired: () => sharedAuthService.clearGuestAccessExpired(),
};
