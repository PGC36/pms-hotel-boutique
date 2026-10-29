import {
  ArrowRight,
  Car,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Gift,
  Sparkles,
  Utensils,
  Waves,
  Wifi,
} from 'lucide-react';
import type { RefObject } from 'react';
import { CatalogImage } from '@/shared/components/CatalogImage';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { LoadingState } from '@/shared/components/LoadingState';
import type { Amenity, AmenityCategory } from '@/shared/types/entities/amenity';
import { findPrimaryImage } from '@/shared/types/entities/media-image';
import type { Promotion } from '@/shared/types/entities/promotion';
import { formatAmenitySchedule } from '@/shared/utils/amenitySchedule';
import { formatDateGT } from '@/shared/utils/date';

export type AmenitiesState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; amenities: Amenity[] }
  | { status: 'error'; message: string };

export type PromotionsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; promotions: Promotion[] }
  | { status: 'error'; message: string };

const AMENITY_CATEGORY_ICONS: Record<AmenityCategory, typeof Sparkles> = {
  hotel: Waves,
  room: Coffee,
  service: Utensils,
};

type CarouselControlsProps = {
  label: string;
  previousLabel: string;
  nextLabel: string;
  onMove: (direction: -1 | 1) => void;
};

function CarouselControls({ label, previousLabel, nextLabel, onMove }: CarouselControlsProps) {
  return (
    <div className="booking-carousel-controls" aria-label={label}>
      <button
        className="booking-carousel-control"
        type="button"
        aria-label={previousLabel}
        onClick={() => onMove(-1)}
      >
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      <button
        className="booking-carousel-control"
        type="button"
        aria-label={nextLabel}
        onClick={() => onMove(1)}
      >
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  showControls: boolean;
  controls: CarouselControlsProps;
  onSearch: () => void;
};

function CatalogSectionHeader({
  eyebrow,
  title,
  showControls,
  controls,
  onSearch,
}: SectionHeaderProps) {
  return (
    <div className="visitor-section-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <div className="booking-amenity-actions">
        {showControls ? <CarouselControls {...controls} /> : null}
        <button className="text-button" type="button" onClick={onSearch}>
          Buscar fechas <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function AmenityCards({
  amenities,
  carouselRef,
}: {
  amenities: Amenity[];
  carouselRef: RefObject<HTMLElement>;
}) {
  const isCarousel = amenities.length > 1;
  const displayedAmenities = isCarousel ? [...amenities, ...amenities, ...amenities] : amenities;
  const className = isCarousel
    ? `booking-amenity-grid booking-amenity-grid--carousel booking-amenity-grid--count-${Math.min(amenities.length, 4)}`
    : 'booking-amenity-grid';

  return (
    <section
      className={className}
      ref={isCarousel ? carouselRef : undefined}
      aria-label={isCarousel ? 'Amenidades del hotel' : undefined}
      aria-roledescription={isCarousel ? 'carrusel' : undefined}
      aria-live={isCarousel ? 'off' : undefined}
      tabIndex={isCarousel ? 0 : undefined}
    >
      {displayedAmenities.map((amenity, index) => {
        const isClone = index >= amenities.length;
        const Icon = AMENITY_CATEGORY_ICONS[amenity.category] ?? Sparkles;
        return (
          <article
            className="booking-amenity-card"
            key={`${amenity.id}-${index}`}
            data-carousel-clone={isClone ? 'true' : undefined}
            aria-hidden={isClone || undefined}
          >
            <div className="booking-amenity-image">
              <CatalogImage
                className="booking-amenity-photo"
                image={findPrimaryImage(amenity.images)}
                variant="medium"
                alt={`Foto de ${amenity.name}`}
              />
              <span>
                <Icon size={18} aria-hidden="true" />
                {formatAmenitySchedule(amenity) || 'Disponible'}
              </span>
            </div>
            <div>
              <h3>{amenity.name}</h3>
              {amenity.description ? <p>{amenity.description}</p> : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function AmenitiesContent({
  state,
  onRetry,
  carouselRef,
}: {
  state: AmenitiesState;
  onRetry: () => void;
  carouselRef: RefObject<HTMLElement>;
}) {
  if (state.status === 'idle' || state.status === 'loading') {
    return <LoadingState label="Cargando amenidades..." />;
  }
  if (state.status === 'error') return <ErrorState description={state.message} onRetry={onRetry} />;
  if (state.amenities.length === 0) {
    return (
      <EmptyState
        title="Sin amenidades publicadas"
        description="Pronto compartiremos los servicios del hotel."
      />
    );
  }
  return <AmenityCards amenities={state.amenities} carouselRef={carouselRef} />;
}

function ServiceStrip() {
  return (
    <div className="booking-service-strip">
      <span>
        <Wifi size={16} aria-hidden="true" /> Wi-Fi de alta velocidad
      </span>
      <span>
        <Car size={16} aria-hidden="true" /> Traslado bajo reserva
      </span>
      <span>
        <Sparkles size={16} aria-hidden="true" /> Servicio a la habitación
      </span>
    </div>
  );
}

export function AmenitiesSection({
  state,
  onRetry,
  onSearch,
  onMove,
  carouselRef,
}: {
  state: AmenitiesState;
  onRetry: () => void;
  onSearch: () => void;
  onMove: (direction: -1 | 1) => void;
  carouselRef: RefObject<HTMLElement>;
}) {
  const showControls = state.status === 'success' && state.amenities.length > 1;
  const controls = {
    label: 'Controles de amenidades',
    previousLabel: 'Ver amenidad anterior',
    nextLabel: 'Ver más amenidades',
    onMove,
  };
  return (
    <section className="booking-public-section" id="amenidades">
      <CatalogSectionHeader
        eyebrow="Amenidades incluidas"
        title="Todo listo para disfrutar tu estancia"
        showControls={showControls}
        controls={controls}
        onSearch={onSearch}
      />
      <AmenitiesContent state={state} onRetry={onRetry} carouselRef={carouselRef} />
      <ServiceStrip />
    </section>
  );
}

function PromotionCards({
  promotions,
  carouselRef,
  onSearch,
}: {
  promotions: Promotion[];
  carouselRef: RefObject<HTMLElement>;
  onSearch: () => void;
}) {
  const isCarousel = promotions.length > 1;
  const displayedPromotions = isCarousel
    ? [...promotions, ...promotions, ...promotions]
    : promotions;
  const className = isCarousel
    ? `booking-promo-grid booking-promo-grid--carousel booking-promo-grid--count-${Math.min(promotions.length, 4)}`
    : 'booking-promo-grid';

  return (
    <section
      className={className}
      ref={isCarousel ? carouselRef : undefined}
      aria-label={isCarousel ? 'Promociones disponibles' : undefined}
      aria-roledescription={isCarousel ? 'carrusel' : undefined}
      aria-live={isCarousel ? 'off' : undefined}
      tabIndex={isCarousel ? 0 : undefined}
    >
      {displayedPromotions.map((promotion, index) => {
        const isClone = index >= promotions.length;
        return (
          <article
            className="booking-promo-card"
            key={`${promotion.id}-${index}`}
            data-carousel-clone={isClone ? 'true' : undefined}
            aria-hidden={isClone || undefined}
          >
            <div className="booking-promo-image">
              <span className="booking-promo-icon" aria-hidden="true">
                <Gift size={32} strokeWidth={1.6} />
              </span>
              <span>{promotion.discountPercent}% de descuento</span>
            </div>
            <div className="booking-promo-body">
              <small>Código: {promotion.code}</small>
              <h3>{promotion.name}</h3>
              {promotion.description ? <p>{promotion.description}</p> : null}
              <p>
                Vigente del {formatDateGT(promotion.validFrom)} al {formatDateGT(promotion.validTo)}
              </p>
              <button
                className="button secondary"
                type="button"
                onClick={onSearch}
                tabIndex={isClone ? -1 : undefined}
              >
                Reservar ahora <ArrowRight size={14} aria-hidden="true" />
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function PromotionsContent({
  state,
  onRetry,
  onSearch,
  carouselRef,
}: {
  state: PromotionsState;
  onRetry: () => void;
  onSearch: () => void;
  carouselRef: RefObject<HTMLElement>;
}) {
  if (state.status === 'idle' || state.status === 'loading') {
    return <LoadingState label="Cargando promociones..." />;
  }
  if (state.status === 'error') return <ErrorState description={state.message} onRetry={onRetry} />;
  if (state.promotions.length === 0) {
    return (
      <EmptyState
        title="No hay promociones disponibles"
        description="Vuelve pronto para descubrir nuevas ofertas."
      />
    );
  }
  return (
    <PromotionCards promotions={state.promotions} carouselRef={carouselRef} onSearch={onSearch} />
  );
}

export function PromotionsSection({
  state,
  onRetry,
  onSearch,
  onMove,
  carouselRef,
}: {
  state: PromotionsState;
  onRetry: () => void;
  onSearch: () => void;
  onMove: (direction: -1 | 1) => void;
  carouselRef: RefObject<HTMLElement>;
}) {
  const showControls = state.status === 'success' && state.promotions.length > 1;
  const controls = {
    label: 'Controles de promociones',
    previousLabel: 'Ver promoción anterior',
    nextLabel: 'Ver más promociones',
    onMove,
  };
  return (
    <section className="booking-public-section" id="promociones">
      <CatalogSectionHeader
        eyebrow="Ofertas especiales"
        title="Promociones para tu próxima estancia"
        showControls={showControls}
        controls={controls}
        onSearch={onSearch}
      />
      <PromotionsContent
        state={state}
        onRetry={onRetry}
        onSearch={onSearch}
        carouselRef={carouselRef}
      />
    </section>
  );
}
