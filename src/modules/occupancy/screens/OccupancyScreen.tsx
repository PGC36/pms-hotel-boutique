import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { routePaths } from '@/app/routes';
import { Badge, type BadgeTone } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { DataTable, type DataTableColumn } from '@/shared/components/DataTable';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { Input } from '@/shared/components/Input';
import { LoadingState } from '@/shared/components/LoadingState';
import { bookingService } from '@/services/bookingService';
import { guestAccountService } from '@/services/guestAccountService';
import { roomService } from '@/services/roomService';
import type { Booking } from '@/shared/types/entities/booking';
import type { GuestAccount } from '@/shared/types/entities/guest-account';
import type { Room } from '@/shared/types/entities/room';
import type { RoomType } from '@/shared/types/entities/room-type';
import { toDomainCalendarDate, toDtoCalendarDate } from '@/shared/types/common';
import { formatDateGT, formatStayRange } from '@/shared/utils/date';
import './occupancy.css';

type ScreenState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      rooms: Room[];
      bookings: Booking[];
      roomTypes: RoomType[];
      accounts: GuestAccount[];
    };

type OccupancyRow = {
  room: Room;
  roomTypeName: string;
  booking?: Booking;
  accountId?: string;
};

const ROOM_STATUS_LABELS: Record<Room['status'], string> = {
  available: 'Libre',
  occupied: 'Ocupada',
  maintenance: 'Mantenimiento',
  outOfService: 'Fuera de servicio',
};

const HOUSEKEEPING_STATUS_LABELS: Record<Room['housekeepingStatus'], string> = {
  dirty: 'Sucia',
  cleaning: 'En limpieza',
  clean: 'Limpia',
  inspected: 'Inspeccionada',
};

const ROOM_STATUS_TONES: Record<Room['status'], BadgeTone> = {
  available: 'success',
  occupied: 'info',
  maintenance: 'warning',
  outOfService: 'danger',
};

const HOUSEKEEPING_STATUS_TONES: Record<Room['housekeepingStatus'], BadgeTone> = {
  dirty: 'warning',
  cleaning: 'info',
  clean: 'success',
  inspected: 'success',
};

function isBookingActiveOn(booking: Booking, selectedDate: string): boolean {
  if (booking.status === 'cancelled' || booking.status === 'noShow') return false;
  return (
    toDtoCalendarDate(booking.checkIn) <= selectedDate &&
    selectedDate < toDtoCalendarDate(booking.checkOut)
  );
}

function getErrorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Error inesperado.';
}

export function OccupancyScreen() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(() => toDtoCalendarDate(new Date()));
  const [screen, setScreen] = useState<ScreenState>({ status: 'loading' });

  const loadData = useCallback(async () => {
    setScreen({ status: 'loading' });
    try {
      const [rooms, bookings, roomTypes, accounts] = await Promise.all([
        roomService.getRooms(),
        bookingService.getBookings(),
        roomService.getRoomTypes(),
        guestAccountService.getAccounts(),
      ]);
      setScreen({ status: 'ready', rooms, bookings, roomTypes, accounts });
    } catch (cause) {
      setScreen({ status: 'error', message: getErrorMessage(cause) });
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const view = useMemo(() => {
    if (screen.status !== 'ready') return null;
    const roomTypeById = new Map(screen.roomTypes.map((roomType) => [roomType.id, roomType]));
    const accountIdByBookingId = new Map(
      screen.accounts.map((account) => [account.bookingId, account.id]),
    );
    const activeBookings = screen.bookings.filter((booking) =>
      isBookingActiveOn(booking, selectedDate),
    );
    const bookingByRoomId = new Map(
      activeBookings
        .filter((booking): booking is Booking & { roomId: string } => Boolean(booking.roomId))
        .map((booking) => [booking.roomId, booking]),
    );

    const rows = screen.rooms
      .map((room) => {
        const booking = bookingByRoomId.get(room.id);
        return {
          room,
          roomTypeName: roomTypeById.get(room.roomTypeId)?.name ?? room.roomTypeId,
          booking,
          accountId: booking ? accountIdByBookingId.get(booking.id) : undefined,
        };
      })
      .sort((left, right) =>
        left.room.roomNumber.localeCompare(right.room.roomNumber, 'es', { numeric: true }),
      );

    return {
      rows,
      unassignedBookings: activeBookings.filter((booking) => !booking.roomId),
      roomTypeById,
    };
  }, [screen, selectedDate]);

  const columns: DataTableColumn<OccupancyRow>[] = [
    {
      id: 'room',
      header: 'Habitación',
      cell: ({ room }) => room.roomNumber,
      sortValue: ({ room }) => room.roomNumber,
    },
    {
      id: 'roomType',
      header: 'Tipo',
      cell: ({ roomTypeName }) => roomTypeName,
      sortValue: ({ roomTypeName }) => roomTypeName,
    },
    {
      id: 'dateAvailability',
      header: 'Disponibilidad en fecha',
      cell: ({ booking }) => (
        <Badge tone={booking ? 'info' : 'success'}>{booking ? 'Ocupada' : 'Libre'}</Badge>
      ),
      sortValue: ({ booking }) => (booking ? 1 : 0),
    },
    {
      id: 'roomStatus',
      header: 'Estado habitación',
      cell: ({ room }) => (
        <Badge tone={ROOM_STATUS_TONES[room.status]}>{ROOM_STATUS_LABELS[room.status]}</Badge>
      ),
      sortValue: ({ room }) => room.status,
    },
    {
      id: 'housekeeping',
      header: 'Limpieza',
      cell: ({ room }) => (
        <Badge tone={HOUSEKEEPING_STATUS_TONES[room.housekeepingStatus]}>
          {HOUSEKEEPING_STATUS_LABELS[room.housekeepingStatus]}
        </Badge>
      ),
      sortValue: ({ room }) => room.housekeepingStatus,
    },
    {
      id: 'booking',
      header: 'Reserva en fecha',
      cell: ({ booking }) =>
        booking ? (
          <span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                navigate(routePaths.pms.bookingDetail.replace(':bookingId', booking.id))
              }
            >
              {booking.confirmationCode}
            </Button>{' '}
            · {formatStayRange(booking.checkIn, booking.checkOut)}
          </span>
        ) : (
          <span className="occupancy-muted">Sin reserva asignada</span>
        ),
      sortValue: ({ booking }) => booking?.confirmationCode,
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ booking, accountId }) => {
        if (booking?.status === 'confirmed') {
          return (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate(routePaths.pms.checkIn.replace(':bookingId', booking.id))}
            >
              Iniciar check-in
            </Button>
          );
        }
        if (booking?.status === 'checkedIn' && accountId) {
          return (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate(routePaths.pms.guestAccount.replace(':accountId', accountId))}
            >
              Ver cuenta
            </Button>
          );
        }
        return <span className="occupancy-muted">—</span>;
      },
    },
  ];

  return (
    <section className="content">
      <div className="occupancy-header">
        <div>
          <h1>Ocupación</h1>
          <p className="occupancy-muted">Vista por habitación para una fecha seleccionada.</p>
        </div>
        <div className="occupancy-header-actions">
          <Input
            label="Fecha"
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
          <Button onClick={() => navigate(routePaths.pms.manualBookingNew)}>Nueva reserva</Button>
        </div>
      </div>

      {screen.status === 'loading' && <LoadingState label="Cargando ocupación..." />}

      {screen.status === 'error' && (
        <ErrorState
          title="No pudimos cargar la ocupación"
          description={screen.message}
          onRetry={loadData}
        />
      )}

      {screen.status === 'ready' && view && (
        <>
          {view.rows.length ? (
            <DataTable
              caption={`Ocupación del ${formatDateGT(toDomainCalendarDate(selectedDate))}`}
              columns={columns}
              data={view.rows}
              getRowId={(row) => row.room.id}
              pageSize={10}
            />
          ) : (
            <EmptyState
              title="Sin habitaciones"
              description="No hay habitaciones registradas para mostrar."
            />
          )}

          {view.unassignedBookings.length > 0 && (
            <section className="occupancy-panel" aria-labelledby="unassigned-bookings-title">
              <h2 id="unassigned-bookings-title">Reservas sin habitación asignada</h2>
              <ul className="occupancy-list">
                {view.unassignedBookings.map((booking) => (
                  <li key={booking.id}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        navigate(routePaths.pms.bookingDetail.replace(':bookingId', booking.id))
                      }
                    >
                      {booking.confirmationCode}
                    </Button>
                    <span>
                      {view.roomTypeById.get(booking.roomTypeId)?.name ?? booking.roomTypeId}
                    </span>
                    <span>{formatStayRange(booking.checkIn, booking.checkOut)}</span>
                    {booking.status === 'confirmed' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          navigate(routePaths.pms.checkIn.replace(':bookingId', booking.id))
                        }
                      >
                        Iniciar check-in
                      </Button>
                    ) : (
                      <span className="occupancy-muted">—</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </section>
  );
}
