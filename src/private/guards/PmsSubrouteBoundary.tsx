import { useParams } from 'react-router-dom';
import { PrivateNotFoundPage } from '@/private/pages/PrivateNotFoundPage';
import { RequirePermission } from '@/private/guards/RequirePermission';
import type { Permission } from '@/modules/auth/models/session';

const permissionBySegment: Record<string, Permission> = {
  admin: 'users:view',
  cash: 'cash:view',
  caja: 'cash:view',
  concierge: 'concierge:view',
  conserjeria: 'concierge:view',
  housekeeping: 'housekeeping:view',
  limpieza: 'housekeeping:view',
  occupancy: 'occupancy:view',
  ocupacion: 'occupancy:view',
  reception: 'reception:view',
  recepcion: 'reception:view',
  roomservice: 'room-service:view',
  'room-service': 'room-service:view',
  rooms: 'rooms:manage',
  habitaciones: 'rooms:manage',
};

export function PmsSubrouteBoundary() {
  const { workspace, area } = useParams();
  const workspacePermission = permissionBySegment[workspace?.toLowerCase() ?? ''];
  const areaPermission = permissionBySegment[area?.toLowerCase() ?? ''];

  if (!workspacePermission) return <PrivateNotFoundPage />;
  if (!areaPermission) {
    return (
      <RequirePermission permission={workspacePermission}>
        <PrivateNotFoundPage />
      </RequirePermission>
    );
  }

  return (
    <RequirePermission permission={workspacePermission}>
      <RequirePermission permission={areaPermission}>
        <PrivateNotFoundPage />
      </RequirePermission>
    </RequirePermission>
  );
}
