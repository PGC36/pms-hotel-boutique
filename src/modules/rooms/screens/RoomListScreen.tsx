import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { routePaths } from '@/app/routes';
import { Badge, type BadgeTone } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { DataTable, type DataTableColumn } from '@/shared/components/DataTable';
import { ErrorState } from '@/shared/components/ErrorState';
import { LoadingState } from '@/shared/components/LoadingState';
import { Select } from '@/shared/components/Select';
import { roomService } from '@/services/roomService';
import { ROOM_STATUSES } from '@/shared/constants/statuses';
import type { Room } from '@/shared/types/entities/room';
import type { RoomType } from '@/shared/types/entities/room-type';
import './rooms.css';

type ScreenState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; rooms: Room[]; roomTypes: RoomType[] };

type RoomRow = { room: Room; roomTypeName: string };

const ROOM_STATUS_LABELS: Record<Room['status'], string> = {
  available: 'Libre',
  occupied: 'Ocupada',
  maintenance: 'Mantenimiento',
  outOfService: 'Fuera de servicio',
};

const ROOM_STATUS_TONES: Record<Room['status'], BadgeTone> = {
  available: 'success',
  occupied: 'info',
  maintenance: 'warning',
  outOfService: 'danger',
};

const HOUSEKEEPING_STATUS_LABELS: Record<Room['housekeepingStatus'], string> = {
  dirty: 'Sucia',
  cleaning: 'En limpieza',
  clean: 'Limpia',
  inspected: 'Inspeccionada',
};

const HOUSEKEEPING_STATUS_TONES: Record<Room['housekeepingStatus'], BadgeTone> = {
  dirty: 'warning',
  cleaning: 'info',
  clean: 'success',
  inspected: 'success',
};

function getErrorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Error inesperado.';
}

export function RoomListScreen() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<ScreenState>({ status: 'loading' });
  const [statusFilter, setStatusFilter] = useState<Room['status'] | ''>('');
  const [roomTypeFilter, setRoomTypeFilter] = useState('');

  const loadData = useCallback(async () => {
    setScreen({ status: 'loading' });
    try {
      const [rooms, roomTypes] = await Promise.all([
        roomService.getRooms(),
        roomService.getRoomTypes(),
      ]);
      setScreen({ status: 'ready', rooms, roomTypes });
    } catch (cause) {
      setScreen({ status: 'error', message: getErrorMessage(cause) });
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const rows = useMemo<RoomRow[]>(() => {
    if (screen.status !== 'ready') return [];
    const roomTypeById = new Map(screen.roomTypes.map((roomType) => [roomType.id, roomType]));
    return screen.rooms
      .filter((room) => !statusFilter || room.status === statusFilter)
      .filter((room) => !roomTypeFilter || room.roomTypeId === roomTypeFilter)
      .map((room) => ({
        room,
        roomTypeName: roomTypeById.get(room.roomTypeId)?.name ?? room.roomTypeId,
      }))
      .sort((left, right) =>
        left.room.roomNumber.localeCompare(right.room.roomNumber, 'es', { numeric: true }),
      );
  }, [screen, statusFilter, roomTypeFilter]);

  const columns: DataTableColumn<RoomRow>[] = [
    {
      id: 'roomNumber',
      header: 'Habitación',
      cell: ({ room }) => room.roomNumber,
      sortValue: ({ room }) => room.roomNumber,
    },
    {
      id: 'floor',
      header: 'Piso',
      cell: ({ room }) => room.floor,
      sortValue: ({ room }) => room.floor,
    },
    {
      id: 'roomType',
      header: 'Tipo',
      cell: ({ roomTypeName }) => roomTypeName,
      sortValue: ({ roomTypeName }) => roomTypeName,
    },
    {
      id: 'status',
      header: 'Estado',
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
      id: 'assignable',
      header: 'Asignable',
      cell: ({ room }) => (
        <Badge tone={room.isAssignable ? 'success' : 'neutral'}>
          {room.isAssignable ? 'Sí' : 'No'}
        </Badge>
      ),
      sortValue: ({ room }) => (room.isAssignable ? 1 : 0),
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ room }) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => navigate(routePaths.pms.roomEdit.replace(':roomId', room.id))}
        >
          Editar
        </Button>
      ),
    },
  ];

  return (
    <section className="content">
      <div className="rooms-header">
        <div>
          <h1>Habitaciones</h1>
          <p className="rooms-muted">Inventario de habitaciones del hotel.</p>
        </div>
        <Button onClick={() => navigate(routePaths.pms.roomNew)}>Nueva habitación</Button>
      </div>

      {screen.status === 'loading' && <LoadingState label="Cargando habitaciones..." />}

      {screen.status === 'error' && (
        <ErrorState
          title="No pudimos cargar las habitaciones"
          description={screen.message}
          onRetry={loadData}
        />
      )}

      {screen.status === 'ready' && (
        <>
          <div className="rooms-filters">
            <Select
              label="Estado"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as Room['status'] | '')}
            >
              <option value="">Todos los estados</option>
              {ROOM_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {ROOM_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
            <Select
              label="Tipo de habitación"
              value={roomTypeFilter}
              onChange={(event) => setRoomTypeFilter(event.target.value)}
            >
              <option value="">Todos los tipos</option>
              {screen.roomTypes.map((roomType) => (
                <option key={roomType.id} value={roomType.id}>
                  {roomType.name}
                </option>
              ))}
            </Select>
          </div>

          <DataTable
            caption="Habitaciones"
            columns={columns}
            data={rows}
            getRowId={(row) => row.room.id}
            pageSize={10}
            emptyMessage="No hay habitaciones que coincidan con los filtros seleccionados."
          />
        </>
      )}
    </section>
  );
}
