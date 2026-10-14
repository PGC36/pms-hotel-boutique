import { HttpError } from './http-client';

/**
 * Errores de las rutas `/guest/...` (INT-12). La reserva siempre sale del JWT de
 * huésped: el frontend nunca envía un `bookingId`, así que un `403` significa que
 * el recurso no es de su estancia o que la estancia ya no está activa.
 */
export function guestErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpError)) return error instanceof Error ? error.message : fallback;
  const backendMsg = (error.data as { message?: string } | undefined)?.message;
  if (error.status === 401)
    return 'Tu acceso de huésped venció. Ingresa de nuevo tus credenciales.';
  if (error.status === 403) {
    return 'Esta información no pertenece a tu estancia o tu cuenta.';
  }
  if (error.status === 409) {
    if (backendMsg && backendMsg.includes('No availability')) {
      return 'Ya no hay habitaciones disponibles para esas fechas. Elige otras fechas u otro tipo de habitación.';
    }
    return backendMsg || `${fallback} Conflicto con la disponibilidad o el estado de la reserva.`;
  }
  if (error.status === 400) {
    return backendMsg || `${fallback} Revisa los datos de la solicitud.`;
  }
  if (error.status === 404) return `${fallback} No encontramos ese registro.`;
  return fallback;
}

export async function guestRequest<T>(call: () => Promise<T>, fallback: string): Promise<T> {
  try {
    return await call();
  } catch (error) {
    throw new Error(guestErrorMessage(error, fallback));
  }
}
