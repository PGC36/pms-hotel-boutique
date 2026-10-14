import type { AuthResponseDTO } from './session.dto';
import type { AuthSession } from './session.model';

/** DTO -> domain for the login/session response: dates become `Date`. */
export const toDomain = (dto: AuthResponseDTO): AuthSession => ({
  user: { ...dto.user, createdAt: new Date(dto.user.createdAt) },
  token: dto.token,
  refreshToken: dto.refreshToken,
  expiresAt: new Date(dto.expiresAt),
  accessExpiresAt: dto.accessExpiresAt ? new Date(dto.accessExpiresAt) : undefined,
  tokenType: dto.tokenType,
  authorities: dto.authorities ?? [],
});
