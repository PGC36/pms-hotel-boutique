/**
 * Característica de una habitación (aire acondicionado, balcón, vista al
 * jardín, jacuzzi...): lo que el cliente compra al elegir un tipo de
 * habitación. Sin horario ni estado activo/inactivo — a diferencia de
 * `amenity` (servicio compartido del hotel, con horario y que el
 * administrador activa/desactiva), una característica no se "abre" ni se
 * "cierra". Ver docs/CONTRATO-DATOS.md, sección 3.2.
 */
export interface RoomFeatureDTO {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export type RoomFeatureDto = RoomFeatureDTO;
