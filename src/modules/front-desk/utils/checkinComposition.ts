import type { Companion } from '@/private/workspace/PrivateWorkspace';

/**
 * Composición que exige el check-in del backend: titular (1 adulto) +
 * acompañantes debe coincidir exactamente con adultos y menores declarados.
 */
export function companionCompositionError(
  companions: Pick<Companion, 'guestType'>[],
  adults: number,
  children: number,
): string | null {
  const expectedAdults = Math.max(adults - 1, 0);
  const adultCompanions = companions.filter((c) => c.guestType === 'adult').length;
  const childCompanions = companions.filter((c) => c.guestType === 'child').length;
  if (adultCompanions === expectedAdults && childCompanions === children) return null;
  return `La reserva declara ${adults} ${adults === 1 ? 'adulto' : 'adultos'} y ${children} ${children === 1 ? 'menor' : 'menores'}: registra ${expectedAdults} ${expectedAdults === 1 ? 'acompañante adulto' : 'acompañantes adultos'} y ${children} ${children === 1 ? 'menor' : 'menores'} (ahora hay ${adultCompanions} y ${childCompanions}).`;
}
