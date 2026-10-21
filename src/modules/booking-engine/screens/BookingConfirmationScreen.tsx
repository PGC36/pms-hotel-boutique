import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import type { PublicBookingConfirmation } from '@/services/publicBookingCatalogService';
import { EmptyState } from '@/shared/components/EmptyState';
import { formatCurrency } from '@/shared/utils/currency';
import { calculateNights, formatDateGT } from '@/shared/utils/date';
import './booking-engine.css';

type BookingConfirmationLocationState = {
  publicBookingConfirmation?: PublicBookingConfirmation;
};

function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function BookingConfirmationScreen() {
  const [reservationDetailsOpen, setReservationDetailsOpen] = useState(false);
  const { bookingId } = useParams<'bookingId'>();
  const location = useLocation();
  const { publicBookingConfirmation } =
    (location.state as BookingConfirmationLocationState | null) ?? {};

  if (!publicBookingConfirmation || publicBookingConfirmation.confirmationCode !== bookingId) {
    return (
      <section className="content booking-confirmation-page">
        <EmptyState
          title="Confirmacion no disponible"
          description="La reserva fue creada desde el flujo publico. Por seguridad, abre esta pantalla al finalizar una reserva nueva."
          action={
            <Link className="ui-action" to="/">
              Buscar disponibilidad
            </Link>
          }
        />
      </section>
    );
  }

  const booking = publicBookingConfirmation;
  const checkIn = parseDate(booking.checkIn);
  const checkOut = parseDate(booking.checkOut);
  const nights = booking.nights || calculateNights(checkIn, checkOut);
  const guestName = `${booking.guestFirstName} ${booking.guestLastName}`;
  // El backend crea toda reserva pública como pending; confirmarla le toca al hotel.
  const statusLabel =
    booking.status === 'pending' ? 'Pendiente de confirmación por el hotel' : 'Reserva registrada';

  return (
    <section className="content booking-confirmation-page">
      <div className="booking-confirmation-heading">
        <div>
          <p className="eyebrow">{statusLabel}</p>
          <h1>Reserva registrada</h1>
          <p>Tu reservación quedó registrada. El hotel la revisará y la confirmará.</p>
        </div>
        <Link className="ui-action" to="/">
          Nueva búsqueda
        </Link>
      </div>

      <div className="booking-confirmation-layout">
        <article className="booking-confirmation-card">
          <h2>Código de confirmación</h2>
          <div className="booking-confirmation-code">{booking.confirmationCode}</div>
          <p className="booking-muted">
            Guarda este código para identificar tu reserva cuando contactes al hotel.
          </p>

          <div className="booking-reservation-summary">
            <div>
              <span>Habitación</span>
              <strong>{booking.roomTypeName}</strong>
            </div>
            <div>
              <span>Estancia</span>
              <strong>
                {formatDateGT(checkIn)} - {formatDateGT(checkOut)}
              </strong>
            </div>
            <div>
              <span>Huésped</span>
              <strong>{guestName}</strong>
            </div>
            <div>
              <span>Total estimado</span>
              <strong>{formatCurrency(booking.totalAmountCents, booking.currency)}</strong>
            </div>
          </div>
        </article>

        <aside className="booking-confirmation-card">
          <h2>Tu reserva</h2>
          <p className="booking-muted">
            Consulta las fechas, huéspedes, tarifa y estado de tu reservación.
          </p>
          <div className="booking-form-actions">
            <button
              className="ui-action"
              type="button"
              aria-expanded={reservationDetailsOpen}
              aria-controls="booking-reservation-details"
              onClick={() => setReservationDetailsOpen((open) => !open)}
            >
              {reservationDetailsOpen ? 'Ocultar detalles' : 'Ver mi reserva'}
            </button>
          </div>
          {reservationDetailsOpen && (
            <section
              id="booking-reservation-details"
              className="booking-reservation-details"
              aria-labelledby="booking-reservation-details-title"
            >
              <h3 id="booking-reservation-details-title">Detalle de tu reserva</h3>
              <div className="booking-confirmation-code">{booking.confirmationCode}</div>
              <p className="booking-reservation-status">{statusLabel}</p>
              <div className="booking-reservation-detail-grid">
                <div>
                  <span>Tipo de habitación</span>
                  <strong>{booking.roomTypeName}</strong>
                </div>
                <div>
                  <span>Huésped</span>
                  <strong>{guestName}</strong>
                </div>
                <div>
                  <span>Correo</span>
                  <strong>{booking.guestEmail}</strong>
                </div>
                <div>
                  <span>Entrada</span>
                  <strong>{formatDateGT(checkIn)}</strong>
                </div>
                <div>
                  <span>Salida</span>
                  <strong>{formatDateGT(checkOut)}</strong>
                </div>
                <div>
                  <span>Noches</span>
                  <strong>{nights}</strong>
                </div>
                <div>
                  <span>Huéspedes</span>
                  <strong>
                    {booking.adults} adultos
                    {booking.children > 0 ? `, ${booking.children} niños` : ''}
                  </strong>
                </div>
                <div>
                  <span>Tarifa</span>
                  <strong>{booking.rateName}</strong>
                </div>
                <div>
                  <span>Total estimado</span>
                  <strong>{formatCurrency(booking.totalAmountCents, booking.currency)}</strong>
                </div>
              </div>
            </section>
          )}
        </aside>
      </div>
    </section>
  );
}
