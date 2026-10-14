import type { RoomHousekeepingStatus, RoomStatus } from '@/shared/constants/statuses';

export type { RoomHousekeepingStatus, RoomStatus };

export interface Room {
  id: string;
  roomNumber: string;
  roomTypeId: string;
  floor: number;
  /** Ocupación: la controla la web. Ver docs/DECISIONES.md, D-002. */
  status: RoomStatus;
  /** Limpieza: la controla la app móvil; la web solo la lee. Ver D-002. */
  housekeepingStatus: RoomHousekeepingStatus;
  /**
   * Calculado por el mapper con `isRoomAssignable` — no existe en el DTO.
   * `true` solo si `status === 'available'` y `housekeepingStatus` es
   * `'clean'` o `'inspected'`.
   */
  isAssignable: boolean;
  notes?: string;
  /** Trazabilidad del turnover (solo desde Housekeeping). Ver room.dto.ts. */
  cleaningUserEmail?: string;
  cleaningStartedAt?: Date;
  cleaningCompletedByUserEmail?: string;
  cleaningCompletedAt?: Date;
  inspectorUserEmail?: string;
  inspectedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
