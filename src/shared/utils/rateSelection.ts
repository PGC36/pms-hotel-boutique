import type { Rate } from '@/shared/types/entities/rate/rate.model';

function validityDays(rate: Rate): number {
  return rate.validTo.getTime() - rate.validFrom.getTime();
}

/** Selects the room's default rate, never a shorter seasonal override. */
export function findBaseRate(rates: Rate[], roomTypeId: string): Rate | undefined {
  const roomRates = rates.filter((rate) => rate.roomTypeId === roomTypeId);
  const activeRates = roomRates.filter((rate) => rate.active);
  const candidates = activeRates.length > 0 ? activeRates : roomRates;

  return candidates.sort((left, right) => {
    const leftIsBase = left.name.trim().toLocaleLowerCase() === 'tarifa base';
    const rightIsBase = right.name.trim().toLocaleLowerCase() === 'tarifa base';
    if (leftIsBase !== rightIsBase) return leftIsBase ? -1 : 1;
    return validityDays(right) - validityDays(left);
  })[0];
}

/** Keeps the default rate out of the seasonal-rate list. */
export function getSeasonalRates(rates: Rate[]): Rate[] {
  const baseRateIds = new Set(
    [...new Set(rates.map((rate) => rate.roomTypeId))]
      .map((roomTypeId) => findBaseRate(rates, roomTypeId)?.id)
      .filter((id): id is string => Boolean(id)),
  );
  return rates.filter((rate) => !baseRateIds.has(rate.id));
}
