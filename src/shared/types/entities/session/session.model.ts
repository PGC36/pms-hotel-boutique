import type { UserRole } from '@/shared/types/common';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  /** Código real de un rol personalizado; ver `SessionUserDTO.roleCode`. */
  roleCode?: string;
  avatarUrl?: string;
  createdAt: Date;
}

export interface AuthSession {
  user: SessionUser;
  token: string;
  expiresAt: Date;
  accessExpiresAt?: Date;
  tokenType?: string;
  authorities: string[];
}
