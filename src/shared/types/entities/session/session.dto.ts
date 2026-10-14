import type { ISODateString, UserRole } from '@/shared/types/common';

/**
 * The authenticated user as the login/session response carries it: the PMS
 * access role (ADMIN/GUEST/RECEPTION/HOUSEKEEPING/CONCIERGE/ROOM_SERVICE)
 * that drives navigation and permissions. Keep it aligned with the `User`
 * staff-directory role catalog in `shared/types/entities/user/`.
 */
export interface SessionUserDTO {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: ISODateString;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface BackendAuthResponseDTO {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

/**
 * Respuesta de `POST /guest/auth/link` (INT-12): el huésped se identifica con
 * el código de su reserva y recibe un JWT de tipo `guest`, sin refresh token.
 */
export interface BackendGuestLinkResponseDTO {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

/**
 * Respuesta de `POST /guest/auth/login`: el huésped se autentica con
 * correo y contraseña y recibe un JWT de tipo `guest`, sin refresh token.
 */
export interface BackendGuestLoginResponseDTO {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface AuthResponseDTO {
  user: SessionUserDTO;
  token: string;
  refreshToken: string;
  expiresAt: ISODateString;
  accessExpiresAt?: ISODateString;
  tokenType?: string;
  authorities?: string[];
}
