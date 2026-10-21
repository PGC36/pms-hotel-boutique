/* eslint-disable @typescript-eslint/no-unused-vars -- Migracion controlada del prototipo Bolt; se conserva la logica original para portarla incrementalmente. */
import { useEffect, useRef, useState } from 'react';
import { Ban, BedDouble, Check, Printer, TriangleAlert, X } from 'lucide-react';
import type {
  Companion,
  FolioEntry,
  GuestInfo,
  PaymentMethod,
  RecRoom,
  Reservation,
} from '@/private/workspace/PrivateWorkspace';
import {
  FRONT_DESK_PAYMENT_METHODS,
  isFrontDeskPaymentMethod,
  type FrontDeskPaymentMethod,
} from '@/modules/front-desk/utils/paymentMethods';
import { DOCUMENT_TYPE_OPTIONS, toDocumentTypeDto } from '@/modules/front-desk/utils/documentTypes';
import { companionCompositionError } from '@/modules/front-desk/utils/checkinComposition';
import { bookingCompanionService } from '@/services/bookingCompanionService';
import { bookingService } from '@/services/bookingService';
import type { GuestDocumentTypeDto } from '@/shared/types/entities/guest';
import { toDtoCalendarDate } from '@/shared/types/common';
import { formatCurrency } from '@/shared/utils/currency';
import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  NOTES_MAX_LENGTH,
  PHONE_MAX_DIGITS,
  describeEditSaveError,
  editCheckOutMin,
  hotelToday,
  isCalendarDate,
  isDigitsOnly,
  keepPhoneDigits,
  nextCalendarDay,
  normalizeChildren,
  normalizePersonName,
  validateEditedNotes,
  validateEditedStay,
  validateEmail,
  validateGuestCounts,
  validateNotes,
  validatePersonName,
  validatePhone,
  validateStayDates,
} from '@/modules/front-desk/utils/reservationFormValidation';
import {
  fieldErrorProps,
  isMoneyInput,
  isWholeNumberInput,
  moneyInputToCents,
  normalizePersonNamePart,
  validateDateRange,
  validateMoneyAmount,
  validatePersonNamePart,
  validateRequiredText,
  validateWholeNumber,
} from '@/shared/utils/formValidation';

// Quetzales con el formato único del proyecto (antes se mostraba "$" con formato de México).
const money = (n: number) => formatCurrency(Math.round(n * 100), 'GTQ');
/** Montos de Nueva reserva en quetzales (los importes del workspace están en Q, no en centavos). */
const moneyGTQ = (amount: number) => formatCurrency(Math.round(amount * 100), 'GTQ');
// Nacionalidad y documento se piden en el check-in: sin valores por defecto.
const emptyGuest: GuestInfo = {
  name: '',
  lastName: '',
  phone: '',
  email: '',
  docType: '',
  docNumber: '',
  birthDate: '',
  nationality: '',
};

type Totals = { charges: number; deposits: number; payments: number; balance: number };

const fieldClass = (err?: string) => `rc-input${err ? ' error' : ''}`;

/**
 * Monto en quetzales: texto con teclado decimal (type="number" admite "e", "-"
 * y más decimales). Solo acepta dígitos y hasta 2 decimales, también al pegar;
 * los espacios exteriores se descartan.
 */
function MoneyInput({
  id,
  value,
  error,
  onChange,
}: {
  id: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={fieldClass(error)}
        value={value}
        placeholder="0.00"
        aria-required="true"
        onChange={(e) => {
          const next = e.target.value.trim();
          if (isMoneyInput(next)) onChange(next);
        }}
        {...fieldErrorProps(`${id}-error`, error)}
      />
      {error && (
        <small id={`${id}-error`} className="rc-field-error">
          {error}
        </small>
      )}
    </>
  );
}

/**
 * Valores de Editar reserva tomados de la fila seleccionada mientras carga el
 * detalle del backend. Adultos y menores por separado: `guestCount` es su suma.
 */
const editFormFromRow = (reservation: Reservation) => ({
  checkIn: reservation.checkIn,
  checkOut: reservation.checkOut,
  adults: reservation.adults === undefined ? '' : String(reservation.adults),
  children: reservation.children,
  notes: reservation.observations,
});

export function ReservationEditModal({
  reservation,
  onClose,
  onSaved,
}: {
  reservation: Reservation;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [booking, setBooking] =
    useState<Awaited<ReturnType<typeof bookingService.getBookingById>>>();
  const [checkIn, setCheckIn] = useState(reservation.checkIn);
  const [checkOut, setCheckOut] = useState(reservation.checkOut);
  // Texto, no número: así se detectan vacío y 0 en lugar de corregirlos en silencio.
  const [adults, setAdults] = useState(() => editFormFromRow(reservation).adults);
  const [children, setChildren] = useState(reservation.children);
  const [notes, setNotes] = useState(reservation.observations);
  // Valores guardados: las reglas nuevas solo se exigen a lo que el usuario cambie.
  const [original, setOriginal] = useState({
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    notes: reservation.observations,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const notesCheck = validateEditedNotes(notes, original.notes);
  const today = hotelToday();

  // Si cambia la reserva seleccionada, se descartan en el mismo render los datos
  // de la anterior: nunca se muestran mezclados mientras carga la nueva.
  const [shownBookingId, setShownBookingId] = useState(reservation.bookingId);
  if (shownBookingId !== reservation.bookingId) {
    const row = editFormFromRow(reservation);
    setShownBookingId(reservation.bookingId);
    setBooking(undefined);
    setCheckIn(row.checkIn);
    setCheckOut(row.checkOut);
    setAdults(row.adults);
    setChildren(row.children);
    setNotes(row.notes);
    setOriginal({ checkIn: row.checkIn, checkOut: row.checkOut, notes: row.notes });
    setFieldErrors({});
    setError('');
    setLoading(true);
  }

  useEffect(() => {
    let active = true;
    if (!reservation.bookingId) {
      setError('La reserva no está vinculada al backend.');
      setLoading(false);
      return;
    }
    void bookingService
      .getBookingById(reservation.bookingId)
      .then((value) => {
        if (!active) return;
        if (!value) {
          setError('No encontramos la reserva en el backend.');
          return;
        }
        setBooking(value);
        const loaded = {
          checkIn: toDtoCalendarDate(value.checkIn),
          checkOut: toDtoCalendarDate(value.checkOut),
          notes: value.notes ?? '',
        };
        setOriginal(loaded);
        setCheckIn(loaded.checkIn);
        setCheckOut(loaded.checkOut);
        setAdults(String(value.adults));
        setChildren(value.children);
        setNotes(loaded.notes);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause.message : 'No fue posible cargar la reserva.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reservation.bookingId]);

  const validate = () => {
    const stay = validateEditedStay(checkIn, checkOut, original);
    const errors: Record<string, string> = {};
    if (stay.checkIn) errors.checkIn = stay.checkIn;
    if (stay.checkOut) errors.checkOut = stay.checkOut;
    // Capacidad: la sigue validando el backend, como hasta ahora.
    const adultsError = validateGuestCounts(adults, '0').adults;
    if (adultsError) errors.adults = adultsError;
    const notesError = validateEditedNotes(notes, original.notes).error;
    if (notesError) errors.notes = notesError;
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const clearFieldError = (field: string) =>
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });

  const save = async () => {
    if (!booking || !reservation.bookingId) return;
    // Se revalida justo antes de guardar.
    if (!validate()) return;
    setSaving(true);
    setError('');
    try {
      await bookingService.updateBooking(reservation.bookingId, {
        guest_id: booking.guestId,
        room_id: booking.roomId,
        room_type_id: booking.roomTypeId,
        rate_id: booking.rateId,
        check_in: checkIn,
        check_out: checkOut,
        adults: Number(adults),
        children: booking.children,
        // Sin cambios no se envían: el backend conserva el texto original exacto,
        // aunque supere el límite actual.
        notes: notes === original.notes ? undefined : notes,
      });
      await onSaved();
      onClose();
    } catch (cause) {
      // Los cruces con otras reservas de la habitación los comprueba el backend.
      const failure = describeEditSaveError(
        cause instanceof Error ? cause.message : 'No fue posible guardar los cambios.',
      );
      if (failure.field === 'form') setError(failure.message);
      else setFieldErrors((current) => ({ ...current, [failure.field]: failure.message }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal rc-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reservation-edit-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">EDITAR RESERVA</p>
            <h2 id="reservation-edit-title">{reservation.code}</h2>
          </div>
          <button
            className="icon-btn"
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar edición"
          >
            <X size={18} />
          </button>
        </div>
        <div className="rc-form-scroll">
          <div className="rc-form-grid">
            <label className="rc-field">
              <span>Entrada</span>
              <input
                type="date"
                name="edit-check-in"
                className={fieldClass(fieldErrors.checkIn)}
                value={checkIn}
                min={today}
                onChange={(event) => {
                  setCheckIn(event.target.value);
                  clearFieldError('checkIn');
                  // La validez de la salida depende de la entrada.
                  clearFieldError('checkOut');
                }}
                disabled={loading || saving}
              />
              {fieldErrors.checkIn && (
                <small className="rc-field-error">{fieldErrors.checkIn}</small>
              )}
            </label>
            <label className="rc-field">
              <span>Salida</span>
              <input
                type="date"
                name="edit-check-out"
                className={fieldClass(fieldErrors.checkOut)}
                value={checkOut}
                min={editCheckOutMin(checkIn, today)}
                onChange={(event) => {
                  setCheckOut(event.target.value);
                  clearFieldError('checkOut');
                }}
                disabled={loading || saving}
              />
              {fieldErrors.checkOut && (
                <small className="rc-field-error">{fieldErrors.checkOut}</small>
              )}
            </label>
            <label className="rc-field">
              <span>Adultos</span>
              {/* type="text" con teclado numérico: type="number" admite "-", "e" y decimales. */}
              <input
                type="text"
                name="edit-adults"
                inputMode="numeric"
                pattern="[0-9]*"
                className={fieldClass(fieldErrors.adults)}
                value={adults}
                onChange={(event) => {
                  // Signos, letras, decimales o espacios no se guardan en el estado.
                  if (!isDigitsOnly(event.target.value)) return;
                  setAdults(event.target.value);
                  clearFieldError('adults');
                }}
                disabled={loading || saving}
              />
              {fieldErrors.adults && <small className="rc-field-error">{fieldErrors.adults}</small>}
            </label>
            <label className="rc-field">
              <span>Menores</span>
              <input type="number" name="edit-children" value={children ?? ''} disabled />
            </label>
            <label className="rc-field rc-field-full">
              <span>Notas</span>
              <textarea
                name="edit-notes"
                className={fieldClass(fieldErrors.notes)}
                maxLength={NOTES_MAX_LENGTH}
                value={notes}
                onChange={(event) => {
                  setNotes(event.target.value);
                  clearFieldError('notes');
                }}
                disabled={loading || saving}
                rows={3}
              />
              <small aria-live="polite">
                {notes.length}/{NOTES_MAX_LENGTH}
              </small>
              {notesCheck.warning && <small role="status">{notesCheck.warning}</small>}
              {fieldErrors.notes && <small className="rc-field-error">{fieldErrors.notes}</small>}
            </label>
          </div>
          {error && (
            <small className="rc-field-error" role="alert">
              {error}
            </small>
          )}
        </div>
        <div className="modal-foot">
          <button className="button secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            className="button primary"
            onClick={() => void save()}
            disabled={loading || saving || !booking}
          >
            <Check size={16} /> {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- New Reservation / Walk-in ---------- */
export function ReservationFormModal({
  nextCode,
  rooms,
  hasConflict,
  isRoomBlocked,
  onSave,
  onClose,
  walkin,
  nights,
  folioTotals,
}: {
  nextCode: string;
  rooms: RecRoom[];
  hasConflict: (room: string, ci: string, co: string, excludeId?: number) => boolean;
  isRoomBlocked: (room: string, ci: string, co: string) => boolean;
  onSave: (res: Reservation) => void | Promise<void>;
  onClose: () => void;
  walkin?: boolean;
  nights: (ci: string, co: string) => number;
  folioTotals: (folio: FolioEntry[]) => Totals;
}) {
  // "Hoy" es el día civil de Guatemala, no el del navegador. Se recalcula en cada
  // render y otra vez al validar: el formulario puede quedar abierto pasada la medianoche.
  const today = hotelToday();
  const [guest, setGuest] = useState<GuestInfo>({ ...emptyGuest });
  const [checkIn, setCheckIn] = useState(() => hotelToday());
  const [checkOut, setCheckOut] = useState(() => nextCalendarDay(hotelToday()));
  const [roomNumber, setRoomNumber] = useState('');
  // Texto, no número: así se detectan vacíos, signos y decimales en lugar de corregirlos en silencio.
  const [adults, setAdults] = useState('1');
  const [children, setChildren] = useState('0');
  const [origin, setOrigin] = useState(walkin ? 'Walk-in' : 'Teléfono');
  const [observations, setObservations] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [saving, setSaving] = useState(false);

  const availableRooms = rooms.filter((r) => r.status === 'Disponible');
  const selectedRoom = rooms.find((r) => r.number === roomNumber);
  // Con un rango inválido no se calculan noches: calculateNights lanza ante él y tumbaría el render.
  const dateError = validateStayDates(checkIn, checkOut, today) ?? '';
  const n = dateError ? null : nights(checkIn, checkOut);
  const total = selectedRoom && n !== null ? selectedRoom.rate * n : 0;
  const checkOutMin = /^\d{4}-\d{2}-\d{2}$/.test(checkIn) && checkIn >= today ? checkIn : today;

  const conflict = roomNumber && hasConflict(roomNumber, checkIn, checkOut);
  const blocked = roomNumber && isRoomBlocked(roomNumber, checkIn, checkOut);

  const validate = () => {
    const e: Record<string, string> = {};
    const nameError = validatePersonName(guest.name, 'nombre');
    if (nameError) e.name = nameError;
    const lastNameError = validatePersonName(guest.lastName, 'apellido');
    if (lastNameError) e.lastName = lastNameError;
    const phoneError = validatePhone(guest.phone);
    if (phoneError) e.phone = phoneError;
    const emailError = validateEmail(guest.email);
    if (emailError) e.email = emailError;
    // Fecha de Guatemala en el momento de comprobar, no la del render anterior.
    const stayError = validateStayDates(checkIn, checkOut, hotelToday());
    if (stayError) e.dates = stayError;
    // Menores vacíos vuelven a 0 al comprobar (sin error por campo vacío).
    const childrenValue = normalizeChildren(children);
    if (childrenValue !== children) setChildren(childrenValue);
    const counts = validateGuestCounts(adults, childrenValue, selectedRoom?.capacity);
    if (counts.adults) e.adults = counts.adults;
    if (counts.children) e.children = counts.children;
    if (counts.capacity) e.capacity = counts.capacity;
    if (!roomNumber) e.room = 'Selecciona una habitación.';
    if (conflict) e.room = 'La habitación ya tiene una reserva en esas fechas.';
    if (blocked) e.room = 'La habitación está bloqueada en esas fechas.';
    const notesError = validateNotes(observations);
    if (notesError) e.observations = notesError;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    // Se vuelve a validar al guardar (p. ej. cambió el día): si falla, se regresa al
    // formulario, que es donde se muestran los errores de cada campo.
    if (!validate() || n === null) {
      setShowSummary(false);
      return;
    }
    const room = rooms.find((r) => r.number === roomNumber)!;
    const adultCount = Number(adults);
    const childCount = Number(normalizeChildren(children));
    setSaving(true);
    setErrors((current) => ({ ...current, submit: '' }));
    try {
      await onSave({
        id: Date.now(),
        code: nextCode,
        guest: {
          ...guest,
          name: normalizePersonName(guest.name),
          lastName: normalizePersonName(guest.lastName),
        },
        // Los acompañantes se registran en el check-in.
        companions: [],
        checkIn,
        checkOut,
        roomNumber: room.number,
        roomType: room.type,
        rate: room.rate,
        guestCount: adultCount + childCount,
        adults: adultCount,
        children: childCount,
        status: 'Confirmada',
        origin,
        observations,
        folio: [
          {
            id: Date.now(),
            concept: `Alojamiento ${n} ${n === 1 ? 'noche' : 'noches'}`,
            category: 'Alojamiento',
            amount: total,
            date: checkIn,
            type: 'Cargo',
            status: 'Activo',
          },
        ],
        cancelReason: '',
        voidReason: '',
        checkInTime: null,
        checkOutTime: null,
      });
    } catch (cause) {
      setErrors((current) => ({
        ...current,
        submit: cause instanceof Error ? cause.message : 'No fue posible guardar la reserva.',
      }));
    } finally {
      setSaving(false);
    }
  };

  if (showSummary) {
    return (
      <div className="modal-backdrop" onMouseDown={onClose}>
        <div className="modal" style={{ width: 460 }} onMouseDown={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <div>
              <p className="eyebrow">RESUMEN DE RESERVA</p>
              <h2>{walkin ? 'Registro walk-in' : 'Nueva reserva'}</h2>
            </div>
            <button className="icon-btn" aria-label="Cerrar" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
          <div className="rc-summary-box">
            <div>
              <small>Código</small>
              {/* El código real (BKG-…) lo genera el backend al guardar. */}
              <span>Se asignará al confirmar</span>
            </div>
            <div>
              <small>Huésped</small>
              <span>
                {normalizePersonName(guest.name)} {normalizePersonName(guest.lastName)}
              </span>
            </div>
            <div>
              <small>Estadía</small>
              <span>
                {checkIn} → {checkOut} · {n} {n === 1 ? 'noche' : 'noches'}
              </span>
            </div>
            <div>
              <small>Habitación</small>
              <span>
                {roomNumber} · {selectedRoom?.type}
              </span>
            </div>
            <div>
              <small>Huéspedes</small>
              <span>
                {adults} {Number(adults) === 1 ? 'adulto' : 'adultos'} · {children}{' '}
                {Number(children) === 1 ? 'menor' : 'menores'}
              </span>
            </div>
            <div>
              <small>Origen</small>
              <span>{origin}</span>
            </div>
            <div className="rc-summary-total">
              {/* Estimado: la tarifa real por noche la calculará el backend (subfase 1B, etapa 2). */}
              <small>Total estimado</small>
              <strong>{moneyGTQ(total)}</strong>
            </div>
          </div>
          {errors.submit && (
            <small className="rc-field-error" role="alert">
              {errors.submit}
            </small>
          )}
          <div className="modal-foot">
            <button
              className="button secondary"
              onClick={() => setShowSummary(false)}
              disabled={saving}
            >
              Volver
            </button>
            <button className="button primary" onClick={() => void handleSave()} disabled={saving}>
              <Check size={16} /> {saving ? 'Guardando...' : 'Confirmar reserva'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal rc-form-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">{walkin ? 'WALK-IN' : 'NUEVA RESERVA'}</p>
            <h2>{walkin ? 'Registro walk-in' : 'Crear reserva manual'}</h2>
          </div>
          <button className="icon-btn" aria-label="Cerrar" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="rc-form-scroll">
          <h4 className="rc-form-section-title">Datos del huésped</h4>
          <div className="rc-form-grid">
            <label className="rc-field">
              <span>Nombre</span>
              <input
                autoComplete="given-name"
                maxLength={NAME_MAX_LENGTH}
                className={fieldClass(errors.name)}
                value={guest.name}
                onChange={(e) => setGuest({ ...guest, name: e.target.value })}
              />
              {errors.name && <small className="rc-field-error">{errors.name}</small>}
            </label>
            <label className="rc-field">
              <span>Apellido</span>
              <input
                autoComplete="family-name"
                maxLength={NAME_MAX_LENGTH}
                className={fieldClass(errors.lastName)}
                value={guest.lastName}
                onChange={(e) => setGuest({ ...guest, lastName: e.target.value })}
              />
              {errors.lastName && <small className="rc-field-error">{errors.lastName}</small>}
            </label>
            <label className="rc-field">
              <span>Teléfono</span>
              <input
                type="text"
                name="phone"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="tel"
                maxLength={PHONE_MAX_DIGITS}
                placeholder="55550000"
                className={fieldClass(errors.phone)}
                value={guest.phone}
                // Solo dígitos y como máximo 20, también al pegar ("+502 5555-0000" → "50255550000").
                onChange={(e) => setGuest({ ...guest, phone: keepPhoneDigits(e.target.value) })}
              />
              {errors.phone && <small className="rc-field-error">{errors.phone}</small>}
            </label>
            <label className="rc-field">
              <span>Correo</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                maxLength={EMAIL_MAX_LENGTH}
                className={fieldClass(errors.email)}
                value={guest.email}
                onChange={(e) => setGuest({ ...guest, email: e.target.value })}
              />
              {errors.email && <small className="rc-field-error">{errors.email}</small>}
            </label>
          </div>

          <h4 className="rc-form-section-title">Estadía</h4>
          <div className="rc-form-grid">
            <label className="rc-field">
              <span>Entrada</span>
              <input
                type="date"
                min={today}
                className={fieldClass(dateError)}
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
              />
            </label>
            <label className="rc-field">
              <span>Salida</span>
              <input
                type="date"
                min={nextCalendarDay(checkOutMin)}
                className={fieldClass(dateError)}
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
            </label>
            <label className="rc-field">
              <span>Adultos</span>
              {/* type="text" con teclado numérico: type="number" admite "-", "e" y decimales. */}
              <input
                type="text"
                name="adults"
                inputMode="numeric"
                pattern="[0-9]*"
                className={fieldClass(errors.adults)}
                value={adults}
                onChange={(e) => {
                  // Un valor con signos, letras, decimales o espacios no se guarda en el estado.
                  if (isDigitsOnly(e.target.value)) setAdults(e.target.value);
                }}
              />
              {errors.adults && <small className="rc-field-error">{errors.adults}</small>}
            </label>
            <label className="rc-field">
              <span>Menores</span>
              <input
                type="text"
                name="children"
                inputMode="numeric"
                pattern="[0-9]*"
                className={fieldClass(errors.children)}
                value={children}
                onChange={(e) => {
                  if (isDigitsOnly(e.target.value)) setChildren(e.target.value);
                }}
                onBlur={() => setChildren(normalizeChildren(children))}
              />
              {errors.children && <small className="rc-field-error">{errors.children}</small>}
            </label>
            <label className="rc-field">
              <span>Origen / canal</span>
              <select value={origin} onChange={(e) => setOrigin(e.target.value)}>
                {!walkin && <option>Teléfono</option>}
                {!walkin && <option>Presencial</option>}
                {!walkin && <option>Online</option>}
                <option>Walk-in</option>
              </select>
            </label>
          </div>
          {dateError && (
            <small className="rc-field-error" role="alert">
              {dateError}
            </small>
          )}

          <h4 className="rc-form-section-title">Habitación</h4>
          <div className="rc-room-select-list">
            {availableRooms.length === 0 && (
              <div className="hk-empty">
                <BedDouble size={22} />
                <p>No hay habitaciones disponibles</p>
              </div>
            )}
            {availableRooms.map((r) => {
              const c = hasConflict(r.number, checkIn, checkOut);
              const b = isRoomBlocked(r.number, checkIn, checkOut);
              const disabled = c || b;
              return (
                <button
                  key={r.id}
                  className={`rc-room-option ${roomNumber === r.number ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                  disabled={disabled}
                  onClick={() => setRoomNumber(r.number)}
                >
                  <div>
                    <strong>Hab. {r.number}</strong>
                    <span>
                      {r.type} · cap. {r.capacity} · {moneyGTQ(r.rate)}/noche (estimado)
                    </span>
                  </div>
                  {disabled && (
                    <small className="rc-room-unavailable">{b ? 'Bloqueada' : 'Ocupada'}</small>
                  )}
                </button>
              );
            })}
          </div>
          {errors.room && <small className="rc-field-error">{errors.room}</small>}
          {errors.capacity && <small className="rc-field-error">{errors.capacity}</small>}
          {errors.submit && (
            <small className="rc-field-error" role="alert">
              {errors.submit}
            </small>
          )}
          {selectedRoom && n !== null && (
            <div className="rc-rate-preview">
              Tarifa estimada: {moneyGTQ(selectedRoom.rate)} × {n} {n === 1 ? 'noche' : 'noches'} ={' '}
              <strong>{moneyGTQ(total)}</strong>
            </div>
          )}

          <label className="rc-field rc-field-full">
            <span>Observaciones</span>
            <textarea
              className={fieldClass(errors.observations)}
              maxLength={NOTES_MAX_LENGTH}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Notas adicionales..."
            />
            <small aria-live="polite">
              {observations.length}/{NOTES_MAX_LENGTH}
            </small>
            {errors.observations && <small className="rc-field-error">{errors.observations}</small>}
          </label>
        </div>
        <div className="modal-foot">
          <button className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button primary"
            disabled={Boolean(dateError)}
            onClick={() => {
              if (validate()) setShowSummary(true);
            }}
          >
            <Check size={16} /> Ver resumen
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Check-in ---------- */
type CompanionDraft = {
  firstName: string;
  lastName: string;
  documentType: GuestDocumentTypeDto | '';
  documentNumber: string;
  age: string;
  guestType: 'adult' | 'child';
};
type CompanionDraftErrors = Partial<Record<keyof CompanionDraft, string>>;

const emptyCompanionDraft = (guestType: 'adult' | 'child'): CompanionDraft => ({
  firstName: '',
  lastName: '',
  documentType: '',
  documentNumber: '',
  age: '',
  guestType,
});

export function CheckinModal({
  reservation,
  rooms,
  hasConflict,
  isRoomBlocked,
  onClose,
  onCheckin,
}: {
  reservation: Reservation;
  rooms: RecRoom[];
  hasConflict: (room: string, checkIn: string, checkOut: string, excludeId?: number) => boolean;
  isRoomBlocked: (room: string, checkIn: string, checkOut: string) => boolean;
  onClose: () => void;
  onCheckin: (
    id: number,
    updates: Partial<GuestInfo>,
    companions: Companion[],
    res: Reservation,
    roomId?: string,
  ) => void | Promise<void>;
}) {
  const [docType, setDocType] = useState<GuestDocumentTypeDto | ''>(
    toDocumentTypeDto(reservation.guest.docType),
  );
  const [docNumber, setDocNumber] = useState(reservation.guest.docNumber || '');
  const [birthDate, setBirthDate] = useState(reservation.guest.birthDate || '');
  // Sin nacionalidad por defecto: antes se proponía "Mexicana" y se guardaba sin querer.
  const [nationality, setNationality] = useState(reservation.guest.nationality || '');
  const [companions, setCompanions] = useState<Companion[]>(reservation.companions);
  const [companionsLoading, setCompanionsLoading] = useState(Boolean(reservation.bookingId));
  const [companionsError, setCompanionsError] = useState('');
  const adultsDeclared = reservation.adults ?? 1;
  const childrenDeclared = reservation.children ?? 0;
  const nextGuestType = (list: Companion[]): 'adult' | 'child' =>
    list.filter((c) => c.guestType === 'adult').length < Math.max(adultsDeclared - 1, 0)
      ? 'adult'
      : 'child';
  const [draft, setDraft] = useState<CompanionDraft>(() =>
    emptyCompanionDraft(nextGuestType(reservation.companions)),
  );
  const [draftErrors, setDraftErrors] = useState<CompanionDraftErrors>({});
  const [fieldErrors, setFieldErrors] = useState<{
    docType?: string;
    docNumber?: string;
    birthDate?: string;
  }>({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState('');

  // Los acompañantes ya guardados se cargan: al sincronizar, los que no estén en
  // la lista se eliminan en el backend.
  useEffect(() => {
    const bookingId = reservation.bookingId;
    if (!bookingId) return;
    let active = true;
    bookingCompanionService
      .getCompanionsByBookingId(bookingId)
      .then((saved) => {
        if (!active) return;
        const loaded = saved.map((companion, index): Companion => ({
          id: index + 1,
          backendId: companion.id,
          name: companion.firstName,
          lastName: companion.lastName,
          documentType: toDocumentTypeDto(companion.documentType),
          document: companion.documentNumber,
          age: null,
          guestType: companion.guestType,
        }));
        setCompanions(loaded);
        setDraft((current) => ({ ...current, guestType: nextGuestType(loaded) }));
      })
      .catch((cause: unknown) => {
        if (active) {
          setCompanionsError(
            cause instanceof Error ? cause.message : 'No fue posible cargar los acompañantes.',
          );
        }
      })
      .finally(() => {
        if (active) setCompanionsLoading(false);
      });
    return () => {
      active = false;
    };
    // nextGuestType solo depende de la reserva, que no cambia mientras el modal está abierto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservation.bookingId]);

  const assignedRoomCandidate = rooms.find((r) => r.number === reservation.roomNumber);
  const assignedRoom =
    assignedRoomCandidate &&
    (!reservation.roomTypeId || assignedRoomCandidate.roomTypeId === reservation.roomTypeId)
      ? assignedRoomCandidate
      : undefined;
  const availableRooms = rooms.filter(
    (candidate) =>
      candidate.status === 'Disponible' &&
      (reservation.roomTypeId
        ? candidate.roomTypeId === reservation.roomTypeId
        : candidate.type === reservation.roomType) &&
      !hasConflict(candidate.number, reservation.checkIn, reservation.checkOut, reservation.id) &&
      !isRoomBlocked(candidate.number, reservation.checkIn, reservation.checkOut),
  );
  const room =
    assignedRoom ?? availableRooms.find((candidate) => candidate.backendRoomId === selectedRoomId);
  const capacityExceeded = room ? 1 + companions.length > room.capacity : false;
  const today = hotelToday();

  const updateDraft = (field: keyof CompanionDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setDraftErrors((current) => ({ ...current, [field]: undefined }));
  };

  const addCompanion = () => {
    // Caracteres de nombres reales, sin el límite 3–20 propio de Nueva reserva.
    const firstName = normalizePersonNamePart(draft.firstName);
    const lastName = normalizePersonNamePart(draft.lastName);
    const nextErrors: CompanionDraftErrors = {
      firstName: validatePersonNamePart(firstName, 'nombre') ?? undefined,
      lastName: validatePersonNamePart(lastName, 'apellido') ?? undefined,
      documentType: draft.documentType ? undefined : 'Selecciona el tipo de documento.',
      documentNumber:
        validateRequiredText(draft.documentNumber, 'Ingresa el número de documento.') ?? undefined,
      // 0 es válido (bebés); vacío no se convierte en 0.
      age:
        validateWholeNumber(draft.age, { min: 0, requiredMessage: 'Ingresa la edad.' }) ??
        undefined,
    };
    setDraftErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    const next: Companion[] = [
      ...companions,
      {
        id: Date.now() + companions.length,
        name: firstName,
        lastName,
        documentType: draft.documentType,
        document: draft.documentNumber.trim(),
        age: Number(draft.age),
        guestType: draft.guestType,
      },
    ];
    setCompanions(next);
    setDraft(emptyCompanionDraft(nextGuestType(next)));
    setError('');
  };
  const removeCompanion = (id: number) => {
    setCompanions((current) => current.filter((x) => x.id !== id));
    setError('');
  };

  const submit = async () => {
    if (submitting) return;
    const nextFieldErrors: { docType?: string; docNumber?: string; birthDate?: string } = {};
    if (!docType) nextFieldErrors.docType = 'Selecciona el tipo de documento.';
    if (!docNumber.trim()) nextFieldErrors.docNumber = 'El número de documento es obligatorio.';
    if (birthDate && (!isCalendarDate(birthDate) || birthDate > today)) {
      nextFieldErrors.birthDate = 'La fecha de nacimiento no puede ser futura.';
    }
    setFieldErrors(nextFieldErrors);
    if (!reservation.bookingId) {
      setError('La reserva no está vinculada al backend.');
      return;
    }
    if (reservation.status !== 'Confirmada') {
      setError('Confirma la reserva antes de hacer check-in.');
      return;
    }
    if (today < reservation.checkIn || today >= reservation.checkOut) {
      setError('El check-in solo se puede realizar durante las fechas de la estadía.');
      return;
    }
    if (!room) {
      setError(
        availableRooms.length > 0
          ? 'Selecciona una habitación antes de hacer check-in.'
          : 'No hay habitaciones compatibles disponibles para estas fechas.',
      );
      return;
    }
    if (room.status !== 'Disponible') {
      setError('La habitación asignada no está disponible para check-in.');
      return;
    }
    if (nextFieldErrors.docType || nextFieldErrors.docNumber || nextFieldErrors.birthDate) {
      setError('');
      return;
    }
    if (companionsLoading) {
      setError('Espera a que carguen los acompañantes registrados.');
      return;
    }
    if (companionsError) {
      setError(companionsError);
      return;
    }
    const compositionError = companionCompositionError(
      companions,
      adultsDeclared,
      childrenDeclared,
    );
    if (compositionError) {
      setError(compositionError);
      return;
    }
    if (capacityExceeded) {
      setError(`Excede la capacidad de la habitación (${room?.capacity})`);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onCheckin(
        reservation.id,
        { docType, docNumber: docNumber.trim(), birthDate, nationality: nationality.trim() },
        companions,
        reservation,
        assignedRoom ? undefined : room?.backendRoomId,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const draftField = (
    field: 'firstName' | 'lastName' | 'documentNumber',
    label: string,
    maxLength?: number,
  ) => (
    <label className="rc-field">
      <span>{label} *</span>
      <input
        className={fieldClass(draftErrors[field])}
        value={draft[field]}
        maxLength={maxLength}
        onChange={(e) => updateDraft(field, e.target.value)}
        aria-required="true"
        {...fieldErrorProps(`checkin-comp-${field}-error`, draftErrors[field])}
      />
      {draftErrors[field] && (
        <small id={`checkin-comp-${field}-error`} className="rc-field-error">
          {draftErrors[field]}
        </small>
      )}
    </label>
  );

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal rc-form-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">CHECK-IN</p>
            <h2>
              {reservation.code} · Hab. {reservation.roomNumber}
            </h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="rc-form-scroll">
          <p className="login-helper">
            Huésped: {reservation.guest.name} {reservation.guest.lastName} · {adultsDeclared}{' '}
            {adultsDeclared === 1 ? 'adulto' : 'adultos'} y {childrenDeclared}{' '}
            {childrenDeclared === 1 ? 'menor' : 'menores'}
          </p>
          <div className="rc-form-grid">
            <label className="rc-field">
              <span>Tipo de documento *</span>
              <select
                className={fieldClass(fieldErrors.docType)}
                value={docType}
                onChange={(e) => {
                  setDocType(toDocumentTypeDto(e.target.value));
                  setFieldErrors((current) => ({ ...current, docType: undefined }));
                }}
                aria-required="true"
                {...fieldErrorProps('checkin-doc-type-error', fieldErrors.docType)}
              >
                <option value="">Selecciona...</option>
                {DOCUMENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {fieldErrors.docType && (
                <small id="checkin-doc-type-error" className="rc-field-error">
                  {fieldErrors.docType}
                </small>
              )}
            </label>
            <label className="rc-field">
              <span>Número de documento *</span>
              <input
                className={fieldClass(fieldErrors.docNumber)}
                value={docNumber}
                onChange={(e) => {
                  setDocNumber(e.target.value);
                  setFieldErrors((current) => ({ ...current, docNumber: undefined }));
                }}
                placeholder="Número..."
                aria-required="true"
                {...fieldErrorProps('checkin-doc-error', fieldErrors.docNumber)}
              />
              {fieldErrors.docNumber && (
                <small id="checkin-doc-error" className="rc-field-error">
                  {fieldErrors.docNumber}
                </small>
              )}
            </label>
            <label className="rc-field">
              <span>Fecha de nacimiento</span>
              <input
                type="date"
                max={today}
                className={fieldClass(fieldErrors.birthDate)}
                value={birthDate}
                onChange={(e) => {
                  setBirthDate(e.target.value);
                  setFieldErrors((current) => ({ ...current, birthDate: undefined }));
                }}
                {...fieldErrorProps('checkin-birth-error', fieldErrors.birthDate)}
              />
              {fieldErrors.birthDate && (
                <small id="checkin-birth-error" className="rc-field-error">
                  {fieldErrors.birthDate}
                </small>
              )}
            </label>
            <label className="rc-field">
              <span>Nacionalidad</span>
              <input value={nationality} onChange={(e) => setNationality(e.target.value)} />
            </label>
          </div>

          {!assignedRoom && (
            <>
              <h4 className="rc-form-section-title">Asignar habitación</h4>
              {availableRooms.length > 0 ? (
                <div className="rc-room-select-list">
                  {availableRooms.map((candidate) => (
                    <button
                      key={candidate.backendRoomId}
                      type="button"
                      className={`rc-room-option ${selectedRoomId === candidate.backendRoomId ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedRoomId(candidate.backendRoomId);
                        setError('');
                      }}
                    >
                      <div>
                        <strong>Hab. {candidate.number}</strong>
                        <span>
                          {candidate.type} · cap. {candidate.capacity} · {candidate.floor}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <small className="rc-field-error">
                  No hay habitaciones compatibles disponibles para estas fechas.
                </small>
              )}
            </>
          )}

          <h4 className="rc-form-section-title">Acompañantes ({companions.length})</h4>
          {companionsLoading && <p className="login-helper">Cargando acompañantes...</p>}
          {companionsError && (
            <small className="rc-field-error" role="alert">
              {companionsError}
            </small>
          )}
          <div className="rc-form-grid">
            {draftField('firstName', 'Nombre')}
            {draftField('lastName', 'Apellido')}
            <label className="rc-field">
              <span>Tipo de documento *</span>
              <select
                className={fieldClass(draftErrors.documentType)}
                value={draft.documentType}
                onChange={(e) => updateDraft('documentType', toDocumentTypeDto(e.target.value))}
                aria-required="true"
                {...fieldErrorProps('checkin-comp-documentType-error', draftErrors.documentType)}
              >
                <option value="">Selecciona...</option>
                {DOCUMENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {draftErrors.documentType && (
                <small id="checkin-comp-documentType-error" className="rc-field-error">
                  {draftErrors.documentType}
                </small>
              )}
            </label>
            {draftField('documentNumber', 'Número de documento')}
            <label className="rc-field">
              <span>Edad *</span>
              {/* type="text" con teclado numérico: type="number" admite "-", "e" y decimales. */}
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={3}
                className={fieldClass(draftErrors.age)}
                value={draft.age}
                onChange={(e) => {
                  if (isWholeNumberInput(e.target.value)) updateDraft('age', e.target.value);
                }}
                aria-required="true"
                {...fieldErrorProps('checkin-comp-age-error', draftErrors.age)}
              />
              {draftErrors.age && (
                <small id="checkin-comp-age-error" className="rc-field-error">
                  {draftErrors.age}
                </small>
              )}
            </label>
            <label className="rc-field">
              <span>Tipo *</span>
              <select
                value={draft.guestType}
                onChange={(e) =>
                  updateDraft('guestType', e.target.value === 'child' ? 'child' : 'adult')
                }
              >
                <option value="adult">Adulto</option>
                <option value="child">Menor</option>
              </select>
            </label>
          </div>
          <button type="button" className="button small secondary" onClick={addCompanion}>
            <Check size={14} /> Agregar acompañante
          </button>
          {companions.length > 0 && (
            <div className="rc-comp-list">
              {companions.map((c) => (
                <div className="rc-comp-item" key={c.id}>
                  <span>
                    {c.name} {c.lastName} · {c.guestType === 'child' ? 'Menor' : 'Adulto'} ·{' '}
                    {c.document}
                    {c.age === null ? '' : ` · ${c.age} años`}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCompanion(c.id)}
                    aria-label={`Quitar a ${c.name} ${c.lastName}`}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {capacityExceeded && (
            <small className="rc-field-error">
              Excede la capacidad de la habitación ({room?.capacity})
            </small>
          )}
          {error && (
            <small className="rc-field-error" role="alert">
              {error}
            </small>
          )}
        </div>

        <div className="modal-foot">
          <button className="button secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button
            className="button primary"
            onClick={() => void submit()}
            disabled={submitting}
            aria-busy={submitting || undefined}
          >
            <Check size={16} /> {submitting ? 'Procesando…' : 'Confirmar check-in'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Checkout ---------- */
export function CheckoutModal({
  reservation,
  onClose,
  onCheckout,
  folioTotals,
}: {
  reservation: Reservation;
  onClose: () => void;
  onCheckout: (id: number) => void | Promise<void>;
  folioTotals: (f: FolioEntry[]) => Totals;
}) {
  const t = folioTotals(reservation.folio);
  const nights = Math.max(
    1,
    Math.round(
      (new Date(reservation.checkOut).getTime() - new Date(reservation.checkIn).getTime()) /
        86400000,
    ),
  );
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" style={{ width: 420 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">CHECK-OUT</p>
            <h2>{reservation.code}</h2>
          </div>
          <button className="icon-btn" aria-label="Cerrar" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="login-helper">
          {reservation.guest.name} {reservation.guest.lastName} · Hab. {reservation.roomNumber} ·{' '}
          {nights} {nights === 1 ? 'noche' : 'noches'}
        </p>
        <div className="rc-folio-summary">
          <div>
            <span>Total cargos</span>
            <strong>{money(t.charges)}</strong>
          </div>
          <div>
            <span>Pagos</span>
            <strong>−{money(t.payments)}</strong>
          </div>
          <div>
            <span>Depósitos</span>
            <strong>−{money(t.deposits)}</strong>
          </div>
          <div className="rc-folio-balance">
            <span>Saldo pendiente</span>
            <strong className={t.balance > 0 ? 'terracotta-text' : ''}>{money(t.balance)}</strong>
          </div>
        </div>
        {t.balance > 0 && (
          <div className="rc-alert warning">
            <TriangleAlert size={15} />
            <div>
              <strong>Saldo pendiente</strong>
              <p>Existe un saldo de {money(t.balance)} por cobrar antes del check-out.</p>
            </div>
          </div>
        )}
        {t.balance < 0 && (
          <div className="rc-alert warning" role="status">
            <TriangleAlert size={15} />
            <div>
              <strong>Saldo a favor</strong>
              <p>Aplica o devuelve el saldo de {money(Math.abs(t.balance))} antes del check-out.</p>
            </div>
          </div>
        )}
        <div className="modal-foot">
          <button className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button primary"
            onClick={() => void onCheckout(reservation.id)}
            disabled={t.balance !== 0}
            title={t.balance !== 0 ? 'Liquida la cuenta antes del check-out' : undefined}
          >
            <Check size={16} /> Finalizar check-out
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Cancel / Void ---------- */
export function ReasonModal({
  title,
  label,
  tone,
  onClose,
  onConfirm,
}: {
  title: string;
  label: string;
  tone: 'warning' | 'terracotta';
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // El ref bloquea un segundo clic antes de que React aplique `submitting`.
  const submittingRef = useRef(false);
  const confirm = async () => {
    // Un motivo con solo espacios no se envía; un segundo clic no repite la operación.
    if (submittingRef.current || !reason.trim()) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" style={{ width: 400 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">{title}</p>
            <h2>{label}</h2>
          </div>
          <button className="icon-btn" aria-label="Cerrar" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="login-helper">
          Esta acción no se puede deshacer. El registro se conservará para auditoría.
        </p>
        <label className="rc-field">
          <span>Motivo *</span>
          <textarea
            className="rc-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Indica el motivo..."
            aria-required="true"
            aria-describedby="reason-modal-help"
          />
          <small id="reason-modal-help" className="adm-field-help">
            Obligatorio para confirmar.
          </small>
        </label>
        <div className="modal-foot">
          <button className="button secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button
            className={`button ${tone === 'terracotta' ? 'terracotta-btn' : 'primary'}`}
            disabled={!reason.trim() || submitting}
            aria-busy={submitting || undefined}
            onClick={() => void confirm()}
          >
            <Ban size={16} /> Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Add Charge ---------- */
/** Confirmación explícita, con bloqueo de doble envío, para acciones sin motivo. */
export function ConfirmActionModal({
  title,
  label,
  message,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  title: string;
  label: string;
  message: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const confirm = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" style={{ width: 400 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">{title}</p>
            <h2>{label}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <p className="login-helper">{message}</p>
        <div className="modal-foot">
          <button className="button secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button
            className="button primary"
            disabled={submitting}
            aria-busy={submitting || undefined}
            onClick={() => void confirm()}
          >
            <Check size={16} /> {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ChargeModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (concept: string, category: string, amount: number, observation: string) => void;
}) {
  const [concept, setConcept] = useState('');
  const [category, setCategory] = useState('Servicios');
  const [amount, setAmount] = useState('');
  const [observation, setObservation] = useState('');
  const [errors, setErrors] = useState<{ concept?: string; amount?: string }>({});
  const submit = () => {
    const nextErrors = {
      concept: validateRequiredText(concept, 'El concepto es obligatorio.') ?? undefined,
      amount: validateMoneyAmount(amount) ?? undefined,
    };
    setErrors(nextErrors);
    const cents = moneyInputToCents(amount);
    if (nextErrors.concept || nextErrors.amount || cents === null) return;
    onAdd(concept.trim(), category, cents / 100, observation.trim());
  };
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" style={{ width: 400 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">AGREGAR CARGO</p>
            <h2>Nuevo cargo</h2>
          </div>
          <button className="icon-btn" aria-label="Cerrar" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <label className="rc-field">
          <span>Concepto *</span>
          <input
            className={fieldClass(errors.concept)}
            value={concept}
            onChange={(e) => {
              setConcept(e.target.value);
              setErrors((current) => ({ ...current, concept: undefined }));
            }}
            placeholder="Ej. Room service — Almuerzo"
            aria-required="true"
            {...fieldErrorProps('charge-concept-error', errors.concept)}
          />
          {errors.concept && (
            <small id="charge-concept-error" className="rc-field-error">
              {errors.concept}
            </small>
          )}
        </label>
        <label className="rc-field">
          <span>Categoría</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option>Servicios</option>
            <option>Room service</option>
            <option>Amenidades</option>
            <option>Productos</option>
            <option>Otro</option>
          </select>
        </label>
        <label className="rc-field">
          <span>Monto *</span>
          <MoneyInput
            id="charge-amount"
            value={amount}
            error={errors.amount}
            onChange={(value) => {
              setAmount(value);
              setErrors((current) => ({ ...current, amount: undefined }));
            }}
          />
        </label>
        <label className="rc-field">
          <span>Observación</span>
          <input
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            placeholder="Opcional..."
          />
        </label>
        <div className="modal-foot">
          <button className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" onClick={submit}>
            <Check size={16} /> Agregar cargo
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Payment / Deposit ---------- */
export function PaymentModal({
  title,
  onClose,
  onSubmit,
  isDeposit,
}: {
  title: string;
  onClose: () => void;
  onSubmit: (
    amount: number,
    method: FrontDeskPaymentMethod,
    reference: string,
  ) => void | Promise<void>;
  isDeposit?: boolean;
}) {
  const [amount, setAmount] = useState('');
  // Métodos reales del backend: "Tarjeta" se distingue en crédito o débito.
  const [method, setMethod] = useState<FrontDeskPaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (submitting) return;
    const amountError = validateMoneyAmount(amount) ?? undefined;
    setError(amountError);
    const cents = moneyInputToCents(amount);
    if (amountError || cents === null) return;
    setSubmitting(true);
    try {
      await onSubmit(cents / 100, method, reference.trim());
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" style={{ width: 400 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">{title}</p>
            <h2>{isDeposit ? 'Registrar depósito' : 'Registrar pago'}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <label className="rc-field">
          <span>Monto *</span>
          <MoneyInput
            id="payment-amount"
            value={amount}
            error={error}
            onChange={(value) => {
              setAmount(value);
              setError(undefined);
            }}
          />
        </label>
        <label className="rc-field">
          <span>Método *</span>
          <select
            value={method}
            onChange={(e) => {
              if (isFrontDeskPaymentMethod(e.target.value)) setMethod(e.target.value);
            }}
            aria-describedby={method === 'cash' ? 'payment-method-help' : undefined}
          >
            {FRONT_DESK_PAYMENT_METHODS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {method === 'cash' && (
            <small id="payment-method-help" className="adm-field-help">
              El efectivo requiere tu caja abierta.
            </small>
          )}
        </label>
        <label className="rc-field">
          <span>{isDeposit ? 'Notas (opcional)' : 'Referencia (opcional)'}</span>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={isDeposit ? 'Ej. garantía de llegada' : 'Ej. TXN-1234'}
          />
        </label>
        <div className="modal-foot">
          <button className="button secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button
            className="button primary"
            onClick={() => void submit()}
            disabled={submitting}
            aria-busy={submitting || undefined}
          >
            <Check size={16} /> {submitting ? 'Registrando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Room Change ---------- */
export function RoomChangeModal({
  reservation,
  rooms,
  hasConflict,
  isRoomBlocked,
  onClose,
  onConfirm,
}: {
  reservation: Reservation;
  rooms: RecRoom[];
  hasConflict: (r: string, ci: string, co: string, excludeId?: number) => boolean;
  isRoomBlocked: (r: string, ci: string, co: string) => boolean;
  onClose: () => void;
  onConfirm: (id: number, room: string) => void;
}) {
  const [selected, setSelected] = useState('');
  const currentRoom = rooms.find((r) => r.number === reservation.roomNumber);
  const newRoom = rooms.find((r) => r.number === selected);
  const compatible = rooms.filter(
    (r) =>
      r.number !== reservation.roomNumber &&
      (reservation.roomTypeId
        ? r.roomTypeId === reservation.roomTypeId
        : r.type === reservation.roomType) &&
      r.status === 'Disponible',
  );
  const available = compatible.filter(
    (r) =>
      !hasConflict(r.number, reservation.checkIn, reservation.checkOut, reservation.id) &&
      !isRoomBlocked(r.number, reservation.checkIn, reservation.checkOut),
  );
  const diff = newRoom && currentRoom ? newRoom.rate - currentRoom.rate : 0;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" style={{ width: 440 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">
              {reservation.roomNumber === 'Sin asignar'
                ? 'ASIGNAR HABITACIÓN'
                : 'CAMBIO DE HABITACIÓN'}
            </p>
            <h2>{reservation.code}</h2>
          </div>
          <button className="icon-btn" aria-label="Cerrar" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="rc-room-change-current">
          <span>{reservation.roomNumber === 'Sin asignar' ? 'Tipo reservado:' : 'Actual:'}</span>
          <strong>
            {reservation.roomNumber === 'Sin asignar'
              ? reservation.roomType
              : `Hab. ${reservation.roomNumber} · ${reservation.roomType} · ${money(currentRoom?.rate ?? 0)}/noche`}
          </strong>
        </div>
        {available.length === 0 ? (
          <div className="hk-empty">
            <BedDouble size={22} />
            <p>No hay habitaciones compatibles disponibles</p>
          </div>
        ) : (
          <div className="rc-room-select-list">
            {available.map((r) => (
              <button
                key={r.id}
                className={`rc-room-option ${selected === r.number ? 'selected' : ''}`}
                onClick={() => setSelected(r.number)}
              >
                <div>
                  <strong>Hab. {r.number}</strong>
                  <span>
                    {r.type} · cap. {r.capacity} · {money(r.rate)}/noche
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
        {newRoom && (
          <div className="rc-rate-preview">
            Diferencia de tarifa:{' '}
            {diff === 0 ? (
              'Sin cambio'
            ) : (
              <strong className={diff > 0 ? 'terracotta-text' : 'success-text'}>
                {diff > 0 ? '+' : ''}
                {money(diff)}/noche
              </strong>
            )}
          </div>
        )}
        <div className="modal-foot">
          <button className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button primary"
            disabled={!selected}
            onClick={() => onConfirm(reservation.id, selected)}
          >
            <Check size={16} />
            {reservation.roomNumber === 'Sin asignar' ? 'Asignar habitación' : 'Cambiar habitación'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Block Room ---------- */
export function BlockModal({
  rooms,
  onClose,
  onAdd,
}: {
  rooms: RecRoom[];
  onClose: () => void;
  onAdd: (room: string, start: string, end: string, reason: string, observation: string) => void;
}) {
  const [roomNumber, setRoomNumber] = useState('');
  // Un bloqueo nuevo parte de hoy → mañana en Guatemala (antes: fechas fijas de 2024).
  const [startDate, setStartDate] = useState(() => hotelToday());
  const [endDate, setEndDate] = useState(() => nextCalendarDay(hotelToday()));
  const [reason, setReason] = useState('Mantenimiento');
  const [observation, setObservation] = useState('');
  const [errors, setErrors] = useState<{ room?: string; start?: string; end?: string }>({});
  const today = hotelToday();
  const submit = () => {
    const range = validateDateRange(startDate, endDate, {
      allowSameDay: false,
      endMessage: 'La fecha final debe ser posterior a la inicial.',
    });
    const nextErrors = {
      room: roomNumber ? undefined : 'Selecciona una habitación.',
      start:
        range.start ??
        (startDate < today ? 'La fecha inicial no puede ser anterior a hoy.' : undefined),
      end: range.end,
    };
    setErrors(nextErrors);
    if (nextErrors.room || nextErrors.start || nextErrors.end) return;
    onAdd(roomNumber, startDate, endDate, reason, observation.trim());
  };
  const blockable = rooms.filter((r) => r.status !== 'Ocupada');
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" style={{ width: 420 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">BLOQUEAR HABITACIÓN</p>
            <h2>Bloqueo temporal</h2>
          </div>
          <button className="icon-btn" aria-label="Cerrar" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <label className="rc-field">
          <span>Habitación *</span>
          <select
            className={fieldClass(errors.room)}
            value={roomNumber}
            disabled={blockable.length === 0}
            onChange={(e) => {
              setRoomNumber(e.target.value);
              setErrors((current) => ({ ...current, room: undefined }));
            }}
            aria-required="true"
            {...fieldErrorProps('block-room-error', errors.room)}
          >
            <option value="">
              {blockable.length === 0 ? 'No hay habitaciones para bloquear' : 'Selecciona...'}
            </option>
            {blockable.map((r) => (
              <option key={r.id} value={r.number}>
                Hab. {r.number} · {r.type}
              </option>
            ))}
          </select>
          {errors.room && (
            <small id="block-room-error" className="rc-field-error">
              {errors.room}
            </small>
          )}
        </label>
        <div className="rc-form-grid">
          <label className="rc-field">
            <span>Fecha inicial *</span>
            <input
              type="date"
              min={today}
              className={fieldClass(errors.start)}
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setErrors((current) => ({ ...current, start: undefined, end: undefined }));
              }}
              {...fieldErrorProps('block-start-error', errors.start)}
            />
            {errors.start && (
              <small id="block-start-error" className="rc-field-error">
                {errors.start}
              </small>
            )}
          </label>
          <label className="rc-field">
            <span>Fecha final *</span>
            <input
              type="date"
              min={isCalendarDate(startDate) ? nextCalendarDay(startDate) : today}
              className={fieldClass(errors.end)}
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setErrors((current) => ({ ...current, end: undefined }));
              }}
              {...fieldErrorProps('block-end-error', errors.end)}
            />
            {errors.end && (
              <small id="block-end-error" className="rc-field-error">
                {errors.end}
              </small>
            )}
          </label>
        </div>
        <label className="rc-field">
          <span>Motivo</span>
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option>Mantenimiento</option>
            <option>Reparación</option>
            <option>Limpieza profunda</option>
            <option>Fuera de servicio</option>
            <option>Otro</option>
          </select>
        </label>
        <label className="rc-field">
          <span>Observación</span>
          <input
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            placeholder="Opcional..."
          />
        </label>
        <div className="modal-foot">
          <button className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" onClick={submit}>
            <Check size={16} /> Bloquear habitación
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Invoice ---------- */
export function InvoiceModal({
  reservation,
  folioTotals,
  onClose,
}: {
  reservation: Reservation;
  folioTotals: (f: FolioEntry[]) => Totals;
  onClose: () => void;
}) {
  const t = folioTotals(reservation.folio);
  const nights = Math.max(
    1,
    Math.round(
      (new Date(reservation.checkOut).getTime() - new Date(reservation.checkIn).getTime()) /
        86400000,
    ),
  );
  const fmt = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal rc-invoice-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">COMPROBANTE DE ESTADÍA</p>
            <h2>Hotel Aurora</h2>
          </div>
          <div className="rc-invoice-actions">
            <button className="button small secondary" onClick={() => window.print()}>
              <Printer size={14} /> Imprimir
            </button>
            <button className="icon-btn" aria-label="Cerrar" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="rc-invoice">
          <div className="rc-invoice-head">
            <div>
              <strong>HOTEL AURORA</strong>
              <small>Av. Reforma 123, Centro · +52 55 1000 2000</small>
              <small>reservaciones@aurorahotel.com</small>
            </div>
            <div>
              <strong className="rc-invoice-code">{reservation.code}</strong>
              <small>Fecha: {new Date().toLocaleDateString('es-MX')}</small>
            </div>
          </div>
          <div className="rc-invoice-guest">
            <div>
              <small>Huésped</small>
              <strong>
                {reservation.guest.name} {reservation.guest.lastName}
              </strong>
              <span>
                {reservation.guest.docType}: {reservation.guest.docNumber}
              </span>
            </div>
            <div>
              <small>Habitación</small>
              <strong>
                {reservation.roomNumber} · {reservation.roomType}
              </strong>
            </div>
          </div>
          <div className="rc-invoice-dates">
            <div>
              <small>Check-in</small>
              <span>
                {fmt(reservation.checkIn)} {reservation.checkInTime}
              </span>
            </div>
            <div>
              <small>Check-out</small>
              <span>
                {fmt(reservation.checkOut)} {reservation.checkOutTime}
              </span>
            </div>
            <div>
              <small>Noches</small>
              <span>{nights}</span>
            </div>
          </div>
          <table className="rc-invoice-table">
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Categoría</th>
                <th>Fecha</th>
                <th className="rc-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {reservation.folio
                .filter((f) => f.status === 'Activo')
                .map((f) => (
                  <tr key={f.id}>
                    <td>{f.concept}</td>
                    <td>{f.category}</td>
                    <td>{f.date}</td>
                    <td className="rc-right">
                      {f.type === 'Cargo' ? money(f.amount) : `−${money(f.amount)}`}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <div className="rc-invoice-totals">
            <div>
              <span>Total cargos</span>
              <strong>{money(t.charges)}</strong>
            </div>
            <div>
              <span>Pagos aplicados</span>
              <strong>−{money(t.payments)}</strong>
            </div>
            <div>
              <span>Depósitos</span>
              <strong>−{money(t.deposits)}</strong>
            </div>
            <div className="rc-invoice-final">
              <span>Saldo final</span>
              <strong>{money(t.balance)}</strong>
            </div>
          </div>
          <p className="rc-invoice-thanks">
            Gracias por su estancia en Hotel Aurora. ¡Esperamos verle pronto!
          </p>
        </div>
      </div>
    </div>
  );
}
