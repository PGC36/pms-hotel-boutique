import type { UserRole } from '@/shared/types/common';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: Date;
}

export interface AuthSession {
  user: SessionUser;
  token: string;
  refreshToken: string;
  expiresAt: Date;
  accessExpiresAt?: Date;
  tokenType?: string;
  authorities: string[];
}
