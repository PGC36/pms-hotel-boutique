import type { Deposit } from '@/shared/types/entities/deposit';
import type { PaymentMethodDto } from '@/shared/types/entities/payment';

/**
 * Métodos que Recepción puede registrar, con los valores exactos del backend
 * (`PaymentMethod` / `DepositMethod`). `online` es exclusivo de la web pública.
 * Un pago en efectivo exige caja abierta del usuario (regla del backend).
 */
export type FrontDeskPaymentMethod = Exclude<PaymentMethodDto, 'online'>;

export const FRONT_DESK_PAYMENT_METHODS: { value: FrontDeskPaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'credit_card', label: 'Tarjeta de crédito' },
  { value: 'debit_card', label: 'Tarjeta de débito' },
  { value: 'bank_transfer', label: 'Transferencia' },
];

export function isFrontDeskPaymentMethod(value: string): value is FrontDeskPaymentMethod {
  return FRONT_DESK_PAYMENT_METHODS.some((method) => method.value === value);
}

/** Mismo método en la forma de dominio que usan los depósitos. */
export function toDepositMethod(method: FrontDeskPaymentMethod): Deposit['method'] {
  return method === 'credit_card'
    ? 'creditCard'
    : method === 'debit_card'
      ? 'debitCard'
      : method === 'bank_transfer'
        ? 'bankTransfer'
        : 'cash';
}

export function paymentMethodLabel(method: FrontDeskPaymentMethod): string {
  return FRONT_DESK_PAYMENT_METHODS.find((option) => option.value === method)?.label ?? method;
}
