import { isRoomAssignable } from '@/shared/constants/statuses';
import { toDomainDate, toDtoDate } from '@/shared/types/common';
import type { RoomDto } from './room.dto';
import type { Room } from './room.model';

export const toDomain = (dto: RoomDto): Room => {
  const status = dto.status === 'out_of_service' ? 'outOfService' : dto.status;
  const housekeepingStatus = dto.housekeeping_status;
  return {
    id: dto.id,
    roomNumber: dto.room_number,
    roomTypeId: dto.room_type_id,
    floor: dto.floor,
    status,
    housekeepingStatus,
    isAssignable: isRoomAssignable({ status, housekeepingStatus }),
    notes: dto.notes,
    cleaningUserEmail: dto.cleaning_user_email,
    cleaningStartedAt: dto.cleaning_started_at ? toDomainDate(dto.cleaning_started_at) : undefined,
    cleaningCompletedByUserEmail: dto.cleaning_completed_by_user_email,
    cleaningCompletedAt: dto.cleaning_completed_at
      ? toDomainDate(dto.cleaning_completed_at)
      : undefined,
    inspectorUserEmail: dto.inspector_user_email,
    inspectedAt: dto.inspected_at ? toDomainDate(dto.inspected_at) : undefined,
    createdAt: toDomainDate(dto.created_at),
    updatedAt: toDomainDate(dto.updated_at),
  };
};

export const toDTO = (model: Room): RoomDto => ({
  id: model.id,
  room_number: model.roomNumber,
  room_type_id: model.roomTypeId,
  floor: model.floor,
  status: model.status === 'outOfService' ? 'out_of_service' : model.status,
  housekeeping_status: model.housekeepingStatus,
  notes: model.notes,
  cleaning_user_email: model.cleaningUserEmail,
  cleaning_started_at: model.cleaningStartedAt ? toDtoDate(model.cleaningStartedAt) : undefined,
  cleaning_completed_by_user_email: model.cleaningCompletedByUserEmail,
  cleaning_completed_at: model.cleaningCompletedAt
    ? toDtoDate(model.cleaningCompletedAt)
    : undefined,
  inspector_user_email: model.inspectorUserEmail,
  inspected_at: model.inspectedAt ? toDtoDate(model.inspectedAt) : undefined,
  created_at: toDtoDate(model.createdAt),
  updated_at: toDtoDate(model.updatedAt),
});
