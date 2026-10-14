# Progreso Ronda 1 - Lote B

## WEB-20 / Issue #46 - SearchScreen

Estado: implementado en rama `booking-engine`.

Cambios realizados:

- `SearchScreen` dejo de ser placeholder y ahora permite seleccionar rango de fechas con `DatePickerRange`.
- La busqueda carga datos mediante `roomService.getRoomTypes()`, `roomService.getRooms()` y `bookingService.getBookings()`.
- La disponibilidad se calcula por tipo de habitacion usando habitaciones asignables y reservas que se solapan con el rango elegido.
- Cada resultado enlaza a `/rooms/:roomTypeId` preservando `checkIn` y `checkOut` en query string para WEB-21.
- La pantalla cubre estado inicial, carga, error con reintento y busqueda sin resultados.
- Se agrego `roomService.getRoomTypes()` porque la issue lo requiere y esta rama no lo exponia aun.

Verificacion:

- `npm run typecheck`: OK.
- `npm run lint`: OK.
- `npm run build`: OK.
- `npm run test`: OK.
- `npm run check`: bloqueado en `format:check` por archivos preexistentes fuera de esta issue
  (`src/index.css`, `NEXT_CONTRIBUTOR.md`, archivos de `shared/types`, configs, etc.).

## WEB-21 / Issue #47 - RoomDetailScreen

Estado: implementado en rama `booking-engine`.

Cambios realizados:

- `RoomDetailScreen` carga todos los tipos con `roomService.getRoomTypes()` y filtra por `roomTypeId` de la ruta.
- La pantalla muestra descripcion, capacidad, configuracion de cama, codigo y caracteristicas del tipo de habitacion.
- Se agregaron paneles visuales para las fotografias, porque `roomType.model.ts` no tiene campos de imagen en esta rama.
- La tarifa se resuelve contra las fechas recibidas por query string (`checkIn`, `checkOut`) y se muestra con `formatCurrency`.
- El resumen usa `formatDateGT` para las fechas y calcula noches con `calculateNights`.
- El boton de reserva navega a `/booking/new` llevando `roomTypeId`, `checkIn` y `checkOut` cuando vienen desde WEB-20.
- La pantalla cubre carga, error con reintento y el caso de `roomTypeId` inexistente.
- Se agregaron `roomService.getRoomFeatures()` y `roomService.getRates()` para mantener la regla de no importar `src/data/` desde pantallas.

Verificacion:

- `npm run typecheck`: OK.
- `npm run lint`: OK.
- `npm run build`: OK.
- `npm run test`: OK.
- `npm run check`: bloqueado en `format:check` por los mismos archivos preexistentes fuera de esta issue
  (`src/index.css`, `NEXT_CONTRIBUTOR.md`, archivos de `shared/types`, configs, etc.).

## WEB-23 / Issue #49 - BookingConfirmationScreen

Estado: implementado en rama `booking-engine`.

Cambios realizados:

- `BookingConfirmationScreen` dejo de ser placeholder y carga la reserva con `bookingService.getBookingById(bookingId)`.
- La pantalla muestra codigo de confirmacion, fechas, noches, tipo de habitacion, huesped y monto.
- Fechas y monto usan `formatDateGT` y `formatCurrency`.
- La pantalla cubre carga, error con reintento y reserva inexistente.
- La confirmacion se mantiene en pantalla; el envio por correo queda fuera de alcance como indica la issue.
- `bookingService.createBooking` ahora calcula `total_amount_cents` cuando recibe `rate_id` y fechas, para que la reserva creada en WEB-22 tenga monto real.

Verificacion:

- `npm run typecheck`: OK.
- `npm run lint`: OK.
- `npm run build`: OK.
- `npm run test`: OK.
- `npm run check`: bloqueado en `format:check` por los mismos archivos preexistentes fuera de esta issue
  (`src/index.css`, `NEXT_CONTRIBUTOR.md`, archivos de `shared/types`, configs, etc.).

## WEB-22 / Issue #48 - BookingFormScreen

Estado: implementado en rama `booking-engine`.

Cambios realizados:

- `BookingFormScreen` dejo de ser placeholder y ahora carga tipos de habitacion y tarifas.
- El formulario usa los campos reales de `CreateBookingDto`: `guest_id`, `room_type_id`, `rate_id`, `check_in`, `check_out`, `adults`, `children` y `notes`.
- Precarga `roomTypeId`, `checkIn` y `checkOut` cuando vienen desde WEB-20/WEB-21 por query string.
- Valida campos requeridos con `Input`, `Select` y `DatePickerRange` de `shared/components`.
- Crea la reserva con `bookingService.createBooking(data)` y redirige a `/booking/:bookingId/done` con el id devuelto.
- No simula ni referencia pasarela de pago; HU-06 queda fuera de alcance como indica la issue.
- La pantalla cubre carga, error con reintento y lista vacia cuando no hay tipos de habitacion activos.
- El resumen muestra tarifa y total estimado con `formatCurrency`, y fechas con `formatDateGT`.

Verificacion:

- `npm run typecheck`: OK.
- `npm run lint`: OK.
- `npm run build`: OK.
- `npm run test`: OK.
- `npm run check`: bloqueado en `format:check` por los mismos archivos preexistentes fuera de esta issue
  (`src/index.css`, `NEXT_CONTRIBUTOR.md`, archivos de `shared/types`, configs, etc.).
