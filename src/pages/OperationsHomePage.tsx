import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { routePaths } from '@/app/routes';
import { useAuth } from '@/modules/auth/components/auth-context';
import { hasPermission } from '@/modules/auth/models/session';
import { bookingService } from '@/services/bookingService';
import { roomService } from '@/services/roomService';
import { Badge, type BadgeTone } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { LoadingState } from '@/shared/components/LoadingState';
import type { Booking } from '@/shared/types/entities/booking';
import type { Room } from '@/shared/types/entities/room';
import { isSameCalendarDay } from '@/shared/utils/date';
import './operations-home.css';

type ScreenState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; rooms: Room[]; bookings: Booking[] };

type QuickAction = { label: string; path: string };

function getErrorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Error inesperado.';
}

export function OperationsHomePage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [screen, setScreen] = useState<ScreenState>({ status: 'loading' });

  const loadData = useCallback(async () => {
    setScreen({ status: 'loading' });
    try {
      const [rooms, bookings] = await Promise.all([
        roomService.getRooms(),
        bookingService.getBookings(),
      ]);
      setScreen({ status: 'ready', rooms, bookings });
    } catch (cause) {
      setScreen({ status: 'error', message: getErrorMessage(cause) });
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const today = useMemo(() => new Date(), []);

  const metrics = useMemo(() => {
    if (screen.status !== 'ready') return null;

    const total = screen.rooms.length;
    const occupied = screen.rooms.filter((room) => room.status === 'occupied').length;
    const pendingCleaning = screen.rooms.filter(
      (room) => room.housekeepingStatus === 'dirty' || room.housekeepingStatus === 'cleaning',
    ).length;

    const expectedBookings = screen.bookings.filter(
      (booking) => booking.status !== 'cancelled' && booking.status !== 'noShow',
    );
    const arrivalsToday = expectedBookings.filter((booking) =>
      isSameCalendarDay(booking.checkIn, today),
    ).length;
    const departuresToday = expectedBookings.filter((booking) =>
      isSameCalendarDay(booking.checkOut, today),
    ).length;

    return { total, occupied, pendingCleaning, arrivalsToday, departuresToday };
  }, [screen, today]);

  const occupancyTone: BadgeTone = useMemo(() => {
    if (!metrics || metrics.total === 0) return 'neutral';
    const rate = metrics.occupied / metrics.total;
    if (rate >= 1) return 'danger';
    if (rate >= 0.8) return 'warning';
    return 'info';
  }, [metrics]);

  const quickActions = useMemo<QuickAction[]>(() => {
    const actions: QuickAction[] = [];
    if (hasPermission(session, 'rooms:manage')) {
      actions.push({ label: 'Nueva habitación', path: routePaths.pms.roomNew });
      actions.push({ label: 'Ver habitaciones', path: routePaths.pms.rooms });
    }
    if (hasPermission(session, 'occupancy:view')) {
      actions.push({ label: 'Nueva reserva', path: routePaths.pms.manualBookingNew });
      actions.push({ label: 'Ver ocupación', path: routePaths.pms.occupancy });
    }
    return actions;
  }, [session]);

  return (
    <section className="content">
      <div className="welcome-row">
        <div>
          <p className="eyebrow">Panel privado</p>
          <h1>Panel operativo</h1>
          <p className="muted">Indicadores del día y accesos rápidos.</p>
        </div>
      </div>

      {screen.status === 'loading' && <LoadingState label="Cargando indicadores..." />}

      {screen.status === 'error' && (
        <ErrorState
          title="No pudimos cargar el panel operativo"
          description={screen.message}
          onRetry={loadData}
        />
      )}

      {screen.status === 'ready' && metrics && (
        <>
          {metrics.total === 0 ? (
            <EmptyState
              title="Sin habitaciones registradas"
              description="Todavía no hay habitaciones en el inventario para calcular indicadores."
            />
          ) : (
            <div className="operations-metrics">
              <Card title="Ocupación actual" description="Habitaciones ocupadas sobre el total.">
                <p className="operations-metric-value">
                  {metrics.occupied} / {metrics.total}
                </p>
                <Badge tone={occupancyTone}>
                  {Math.round((metrics.occupied / metrics.total) * 100)}% ocupado
                </Badge>
              </Card>

              <Card
                title="Llegadas y salidas de hoy"
                description="Reservas activas con entrada o salida hoy."
              >
                <dl className="operations-metric-list">
                  <div>
                    <dt>Llegadas</dt>
                    <dd>{metrics.arrivalsToday}</dd>
                  </div>
                  <div>
                    <dt>Salidas</dt>
                    <dd>{metrics.departuresToday}</dd>
                  </div>
                </dl>
              </Card>

              <Card
                title="Limpieza pendiente"
                description="Habitaciones sucias o en proceso de limpieza."
              >
                <p className="operations-metric-value">{metrics.pendingCleaning}</p>
              </Card>
            </div>
          )}

          <section className="operations-panel" aria-labelledby="quick-actions-title">
            <h2 id="quick-actions-title">Accesos rápidos</h2>
            {quickActions.length === 0 ? (
              <EmptyState
                title="Sin accesos rápidos para tu rol"
                description="Tu rol todavía no tiene acciones frecuentes configuradas."
              />
            ) : (
              <div className="operations-actions">
                {quickActions.map((action) => (
                  <Button
                    key={action.path}
                    variant="secondary"
                    onClick={() => navigate(action.path)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
