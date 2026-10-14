import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { routePaths } from '@/app/routes';
import { bookingService } from '@/services/bookingService';
import { guestAccountService } from '@/services/guestAccountService';
import { guestService } from '@/services/guestService';
import { roomService } from '@/services/roomService';
import { Badge, type BadgeTone } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { DataTable, type DataTableColumn } from '@/shared/components/DataTable';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { LoadingState } from '@/shared/components/LoadingState';
import type { Booking } from '@/shared/types/entities/booking';
import type { Guest } from '@/shared/types/entities/guest';
import type { GuestAccount } from '@/shared/types/entities/guest-account';
import type { RoomType } from '@/shared/types/entities/room-type';
import { isSameCalendarDay } from '@/shared/utils/date';
import './front-desk.css';

type ScreenState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      bookings: Booking[];
      guests: Guest[];
      roomTypes: RoomType[];
      accounts: GuestAccount[];
    };

type TodayRow = {
  booking: Booking;
  guestName: string;
  roomTypeName: string;
  isArrivalToday: boolean;
  isDepartureToday: boolean;
  accountId?: string;
};

const BOOKING_STATUS_LABELS: Record<Booking['status'], string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  checkedIn: 'Hospedaje activo',
  checkedOut: 'Check-out realizado',
  cancelled: 'Cancelada',
  noShow: 'No-show',
};

const BOOKING_STATUS_TONES: Record<Booking['status'], BadgeTone> = {
  pending: 'warning',
  confirmed: 'info',
  checkedIn: 'success',
  checkedOut: 'neutral',
  cancelled: 'danger',
  noShow: 'danger',
};

function getErrorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Error inesperado.';
}

export function ReceptionScreen() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<ScreenState>({ status: 'loading' });

  const loadData = useCallback(async () => {
    setScreen({ status: 'loading' });
    try {
      const [bookings, guests, roomTypes, accounts] = await Promise.all([
        bookingService.getBookings(),
        guestService.getGuests(),
        roomService.getRoomTypes(),
        guestAccountService.getAccounts(),
      ]);
      setScreen({ status: 'ready', bookings, guests, roomTypes, accounts });
    } catch (cause) {
      setScreen({ status: 'error', message: getErrorMessage(cause) });
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const today = useMemo(() => new Date(), []);

  const rows = useMemo<TodayRow[]>(() => {
    if (screen.status !== 'ready') return [];

    const guestNameById = new Map(
      screen.guests.map((guest) => [guest.id, `${guest.firstName} ${guest.lastName}`]),
    );
    const roomTypeNameById = new Map(
      screen.roomTypes.map((roomType) => [roomType.id, roomType.name]),
    );
    const accountIdByBookingId = new Map(
      screen.accounts.map((account) => [account.bookingId, account.id]),
    );

    return screen.bookings
      .filter((booking) => booking.status !== 'cancelled' && booking.status !== 'noShow')
      .filter(
        (booking) =>
          isSameCalendarDay(booking.checkIn, today) || isSameCalendarDay(booking.checkOut, today),
      )
      .map((booking) => ({
        booking,
        guestName: guestNameById.get(booking.guestId) ?? booking.guestId,
        roomTypeName: roomTypeNameById.get(booking.roomTypeId) ?? booking.roomTypeId,
        isArrivalToday: isSameCalendarDay(booking.checkIn, today),
        isDepartureToday: isSameCalendarDay(booking.checkOut, today),
        accountId: accountIdByBookingId.get(booking.id),
      }))
      .sort((left, right) => left.guestName.localeCompare(right.guestName, 'es'));
  }, [screen, today]);

  const columns: DataTableColumn<TodayRow>[] = [
    {
      id: 'guest',
      header: 'Huésped',
      cell: (row) => row.guestName,
      sortValue: (row) => row.guestName,
    },
    {
      id: 'roomType',
      header: 'Tipo de habitación',
      cell: (row) => row.roomTypeName,
    },
    {
      id: 'movement',
      header: 'Movimiento',
      cell: (row) => (
        <span className="front-desk-cell-actions">
          {row.isArrivalToday && <Badge tone="info">Llegada</Badge>}
          {row.isDepartureToday && <Badge tone="warning">Salida</Badge>}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Estado',
      cell: (row) => (
        <Badge tone={BOOKING_STATUS_TONES[row.booking.status]}>
          {BOOKING_STATUS_LABELS[row.booking.status]}
        </Badge>
      ),
      sortValue: (row) => row.booking.status,
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: (row) => {
        const { booking, accountId, isDepartureToday } = row;
        const actions: ReactNode[] = [
          <Button
            key="detail"
            size="sm"
            variant="secondary"
            onClick={() => navigate(routePaths.pms.bookingDetail.replace(':bookingId', booking.id))}
          >
            Ver reserva
          </Button>,
        ];

        if (booking.status === 'confirmed') {
          actions.push(
            <Button
              key="checkin"
              size="sm"
              onClick={() => navigate(routePaths.pms.checkIn.replace(':bookingId', booking.id))}
            >
              Check-in
            </Button>,
          );
        }

        if (booking.status === 'checkedIn' && accountId) {
          actions.push(
            <Button
              key="account"
              size="sm"
              onClick={() => navigate(routePaths.pms.guestAccount.replace(':accountId', accountId))}
            >
              Ver cuenta
            </Button>,
          );
          if (isDepartureToday) {
            actions.push(
              <Button
                key="checkout"
                size="sm"
                onClick={() => navigate(routePaths.pms.checkOut.replace(':bookingId', booking.id))}
              >
                Check-out
              </Button>,
            );
          }
        }

        return <div className="front-desk-cell-actions">{actions}</div>;
      },
    },
  ];

  if (screen.status === 'loading') {
    return (
      <section className="content">
        <LoadingState label="Cargando recepción..." />
      </section>
    );
  }

  if (screen.status === 'error') {
    return (
      <section className="content">
        <ErrorState
          title="No pudimos cargar recepción"
          description={screen.message}
          onRetry={loadData}
        />
      </section>
    );
  }

  return (
    <section className="content" aria-labelledby="reception-title">
      <div className="front-desk-header">
        <div>
          <p className="eyebrow">Front Desk</p>
          <h1 id="reception-title">Recepción</h1>
          <p className="muted">Reservas con llegada o salida hoy.</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Sin movimiento hoy"
          description="No hay llegadas ni salidas previstas para hoy."
        />
      ) : (
        <DataTable
          caption="Reservas del día"
          columns={columns}
          data={rows}
          getRowId={(row) => row.booking.id}
          pageSize={10}
        />
      )}
    </section>
  );
}
