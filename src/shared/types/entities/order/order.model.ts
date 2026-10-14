import type { Currency } from '@/shared/types/common';
import type { OrderStatus } from '@/shared/constants/statuses';

export type { OrderStatus };

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPriceCents: number;
  productName?: string;
  lineTotalCents?: number;
}

export interface Order {
  id: string;
  bookingId: string;
  roomId: string;
  roomNumber?: string;
  guestId?: string;
  guestName?: string;
  items: OrderItem[];
  status: OrderStatus;
  notes?: string;
  currency: Currency;
  totalCents?: number;
  chargeId?: string;
  requestedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
