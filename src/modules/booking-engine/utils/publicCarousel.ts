type CarouselMetrics = {
  container: HTMLElement;
  cardWidth: number;
  gap: number;
  cycleWidth: number;
};

function getCarouselMetrics(
  container: HTMLElement | null,
  itemSelector: string,
): CarouselMetrics | null {
  const firstCard = container?.querySelector<HTMLElement>(
    `${itemSelector}:not([data-carousel-clone="true"])`,
  );
  const cloneStart = container?.querySelector<HTMLElement>('[data-carousel-clone="true"]');
  if (!container || !firstCard) return null;

  const gap = Number.parseFloat(window.getComputedStyle(container).columnGap) || 0;
  return {
    container,
    cardWidth: firstCard.getBoundingClientRect().width,
    gap,
    cycleWidth: cloneStart ? cloneStart.offsetLeft - firstCard.offsetLeft : 0,
  };
}

export function scrollPublicCarousel(
  container: HTMLElement | null,
  itemSelector: string,
  direction: -1 | 1,
): void {
  const metrics = getCarouselMetrics(container, itemSelector);
  if (!metrics) return;

  let destination = metrics.container.scrollLeft + direction * (metrics.cardWidth + metrics.gap);
  if (destination < 0 && metrics.cycleWidth > 0) destination += metrics.cycleWidth;
  if (destination >= metrics.cycleWidth && metrics.cycleWidth > 0) {
    destination -= metrics.cycleWidth;
  }
  metrics.container.scrollLeft = destination;
}

export function advancePublicCarousel(container: HTMLElement | null, itemSelector: string): void {
  const metrics = getCarouselMetrics(container, itemSelector);
  if (!metrics) return;

  if (metrics.cycleWidth > 0 && metrics.container.scrollLeft >= metrics.cycleWidth) {
    metrics.container.scrollLeft -= metrics.cycleWidth;
  }
  metrics.container.scrollBy({ left: metrics.cardWidth + metrics.gap, behavior: 'smooth' });
}
