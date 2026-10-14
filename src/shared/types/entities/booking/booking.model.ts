import type { Currency } from '@/shared/types/common';
import type { BookingStatus } from '@/shared/constants/statuses';

export type { BookingStatus };

export interface Booking {
  id: string;
  confirmationCode: string;
  guestLinkCode: string;
  guestId: string;
  roomId?: string;
  roomTypeId: string;
  rateId?: string;
  checkIn: Date;
  checkOut: Date;
  status: BookingStatus;
  adults: number;
  children: number;
  totalAmountCents: number;
  currency: Currency;
  notes?: string;
  cancellationReason?: string;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
