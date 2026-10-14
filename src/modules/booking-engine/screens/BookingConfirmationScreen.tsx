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
  const roomDetailsParams = new URLSearchParams({
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    adults: String(booking.adults),
    children: String(booking.children),
  });
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
            Conserva este código para consultar tu reserva en recepción.
          </p>

          <div className="booking-rate-summary">
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
              <span>Habitacion</span>
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
              <span>Tarifa</span>
              <strong>{booking.rateName}</strong>
            </div>
            <div>
              <span>Estado</span>
              <strong>{statusLabel}</strong>
            </div>
            <div>
              <span>Monto</span>
              <strong>{formatCurrency(booking.totalAmountCents, booking.currency)}</strong>
            </div>
          </div>
        </article>

        <aside className="booking-confirmation-card">
          <h2>Siguiente paso</h2>
          <p className="booking-muted">
            Conserva tu código de confirmación. El hotel confirmará la reserva; el envío por correo
            queda fuera de alcance.
          </p>
          <div className="booking-form-actions">
            <Link
              className="ui-action"
              to={`/rooms/${booking.roomTypeId}?${roomDetailsParams.toString()}`}
            >
              Ver habitación
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
