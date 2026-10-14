import type { GuestDocumentType } from '@/shared/types/entities/guest';

export type BookingCompanionGuestType = 'adult' | 'child';

export interface BookingCompanion {
  id: string;
  bookingId: string;
  firstName: string;
  lastName: string;
  documentType: GuestDocumentType;
  documentNumber: string;
  guestType: BookingCompanionGuestType;
  createdAt: Date;
  updatedAt: Date;
}

export type UpsertBookingCompanion = Omit<
  BookingCompanion,
  'id' | 'bookingId' | 'createdAt' | 'updatedAt'
> & {
  id?: string;
};
