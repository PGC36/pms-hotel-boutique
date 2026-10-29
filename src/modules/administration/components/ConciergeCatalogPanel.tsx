import {
  conciergeCatalogService,
  type ConciergeServiceOption,
} from '@/services/conciergeCatalogService';
import { CatalogManagementPanel } from './CatalogManagementPanel';

type Props = Readonly<{ onAction: (message: string) => void }>;

export function ConciergeCatalogPanel({ onAction }: Props) {
  return (
    <CatalogManagementPanel<ConciergeServiceOption>
      onAction={onAction}
      service={conciergeCatalogService}
      title="Catálogo de Conserjería"
      description="Define qué servicios pueden solicitar los huéspedes."
      addLabel="Agregar servicio"
      itemLabel="servicio de conserjería"
      itemLabelPlural="servicios"
      emptyMessage="No hay servicios configurados"
      paginationLabel="Paginación del catálogo de conserjería"
      saveMessages={{ created: 'Servicio agregado al catálogo', updated: 'Servicio actualizado' }}
      deleteMessage="Servicio eliminado del catálogo; se conserva en el historial."
      toggleMessages={{
        activated: 'Servicio disponible para huéspedes',
        deactivated: 'Servicio desactivado',
      }}
      errorMessages={{
        save: 'No fue posible guardar el servicio.',
        update: 'No fue posible actualizar el servicio.',
        delete: 'No fue posible eliminar el servicio.',
      }}
      deleteDescription="Se conservará en el historial."
    />
  );
}
