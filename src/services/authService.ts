import {
  toAuthSession,
  type AuthResponseDTO,
  type AuthSession,
  type BackendAuthResponseDTO,
  type BackendGuestLinkResponseDTO,
  type BackendGuestLoginResponseDTO,
  type SessionUser,
} from '@/shared/types/entities/session';
import type { UserRole } from '@/shared/types/common';
import { httpClient, HttpError } from './http-client';

export const sessionStorageKey = 'PMS_AUTH_SESSION';
const legacyStorageKey = 'hotel-aurora.auth.v1';
const sessionDuration = 8 * 60 * 60 * 1000;
const accessTokenRefreshWindow = 30 * 1000;
let revision = 0;

type JwtPayload = {
  sub?: string;
  authorities?: string[];
  type?: string;
  iat?: number;
  exp?: number;
};

const roleCodes: Record<string, UserRole> = {
  ADMIN: 'ADMIN',
  GUEST: 'GUEST',
  RECEPTION: 'RECEPTION',
  HOUSEKEEPING: 'HOUSEKEEPING',
  CONCIERGE: 'CONCIERGE',
  ROOM_SERVICE: 'ROOM_SERVICE',
};

function checkRequest(current: number, signal?: AbortSignal) {
  if (signal?.aborted || current !== revision)
    throw new DOMException('Solicitud cancelada', 'AbortError');
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function decodeJwt(token: string): JwtPayload {
  const [, payload] = token.split('.');
  if (!payload) throw new Error('El token de acceso no tiene el formato esperado.');
  const decoded = JSON.parse(decodeBase64Url(payload)) as JwtPayload;
  return {
    ...decoded,
    authorities: Array.isArray(decoded.authorities) ? decoded.authorities : [],
  };
}

function roleFromAuthorities(authorities: readonly string[]): UserRole {
  const authority = authorities.find((item) => item.startsWith('ROLE_'));
  const code = authority?.replace(/^ROLE_/, '').toUpperCase();
  const role = code ? roleCodes[code] : undefined;
  if (!role) throw new Error('El token no incluye un rol reconocido para el PMS.');
  return role;
}

function displayNameFromEmail(email: string): string {
  const [name] = email.split('@');
  return name
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function messageFromHttpError(error: unknown, fallback: string): string {
  if (!(error instanceof HttpError)) return error instanceof Error ? error.message : fallback;
  const data = error.data;
  if (data && typeof data === 'object') {
    const value = data as { message?: unknown; error?: unknown };
    if (typeof value.message === 'string' && value.message.trim()) return value.message;
    if (typeof value.error === 'string' && value.error.trim()) return value.error;
  }
  return fallback;
}

function normalizeAuthResponse(
  response: BackendAuthResponseDTO,
  sessionExpiresAt?: string,
): AuthResponseDTO {
  const payload = decodeJwt(response.accessToken);
  const email = payload.sub?.trim().toLowerCase();
  if (!email) throw new Error('El token no incluye la identidad del usuario.');
  const authorities = payload.authorities ?? [];
  const role = roleFromAuthorities(authorities);
  const issuedAt = payload.iat ? new Date(payload.iat * 1000) : new Date();
  const accessExpiresAt = payload.exp
    ? new Date(payload.exp * 1000)
    : new Date(Date.now() + response.expiresIn * 1000);
  return {
    user: {
      id: email,
      email,
      name: displayNameFromEmail(email),
      role,
      createdAt: issuedAt.toISOString(),
    },
    token: response.accessToken,
    refreshToken: response.refreshToken,
    expiresAt: sessionExpiresAt ?? new Date(Date.now() + sessionDuration).toISOString(),
    accessExpiresAt: accessExpiresAt.toISOString(),
    tokenType: response.tokenType,
    authorities,
  };
}

// --- Acceso de huésped (INT-12) ----------------------------------------------
// El huésped no usa el login del personal: canjea el código de su reserva en
// `POST /guest/auth/link` y recibe un JWT `type: guest` sin refresh token. La
// sesión dura lo mismo que ese token; al vencer, se pide de nuevo el código.

const guestAccessExpiredKey = 'PMS_GUEST_ACCESS_EXPIRED';
// En memoria para la pestaña actual; sessionStorage solo lo conserva si se recarga.
let guestAccessExpired = false;

function isGuestToken(token: string): boolean {
  try {
    return decodeJwt(token).type === 'guest';
  } catch {
    return false;
  }
}

function normalizeGuestSession(
  token: string,
  tokenType: string,
  expiresInSeconds: number,
  name?: string,
  email?: string,
): AuthResponseDTO {
  const payload = decodeJwt(token);
  if (payload.type !== 'guest') throw new Error('El acceso recibido no corresponde a un huésped.');
  const subject = payload.sub?.trim();
  if (!subject) throw new Error('El token de huésped no incluye la reserva.');
  const authorities = payload.authorities ?? [];
  const role = roleFromAuthorities(authorities);
  if (role !== 'GUEST') throw new Error('El acceso recibido no corresponde a un huésped.');
  const issuedAt = payload.iat ? new Date(payload.iat * 1000) : new Date();
  const accessExpiresAt = payload.exp
    ? new Date(payload.exp * 1000)
    : new Date(Date.now() + expiresInSeconds * 1000);
  return {
    user: {
      id: subject,
      email: email?.trim().toLowerCase() || '',
      name: name?.trim() || 'Huésped',
      role,
      createdAt: issuedAt.toISOString(),
    },
    token,
    refreshToken: '',
    expiresAt: accessExpiresAt.toISOString(),
    accessExpiresAt: accessExpiresAt.toISOString(),
    tokenType,
    authorities,
  };
}

function guestLoginErrorMessage(error: unknown): string {
  if (error instanceof HttpError) {
    if (error.status === 401) {
      return 'Correo o contraseña incorrectos.';
    }
    if (error.status === 400) {
      const data = error.data as { message?: string } | undefined;
      const msg = typeof data?.message === 'string' ? data.message.toLowerCase() : '';
      if (msg.includes('active stay') || msg.includes('estancia')) {
        return 'No tienes una estancia activa en este momento. El acceso funciona desde el check-in hasta el check-out.';
      }
      return messageFromHttpError(error, 'El correo y la contraseña son requeridos.');
    }
    if (error.status === 403) {
      return 'Esta información no pertenece a tu estancia o tu estancia ya no está activa.';
    }
  }
  return messageFromHttpError(error, 'No fue posible iniciar sesión como huésped.');
}

function guestLinkErrorMessage(error: unknown): string {
  if (error instanceof HttpError && (error.status === 400 || error.status === 404)) {
    return 'El código no es válido, la reserva no está vigente o fue cancelada.';
  }
  return messageFromHttpError(error, 'No fue posible validar tu código de reserva.');
}

function guestRegistrationErrorMessage(error: unknown): string {
  if (error instanceof HttpError) {
    const message = messageFromHttpError(error, '').toLowerCase();
    if (error.status === 409)
      return 'Esta reserva o correo ya tiene una cuenta. Inicia sesión con tu correo y contraseña.';
    if (message.includes('email does not match'))
      return 'El correo no coincide con el registrado en la reserva.';
    if (message.includes('code is invalid')) return 'El código de reserva no es válido.';
    if (message.includes('expired or not yet active'))
      return 'La reserva ya venció o aún no está disponible para acceso al portal.';
    if (error.status === 400)
      return messageFromHttpError(error, 'Revisa el código, el correo y la contraseña.');
  }
  return messageFromHttpError(error, 'No fue posible crear tu cuenta de huésped.');
}

function readStoredSession(): AuthResponseDTO | null {
  localStorage.removeItem(legacyStorageKey);
  const raw = localStorage.getItem(sessionStorageKey);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<AuthResponseDTO>;
    if (
      !value ||
      typeof value !== 'object' ||
      typeof value.token !== 'string' ||
      typeof value.refreshToken !== 'string' ||
      typeof value.expiresAt !== 'string' ||
      !value.user ||
      typeof value.user.email !== 'string'
    ) {
      return null;
    }
    return value as AuthResponseDTO;
  } catch {
    return null;
  }
}

function persistSession(dto: AuthResponseDTO): void {
  try {
    localStorage.removeItem(legacyStorageKey);
    localStorage.setItem(sessionStorageKey, JSON.stringify(dto));
  } catch {
    httpClient.clearToken();
    throw new Error(
      'No se pudo guardar la sesión. Habilita el almacenamiento del navegador e intenta nuevamente.',
    );
  }
}

function isAccessTokenExpiring(dto: AuthResponseDTO): boolean {
  const expiresAt = Date.parse(dto.accessExpiresAt ?? '');
  return Number.isFinite(expiresAt) && expiresAt <= Date.now() + accessTokenRefreshWindow;
}

async function refreshStoredSession(): Promise<string | null> {
  const stored = readStoredSession();
  if (!stored) return null;
  if (isGuestToken(stored.token)) {
    // El huésped no tiene refresh token: vuelve a ingresar su código.
    authService.clearSession();
    return null;
  }
  try {
    const response = await httpClient.post<BackendAuthResponseDTO>(
      '/auth/refresh',
      { refreshToken: stored.refreshToken },
      { auth: { skipAuthorization: true, skipRefresh: true } },
    );
    const next = normalizeAuthResponse(response, stored.expiresAt);
    persistSession(next);
    return next.token;
  } catch {
    authService.clearSession();
    return null;
  }
}

export const authService = {
  clearSession(): void {
    ++revision;
    httpClient.clearToken();
    try {
      localStorage.removeItem(sessionStorageKey);
    } finally {
      localStorage.removeItem(legacyStorageKey);
    }
  },
  async login(email: string, password: string, signal?: AbortSignal): Promise<AuthSession> {
    const current = ++revision;
    checkRequest(current, signal);
    try {
      const response = await httpClient.post<BackendAuthResponseDTO>(
        '/auth/login',
        { email: email.trim().toLowerCase(), password },
        { signal, auth: { skipAuthorization: true, skipRefresh: true } },
      );
      checkRequest(current, signal);
      const dto = normalizeAuthResponse(response);
      if (dto.user.role === 'GUEST') {
        throw new Error(
          'Los huéspedes ingresan con el código de su reserva en "Acceso de huésped".',
        );
      }
      persistSession(dto);
      httpClient.setToken(dto.token);
      return toAuthSession(dto);
    } catch (error) {
      checkRequest(current, signal);
      throw new Error(messageFromHttpError(error, 'Correo o contraseña incorrectos.'));
    }
  },
  /** Inicia sesión de huésped con correo y contraseña contra `POST /guest/auth/login`. */
  async loginGuest(email: string, password: string, signal?: AbortSignal): Promise<AuthSession> {
    const current = ++revision;
    checkRequest(current, signal);
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) throw new Error('Ingresa tu correo electrónico.');
    if (!password) throw new Error('Ingresa tu contraseña.');
    let dto: AuthResponseDTO;
    try {
      const response = await httpClient.post<BackendGuestLoginResponseDTO>(
        '/guest/auth/login',
        { email: trimmedEmail, password },
        { signal, auth: { skipAuthorization: true, skipRefresh: true } },
      );
      checkRequest(current, signal);
      dto = normalizeGuestSession(
        response.accessToken,
        response.tokenType,
        response.expiresIn,
        undefined,
        trimmedEmail,
      );
    } catch (error) {
      checkRequest(current, signal);
      throw new Error(guestLoginErrorMessage(error));
    }
    httpClient.setToken(dto.token);
    try {
      // El nombre visible sale de la estancia; si falla, la sesión sigue siendo válida.
      const stay = await httpClient.get<{ guestFirstName?: string; guestLastName?: string }>(
        '/guest/stay',
        { signal, auth: { skipRefresh: true } },
      );
      const name = [stay.guestFirstName, stay.guestLastName].filter(Boolean).join(' ');
      if (name) dto = { ...dto, user: { ...dto.user, name } };
    } catch {
      /* El portal vuelve a pedir la estancia al cargar. */
    }
    checkRequest(current, signal);
    this.clearGuestAccessExpired();
    persistSession(dto);
    return toAuthSession(dto);
  },
  /** Creates guest credentials only after the backend validates the reservation code and email. */
  async registerGuest(
    code: string,
    email: string,
    password: string,
    signal?: AbortSignal,
  ): Promise<AuthSession> {
    const current = ++revision;
    checkRequest(current, signal);
    const normalizedEmail = email.trim().toLowerCase();
    if (!code.trim()) throw new Error('Ingresa el código de tu reserva.');
    if (!normalizedEmail) throw new Error('Ingresa el correo asociado a tu reserva.');
    if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
    let response: BackendGuestLinkResponseDTO;
    try {
      response = await httpClient.post<BackendGuestLinkResponseDTO>(
        '/guest/auth/register',
        { code: code.trim(), email: normalizedEmail, password },
        { signal, auth: { skipAuthorization: true, skipRefresh: true } },
      );
    } catch (error) {
      checkRequest(current, signal);
      throw new Error(guestRegistrationErrorMessage(error));
    }
    checkRequest(current, signal);
    const dto = normalizeGuestSession(
      response.accessToken,
      response.tokenType,
      response.expiresIn,
      undefined,
      normalizedEmail,
    );
    httpClient.setToken(dto.token);
    try {
      const stay = await httpClient.get<{ guestFirstName?: string; guestLastName?: string }>(
        '/guest/stay',
        { signal, auth: { skipRefresh: true } },
      );
      const name = [stay.guestFirstName, stay.guestLastName].filter(Boolean).join(' ');
      if (name) dto.user = { ...dto.user, name };
    } catch {
      /* The token remains valid; the portal can retry loading the stay. */
    }
    checkRequest(current, signal);
    this.clearGuestAccessExpired();
    persistSession(dto);
    return toAuthSession(dto);
  },
  /** Canjea el código de la reserva por una sesión de huésped (flujo secundario de compatibilidad). */
  async linkGuest(code: string, signal?: AbortSignal): Promise<AuthSession> {
    const current = ++revision;
    checkRequest(current, signal);
    const trimmed = code.trim();
    if (!trimmed) throw new Error('Ingresa el código de tu reserva.');
    let dto: AuthResponseDTO;
    try {
      const response = await httpClient.post<BackendGuestLinkResponseDTO>(
        '/guest/auth/link',
        { code: trimmed },
        { signal, auth: { skipAuthorization: true, skipRefresh: true } },
      );
      checkRequest(current, signal);
      dto = normalizeGuestSession(response.accessToken, response.tokenType, response.expiresIn);
    } catch (error) {
      checkRequest(current, signal);
      throw new Error(guestLinkErrorMessage(error));
    }
    httpClient.setToken(dto.token);
    try {
      // El nombre visible sale de la estancia; si falla, la sesión sigue siendo válida.
      const stay = await httpClient.get<{ guestFirstName?: string; guestLastName?: string }>(
        '/guest/stay',
        { signal, auth: { skipRefresh: true } },
      );
      const name = [stay.guestFirstName, stay.guestLastName].filter(Boolean).join(' ');
      if (name) dto = { ...dto, user: { ...dto.user, name } };
    } catch {
      /* El portal vuelve a pedir la estancia al cargar. */
    }
    checkRequest(current, signal);
    this.clearGuestAccessExpired();
    persistSession(dto);
    return toAuthSession(dto);
  },
  /** Recuerda que la sesión de huésped venció para pedir el código con un aviso. */
  markGuestAccessExpired(): void {
    guestAccessExpired = true;
    try {
      sessionStorage.setItem(guestAccessExpiredKey, 'true');
    } catch {
      /* Sin sessionStorage, el aviso dura mientras la pestaña siga abierta. */
    }
  },
  isGuestAccessExpired(): boolean {
    if (guestAccessExpired) return true;
    try {
      return sessionStorage.getItem(guestAccessExpiredKey) === 'true';
    } catch {
      return false;
    }
  },
  clearGuestAccessExpired(): void {
    guestAccessExpired = false;
    try {
      sessionStorage.removeItem(guestAccessExpiredKey);
    } catch {
      /* Nada que limpiar sin almacenamiento. */
    }
  },
  async getCurrentSession(signal?: AbortSignal): Promise<AuthSession | null> {
    const current = revision;
    httpClient.clearToken();
    const hadStoredSession = localStorage.getItem(sessionStorageKey) !== null;
    const stored = readStoredSession();
    if (!stored) {
      if (hadStoredSession) this.clearSession();
      return null;
    }
    checkRequest(current, signal);
    const expiresAt = Date.parse(stored.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      if (isGuestToken(stored.token)) this.markGuestAccessExpired();
      this.clearSession();
      return null;
    }
    if (isGuestToken(stored.token)) {
      try {
        const guest = normalizeGuestSession(
          stored.token,
          stored.tokenType ?? 'Bearer',
          0,
          stored.user.name,
          stored.user.email,
        );
        persistSession(guest);
        httpClient.setToken(guest.token);
        return toAuthSession(guest);
      } catch {
        this.clearSession();
        return null;
      }
    }
    try {
      const normalized = normalizeAuthResponse(
        {
          accessToken: stored.token,
          refreshToken: stored.refreshToken,
          tokenType: stored.tokenType ?? 'Bearer',
          expiresIn: 0,
        },
        stored.expiresAt,
      );
      if (isAccessTokenExpiring(normalized)) {
        const refreshedToken = await refreshStoredSession();
        if (!refreshedToken) return null;
        checkRequest(current, signal);
        const refreshed = readStoredSession();
        if (!refreshed) return null;
        httpClient.setToken(refreshed.token);
        return toAuthSession(refreshed);
      }
      checkRequest(current, signal);
      persistSession(normalized);
      httpClient.setToken(normalized.token);
      return toAuthSession(normalized);
    } catch {
      this.clearSession();
      return null;
    }
  },
  async getCurrentUser(): Promise<SessionUser | null> {
    return (await this.getCurrentSession())?.user ?? null;
  },
  async logout(): Promise<void> {
    const stored = readStoredSession();
    this.clearSession();
    if (!stored?.refreshToken) return;
    try {
      await httpClient.post<void>(
        '/auth/logout',
        { refreshToken: stored.refreshToken },
        { auth: { skipAuthorization: true, skipRefresh: true } },
      );
    } catch (error) {
      throw new Error(
        messageFromHttpError(
          error,
          'La sesión local se cerró, pero no se pudo confirmar con el servicio.',
        ),
      );
    }
  },
};

httpClient.setRefreshHandler(refreshStoredSession);
httpClient.setUnauthorizedHandler(() => authService.clearSession());

export default authService;
