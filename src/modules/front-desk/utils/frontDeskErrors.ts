/**
 * Mensajes del backend de Recepción (reservas, check-in, folio, pagos,
 * depósitos y caja) traducidos al español. Las claves son los textos exactos
 * de las excepciones de `BookingServiceImpl`, `GuestFolioServiceImpl`,
 * `PaymentServiceImpl`, `DepositServiceImpl`, `CashSessionServiceImpl` y
 * `BookingCompanionServiceImpl`. Un mensaje desconocido se muestra tal cual.
 */
const EXACT_MESSAGES: Record<string, string> = {
  'Guest account balance must be zero before checkout':
    'El saldo de la cuenta debe ser Q0.00 para hacer check-out.',
  'Guest account is not open': 'La cuenta del huésped no está abierta.',
  'Payment amount exceeds guest account balance':
    'El pago supera el saldo pendiente de la cuenta (no se admiten sobrepagos).',
  'Cash payment requires an open cash session':
    'Para cobrar en efectivo necesitas tener tu caja abierta.',
  'No open cash session for current user': 'No tienes una caja abierta.',
  'Charge is already voided': 'El cargo ya estaba anulado.',
  'Charge amount must be greater than zero': 'El monto del cargo debe ser mayor a 0.',
  'Only held deposits can be applied': 'Solo se puede aplicar un depósito retenido.',
  'Only held deposits can be refunded': 'Solo se puede devolver un depósito retenido.',
  'Deposit is already refunded': 'El depósito ya fue devuelto.',
  'Only checked-in bookings can be checked out':
    'Solo se puede hacer check-out de una reserva con check-in.',
  'Booking must have an assigned room before check-in': 'Asigna una habitación antes del check-in.',
  'Booking must have an assigned room before check-out': 'La reserva no tiene habitación asignada.',
  'Booking is already checked in': 'La reserva ya tiene check-in.',
  'Booking status does not allow check-in': 'Confirma la reserva antes de hacer check-in.',
  'Booking cannot be checked in outside its stay dates':
    'El check-in solo se puede realizar durante las fechas de la estadía.',
  'Room is not available for check-in': 'La habitación no está disponible para check-in.',
  'Room is not ready for check-in': 'La habitación no está limpia: termina la limpieza antes.',
  'Booking occupants exceed room type capacity':
    'Los ocupantes superan la capacidad de la habitación.',
  'Booking companions do not match declared adult and child composition':
    'Los acompañantes no coinciden con los adultos y menores declarados en la reserva.',
  'Booking companions exceed declared adult count':
    'Hay más acompañantes adultos que los declarados en la reserva.',
  'Booking companions exceed declared child count':
    'Hay más menores que los declarados en la reserva.',
  'Booking companions exceed room type capacity':
    'Los acompañantes superan la capacidad de la habitación.',
  'Primary guest cannot be registered as a companion':
    'El huésped titular no puede registrarse como acompañante.',
};

const PREFIX_MESSAGES: [string, string][] = [
  ['Guest account not found for booking', 'La reserva todavía no tiene una cuenta abierta.'],
  [
    'Cannot open a guest account for a booking with status',
    'No se puede abrir la cuenta de una reserva en este estado.',
  ],
  [
    'Cannot create financial movements for a booking with status',
    'No se pueden registrar movimientos en una reserva en este estado.',
  ],
  [
    'Booking companions cannot be managed when booking status is',
    'No se pueden modificar acompañantes en este estado de la reserva.',
  ],
];

export function describeFrontDeskError(message: string): string {
  const text = message.trim();
  const exact = EXACT_MESSAGES[text];
  if (exact) return exact;
  const prefixed = PREFIX_MESSAGES.find(([prefix]) => text.startsWith(prefix));
  return prefixed ? prefixed[1] : message;
}
