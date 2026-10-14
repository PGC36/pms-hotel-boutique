import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  publicBookingCatalogService,
  type PublicAvailableRoomType,
} from '@/services/publicBookingCatalogService';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { CatalogImage } from '@/shared/components/CatalogImage';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { LoadingState } from '@/shared/components/LoadingState';
import { orderGalleryImages } from '@/shared/types/entities/media-image';
import type { Rate } from '@/shared/types/entities/rate';
import type { RoomFeature } from '@/shared/types/entities/room-feature';
import type { RoomType } from '@/shared/types/entities/room-type';
import { formatCurrency } from '@/shared/utils/currency';
import { calculateNights, formatDateGT } from '@/shared/utils/date';
import './booking-engine.css';

type DetailStatus = 'loading' | 'success' | 'error';

/** Disponibilidad y precio de la estadía: siempre de GET /public/availability. */
type QuoteState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'available'; result: PublicAvailableRoomType }
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

type DetailState = {
  roomType?: RoomType;
  features: RoomFeature[];
  rates: Rate[];
};

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

function isValidStay(checkIn: Date | null, checkOut: Date | null): checkIn is Date {
  if (!checkIn || !checkOut) return false;
  try {
    return calculateNights(checkIn, checkOut) > 0;
  } catch {
    return false;
  }
}

function parseCount(value: string | null, minimum: number): number | null {
  if (value === null) return null;
  const count = Number(value);
  return Number.isInteger(count) && count >= minimum ? count : null;
}

/** Tarifa vigente más baja, solo como referencia "por noche" sin fechas. */
function findFallbackRate(rates: Rate[], roomTypeId: string): Rate | undefined {
  return rates
    .filter((rate) => rate.active && rate.roomTypeId === roomTypeId)
    .sort((left, right) => left.priceCents - right.priceCents)[0];
}

export function RoomDetailScreen() {
  const navigate = useNavigate();
  const { roomTypeId } = useParams<'roomTypeId'>();
  const [searchParams] = useSearchParams();
  const checkIn = parseDateKey(searchParams.get('checkIn'));
  const checkOut = parseDateKey(searchParams.get('checkOut'));
  const adults = parseCount(searchParams.get('adults'), 1);
  const children = parseCount(searchParams.get('children'), 0) ?? 0;
  const hasValidDates = isValidStay(checkIn, checkOut);
  const checkInKey = hasValidDates ? dateKey(checkIn) : '';
  const checkOutKey = hasValidDates && checkOut ? dateKey(checkOut) : '';
  // Sin fechas válidas y adultos no se consulta disponibilidad ni se inventa.
  const canQuote = hasValidDates && adults !== null;

  const [status, setStatus] = useState<DetailStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailState>({ features: [], rates: [] });
  const [quote, setQuote] = useState<QuoteState>({ status: 'idle' });
  // Solo la consulta más reciente puede escribir el estado.
  const quoteRequestRef = useRef(0);

  const loadDetail = useCallback(async () => {
    if (!roomTypeId) return;

    setStatus('loading');
    setError(null);

    try {
      const [catalog, rates] = await Promise.all([
        publicBookingCatalogService.getRoomTypeCatalog(),
        publicBookingCatalogService.getRates(),
      ]);

      setDetail({
        roomType: catalog.roomTypes.find(
          (roomType) => roomType.id === roomTypeId && roomType.active,
        ),
        features: catalog.features,
        rates,
      });
      setStatus('success');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar el detalle.');
      setStatus('error');
    }
  }, [roomTypeId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const loadQuote = useCallback(async () => {
    const requestId = ++quoteRequestRef.current;
    if (!roomTypeId || !canQuote || adults === null) {
      setQuote({ status: 'idle' });
      return;
    }

    setQuote({ status: 'loading' });
    try {
      const results = await publicBookingCatalogService.getAvailability({
        checkIn: checkInKey,
        checkOut: checkOutKey,
        adults,
        children,
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
  }, [adults, canQuote, checkInKey, checkOutKey, children, roomTypeId]);

  useEffect(() => {
    void loadQuote();
  }, [loadQuote]);

  const featureNames = useMemo(() => {
    if (!detail.roomType) return [];
    const featureById = new Map(detail.features.map((feature) => [feature.id, feature.name]));

    return detail.roomType.roomFeatureIds.map(
      (featureId) => featureById.get(featureId) ?? featureId,
    );
  }, [detail.features, detail.roomType]);

  if (status === 'loading') {
    return (
      <section className="content booking-detail-page">
        <LoadingState label="Cargando detalle de habitación..." />
      </section>
    );
  }

  if (status === 'error') {
    return (
      <section className="content booking-detail-page">
        <ErrorState description={error ?? 'Intenta nuevamente.'} onRetry={loadDetail} />
      </section>
    );
  }

  if (!detail.roomType) {
    return (
      <section className="content booking-detail-page">
        <EmptyState
          title="Habitación no encontrada"
          description="El tipo de habitación solicitado no existe o no está disponible."
          action={
            <Link className="ui-action" to="/">
              Buscar disponibilidad
            </Link>
          }
        />
      </section>
    );
  }

  const rate = canQuote
    ? quote.status === 'available'
      ? quote.result.rate
      : undefined
    : findFallbackRate(detail.rates, detail.roomType.id);
  const nights = hasValidDates ? calculateNights(checkIn, checkOut!) : 0;
  const totalAmount = quote.status === 'available' ? quote.result.totalAmountCents : undefined;
  const bookingParams = new URLSearchParams({ roomTypeId: detail.roomType.id });
  if (hasValidDates) {
    bookingParams.set('checkIn', checkInKey);
    bookingParams.set('checkOut', checkOutKey);
  }
  if (adults !== null) {
    bookingParams.set('adults', String(adults));
    bookingParams.set('children', String(children));
  }
  const bookingUrl = `/booking/new?${bookingParams.toString()}`;
  const canBook = canQuote ? quote.status === 'available' : !!rate;
  const availabilityMessage = !canQuote
    ? undefined
    : quote.status === 'loading'
      ? 'Consultando disponibilidad...'
      : quote.status === 'available'
        ? `${quote.result.availableRooms} ${quote.result.availableRooms === 1 ? 'disponible' : 'disponibles'} para tus fechas`
        : quote.status === 'unavailable'
          ? 'No hay disponibilidad para estas fechas y huéspedes.'
          : quote.status === 'error'
            ? quote.message
            : undefined;
  // Principal primero, luego en el orden de la galería del backend.
  const galleryImages = orderGalleryImages(detail.roomType.images);
  const roomTypeName = detail.roomType.name;

  return (
    <section className="content booking-detail-page">
      <div className="booking-detail-heading">
        <div>
          <p className="eyebrow">Detalle de habitación</p>
          <h1>{detail.roomType.name}</h1>
          <p>{detail.roomType.description}</p>
        </div>
        <Link className="ui-action" to="/">
          Cambiar fechas
        </Link>
      </div>

      <div className="booking-detail-layout">
        <div className="booking-detail-main">
          <div className="booking-photo-grid" aria-label="Fotografías de la habitación">
            {galleryImages.length > 0 ? (
              galleryImages.map((image, index) => (
                <figure className="booking-photo-card" key={image.id}>
                  <CatalogImage
                    image={image}
                    variant={index === 0 ? 'large' : 'medium'}
                    alt={`Foto ${index + 1} de ${roomTypeName}`}
                  />
                </figure>
              ))
            ) : (
              <div className="booking-photo-card booking-photo-card--fallback">
                <CatalogImage
                  alt={`${detail.roomType.name}: sin fotografías todavía`}
                  placeholderLabel="Fotografías próximamente"
                />
              </div>
            )}
          </div>

          <article className="booking-detail-card">
            <h2>Características</h2>
            <div className="booking-roomtype-meta">
              <span>{detail.roomType.capacity} huéspedes</span>
              <span>{detail.roomType.bedConfiguration}</span>
              <span>Código {detail.roomType.code}</span>
            </div>
            <div className="booking-feature-list">
              {featureNames.map((featureName) => (
                <Badge key={featureName} tone="info">
                  {featureName}
                </Badge>
              ))}
            </div>
          </article>
        </div>

        <aside className="booking-rate-card">
          <h2>Tarifa</h2>
          {rate ? (
            <>
              <p className="booking-rate-name">{rate.name}</p>
              <p className="booking-rate-price">{formatCurrency(rate.priceCents, rate.currency)}</p>
              <p className="booking-muted">por noche</p>
            </>
          ) : canQuote ? null : (
            <p className="booking-muted">No hay tarifa activa para este tipo de habitación.</p>
          )}
          {availabilityMessage ? (
            <p className="booking-muted" role="status">
              {availabilityMessage}
            </p>
          ) : null}

          <div className="booking-rate-summary">
            <div>
              <span>Entrada</span>
              <strong>{hasValidDates ? formatDateGT(checkIn) : 'Por definir'}</strong>
            </div>
            <div>
              <span>Salida</span>
              <strong>{hasValidDates ? formatDateGT(checkOut!) : 'Por definir'}</strong>
            </div>
            <div>
              <span>Noches</span>
              <strong>{hasValidDates ? nights : 'Por definir'}</strong>
            </div>
            <div>
              <span>Total estimado</span>
              <strong>
                {totalAmount !== undefined
                  ? formatCurrency(totalAmount, rate?.currency)
                  : 'Por definir'}
              </strong>
            </div>
          </div>

          <Button
            disabled={!canBook}
            onClick={() => {
              navigate(bookingUrl);
            }}
          >
            Reservar
          </Button>
        </aside>
      </div>
    </section>
  );
}
