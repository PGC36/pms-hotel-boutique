import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Banknote,
  BedDouble,
  Building2,
  CalendarDays,
  CreditCard,
  Smartphone,
  StickyNote,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  PublicBookingError,
  publicBookingCatalogService,
  type PublicAvailableRoomType,
} from '@/services/publicBookingCatalogService';
import { Button } from '@/shared/components/Button';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { Input } from '@/shared/components/Input';
import { LoadingState } from '@/shared/components/LoadingState';
import { Select } from '@/shared/components/Select';
import type { RoomType } from '@/shared/types/entities/room-type';
import { formatCurrency } from '@/shared/utils/currency';
import { calculateNights, formatDateGT } from '@/shared/utils/date';
import { validateBookingCapacity } from '@/shared/utils/bookingCapacity';
import './booking-engine.css';

type FormStatus = 'loading' | 'success' | 'error';
type BookingStep = 'details' | 'confirmation' | 'payment';
type PaymentMethod = 'card' | 'transfer' | 'hotel' | 'wallet';

/** Tarifa, total y disponibilidad: siempre los decide GET /public/availability. */
type QuoteState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'available'; result: PublicAvailableRoomType }
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

const NO_AVAILABILITY_MESSAGE =
  'No hay disponibilidad para ese tipo de habitacion en esas fechas. Elige otras fechas u otra habitacion.';

type DateRangeValue = {
  start: Date | null;
  end: Date | null;
};

type FormErrors = Partial<
  Record<
    | 'guestFirstName'
    | 'guestLastName'
    | 'guestEmail'
    | 'guestPhone'
    | 'guestDocumentNumber'
    | 'roomTypeId'
    | 'dates'
    | 'adults'
    | 'children'
    | 'capacity',
    string
  >
>;

function dateKey(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

function isValidStay(range: DateRangeValue): range is { start: Date; end: Date } {
  if (!range.start || !range.end) return false;
  try {
    return calculateNights(range.start, range.end) > 0;
  } catch {
    return false;
  }
}

function parseCount(value: string | null, fallback: string, minimum: number): string {
  const count = Number(value);
  return value !== null && Number.isInteger(count) && count >= minimum ? String(count) : fallback;
}

export function BookingFormScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRoomTypeId = searchParams.get('roomTypeId') ?? '';
  const initialRange = useMemo<DateRangeValue>(
    () => ({
      start: parseDateKey(searchParams.get('checkIn')),
      end: parseDateKey(searchParams.get('checkOut')),
    }),
    [searchParams],
  );

  const [status, setStatus] = useState<FormStatus>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [roomTypeId, setRoomTypeId] = useState(initialRoomTypeId);
  const [range, setRange] = useState<DateRangeValue>(initialRange);
  const [guestFirstName, setGuestFirstName] = useState('');
  const [guestLastName, setGuestLastName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestDocumentType, setGuestDocumentType] = useState('national_id');
  const [guestDocumentNumber, setGuestDocumentNumber] = useState('');
  const [adults, setAdults] = useState(() => parseCount(searchParams.get('adults'), '1', 1));
  const [children, setChildren] = useState(() => parseCount(searchParams.get('children'), '0', 0));
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<BookingStep>('details');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [quote, setQuote] = useState<QuoteState>({ status: 'idle' });
  // Cada consulta lleva un número; solo la más reciente puede escribir el estado.
  const quoteRequestRef = useRef(0);

  const loadFormData = useCallback(async () => {
    setStatus('loading');
    setLoadError(null);

    try {
      const nextRoomTypes = await publicBookingCatalogService.getRoomTypes();
      const activeRoomTypes = nextRoomTypes.filter((roomType) => roomType.active);

      setRoomTypes(activeRoomTypes);
      setRoomTypeId((current) => current || activeRoomTypes[0]?.id || '');
      setStatus('success');
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'No fue posible cargar el formulario.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void loadFormData();
  }, [loadFormData]);

  const selectedRoomType = roomTypes.find((roomType) => roomType.id === roomTypeId);
  const nights = isValidStay(range) ? calculateNights(range.start, range.end) : 0;
  const guestFullName = [guestFirstName, guestLastName].filter(Boolean).join(' ');
  const capacityError = selectedRoomType
    ? validateBookingCapacity({
        adults: Number(adults),
        children: Number(children),
        capacity: selectedRoomType.capacity,
        roomTypeName: selectedRoomType.name,
      })
    : undefined;

  const adultsCount = Number(adults);
  const childrenCount = Number(children);
  const checkInKey = range.start ? dateKey(range.start) : '';
  const checkOutKey = range.end ? dateKey(range.end) : '';
  const canQuote =
    !!selectedRoomType &&
    isValidStay(range) &&
    Number.isInteger(adultsCount) &&
    adultsCount >= 1 &&
    Number.isInteger(childrenCount) &&
    childrenCount >= 0 &&
    !capacityError;

  const loadQuote = useCallback(async () => {
    const requestId = ++quoteRequestRef.current;
    if (!canQuote) {
      setQuote({ status: 'idle' });
      return;
    }

    setQuote({ status: 'loading' });
    try {
      const results = await publicBookingCatalogService.getAvailability({
        checkIn: checkInKey,
        checkOut: checkOutKey,
        adults: adultsCount,
        children: childrenCount,
        roomTypeId,
      });
      if (requestId !== quoteRequestRef.current) return;
      const result = results.find((item) => item.roomType.id === roomTypeId);
      setQuote(result ? { status: 'available', result } : { status: 'unavailable' });
    } catch (cause) {
      if (requestId !== quoteRequestRef.current) return;
      setQuote({
        status: 'error',
        message:
          cause instanceof Error ? cause.message : 'No fue posible consultar la disponibilidad.',
      });
    }
  }, [adultsCount, canQuote, checkInKey, checkOutKey, childrenCount, roomTypeId]);

  useEffect(() => {
    void loadQuote();
  }, [loadQuote]);

  const quotedRate = quote.status === 'available' ? quote.result.rate : undefined;
  const totalAmount = quote.status === 'available' ? quote.result.totalAmountCents : undefined;
  const quoteMessage =
    quote.status === 'loading'
      ? 'Consultando disponibilidad...'
      : quote.status === 'available'
        ? `${quote.result.availableRooms} ${quote.result.availableRooms === 1 ? 'disponible' : 'disponibles'}`
        : quote.status === 'unavailable'
          ? NO_AVAILABILITY_MESSAGE
          : quote.status === 'error'
            ? quote.message
            : undefined;

  function stepClassName(targetStep: BookingStep): string {
    const order: BookingStep[] = ['details', 'confirmation', 'payment'];
    const currentIndex = order.indexOf(step);
    const targetIndex = order.indexOf(targetStep);
    return [
      'res-step',
      currentIndex === targetIndex ? 'active' : '',
      currentIndex > targetIndex ? 'done' : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  function updateRange(nextRange: DateRangeValue) {
    setRange(nextRange);
    setErrors((current) => ({ ...current, dates: undefined }));
  }

  function validateForm(): boolean {
    const nextErrors: FormErrors = {};
    const adultsNumber = Number(adults);
    const childrenNumber = Number(children);

    if (!guestFirstName.trim()) nextErrors.guestFirstName = 'Ingresa el nombre del huesped.';
    if (!guestLastName.trim()) nextErrors.guestLastName = 'Ingresa el apellido del huesped.';
    if (!guestEmail.trim()) nextErrors.guestEmail = 'Ingresa el correo del huesped.';
    if (!guestPhone.trim()) nextErrors.guestPhone = 'Ingresa el telefono del huesped.';
    if (!guestDocumentNumber.trim()) {
      nextErrors.guestDocumentNumber = 'Ingresa el documento del huesped.';
    }
    if (!selectedRoomType) nextErrors.roomTypeId = 'Selecciona un tipo de habitacion valido.';
    if (!isValidStay(range)) nextErrors.dates = 'Selecciona una salida posterior a la entrada.';
    if (!Number.isInteger(adultsNumber) || adultsNumber < 1) {
      nextErrors.adults = 'Debe viajar al menos un adulto.';
    }
    if (!Number.isInteger(childrenNumber) || childrenNumber < 0) {
      nextErrors.children = 'Ingresa cero o mas ninos.';
    }
    if (!nextErrors.adults && !nextErrors.children && capacityError) {
      nextErrors.capacity = capacityError;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    if (step === 'details') {
      if (!validateForm() || !isValidStay(range)) return;
      if (quote.status !== 'available') {
        setSubmitError(quoteMessage ?? NO_AVAILABILITY_MESSAGE);
        return;
      }
      setStep('confirmation');
      return;
    }

    if (step === 'confirmation') {
      setStep('payment');
      return;
    }

    if (quote.status !== 'available') {
      setStep('details');
      setSubmitError(quoteMessage ?? NO_AVAILABILITY_MESSAGE);
      return;
    }

    if (!isValidStay(range)) {
      setStep('details');
      setErrors((current) => ({
        ...current,
        dates: 'Selecciona una salida posterior a la entrada.',
      }));
      return;
    }

    setSubmitting(true);
    try {
      const booking = await publicBookingCatalogService.createBooking({
        roomTypeId,
        checkIn: dateKey(range.start),
        checkOut: dateKey(range.end),
        adults: Number(adults),
        children: Number(children),
        notes: notes.trim() || undefined,
        guest: {
          firstName: guestFirstName.trim(),
          lastName: guestLastName.trim(),
          email: guestEmail.trim(),
          phone: guestPhone.trim() || undefined,
          documentType: guestDocumentType as 'national_id' | 'passport' | 'driver_license',
          documentNumber: guestDocumentNumber.trim() || undefined,
        },
      });
      navigate(`/booking/${booking.confirmationCode}/done`, {
        state: { publicBookingConfirmation: booking },
      });
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : 'No fue posible crear la reserva.');
      if (cause instanceof PublicBookingError && cause.kind === 'no_availability') {
        // Otra reserva tomó la última habitación: volver a detalles con la
        // disponibilidad real actualizada.
        setStep('details');
        void loadQuote();
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'loading') {
    return (
      <section className="content booking-form-page">
        <LoadingState label="Cargando formulario de reserva..." />
      </section>
    );
  }

  if (status === 'error') {
    return (
      <section className="content booking-form-page">
        <ErrorState description={loadError ?? 'Intenta nuevamente.'} onRetry={loadFormData} />
      </section>
    );
  }

  if (roomTypes.length === 0) {
    return (
      <section className="content booking-form-page">
        <EmptyState
          title="Sin habitaciones para reservar"
          description="No hay tipos de habitacion activos en este momento."
        />
      </section>
    );
  }

  return (
    <section className="content booking-form-page">
      <div className="booking-form-heading">
        <div>
          <p className="eyebrow">Reserva directa</p>
          <h1>Completa tu estadia</h1>
          <p>Confirma los datos principales y deja listo el pre-registro.</p>
        </div>
      </div>

      <div className="reservation-steps booking-form-steps" aria-label="Progreso de reserva">
        <span className={stepClassName('details')}>
          <span className="res-step-num">1</span>
          Datos y habitacion
        </span>
        <span className={stepClassName('confirmation')}>
          <span className="res-step-num">2</span>
          Confirmacion
        </span>
        <span className={stepClassName('payment')}>
          <span className="res-step-num">3</span>
          Pago
        </span>
      </div>

      <div className="booking-form-layout booking-reservation-shell">
        <form className="booking-form-card" onSubmit={handleSubmit}>
          {submitError ? <p className="field-error">{submitError}</p> : null}

          {step === 'details' ? (
            <>
              <div className="booking-form-section-title">
                <UserRound size={16} aria-hidden="true" />
                <span>Informacion del huesped</span>
              </div>
              <div className="booking-form-grid">
                <Input
                  label="Nombre"
                  value={guestFirstName}
                  onChange={(event) => {
                    setGuestFirstName(event.target.value);
                    setErrors((current) => ({ ...current, guestFirstName: undefined }));
                  }}
                  error={errors.guestFirstName}
                  required
                />

                <Input
                  label="Apellido"
                  value={guestLastName}
                  onChange={(event) => {
                    setGuestLastName(event.target.value);
                    setErrors((current) => ({ ...current, guestLastName: undefined }));
                  }}
                  error={errors.guestLastName}
                  required
                />

                <Input
                  label="Correo"
                  type="email"
                  value={guestEmail}
                  onChange={(event) => {
                    setGuestEmail(event.target.value);
                    setErrors((current) => ({ ...current, guestEmail: undefined }));
                  }}
                  error={errors.guestEmail}
                  required
                />

                <Input
                  label="Telefono"
                  type="tel"
                  value={guestPhone}
                  onChange={(event) => {
                    setGuestPhone(event.target.value);
                    setErrors((current) => ({ ...current, guestPhone: undefined }));
                  }}
                  error={errors.guestPhone}
                  required
                />

                <Select
                  label="Documento"
                  value={guestDocumentType}
                  onChange={(event) => setGuestDocumentType(event.target.value)}
                >
                  <option value="national_id">DPI / identificacion</option>
                  <option value="passport">Pasaporte</option>
                  <option value="driver_license">Licencia</option>
                </Select>

                <Input
                  label="Numero de documento"
                  value={guestDocumentNumber}
                  onChange={(event) => {
                    setGuestDocumentNumber(event.target.value);
                    setErrors((current) => ({ ...current, guestDocumentNumber: undefined }));
                  }}
                  error={errors.guestDocumentNumber}
                  required
                />

                <Select
                  label="Tipo de habitacion"
                  value={roomTypeId}
                  onChange={(event) => {
                    setRoomTypeId(event.target.value);
                    setErrors((current) => ({
                      ...current,
                      roomTypeId: undefined,
                      capacity: undefined,
                    }));
                  }}
                  error={errors.roomTypeId}
                  required
                >
                  {roomTypes.map((roomType) => (
                    <option key={roomType.id} value={roomType.id}>
                      {roomType.name}
                    </option>
                  ))}
                </Select>

                <Input
                  label="Adultos"
                  type="number"
                  min="1"
                  value={adults}
                  onChange={(event) => {
                    setAdults(event.target.value);
                    setErrors((current) => ({
                      ...current,
                      adults: undefined,
                      capacity: undefined,
                    }));
                  }}
                  error={errors.adults}
                  required
                />

                <Input
                  label="Ninos"
                  type="number"
                  min="0"
                  value={children}
                  onChange={(event) => {
                    setChildren(event.target.value);
                    setErrors((current) => ({
                      ...current,
                      children: undefined,
                      capacity: undefined,
                    }));
                  }}
                  error={errors.children ?? errors.capacity ?? capacityError}
                  required
                />

                <div className="booking-form-full">
                  <div className="booking-form-section-title booking-form-calendar-title">
                    <CalendarDays size={16} aria-hidden="true" />
                    <span>Fechas de estadia</span>
                  </div>
                  <div className="booking-date-fields">
                    <Input
                      label="Entrada"
                      type="date"
                      value={range.start ? dateKey(range.start) : ''}
                      min={dateKey(new Date())}
                      onChange={(event) => {
                        updateRange({ ...range, start: parseDateKey(event.target.value) });
                      }}
                      error={errors.dates}
                      required
                    />
                    <Input
                      label="Salida"
                      type="date"
                      value={range.end ? dateKey(range.end) : ''}
                      min={
                        range.start
                          ? dateKey(
                              new Date(
                                range.start.getFullYear(),
                                range.start.getMonth(),
                                range.start.getDate() + 1,
                              ),
                            )
                          : dateKey(new Date())
                      }
                      onChange={(event) => {
                        updateRange({ ...range, end: parseDateKey(event.target.value) });
                      }}
                      required
                    />
                  </div>
                </div>

                <div className="field booking-form-full">
                  <label className="field-label booking-form-notes-label" htmlFor="booking-notes">
                    <StickyNote size={14} aria-hidden="true" />
                    Notas
                  </label>
                  <textarea
                    id="booking-notes"
                    className="booking-form-textarea"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </div>
              </div>
            </>
          ) : null}

          {step === 'confirmation' ? (
            <div className="booking-step-panel">
              <div className="booking-form-section-title">
                <BedDouble size={16} aria-hidden="true" />
                <span>Confirmacion</span>
              </div>
              <h2>Revisa tu reserva</h2>
              <p>Confirma que los datos de huesped, habitacion y fechas esten correctos.</p>
              <div className="booking-confirm-grid">
                <span>Huesped</span>
                <strong>{guestFullName}</strong>
                <span>Habitacion</span>
                <strong>{selectedRoomType?.name ?? 'Por definir'}</strong>
                <span>Estadia</span>
                <strong>
                  {isValidStay(range)
                    ? `${formatDateGT(range.start)} al ${formatDateGT(range.end)}`
                    : 'Por definir'}
                </strong>
                <span>Total estimado</span>
                <strong>
                  {totalAmount !== undefined
                    ? formatCurrency(totalAmount, quotedRate?.currency)
                    : 'Por definir'}
                </strong>
              </div>
            </div>
          ) : null}

          {step === 'payment' ? (
            <div className="booking-step-panel">
              <div className="booking-form-section-title">
                <CreditCard size={16} aria-hidden="true" />
                <span>Pago</span>
              </div>
              <div className="booking-checkout-shell">
                <div
                  className="booking-payment-methods"
                  role="radiogroup"
                  aria-label="Metodo de pago"
                >
                  <button
                    className={`booking-payment-method ${paymentMethod === 'card' ? 'active' : ''}`}
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    role="radio"
                    aria-checked={paymentMethod === 'card'}
                  >
                    <CreditCard size={18} aria-hidden="true" />
                    <span>
                      Tarjeta
                      <small>Credito o debito</small>
                    </span>
                  </button>
                  <button
                    className={`booking-payment-method ${paymentMethod === 'transfer' ? 'active' : ''}`}
                    type="button"
                    onClick={() => setPaymentMethod('transfer')}
                    role="radio"
                    aria-checked={paymentMethod === 'transfer'}
                  >
                    <Building2 size={18} aria-hidden="true" />
                    <span>
                      Transferencia
                      <small>Reserva con comprobante</small>
                    </span>
                  </button>
                  <button
                    className={`booking-payment-method ${paymentMethod === 'hotel' ? 'active' : ''}`}
                    type="button"
                    onClick={() => setPaymentMethod('hotel')}
                    role="radio"
                    aria-checked={paymentMethod === 'hotel'}
                  >
                    <Banknote size={18} aria-hidden="true" />
                    <span>
                      Pago en hotel
                      <small>Efectivo o terminal</small>
                    </span>
                  </button>
                  <button
                    className={`booking-payment-method ${paymentMethod === 'wallet' ? 'active' : ''}`}
                    type="button"
                    onClick={() => setPaymentMethod('wallet')}
                    role="radio"
                    aria-checked={paymentMethod === 'wallet'}
                  >
                    <Smartphone size={18} aria-hidden="true" />
                    <span>
                      Billetera
                      <small>Apple Pay / Google Pay</small>
                    </span>
                  </button>
                </div>

                <div className="booking-payment-panel">
                  {paymentMethod === 'card' ? (
                    <>
                      <div>
                        <h2>Pago con tarjeta</h2>
                        <p>
                          Captura de tarjeta estilo checkout seguro. No procesa cobros reales en
                          demo.
                        </p>
                      </div>
                      <div className="booking-card-preview">
                        <span>Hotel Aurora</span>
                        <strong>{cardNumber || '4242 4242 4242 4242'}</strong>
                        <small>
                          {cardholderName || guestFullName || 'Nombre del titular'} ·{' '}
                          {cardExpiry || 'MM/AA'}
                        </small>
                      </div>
                      <div className="booking-payment-grid">
                        <Input
                          label="Titular"
                          value={cardholderName}
                          onChange={(event) => setCardholderName(event.target.value)}
                          placeholder={guestFullName || 'Nombre como aparece en la tarjeta'}
                        />
                        <Input
                          label="Numero de tarjeta"
                          inputMode="numeric"
                          value={cardNumber}
                          onChange={(event) => setCardNumber(event.target.value)}
                          placeholder="4242 4242 4242 4242"
                        />
                        <Input
                          label="Vencimiento"
                          value={cardExpiry}
                          onChange={(event) => setCardExpiry(event.target.value)}
                          placeholder="MM/AA"
                        />
                        <Input
                          label="CVC"
                          inputMode="numeric"
                          value={cardCvc}
                          onChange={(event) => setCardCvc(event.target.value)}
                          placeholder="123"
                        />
                      </div>
                    </>
                  ) : null}

                  {paymentMethod === 'transfer' ? (
                    <div className="booking-payment-instructions">
                      <h2>Transferencia bancaria</h2>
                      <p>
                        Reserva ahora y envia el comprobante al equipo del hotel para confirmar.
                      </p>
                      <dl>
                        <div>
                          <dt>Banco</dt>
                          <dd>Banco Industrial</dd>
                        </div>
                        <div>
                          <dt>Cuenta</dt>
                          <dd>Monetaria 000-123456-7</dd>
                        </div>
                        <div>
                          <dt>Nombre</dt>
                          <dd>Hotel Aurora Group</dd>
                        </div>
                      </dl>
                    </div>
                  ) : null}

                  {paymentMethod === 'hotel' ? (
                    <div className="booking-payment-instructions">
                      <h2>Pago en hotel</h2>
                      <p>
                        Tu reserva queda solicitada y el equipo la confirma con garantia al llegar.
                      </p>
                      <dl>
                        <div>
                          <dt>Disponible</dt>
                          <dd>Efectivo, tarjeta en terminal y deposito</dd>
                        </div>
                        <div>
                          <dt>Vence</dt>
                          <dd>Hasta las 18:00 del dia de llegada</dd>
                        </div>
                      </dl>
                    </div>
                  ) : null}

                  {paymentMethod === 'wallet' ? (
                    <div className="booking-payment-instructions">
                      <h2>Billetera digital</h2>
                      <p>Opcion preparada para Apple Pay, Google Pay u otra billetera soportada.</p>
                      <button className="booking-wallet-button" type="button">
                        Continuar con billetera
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="booking-payment-total">
                  <span>Total estimado</span>
                  <strong>
                    {totalAmount !== undefined
                      ? formatCurrency(totalAmount, quotedRate?.currency)
                      : 'Por definir'}
                  </strong>
                  <small>Tarifa sujeta a confirmacion final del hotel.</small>
                </div>
              </div>
            </div>
          ) : null}

          <div className="booking-form-actions">
            {step !== 'details' ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep(step === 'payment' ? 'confirmation' : 'details')}
              >
                Volver
              </Button>
            ) : null}
            <Button type="submit" loading={submitting}>
              {step === 'details'
                ? 'Continuar'
                : step === 'confirmation'
                  ? 'Ir a pago'
                  : 'Crear reserva'}
            </Button>
          </div>
        </form>

        <aside className="booking-form-summary">
          <div className="booking-form-summary-head">
            <BedDouble size={18} aria-hidden="true" />
            <div>
              <span>Resumen</span>
              <h2>Tu reserva</h2>
            </div>
          </div>
          <div className="booking-form-room-chip">
            <span>{selectedRoomType?.name ?? 'Habitacion por definir'}</span>
            <strong>
              {quotedRate
                ? formatCurrency(quotedRate.priceCents, quotedRate.currency)
                : 'Tarifa pendiente'}
            </strong>
          </div>
          {quoteMessage ? (
            <p className="booking-muted" role="status">
              {quoteMessage}
            </p>
          ) : null}
          <div className="booking-rate-summary">
            <div>
              <span>Huesped</span>
              <strong>
                {[guestFirstName, guestLastName].filter(Boolean).join(' ') || 'Por definir'}
              </strong>
            </div>
            <div>
              <span>Habitacion</span>
              <strong>{selectedRoomType?.name ?? 'Por definir'}</strong>
            </div>
            <div>
              <span>Entrada</span>
              <strong>{isValidStay(range) ? formatDateGT(range.start) : 'Por definir'}</strong>
            </div>
            <div>
              <span>Salida</span>
              <strong>{isValidStay(range) ? formatDateGT(range.end) : 'Por definir'}</strong>
            </div>
            <div>
              <span>Noches</span>
              <strong>{isValidStay(range) ? nights : 'Por definir'}</strong>
            </div>
            <div>
              <span>Tarifa</span>
              <strong>
                {quotedRate
                  ? formatCurrency(quotedRate.priceCents, quotedRate.currency)
                  : 'Por definir'}
              </strong>
            </div>
            <div>
              <span>Total estimado</span>
              <strong>
                {totalAmount !== undefined
                  ? formatCurrency(totalAmount, quotedRate?.currency)
                  : 'Por definir'}
              </strong>
            </div>
          </div>
          <div className="booking-form-guest-count">
            <UsersRound size={15} aria-hidden="true" />
            <span>
              {adults || '0'} adulto(s), {children || '0'} nino(s)
            </span>
          </div>
        </aside>
      </div>
    </section>
  );
}
