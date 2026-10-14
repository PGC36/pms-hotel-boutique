type CapacityValidationInput = {
  adults: number;
  children: number;
  capacity: number;
  roomTypeName?: string;
};

export function getBookingGuestTotal(adults: number, children: number): number {
  return adults + children;
}

export function validateBookingCapacity({
  adults,
  children,
  capacity,
  roomTypeName,
}: CapacityValidationInput): string | undefined {
  if (!Number.isInteger(adults) || !Number.isInteger(children)) return undefined;
  if (adults < 1 || children < 0) return undefined;

  const totalGuests = getBookingGuestTotal(adults, children);
  if (totalGuests <= capacity) return undefined;

  const roomLabel = roomTypeName ? ` ${roomTypeName}` : '';
  return `La habitacion${roomLabel} permite maximo ${capacity} huesped(es). Ajusta adultos y menores.`;
}
