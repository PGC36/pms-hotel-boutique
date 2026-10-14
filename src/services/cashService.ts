import {
  toDomain as toCashSession,
  type CashSession,
  type CashSessionDto,
} from '@/shared/types/entities/cash-session';
import {
  toDomain as toCashMovement,
  type CashMovement,
  type CashMovementDto,
} from '@/shared/types/entities/cash-movement';
import type { ID } from '@/shared/types/common';
import { HttpError, httpClient } from './http-client';

type CashSessionResponse = {
  id: string;
  openedByUserId?: string | null;
  openedAt: string;
  openingBalanceCents: number;
  currency: string;
  status: 'open' | 'closed';
  totalIncomeCents?: number | null;
  totalExpenseCents?: number | null;
  expectedBalanceCents?: number | null;
  closedByUserId?: string | null;
  closedAt?: string | null;
  countedBalanceCents?: number | null;
  differenceCents?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

type CashMovementResponse = {
  id: string;
  cashSessionId: string;
  type: 'income' | 'expense';
  concept: string;
  amountCents: number;
  currency: string;
  responsibleUserId?: string | null;
  occurredAt: string;
  paymentId?: string | null;
  createdAt: string;
};

function normalizeCurrency(value: string): CashSessionDto['currency'] {
  if (value !== 'GTQ') {
    throw new Error(`La caja solo admite moneda GTQ; backend devolvio ${value}.`);
  }
  return 'GTQ';
}

function toCashSessionDto(response: CashSessionResponse): CashSessionDto {
  return {
    id: response.id,
    opened_by_user_id: response.openedByUserId ?? undefined,
    opened_at: response.openedAt,
    opening_balance_cents: response.openingBalanceCents,
    currency: normalizeCurrency(response.currency),
    status: response.status,
    total_income_cents: response.totalIncomeCents ?? undefined,
    total_expense_cents: response.totalExpenseCents ?? undefined,
    expected_balance_cents: response.expectedBalanceCents ?? undefined,
    closed_by_user_id: response.closedByUserId ?? undefined,
    closed_at: response.closedAt ?? undefined,
    counted_balance_cents: response.countedBalanceCents ?? undefined,
    difference_cents: response.differenceCents ?? undefined,
    notes: response.notes ?? undefined,
    created_at: response.createdAt,
    updated_at: response.updatedAt,
  };
}

function toCashMovementDto(response: CashMovementResponse): CashMovementDto {
  return {
    id: response.id,
    cash_session_id: response.cashSessionId,
    type: response.type,
    concept: response.concept,
    amount_cents: response.amountCents,
    currency: normalizeCurrency(response.currency),
    responsible_user_id: response.responsibleUserId ?? undefined,
    occurred_at: response.occurredAt,
    payment_id: response.paymentId ?? undefined,
    created_at: response.createdAt,
  };
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
  if (error.status === 403) return 'No tienes permisos para operar caja.';
  if (error.status === 404) return 'No existe una jornada de caja abierta.';
  if (error.status === 409) return 'La operacion de caja entro en conflicto con el estado actual.';
  return fallback;
}

async function getCurrentSessionOrUndefined(): Promise<CashSession | undefined> {
  try {
    const response = await httpClient.get<CashSessionResponse>('/cash-sessions/current');
    return toCashSession(toCashSessionDto(response));
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return undefined;
    throw new Error(getHttpErrorMessage(error, 'No fue posible cargar la jornada de caja.'));
  }
}

export const cashService = {
  async getSessions(): Promise<CashSession[]> {
    const current = await getCurrentSessionOrUndefined();
    return current ? [current] : [];
  },
  async getSessionById(id: ID): Promise<CashSession | undefined> {
    const current = await getCurrentSessionOrUndefined();
    return current?.id === id ? current : undefined;
  },
  async getMovementsBySessionId(sessionId: ID): Promise<CashMovement[]> {
    try {
      const response = await httpClient.get<CashMovementResponse[]>(
        `/cash-sessions/${sessionId}/movements`,
      );
      return response.map((item) => toCashMovement(toCashMovementDto(item)));
    } catch (error) {
      throw new Error(getHttpErrorMessage(error, 'No fue posible cargar los movimientos de caja.'));
    }
  },
  async getMovements(): Promise<CashMovement[]> {
    const current = await getCurrentSessionOrUndefined();
    return current ? this.getMovementsBySessionId(current.id) : [];
  },
  async openSession(data: {
    openingBalanceCents: number;
    responsibleUserId?: ID;
    notes?: string;
  }): Promise<CashSession> {
    if (!Number.isInteger(data.openingBalanceCents) || data.openingBalanceCents < 0) {
      throw new Error('El saldo inicial debe ser un entero mayor o igual a 0.');
    }

    try {
      const response = await httpClient.post<CashSessionResponse>('/cash-sessions/open', {
        openingBalanceCents: data.openingBalanceCents,
        notes: data.notes?.trim() || undefined,
      });
      return toCashSession(toCashSessionDto(response));
    } catch (error) {
      throw new Error(getHttpErrorMessage(error, 'No fue posible abrir la caja.'));
    }
  },
  async closeSession(
    data: {
      sessionId?: ID;
      countedBalanceCents?: number;
      responsibleUserId?: ID;
      notes?: string;
    } = {},
  ): Promise<CashSession> {
    const session = data.sessionId ? undefined : await getCurrentSessionOrUndefined();
    const sessionId = data.sessionId ?? session?.id;
    if (!sessionId) throw new Error('No existe una jornada de caja abierta.');
    const countedBalanceCents = data.countedBalanceCents ?? session?.expectedBalanceCents;
    if (
      typeof countedBalanceCents !== 'number' ||
      !Number.isInteger(countedBalanceCents) ||
      countedBalanceCents < 0
    ) {
      throw new Error('El saldo contado debe ser un entero mayor o igual a 0.');
    }
    const countedBalance = countedBalanceCents;

    try {
      const response = await httpClient.post<CashSessionResponse>(
        `/cash-sessions/${sessionId}/close`,
        {
          countedBalanceCents: countedBalance,
          notes: data.notes?.trim() || undefined,
        },
      );
      return toCashSession(toCashSessionDto(response));
    } catch (error) {
      throw new Error(getHttpErrorMessage(error, 'No fue posible cerrar la caja.'));
    }
  },
  async createMovement(data: {
    type: 'income' | 'expense';
    concept: string;
    amountCents: number;
    responsibleUserId?: ID;
  }): Promise<CashMovement> {
    if (!data.concept.trim()) throw new Error('El movimiento requiere concepto.');
    if (!Number.isInteger(data.amountCents) || data.amountCents <= 0) {
      throw new Error('El monto debe ser un entero mayor a 0.');
    }

    const session = await getCurrentSessionOrUndefined();
    if (!session) throw new Error('No existe una jornada de caja abierta.');

    try {
      const response = await httpClient.post<CashMovementResponse>(
        `/cash-sessions/${session.id}/movements`,
        {
          type: data.type,
          concept: data.concept.trim(),
          amountCents: data.amountCents,
        },
      );
      return toCashMovement(toCashMovementDto(response));
    } catch (error) {
      throw new Error(
        getHttpErrorMessage(error, 'No fue posible registrar el movimiento de caja.'),
      );
    }
  },
};
export default cashService;
