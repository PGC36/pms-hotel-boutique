import { toDomain as toCharge, type Charge, type ChargeDto } from '@/shared/types/entities/charge';
import {
  toDomain as toDeposit,
  type Deposit,
  type DepositDto,
} from '@/shared/types/entities/deposit';
import {
  toDomain as toPayment,
  type Payment,
  type PaymentDto,
} from '@/shared/types/entities/payment';
import type { Currency } from '@/shared/types/common';
import { mockUtils, simulateLatency } from './mockUtils';
import { httpClient } from './http-client';

type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';

type ApiOperationalReport = {
  from: string;
  to: string;
  bookings: number;
  cancellations: number;
  revenueCents: number;
  occupancyNights: number;
  bookingsByStatus: Record<string, number>;
  roomServiceOrders: number;
};

type ApiGuestStay = {
  bookingId: string;
  guestId: string;
  guestFirstName: string;
  guestLastName: string;
  roomId?: string;
  roomNumber?: string;
  roomTypeId: string;
  roomTypeName: string;
  checkIn: string;
  checkOut: string;
  status: BookingStatus;
  balanceCents: number;
  currency: Currency;
};

type ApiCharge = {
  id: string;
  bookingId: string;
  productId?: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  amountCents: number;
  currency: Currency;
  category?: ChargeDto['category'];
  status: ChargeDto['status'];
  chargedAt: string;
  createdByUserId?: string;
  voidReason?: string;
  createdAt: string;
};

type ApiPayment = {
  id: string;
  bookingId: string;
  amountCents: number;
  currency: Currency;
  method: PaymentDto['method'];
  status: PaymentDto['status'];
  transactionReference?: string;
  paidAt?: string;
  processedByUserId?: string;
  createdAt: string;
};

type ApiDeposit = {
  id: string;
  bookingId: string;
  guestId: string;
  amountCents: number;
  currency: Currency;
  method: DepositDto['method'];
  status: DepositDto['status'];
  collectedAt: string;
  refundedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

type ApiStayReceipt = {
  stay: ApiGuestStay;
  charges: ApiCharge[];
  payments: ApiPayment[];
  deposits: ApiDeposit[];
  finalBalanceCents: number;
  currency: Currency;
};

export type OperationalReport = {
  from: string;
  to: string;
  bookings: number;
  cancellations: number;
  revenueCents: number;
  occupancyNights: number;
  bookingsByStatus: Record<string, number>;
  roomServiceOrders: number;
};

export type StayReceipt = {
  stay: ApiGuestStay;
  charges: Charge[];
  payments: Payment[];
  deposits: Deposit[];
  finalBalanceCents: number;
  currency: Currency;
};

const toChargeDto = (api: ApiCharge): ChargeDto => ({
  id: api.id,
  booking_id: api.bookingId,
  product_id: api.productId,
  description: api.description,
  quantity: api.quantity,
  unit_price_cents: api.unitPriceCents,
  amount_cents: api.amountCents,
  currency: api.currency,
  category: api.category,
  status: api.status,
  charged_at: api.chargedAt,
  created_by_user_id: api.createdByUserId,
  void_reason: api.voidReason,
  created_at: api.createdAt,
});

const toPaymentDto = (api: ApiPayment): PaymentDto => ({
  id: api.id,
  booking_id: api.bookingId,
  amount_cents: api.amountCents,
  currency: api.currency,
  method: api.method,
  status: api.status,
  transaction_reference: api.transactionReference,
  paid_at: api.paidAt,
  processed_by_user_id: api.processedByUserId,
  created_at: api.createdAt,
});

const toDepositDto = (api: ApiDeposit): DepositDto => ({
  id: api.id,
  booking_id: api.bookingId,
  guest_id: api.guestId,
  amount_cents: api.amountCents,
  currency: api.currency,
  method: api.method,
  status: api.status,
  collected_at: api.collectedAt,
  refunded_at: api.refundedAt,
  notes: api.notes,
  created_at: api.createdAt,
  updated_at: api.updatedAt,
});

export const reportingService = {
  async getOperationalReport(range: { from: string; to: string }): Promise<OperationalReport> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible cargar el reporte operativo.');
    const params = new URLSearchParams(range);
    return httpClient.get<ApiOperationalReport>(`/admin/reports/operations?${params.toString()}`);
  },

  async getStayReceipt(bookingId: string): Promise<StayReceipt> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible cargar el recibo de estancia.');
    const receipt = await httpClient.get<ApiStayReceipt>(`/admin/bookings/${bookingId}/receipt`);
    return {
      stay: receipt.stay,
      charges: receipt.charges.map(toChargeDto).map(toCharge),
      payments: receipt.payments.map(toPaymentDto).map(toPayment),
      deposits: receipt.deposits.map(toDepositDto).map(toDeposit),
      finalBalanceCents: receipt.finalBalanceCents,
      currency: receipt.currency,
    };
  },
};

export default reportingService;
