import {
  toDomain as toGuestAccount,
  type GuestAccount,
  type GuestAccountDto,
} from '@/shared/types/entities/guest-account';
import {
  toDomain as toCharge,
  type Charge,
  type ChargeDto,
  type CreateChargeDto,
} from '@/shared/types/entities/charge';
import {
  toDomain as toPayment,
  type AddPaymentDto,
  type Payment,
  type PaymentDto,
} from '@/shared/types/entities/payment';
import { toDomain as toDeposit, type Deposit } from '@/shared/types/entities/deposit';
import type { BookingDto } from '@/shared/types/entities/booking';
import type { ID } from '@/shared/types/common';
import { HttpError, httpClient } from './http-client';
import { mockUtils, simulateLatency } from './mockUtils';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type GuestFolioResponse = {
  accountId: string;
  bookingId: string;
  guestId: string;
  status: 'open' | 'closed';
  balanceCents: number;
  currency: string;
  openedAt: string;
  closedAt?: string | null;
  charges: ChargeResponse[];
};

type ChargeResponse = {
  id: string;
  bookingId: string;
  productId?: string | null;
  description: string;
  quantity: number;
  unitPriceCents: number;
  amountCents: number;
  currency: string;
  category?: ChargeDto['category'] | null;
  status: ChargeDto['status'];
  chargedAt: string;
  createdByUserId?: string | null;
  voidReason?: string | null;
  createdAt: string;
};

type PaymentResponse = {
  id: string;
  bookingId: string;
  amountCents: number;
  currency: string;
  method: PaymentDto['method'];
  status: PaymentDto['status'];
  transactionReference?: string | null;
  paidAt?: string | null;
  processedByUserId?: string | null;
  createdAt: string;
};

type DepositResponse = {
  id: string;
  bookingId: string;
  guestId: string;
  amountCents: number;
  currency: string;
  method: 'cash' | 'credit_card' | 'debit_card' | 'bank_transfer';
  status: 'held' | 'refunded' | 'applied';
  collectedAt: string;
  refundedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

function isUuid(value: ID): boolean {
  return UUID_PATTERN.test(value);
}

function assertBackendId(id: ID, operation: string): void {
  if (!isUuid(id)) {
    throw new Error(`${operation} requiere recursos integrados con backend real.`);
  }
}

function normalizeCurrency(value: string): 'GTQ' {
  if (value !== 'GTQ') {
    throw new Error(`El folio solo admite moneda GTQ; backend devolvio ${value}.`);
  }
  return 'GTQ';
}

function toGuestAccountDto(response: GuestFolioResponse): GuestAccountDto {
  return {
    id: response.accountId,
    booking_id: response.bookingId,
    guest_id: response.guestId,
    status: response.status,
    balance_cents: response.balanceCents,
    currency: normalizeCurrency(response.currency),
    opened_at: response.openedAt,
    closed_at: response.closedAt ?? undefined,
    created_at: response.openedAt,
    updated_at: response.closedAt ?? response.openedAt,
  };
}

function toChargeDto(response: ChargeResponse): ChargeDto {
  return {
    id: response.id,
    booking_id: response.bookingId,
    product_id: response.productId ?? undefined,
    description: response.description,
    quantity: response.quantity,
    unit_price_cents: response.unitPriceCents,
    amount_cents: response.amountCents,
    currency: normalizeCurrency(response.currency),
    category: response.category ?? undefined,
    status: response.status,
    charged_at: response.chargedAt,
    created_by_user_id: response.createdByUserId ?? undefined,
    void_reason: response.voidReason ?? undefined,
    created_at: response.createdAt,
  };
}

function toPaymentDto(response: PaymentResponse): PaymentDto {
  return {
    id: response.id,
    booking_id: response.bookingId,
    amount_cents: response.amountCents,
    currency: normalizeCurrency(response.currency),
    method: response.method,
    status: response.status,
    transaction_reference: response.transactionReference ?? undefined,
    paid_at: response.paidAt ?? undefined,
    processed_by_user_id: response.processedByUserId ?? undefined,
    created_at: response.createdAt,
  };
}

function toDepositDto(
  response: DepositResponse,
): import('@/shared/types/entities/deposit').DepositDto {
  return {
    id: response.id,
    booking_id: response.bookingId,
    guest_id: response.guestId,
    amount_cents: response.amountCents,
    currency: normalizeCurrency(response.currency),
    method: response.method,
    status: response.status,
    collected_at: response.collectedAt,
    refunded_at: response.refundedAt ?? undefined,
    notes: response.notes ?? undefined,
    created_at: response.createdAt,
    updated_at: response.updatedAt,
  };
}

function paymentMethodToApi(method: AddPaymentDto['method'] = 'cash'): PaymentDto['method'] {
  return method;
}

function depositMethodToApi(method: Deposit['method']): DepositResponse['method'] {
  return method === 'creditCard'
    ? 'credit_card'
    : method === 'debitCard'
      ? 'debit_card'
      : method === 'bankTransfer'
        ? 'bank_transfer'
        : method;
}

function getHttpErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpError)) return error instanceof Error ? error.message : fallback;
  const data = error.data;
  if (data && typeof data === 'object') {
    const value = data as { message?: unknown; error?: unknown; detail?: unknown };
    if (typeof value.message === 'string' && value.message.trim()) return value.message;
    if (typeof value.error === 'string' && value.error.trim()) return value.error;
    if (typeof value.detail === 'string' && value.detail.trim()) return value.detail;
  }
  if (error.status === 401) return 'Tu sesion expiro. Inicia sesion nuevamente.';
  if (error.status === 403) return 'No tienes permisos para operar el folio.';
  if (error.status === 404) return 'No se encontro el folio o recurso financiero solicitado.';
  if (error.status === 409)
    return 'La operacion financiera entro en conflicto con el estado actual.';
  return fallback;
}

async function request<T>(call: () => Promise<T>, fallback: string): Promise<T> {
  try {
    return await call();
  } catch (error) {
    throw new Error(getHttpErrorMessage(error, fallback));
  }
}

export function calculateAccountBalanceCents(bookingId: ID): number {
  assertBackendId(bookingId, 'El calculo local de saldo');
  throw new Error('El saldo oficial debe consultarse en GET /bookings/{bookingId}/folio.');
}

export function openOrSyncAccountForBooking(booking: BookingDto): GuestAccountDto {
  assertBackendId(booking.id, 'La apertura o sincronizacion local de cuenta');
  throw new Error('La apertura del folio se ejecuta en el backend durante check-in.');
}

export function closeAccountForCheckout(booking: BookingDto): GuestAccountDto {
  assertBackendId(booking.id, 'El cierre local de cuenta');
  throw new Error('El cierre del folio se ejecuta en el backend durante check-out.');
}

export const guestAccountService = {
  calculateBalanceCents: calculateAccountBalanceCents,
  async getAccounts(): Promise<GuestAccount[]> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible cargar las cuentas de huesped.');
    const response = await request(
      () => httpClient.get<GuestFolioResponse[]>('/guest-accounts'),
      'No fue posible cargar las cuentas de huesped.',
    );
    return response.map((item) => toGuestAccount(toGuestAccountDto(item)));
  },
  async getAccountByBookingId(bookingId: ID): Promise<GuestAccount | undefined> {
    assertBackendId(bookingId, 'La consulta de folio');
    try {
      const response = await httpClient.get<GuestFolioResponse>(`/bookings/${bookingId}/folio`);
      return toGuestAccount(toGuestAccountDto(response));
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) return undefined;
      throw new Error(getHttpErrorMessage(error, 'No fue posible cargar la cuenta del huesped.'));
    }
  },
  async getCharges(): Promise<Charge[]> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible cargar los cargos.');
    const response = await request(
      () => httpClient.get<ChargeResponse[]>('/charges'),
      'No fue posible cargar los cargos.',
    );
    return response.map((item) => toCharge(toChargeDto(item)));
  },
  async getChargesByBookingId(bookingId: ID): Promise<Charge[]> {
    assertBackendId(bookingId, 'La consulta de cargos');
    const response = await request(
      () => httpClient.get<ChargeResponse[]>(`/bookings/${bookingId}/charges`),
      'No fue posible cargar los cargos.',
    );
    return response.map((item) => toCharge(toChargeDto(item)));
  },
  async createCharge(data: CreateChargeDto): Promise<Charge> {
    assertBackendId(data.booking_id, 'La creacion de cargo');
    if (!data.description.trim()) throw new Error('El cargo requiere descripcion.');
    if (!Number.isInteger(data.quantity) || data.quantity <= 0) {
      throw new Error('La cantidad debe ser un entero mayor a 0.');
    }
    if (!Number.isInteger(data.unit_price_cents) || data.unit_price_cents < 0) {
      throw new Error('El precio unitario debe ser un entero mayor o igual a 0.');
    }

    const response = await request(
      () =>
        httpClient.post<ChargeResponse>(`/bookings/${data.booking_id}/charges`, {
          description: data.description.trim(),
          quantity: data.quantity,
          unitPriceCents: data.unit_price_cents,
          category: data.category ?? 'consumption',
          productId: data.product_id,
        }),
      'No fue posible crear el cargo.',
    );
    return toCharge(toChargeDto(response));
  },
  async voidCharge(chargeId: ID, reason: string, bookingId?: ID): Promise<Charge> {
    if (!bookingId) {
      throw new Error('La anulacion de un cargo requiere bookingId para operar contra el backend.');
    }
    assertBackendId(chargeId, 'La anulacion de cargo');
    assertBackendId(bookingId, 'La anulacion de cargo');
    if (!reason.trim()) throw new Error('Se requiere un motivo para anular el cargo.');

    const response = await request(
      () =>
        httpClient.post<ChargeResponse>(`/bookings/${bookingId}/charges/${chargeId}/void`, {
          reason: reason.trim(),
        }),
      'No fue posible anular el cargo.',
    );
    return toCharge(toChargeDto(response));
  },
  async getPayments(): Promise<Payment[]> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible cargar los pagos.');
    const response = await request(
      () => httpClient.get<PaymentResponse[]>('/payments'),
      'No fue posible cargar los pagos.',
    );
    return response.map((item) => toPayment(toPaymentDto(item)));
  },
  async getPaymentsByBookingId(bookingId: ID): Promise<Payment[]> {
    assertBackendId(bookingId, 'La consulta de pagos');
    const response = await request(
      () => httpClient.get<PaymentResponse[]>(`/bookings/${bookingId}/payments`),
      'No fue posible cargar los pagos.',
    );
    return response.map((item) => toPayment(toPaymentDto(item)));
  },
  async createPayment(data: AddPaymentDto): Promise<Payment> {
    assertBackendId(data.booking_id, 'El registro de pago');
    if (!Number.isInteger(data.amount_cents) || data.amount_cents <= 0) {
      throw new Error('El pago debe ser un monto entero mayor a 0.');
    }

    const response = await request(
      () =>
        httpClient.post<PaymentResponse>(`/bookings/${data.booking_id}/payments`, {
          amountCents: data.amount_cents,
          method: paymentMethodToApi(data.method),
          transactionReference: data.transaction_reference,
        }),
      'No fue posible registrar el pago.',
    );
    return toPayment(toPaymentDto(response));
  },
  async getDeposits(): Promise<Deposit[]> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible cargar los depositos.');
    const response = await request(
      () => httpClient.get<DepositResponse[]>('/deposits'),
      'No fue posible cargar los depositos.',
    );
    return response.map((item) => toDeposit(toDepositDto(item)));
  },
  async getDepositsByBookingId(bookingId: ID): Promise<Deposit[]> {
    assertBackendId(bookingId, 'La consulta de depositos');
    const response = await request(
      () => httpClient.get<DepositResponse[]>(`/bookings/${bookingId}/deposits`),
      'No fue posible cargar los depositos.',
    );
    return response.map((item) => toDeposit(toDepositDto(item)));
  },
  async createDeposit(data: {
    bookingId: ID;
    amountCents: number;
    method: Deposit['method'];
    notes?: string;
  }): Promise<Deposit> {
    if (!Number.isInteger(data.amountCents) || data.amountCents <= 0) {
      throw new Error('El deposito debe ser un monto entero mayor a 0.');
    }
    assertBackendId(data.bookingId, 'El registro de deposito');

    const response = await request(
      () =>
        httpClient.post<DepositResponse>(`/bookings/${data.bookingId}/deposits`, {
          amountCents: data.amountCents,
          method: depositMethodToApi(data.method),
          notes: data.notes?.trim() || undefined,
        }),
      'No fue posible registrar el deposito.',
    );
    return toDeposit(toDepositDto(response));
  },
  async refundDeposit(bookingId: ID, depositId: ID, reason?: string): Promise<Deposit> {
    assertBackendId(bookingId, 'El reembolso de deposito');
    assertBackendId(depositId, 'El reembolso de deposito');

    const response = await request(
      () =>
        httpClient.post<DepositResponse>(
          `/bookings/${bookingId}/deposits/${depositId}/refund`,
          reason?.trim() ? { reason: reason.trim() } : undefined,
        ),
      'No fue posible reembolsar el deposito.',
    );
    return toDeposit(toDepositDto(response));
  },
  async applyDeposit(bookingId: ID, depositId: ID): Promise<Deposit> {
    assertBackendId(bookingId, 'La aplicacion de deposito');
    assertBackendId(depositId, 'La aplicacion de deposito');

    const response = await request(
      () => httpClient.post<DepositResponse>(`/bookings/${bookingId}/deposits/${depositId}/apply`),
      'No fue posible aplicar el deposito.',
    );
    return toDeposit(toDepositDto(response));
  },
};
export default guestAccountService;
