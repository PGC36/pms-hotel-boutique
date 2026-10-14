import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { routePaths } from '@/app/routes';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { DataTable, type DataTableColumn } from '@/shared/components/DataTable';
import { ErrorState } from '@/shared/components/ErrorState';
import { LoadingState } from '@/shared/components/LoadingState';
import { roomService } from '@/services/roomService';
import type { RoomFeature } from '@/shared/types/entities/room-feature';
import type { RoomType } from '@/shared/types/entities/room-type';
import './rooms.css';

type ScreenState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; roomTypes: RoomType[]; roomFeatures: RoomFeature[] };

type RoomTypeRow = { roomType: RoomType; featureNames: string };

function getErrorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Error inesperado.';
}

export function RoomTypeListScreen() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<ScreenState>({ status: 'loading' });

  const loadData = useCallback(async () => {
    setScreen({ status: 'loading' });
    try {
      const [roomTypes, roomFeatures] = await Promise.all([
        roomService.getRoomTypes(),
        roomService.getRoomFeatures(),
      ]);
      setScreen({ status: 'ready', roomTypes, roomFeatures });
    } catch (cause) {
      setScreen({ status: 'error', message: getErrorMessage(cause) });
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const rows = useMemo<RoomTypeRow[]>(() => {
    if (screen.status !== 'ready') return [];
    const featureNameById = new Map(
      screen.roomFeatures.map((feature) => [feature.id, feature.name]),
    );
    return screen.roomTypes
      .map((roomType) => ({
        roomType,
        featureNames:
          roomType.roomFeatureIds.map((id) => featureNameById.get(id) ?? id).join(', ') || '—',
      }))
      .sort((left, right) => left.roomType.name.localeCompare(right.roomType.name, 'es'));
  }, [screen]);

  const columns: DataTableColumn<RoomTypeRow>[] = [
    {
      id: 'code',
      header: 'Código',
      cell: ({ roomType }) => roomType.code,
      sortValue: ({ roomType }) => roomType.code,
    },
    {
      id: 'name',
      header: 'Nombre',
      cell: ({ roomType }) => roomType.name,
      sortValue: ({ roomType }) => roomType.name,
    },
    {
      id: 'bedConfiguration',
      header: 'Configuración de camas',
      cell: ({ roomType }) => roomType.bedConfiguration,
    },
    {
      id: 'capacity',
      header: 'Capacidad',
      cell: ({ roomType }) => roomType.capacity,
      sortValue: ({ roomType }) => roomType.capacity,
    },
    {
      id: 'features',
      header: 'Características',
      cell: ({ featureNames }) => featureNames,
    },
    {
      id: 'active',
      header: 'Estado',
      cell: ({ roomType }) => (
        <Badge tone={roomType.active ? 'success' : 'neutral'}>
          {roomType.active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
      sortValue: ({ roomType }) => (roomType.active ? 1 : 0),
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ roomType }) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => navigate(routePaths.pms.roomTypeEdit.replace(':roomTypeId', roomType.id))}
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
          <h1>Tipos de habitación</h1>
          <p className="rooms-muted">Catálogo de tipos de habitación del hotel.</p>
        </div>
        <Button onClick={() => navigate(routePaths.pms.roomTypeNew)}>Nuevo tipo</Button>
      </div>

      {screen.status === 'loading' && <LoadingState label="Cargando tipos de habitación..." />}

      {screen.status === 'error' && (
        <ErrorState
          title="No pudimos cargar los tipos de habitación"
          description={screen.message}
          onRetry={loadData}
        />
      )}

      {screen.status === 'ready' && (
        <DataTable
          caption="Tipos de habitación"
          columns={columns}
          data={rows}
          getRowId={(row) => row.roomType.id}
          pageSize={10}
          emptyMessage="Todavía no hay tipos de habitación registrados."
        />
      )}
    </section>
  );
}
