import { toDomainDate, toDtoDate } from '@/shared/types/common';
import type { GuestDto } from './guest.dto';
import type { Guest } from './guest.model';

export const toDomain = (dto: GuestDto): Guest => ({
  id: dto.id,
  firstName: dto.first_name,
  lastName: dto.last_name,
  email: dto.email,
  phone: dto.phone,
  nationality: dto.nationality,
  documentType:
    dto.document_type === 'national_id'
      ? 'nationalId'
      : dto.document_type === 'driver_license'
        ? 'driverLicense'
        : dto.document_type,
  documentNumber: dto.document_number,
  notes: dto.notes,
  createdAt: toDomainDate(dto.created_at),
  updatedAt: toDomainDate(dto.updated_at),
});

export const toDTO = (model: Guest): GuestDto => ({
  id: model.id,
  first_name: model.firstName,
  last_name: model.lastName,
  email: model.email,
  phone: model.phone,
  nationality: model.nationality,
  document_type:
    model.documentType === 'nationalId'
      ? 'national_id'
      : model.documentType === 'driverLicense'
        ? 'driver_license'
        : model.documentType,
  document_number: model.documentNumber,
  notes: model.notes,
  created_at: toDtoDate(model.createdAt),
  updated_at: toDtoDate(model.updatedAt),
});
