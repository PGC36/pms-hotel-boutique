import { toDomainDate, toDtoDate } from '@/shared/types/common';
import type { UserDto } from './user.dto';
import type { User } from './user.model';

export const toDomain = (dto: UserDto): User => ({
  id: dto.id,
  firstName: dto.first_name,
  lastName: dto.last_name,
  email: dto.email,
  role: dto.role === 'room_service' ? 'roomService' : dto.role,
  status: dto.status,
  createdAt: toDomainDate(dto.created_at),
  updatedAt: toDomainDate(dto.updated_at),
});

export const toDTO = (model: User): UserDto => ({
  id: model.id,
  first_name: model.firstName,
  last_name: model.lastName,
  email: model.email,
  role: model.role === 'roomService' ? 'room_service' : model.role,
  status: model.status,
  created_at: toDtoDate(model.createdAt),
  updated_at: toDtoDate(model.updatedAt),
});
