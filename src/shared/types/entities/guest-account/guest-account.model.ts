import type { Currency } from '@/shared/types/common';
import type { GuestAccountStatus } from '@/shared/constants/statuses';

export type { GuestAccountStatus };

export interface GuestAccount {
  id: string;
  bookingId: string;
  guestId: string;
  status: GuestAccountStatus;
  balanceCents: number;
  currency: Currency;
  openedAt: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
