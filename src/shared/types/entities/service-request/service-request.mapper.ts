import { toDomainDate, toDtoDate } from '@/shared/types/common';
import type { ServiceRequestDto } from './service-request.dto';
import type { ServiceRequest } from './service-request.model';

export const toDomain = (dto: ServiceRequestDto): ServiceRequest => ({
  id: dto.id,
  bookingId: dto.booking_id,
  roomId: dto.room_id,
  roomNumber: dto.room_number,
  guestId: dto.guest_id,
  guestName: dto.guest_name,
  responsibleUserId: dto.responsible_user_id,
  responsibleUserName: dto.responsible_user_name,
  responsibleUserEmail: dto.responsible_user_email,
  type: dto.type,
  description: dto.description,
  status: dto.status === 'in_progress' ? 'inProgress' : dto.status,
  notes: dto.notes,
  chargeId: dto.charge_id,
  requestedAt: toDomainDate(dto.requested_at),
  startedAt: dto.started_at ? toDomainDate(dto.started_at) : undefined,
  completedAt: dto.completed_at ? toDomainDate(dto.completed_at) : undefined,
  createdAt: toDomainDate(dto.created_at),
  updatedAt: toDomainDate(dto.updated_at),
});

export const toDTO = (model: ServiceRequest): ServiceRequestDto => ({
  id: model.id,
  booking_id: model.bookingId,
  room_id: model.roomId,
  room_number: model.roomNumber,
  guest_id: model.guestId,
  guest_name: model.guestName,
  responsible_user_id: model.responsibleUserId,
  responsible_user_name: model.responsibleUserName,
  responsible_user_email: model.responsibleUserEmail,
  type: model.type,
  description: model.description,
  status: model.status === 'inProgress' ? 'in_progress' : model.status,
  notes: model.notes,
  charge_id: model.chargeId,
  requested_at: toDtoDate(model.requestedAt),
  started_at: model.startedAt ? toDtoDate(model.startedAt) : undefined,
  completed_at: model.completedAt ? toDtoDate(model.completedAt) : undefined,
  created_at: toDtoDate(model.createdAt),
  updated_at: toDtoDate(model.updatedAt),
});
