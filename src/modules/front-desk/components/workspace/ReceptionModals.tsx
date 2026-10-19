/* eslint-disable @typescript-eslint/no-unused-vars -- Migracion controlada del prototipo Bolt; se conserva la logica original para portarla incrementalmente. */
import { useEffect, useState } from 'react';
import { Ban, BedDouble, Check, Printer, TriangleAlert, X } from 'lucide-react';
import type {
  Companion,
  FolioEntry,
  GuestInfo,
  PaymentMethod,
  RecRoom,
  Reservation,
} from '@/private/workspace/PrivateWorkspace';
import { bookingService } from '@/services/bookingService';
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

const money = (n: number) => `$${n.toLocaleString('es-MX')}`;
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
            <button className="icon-btn" onClick={onClose}>
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
          <button className="icon-btn" onClick={onClose}>
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
  ) => void;
}) {
  const [docType, setDocType] = useState(reservation.guest.docType || 'INE');
  const [docNumber, setDocNumber] = useState(reservation.guest.docNumber || '');
  const [birthDate, setBirthDate] = useState(reservation.guest.birthDate || '');
  const [nationality, setNationality] = useState(reservation.guest.nationality || 'Mexicana');
  const [companions, setCompanions] = useState<Companion[]>(reservation.companions);
  const [compName, setCompName] = useState('');
  const [compDoc, setCompDoc] = useState('');
  const [compAge, setCompAge] = useState('');
  const [error, setError] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');

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
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(
    new Date(),
  );

  const addCompanion = () => {
    if (!compName.trim()) return;
    setCompanions((c) => [
      ...c,
      {
        id: Date.now() + c.length,
        name: compName.split(' ')[0],
        lastName: compName.split(' ')[1] ?? '',
        document: compDoc,
        age: Number(compAge) || 0,
      },
    ]);
    setCompName('');
    setCompDoc('');
    setCompAge('');
  };
  const removeCompanion = (id: number) => setCompanions((c) => c.filter((x) => x.id !== id));

  const submit = () => {
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
    if (!docNumber.trim()) {
      setError('El número de documento es obligatorio');
      return;
    }
    if (capacityExceeded) {
      setError(`Excede la capacidad de la habitación (${room?.capacity})`);
      return;
    }
    onCheckin(
      reservation.id,
      { docType, docNumber, birthDate, nationality },
      companions,
      reservation,
      assignedRoom ? undefined : room?.backendRoomId,
    );
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" style={{ width: 460 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">CHECK-IN</p>
            <h2>
              {reservation.code} · Hab. {reservation.roomNumber}
            </h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="login-helper">
          Huésped: {reservation.guest.name} {reservation.guest.lastName}
        </p>
        <div className="rc-form-grid">
          <label className="rc-field">
            <span>Tipo de documento</span>
            <select value={docType} onChange={(e) => setDocType(e.target.value)}>
              <option>INE</option>
              <option>Pasaporte</option>
              <option>Licencia</option>
            </select>
          </label>
          <label className="rc-field">
            <span>Número de documento</span>
            <input
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              placeholder="Número..."
            />
          </label>
          <label className="rc-field">
            <span>Fecha de nacimiento</span>
            <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
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
        <div className="rc-comp-add">
          <input
            placeholder="Nombre y apellido"
            value={compName}
            onChange={(e) => setCompName(e.target.value)}
          />
          <input
            placeholder="Documento"
            value={compDoc}
            onChange={(e) => setCompDoc(e.target.value)}
          />
          <input
            placeholder="Edad"
            type="number"
            className="rc-input-narrow"
            value={compAge}
            onChange={(e) => setCompAge(e.target.value)}
          />
          <button className="button small secondary" onClick={addCompanion}>
            <Check size={14} />
          </button>
        </div>
        {companions.length > 0 && (
          <div className="rc-comp-list">
            {companions.map((c) => (
              <div className="rc-comp-item" key={c.id}>
                <span>
                  {c.name} {c.lastName} · {c.document} · {c.age} años
                </span>
                <button onClick={() => removeCompanion(c.id)}>
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
        {error && <small className="rc-field-error">{error}</small>}

        <div className="modal-foot">
          <button className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" onClick={submit}>
            <Check size={16} /> Confirmar check-in
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
  onCheckout: (id: number) => void;
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
          <button className="icon-btn" onClick={onClose}>
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
        <div className="modal-foot">
          <button className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" onClick={() => onCheckout(reservation.id)}>
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
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" style={{ width: 400 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">{title}</p>
            <h2>{label}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="login-helper">
          Esta acción no se puede deshacer. El registro se conservará para auditoría.
        </p>
        <label className="rc-field">
          <span>Motivo</span>
          <textarea
            className="rc-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Indica el motivo..."
          />
        </label>
        <div className="modal-foot">
          <button className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className={`button ${tone === 'terracotta' ? 'terracotta-btn' : 'primary'}`}
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            <Ban size={16} /> Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Add Charge ---------- */
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
  const [error, setError] = useState('');
  const submit = () => {
    const amt = Number(amount);
    if (!concept.trim()) {
      setError('El concepto es obligatorio');
      return;
    }
    if (!amt || amt <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
    }
    onAdd(concept.trim(), category, amt, observation);
  };
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" style={{ width: 400 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">AGREGAR CARGO</p>
            <h2>Nuevo cargo</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <label className="rc-field">
          <span>Concepto</span>
          <input
            className="rc-input"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="Ej. Room service — Almuerzo"
          />
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
          <span>Monto</span>
          <input
            className="rc-input"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
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
        {error && <small className="rc-field-error">{error}</small>}
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
  onSubmit: (amount: number, method: PaymentMethod, reference: string) => void;
  isDeposit?: boolean;
}) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('Efectivo');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
    }
    onSubmit(amt, method, reference);
  };
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" style={{ width: 400 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">{title}</p>
            <h2>{isDeposit ? 'Registrar depósito' : 'Registrar pago'}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <label className="rc-field">
          <span>Monto</span>
          <input
            className="rc-input"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </label>
        <label className="rc-field">
          <span>Método</span>
          <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            <option>Efectivo</option>
            <option>Tarjeta</option>
            <option>Transferencia</option>
          </select>
        </label>
        <label className="rc-field">
          <span>Referencia (opcional)</span>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Ej. TXN-1234"
          />
        </label>
        {error && <small className="rc-field-error">{error}</small>}
        <div className="modal-foot">
          <button className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" onClick={submit}>
            <Check size={16} /> Confirmar
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
          <button className="icon-btn" onClick={onClose}>
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
  const [startDate, setStartDate] = useState('2024-08-31');
  const [endDate, setEndDate] = useState('2024-09-02');
  const [reason, setReason] = useState('Mantenimiento');
  const [observation, setObservation] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    if (!roomNumber) {
      setError('Selecciona una habitación');
      return;
    }
    if (new Date(endDate) <= new Date(startDate)) {
      setError('La fecha final debe ser posterior');
      return;
    }
    onAdd(roomNumber, startDate, endDate, reason, observation);
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
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <label className="rc-field">
          <span>Habitación</span>
          <select value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)}>
            <option value="">Selecciona...</option>
            {blockable.map((r) => (
              <option key={r.id} value={r.number}>
                Hab. {r.number} · {r.type}
              </option>
            ))}
          </select>
        </label>
        <div className="rc-form-grid">
          <label className="rc-field">
            <span>Fecha inicial</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="rc-field">
            <span>Fecha final</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
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
        {error && <small className="rc-field-error">{error}</small>}
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
            <button className="icon-btn" onClick={onClose}>
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
