import {
  housekeepingCatalogService,
  type HousekeepingServiceOption,
} from '@/services/housekeepingCatalogService';
import { CatalogManagementPanel } from './CatalogManagementPanel';

type Props = Readonly<{ onAction: (message: string) => void }>;

export function HousekeepingCatalogPanel({ onAction }: Props) {
  return (
    <CatalogManagementPanel<HousekeepingServiceOption>
      onAction={onAction}
      service={housekeepingCatalogService}
      title="Catálogo de Limpieza"
      description="Define qué tipos de limpieza pueden solicitar los huéspedes."
      addLabel="Agregar opción"
      itemLabel="opción de limpieza"
      itemLabelPlural="opciones"
      emptyMessage="No hay opciones configuradas"
      paginationLabel="Paginación del catálogo de limpieza"
      saveMessages={{
        created: 'Opción agregada al catálogo de limpieza',
        updated: 'Opción de limpieza actualizada',
      }}
      deleteMessage="Opción eliminada del catálogo; se conserva en el historial."
      toggleMessages={{
        activated: 'Opción disponible para huéspedes',
        deactivated: 'Opción desactivada',
      }}
      errorMessages={{
        save: 'No fue posible guardar la opción.',
        update: 'No fue posible actualizar la opción.',
        delete: 'No fue posible eliminar la opción.',
      }}
      deleteDescription="Se conservará en el historial de solicitudes."
    />
  );
}
