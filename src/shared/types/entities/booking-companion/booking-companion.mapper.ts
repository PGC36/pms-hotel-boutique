import { toDomainDate, toDtoDate } from '@/shared/types/common';
import type { BookingCompanionDto, UpsertBookingCompanionDto } from './booking-companion.dto';
import type { BookingCompanion, UpsertBookingCompanion } from './booking-companion.model';

const documentTypeToDomain = (value: BookingCompanionDto['document_type']) =>
  value === 'national_id' ? 'nationalId' : value === 'driver_license' ? 'driverLicense' : value;

const documentTypeToDTO = (value: BookingCompanion['documentType']) =>
  value === 'nationalId' ? 'national_id' : value === 'driverLicense' ? 'driver_license' : value;

export const toDomain = (dto: BookingCompanionDto): BookingCompanion => ({
  id: dto.id,
  bookingId: dto.booking_id,
  firstName: dto.first_name,
  lastName: dto.last_name,
  documentType: documentTypeToDomain(dto.document_type),
  documentNumber: dto.document_number,
  guestType: dto.guest_type,
  createdAt: toDomainDate(dto.created_at),
  updatedAt: toDomainDate(dto.updated_at),
});

export const toDTO = (model: BookingCompanion): BookingCompanionDto => ({
  id: model.id,
  booking_id: model.bookingId,
  first_name: model.firstName,
  last_name: model.lastName,
  document_type: documentTypeToDTO(model.documentType),
  document_number: model.documentNumber,
  guest_type: model.guestType,
  created_at: toDtoDate(model.createdAt),
  updated_at: toDtoDate(model.updatedAt),
});

export const upsertToDTO = (model: UpsertBookingCompanion): UpsertBookingCompanionDto => ({
  id: model.id,
  first_name: model.firstName,
  last_name: model.lastName,
  document_type: documentTypeToDTO(model.documentType),
  document_number: model.documentNumber,
  guest_type: model.guestType,
});
