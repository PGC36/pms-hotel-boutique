import type { GuestDocumentTypeDto } from '@/shared/types/entities/guest';

export type BookingCompanionGuestTypeDto = 'adult' | 'child';

export interface BookingCompanionDTO {
  id: string;
  booking_id: string;
  first_name: string;
  last_name: string;
  document_type: GuestDocumentTypeDto;
  document_number: string;
  guest_type: BookingCompanionGuestTypeDto;
  created_at: string;
  updated_at: string;
}

export type BookingCompanionDto = BookingCompanionDTO;

export type UpsertBookingCompanionDto = Omit<
  BookingCompanionDTO,
  'id' | 'booking_id' | 'created_at' | 'updated_at'
> & {
  id?: string;
};
