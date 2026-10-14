# Correcciones del testeo web (2026-10-06)

Se corrigieron hallazgos que siguen vigentes en el código:

- El resumen de recepción compara llegadas y salidas con la fecha local actual,
  no con una fecha fija.
- Crear un tipo de habitación también persiste su tarifa base mediante
  `POST /rates`. Si esa segunda operación falla, se muestra el error y se
  recargan los datos para evitar duplicar el tipo al reintentar.
- El catálogo resuelve las galerías de muestra por código de tipo además del
  identificador. Esas imágenes siguen siendo ilustrativas, no fotos cargadas
  por el hotel.
- La confirmación vuelve al detalle conservando fechas y cantidad de huéspedes.
- Se retiraron las promociones públicas de muestra: hoy no existe un contrato
  público para listarlas ni aplicarlas.
- Se retiró el control visual de adjuntar fotografía al reporte de
  mantenimiento porque no existe persistencia de archivos para ese flujo.

La carga persistente de imágenes para habitaciones, productos y amenidades
continúa pendiente de la issue #82 del backend. Los reportes de desperfectos
con fotografías requieren además que el contrato de medios cubra adjuntos de
mantenimiento.

Verificación: `npm run typecheck`, `npm run lint`, `npm run build` y `npm test`.
