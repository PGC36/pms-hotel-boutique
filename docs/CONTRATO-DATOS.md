# Contrato de datos — PMS Hotel Boutique

**Última actualización:** 2026-10-04 · issue `#129` / limites Guatemala
pagos/FEL frontend.

## 1. Propósito y regla de gobierno

Este documento es el contrato de datos que comparten los dos repositorios del
PMS:

- **`pms-hotel-boutique` (web)** — motor de reservas público y operación
  privada (recepción, administración, caja, inventario, reportes).
- **`pms-hotel-mobile` (móvil)** — app React Native con experiencia de
  personal (limpieza, room service, conserjería) y experiencia de huésped
  (estadía, pedidos, solicitudes).

**La web es la fuente de verdad del contrato.** Define cada entidad como
DTO (snake_case) → Mapper → Model (camelCase) en
`src/shared/types/entities/<entidad>/`. Móvil **consume este contrato y no
lo redefine**: si móvil necesita un campo o un estado que no existe aquí, se
agrega aquí primero. Ningún cambio de campo, tipo o literal de estado se
hace en silencio — se anuncia a ambos equipos antes de tocar código (ver
sección 7).

Este documento está escrito para que quien lo lea no tenga que abrir el
código de la web.

## 2. Convenciones

- **Idioma:** todo identificador (archivo, variable, campo, tipo) en inglés.
  Español solo en texto visible al usuario y en documentación (`.md`).
- **DTO vs. Model:** el DTO es snake_case y es la forma que devolvería una
  API real; el Model es camelCase y es la forma que consume la UI. Un
  mapper (`toDomain`/`toDTO`) es el único punto que conoce ambas formas.
- **Moneda:** quetzal guatemalteco. Todo campo de dinero en un DTO termina
  en `_cents` y es un **entero** (nunca decimal). `currency` es el literal
  `'GTQ'` (`shared/types/common.ts`), nunca una unión de monedas ni un
  `string` suelto.
- **Pagos locales y FEL/SAT:** el contrato de datos no modela proveedores de
  pasarela ni documentos fiscales certificados. `payment.method` describe el
  metodo operativo abstracto; FEL/SAT y proveedores locales deben entrar por un
  contrato backend futuro. Hasta entonces, recibos/PDF son comprobantes
  operativos, no DTE/FEL. Ver
  [`docs/guatemala-pagos-fel-frontend.md`](guatemala-pagos-fel-frontend.md) y
  [`docs/DECISIONES.md`, D-015](DECISIONES.md).
- **Fechas — transporte vs. presentación:**
  - _Timestamp_ (`created_at`, `updated_at`, `charged_at`, `paid_at`,
    `requested_at`): ISO 8601 completo con hora y zona,
    p. ej. `"2026-09-10T09:30:00.000Z"`.
  - _Fecha civil_ (`check_in`, `check_out`, `valid_from`, `valid_to`): ISO
    8601 sin hora, `"YYYY-MM-DD"`, p. ej. `"2026-09-10"`. Nunca
    `new Date(value)` directo sobre un string de solo fecha — desplaza el
    día según la zona horaria del proceso que lo lee. Usar
    `toDomainCalendarDate`/`toDtoCalendarDate` (o el equivalente que móvil
    implemente del mismo lado).
  - **`dd-mm-aaaa` es exclusivamente de presentación.** Ningún DTO ni
    dataset lo usa; lo produce `formatDateGT` (`shared/utils/date.ts`) al
    mostrarlo en pantalla. Un DTO nunca lleva una fecha ya formateada para
    humanos.
- **IDs:** `string` en todo el contrato (`ID` en `shared/types/common.ts`).
  Tratarlos como opacos — nunca parsear ni comparar numéricamente (ver
  decisión pendiente 6.3).

### 2.1 DTOs de entrada de servicios WEB-14

Los servicios de escritura reciben DTOs de entrada, no Models. Sus respuestas
siempre son Models.

- `CreateRoomDto`: `room_number`, `room_type_id`, `floor`, y opcionalmente
  `status`, `housekeeping_status`, `notes`. `UpdateRoomDto` es el parcial de
  ese mismo contrato.
- `CreateBookingDto`: `guest_id`, `room_type_id`, `rate_id?`, `check_in`,
  `check_out`, `adults`, `children`, `notes?`.
- `CreateChargeDto`: `booking_id`, `product_id?`, `description`, `quantity`,
  `unit_price_cents`, `currency`, `category?`, `charged_at?`, `created_by_user_id?`. El
  servicio calcula `amount_cents` y fija `status: 'posted'`.

Servicios habilitados por WEB-14:

- `roomService.createRoom`, `roomService.updateRoom`, `roomService.getRoomTypes`.
- `bookingService.checkIn`, `bookingService.checkOut`,
  `bookingService.assignRoom`.
- `bookingCompanionService.getCompanionsByBookingId`,
  `bookingCompanionService.saveCompanionsForBooking`.
- `guestAccountService.createCharge`, `guestAccountService.createPayment`,
  `guestAccountService.voidCharge`.

`checkIn`/`checkOut` aplican `BOOKING_STATUS_TRANSITIONS`; `assignRoom` usa
`isRoomAssignable()`. En folios mock (`BKG-*`), el saldo se recalcula como
cargos activos menos pagos completados menos depositos no reembolsados. En
folios integrados con backend (UUID), `balance_cents` es autoridad del backend
y se consulta desde `GET /bookings/{bookingId}/folio`; ningun cliente debe usar
el calculo local como fuente oficial. `createCharge`, `createPayment` y
`voidCharge` actualizan ese saldo guardado solo en el camino mock.
`checkIn` marca la habitacion asignada como `occupied`. Los acompañantes se
persisten por reserva y se validan contra capacidad y composición de adultos/
niños antes de completar check-in.

En reservas UUID, check-in usa `POST /bookings/{id}/check-in`, asignacion de
habitacion usa `PUT /bookings/{id}` con `roomId` y acompanantes usan
`GET /bookings/{bookingId}/companions`,
`POST /bookings/{bookingId}/companions`,
`PUT /bookings/{bookingId}/companions/{companionId}` y
`DELETE /bookings/{bookingId}/companions/{companionId}`; el backend valida
estado, habitacion, acompanantes y composicion. El frontend aplica esas
mutaciones en orden `DELETE` -> `PUT` -> `POST` para no crear estados
temporales invalidos por carreras de red.

`checkOut` se bloquea si `balance_cents !== 0`; solo con saldo exactamente en cero cierra el folio,
marca la reserva como `checked_out` y deja la habitacion `available` con
`housekeeping_status: 'dirty'`.

En reservas UUID, ese bloqueo financiero lo decide el backend: el frontend llama
`POST /bookings/{id}/check-out`, muestra el `409` cuando el folio abierto tiene
saldo distinto de cero y no fuerza el cambio local de estado.

Actualizacion 2026-10-03 (#103): las funciones legacy de folio mock rechazan
reservas UUID. `voidCharge(chargeId, reason)` queda reservada para cargos mock;
si el cargo es UUID debe llamarse como `voidCharge(chargeId, reason, bookingId)`
para operar contra el backend.

Actualizacion 2026-10-04 (#101 / INT-03): `guestService` y `bookingService`
consumen el backend para huespedes y reservas. El transporte backend usa
camelCase (`firstName`, `guestId`, `roomTypeId`, `totalAmountCents`), pero la
web conserva este contrato interno snake_case -> Mapper -> Model. Los servicios
son el unico punto de adaptacion.

Actualizacion 2026-10-05 (#135 / INT-FINAL): `src/data/db.ts` fue eliminado.
Las entidades integradas no caen automaticamente a mocks cuando falla el
backend. Si una prueba necesita datos de contrato, usa fixtures bajo
`scripts/fixtures/`, no datos productivos locales.

Actualizacion 2026-10-04 (#102 / INT-04): las operaciones de recepcion
integradas para reservas UUID ya no cambian estados solo en frontend. Check-in,
check-out, asignacion de habitacion y acompanantes se ejecutan contra backend y
las pantallas refrescan los datos posteriores desde los servicios, incluyendo
habitaciones despues de check-in/check-out.

## 3. Entidad por entidad

Para cada entidad: si es compartida (ambos proyectos la leen) o exclusiva de
un lado, los campos del DTO, la forma del Model, y un ejemplo real.

### 3.1 `room` — compartida

Habitación física del hotel. **Dos campos de estado independientes, con
dueños distintos** — ver decisión D-002 en `docs/DECISIONES.md`:

| Campo DTO             | Tipo                                                          | Descripción                                                    |
| ----------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| `id`                    | `string`                                                          | Identificador opaco                                                |
| `room_number`           | `string`                                                          | Número visible al personal (`"101"`)                              |
| `room_type_id`          | `string`                                                          | FK a `room-type`                                                   |
| `floor`                 | `number`                                                          | Piso                                                               |
| `status`                | `'available' \| 'occupied' \| 'maintenance' \| 'out_of_service'` | **Ocupación.** Dueña: la web (recepción). Ver sección 4.           |
| `housekeeping_status`   | `'dirty' \| 'cleaning' \| 'clean' \| 'inspected'`                 | **Limpieza.** Dueña: la app móvil; la web solo la lee. Ver sección 4. |
| `notes?`                | `string`                                                          | Nota libre                                                         |
| `created_at`            | `string` (timestamp)                                              |                                                                     |
| `updated_at`            | `string` (timestamp)                                              |                                                                     |

Model: igual en camelCase (`roomNumber`, `roomTypeId`, `housekeepingStatus`),
`status` con `out_of_service → outOfService`, fechas como `Date`, más un
campo **calculado por el mapper, que no existe en el DTO**:

| Campo Model     | Tipo      | Descripción                                                                                                    |
| ---------------- | --------- | ----------------------------------------------------------------------------------------------------------------- |
| `isAssignable`   | `boolean` | `true` solo si `status === 'available'` y `housekeepingStatus` es `'clean'` o `'inspected'`. Calculado con `isRoomAssignable()` (`shared/constants/statuses.ts`) — **ninguna pantalla lo reimplementa**. |

```json
{
  "id": "RM-101",
  "room_number": "101",
  "room_type_id": "RT-01",
  "floor": 1,
  "status": "available",
  "housekeeping_status": "clean",
  "created_at": "2026-01-01T00:00:00.000Z",
  "updated_at": "2026-09-07T00:00:00.000Z"
}
```

### 3.2 `room-type` — compartida (de facto)

No estaba en la lista original de entidades cruzadas de la consigna, pero
`room`/`booking` dependen de ella para capacidad/descripción/amenidades, y
móvil las necesita para mostrarle al huésped el tipo de su habitación. Se
recomienda tratarla como compartida.

| Campo DTO           | Tipo       | Descripción                                    |
| -------------------- | ---------- | ------------------------------------------------ |
| `id`                 | `string`   |                                                   |
| `code`               | `string`   | Código corto (`"EST"`, `"DLX"`)                 |
| `name`               | `string`   |                                                   |
| `description?`       | `string`   |                                                   |
| `capacity`           | `number`   | Huéspedes máximos                               |
| `bed_configuration`  | `string`   | Texto libre                                      |
| `room_feature_ids`   | `string[]` | FKs a `room_feature` — **no** a `amenity` (D-001) |
| `active`             | `boolean`  |                                                   |
| `created_at`         | `string`   |                                                   |
| `updated_at`         | `string`   |                                                   |

```json
{
  "id": "RT-01",
  "code": "EST",
  "name": "Estándar",
  "description": "Habitación acogedora para una estancia práctica y tranquila.",
  "capacity": 2,
  "bed_configuration": "1 cama matrimonial",
  "room_feature_ids": ["RF-01", "RF-02", "RF-03"],
  "active": true,
  "created_at": "2026-01-01T00:00:00.000Z",
  "updated_at": "2026-01-01T00:00:00.000Z"
}
```

### 3.2b `room_feature` — compartida (**nueva**, separada de `amenity`)

Característica de la habitación (aire acondicionado, balcón, vista al
jardín, jacuzzi...): lo que el cliente compra al elegir un tipo de
habitación. Antes vivía mezclada con `amenity` bajo `room-type.amenity_ids`
— ver [`docs/DECISIONES.md`, D-001](./DECISIONES.md#d-001--room_feature-es-una-entidad-distinta-de-amenity)
para el porqué de la separación. Sin horario ni `active`/`inactive`: a
diferencia de una amenidad, una característica no se "abre" ni se "cierra".

| Campo DTO       | Tipo     | Descripción |
| ---------------- | -------- | ------------ |
| `id`              | `string` |              |
| `name`            | `string` |              |
| `description?`    | `string` |              |
| `created_at`      | `string` |              |
| `updated_at`      | `string` |              |

```json
{
  "id": "RF-01",
  "name": "Aire acondicionado",
  "description": "Climatización individual controlable desde la habitación.",
  "created_at": "2026-01-01T00:00:00.000Z",
  "updated_at": "2026-01-01T00:00:00.000Z"
}
```

### 3.3 `guest` — compartida

| Campo DTO          | Tipo                                                    | Descripción             |
| ------------------- | -------------------------------------------------------- | ------------------------ |
| `id`                | `string`                                                 |                           |
| `first_name`        | `string`                                                 |                           |
| `last_name`         | `string`                                                 |                           |
| `email?`            | `string`                                                 |                           |
| `phone?`            | `string`                                                 |                           |
| `nationality?`      | `string`                                                 |                           |
| `document_type?`    | `'passport' \| 'national_id' \| 'driver_license'`        |                           |
| `document_number?`  | `string`                                                 |                           |
| `notes?`            | `string`                                                 |                           |
| `created_at`        | `string`                                                 |                           |
| `updated_at`        | `string`                                                 |                           |

```json
{
  "id": "GST-001",
  "first_name": "Ana Lucía",
  "last_name": "López Cifuentes",
  "email": "ana.lopez@example.com",
  "phone": "+502 4210-6832",
  "nationality": "Guatemalteca",
  "document_type": "national_id",
  "document_number": "2451 77890 0101",
  "created_at": "2026-01-03T00:00:00.000Z",
  "updated_at": "2026-01-03T00:00:00.000Z"
}
```

### 3.4 `booking` — compartida (crítica)

Reserva de un huésped. `guest_link_code` es el campo que agrega este
contrato (FASE 2.3): el código que el huésped teclea en la app móvil para
vincularse a su estadía (ticket MOV-14). La web lo genera al crear/confirmar
la reserva. Es distinto de `confirmation_code`, que identifica la reserva
ante recepción.

| Campo DTO             | Tipo                                                                                          | Descripción                              |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `id`                    | `string`                                                                                        |                                             |
| `confirmation_code`     | `string`                                                                                        | Identifica la reserva ante recepción       |
| `guest_link_code`       | `string`                                                                                        | **Nuevo.** Código de vinculación (MOV-14)  |
| `guest_id`              | `string`                                                                                        |                                             |
| `room_id?`              | `string`                                                                                        | Puede no estar asignada aún                |
| `room_type_id`          | `string`                                                                                        |                                             |
| `rate_id?`              | `string`                                                                                        |                                             |
| `check_in`              | `string` (fecha civil)                                                                          |                                             |
| `check_out`             | `string` (fecha civil)                                                                          |                                             |
| `status`                | `'pending' \| 'confirmed' \| 'checked_in' \| 'checked_out' \| 'cancelled' \| 'no_show'`         | Ver sección 4                              |
| `adults`                | `number`                                                                                        |                                             |
| `children`              | `number`                                                                                        |                                             |
| `total_amount_cents`    | `number` (entero)                                                                               |                                             |
| `currency`              | `'GTQ'`                                                                                         |                                             |
| `notes?`                | `string`                                                                                        |                                             |
| `created_at`            | `string`                                                                                        |                                             |
| `updated_at`            | `string`                                                                                        |                                             |

```json
{
  "id": "BKG-001",
  "confirmation_code": "AUR-26001",
  "guest_link_code": "LNK-26001",
  "guest_id": "GST-001",
  "room_id": "RM-101",
  "room_type_id": "RT-01",
  "rate_id": "RATE-01",
  "check_in": "2026-09-10",
  "check_out": "2026-09-12",
  "status": "pending",
  "adults": 2,
  "children": 0,
  "total_amount_cents": 130000,
  "currency": "GTQ",
  "notes": "Solicita habitación silenciosa.",
  "created_at": "2026-09-01T00:00:00.000Z",
  "updated_at": "2026-09-01T00:00:00.000Z"
}
```

### 3.4b `booking_companion` — web / recepción

Acompañante registrado durante check-in. El huésped principal sigue siendo
`booking.guest_id`; los acompañantes no son cuentas de usuario ni reemplazan al
titular. Se relacionan con la reserva mediante `booking_id`.

Reglas:

- `1 huésped principal + booking_companion[] <= roomType.capacity`.
- El huésped principal cuenta como adulto.
- `companions adult === booking.adults - 1`.
- `companions child === booking.children`.

| Campo DTO         | Tipo                                      | Descripción                    |
| ----------------- | ----------------------------------------- | ------------------------------ |
| `id`              | `string`                                  |                                |
| `booking_id`      | `string`                                  | FK a `booking`                 |
| `first_name`      | `string`                                  |                                |
| `last_name`       | `string`                                  |                                |
| `document_type`   | `'passport' \| 'national_id' \| 'driver_license'` |                 |
| `document_number` | `string`                                  |                                |
| `guest_type`      | `'adult' \| 'child'`                      | Composición de la reserva      |
| `created_at`      | `string` (timestamp)                      |                                |
| `updated_at`      | `string` (timestamp)                      |                                |

Ejemplo DTO:

```json
{
  "id": "BCMP-001",
  "booking_id": "BKG-003",
  "first_name": "Lucia",
  "last_name": "Gomez",
  "document_type": "national_id",
  "document_number": "3012 77890 0101",
  "guest_type": "adult",
  "created_at": "2026-09-07T14:00:00.000Z",
  "updated_at": "2026-09-07T14:00:00.000Z"
}
```

### 3.5 `product` — compartida

| Campo DTO         | Tipo                                                            | Descripción              |
| ------------------ | ------------------------------------------------------------------ | -------------------------- |
| `id`               | `string`                                                            |                             |
| `sku`               | `string`                                                            | Ver decisión pendiente 6.1 |
| `name`              | `string`                                                            |                             |
| `description?`      | `string`                                                            |                             |
| `category`          | `'minibar' \| 'shop' \| 'food_and_beverage' \| 'other'`             | Ver decisión pendiente 6.2 |
| `price_cents`       | `number` (entero)                                                   |                             |
| `currency`          | `'GTQ'`                                                             |                             |
| `stock_quantity`    | `number`                                                            |                             |
| `reorder_level`     | `number`                                                            |                             |
| `active`            | `boolean`                                                           |                             |
| `created_at`        | `string`                                                            |                             |
| `updated_at`        | `string`                                                            |                             |

```json
{
  "id": "product-1",
  "sku": "AGUA-600ML",
  "name": "Agua mineral",
  "description": "Botella de 600 ml",
  "category": "minibar",
  "price_cents": 1500,
  "currency": "GTQ",
  "stock_quantity": 24,
  "reorder_level": 6,
  "active": true,
  "created_at": "2026-01-10T12:00:00.000Z",
  "updated_at": "2026-01-10T12:00:00.000Z"
}
```

### 3.6 `amenity` — compartida

Servicio compartido del hotel (piscina, spa, Wi-Fi general, desayuno) —
**no pertenece a una habitación ni a un tipo de habitación.** Antes
`room-type.amenity_ids` la referenciaba, mezclando este concepto con
características de habitación; ver [`docs/DECISIONES.md`, D-001](./DECISIONES.md#d-001--room_feature-es-una-entidad-distinta-de-amenity).
**No agregar de nuevo una referencia desde `room`/`room-type` a `amenity`.**
No tiene horario de funcionamiento todavía a pesar de ser un servicio
compartido — es una limitación conocida, no algo que este documento
resuelva (agregarlo es trabajo futuro del equipo, no una decisión tomada).

| Campo DTO       | Tipo                                        | Descripción              |
| ---------------- | --------------------------------------------- | -------------------------- |
| `id`              | `string`                                      |                             |
| `name`            | `string`                                      |                             |
| `description?`    | `string`                                      |                             |
| `category`        | `'room' \| 'hotel' \| 'service'`             | Ver decisión pendiente 6.2 |
| `location?`       | `string`                                      |                             |
| `active`          | `boolean`                                     |                             |
| `created_at`      | `string`                                      |                             |
| `updated_at`      | `string`                                      |                             |

```json
{
  "id": "amenity-1",
  "name": "Wi-Fi",
  "description": "Internet inalámbrico",
  "category": "hotel",
  "active": true,
  "created_at": "2026-01-10T12:00:00.000Z",
  "updated_at": "2026-01-10T12:00:00.000Z"
}
```

### 3.6b `media_image` — compartida (**nueva**, #146)

Imagen de catálogo asociada a un `room-type`, `product` o `amenity`. No
existe sola: llega dentro del campo `images` de esas tres entidades, ordenada
por `position`. Un registro sin fotos trae `images: []` y se muestra con un
placeholder neutral. Flujo de carga, límites y reglas en
[`docs/DECISIONES.md`, D-017](./DECISIONES.md#d-017--146-las-imágenes-de-catálogo-salen-solo-del-backend).

| Campo DTO     | Tipo                                         | Descripción                                      |
| ------------- | -------------------------------------------- | ------------------------------------------------ |
| `id`          | `string`                                     |                                                  |
| `alt_text?`   | `string`                                     | Texto alternativo; ausente si no se cargó        |
| `position`    | `number`                                     | Orden en la galería, desde 0                     |
| `primary`     | `boolean`                                    | Imagen principal (portada) del registro          |
| `width`       | `number`                                     | Píxeles del original ya orientado                |
| `height`      | `number`                                     |                                                  |
| `urls`        | `{ thumb: string; medium: string; large: string }` | URLs públicas por variante (320/960/1600 px) |

Al crear o actualizar, el registro recibe `images?: { media_id, alt_text?, primary? }[]`
con imágenes ya subidas por `POST /media`. Ausente: no cambia la galería;
lista vacía: la vacía.

```json
{
  "id": "6f1c2a8e-…",
  "alt_text": "Cama king con vista al jardín",
  "position": 0,
  "primary": true,
  "width": 1600,
  "height": 1067,
  "urls": {
    "thumb": "https://api.example.com/api/v1/public/media/6f1c2a8e-…/thumb",
    "medium": "https://api.example.com/api/v1/public/media/6f1c2a8e-…/medium",
    "large": "https://api.example.com/api/v1/public/media/6f1c2a8e-…/large"
  }
}
```

### 3.7 `user` — compartida (puesto de personal, no rol de acceso)

Ver sección 3.12 para la distinción con `session`.

| Campo DTO       | Tipo                                                                        | Descripción       |
| ---------------- | ------------------------------------------------------------------------------ | ------------------- |
| `id`              | `string`                                                                        |                     |
| `first_name`      | `string`                                                                        |                     |
| `last_name`       | `string`                                                                        |                     |
| `email`           | `string`                                                                        |                     |
| `role`            | `'admin' \| 'guest' \| 'reception' \| 'housekeeping' \| 'concierge' \| 'room_service'` | Rol operativo/acceso alineado |
| `status`          | `'active' \| 'inactive'`                                                       |                     |
| `created_at`      | `string`                                                                        |                     |
| `updated_at`      | `string`                                                                        |                     |

```json
{
  "id": "user-1",
  "first_name": "Ana",
  "last_name": "Martínez",
  "email": "ana@hotelboutique.test",
  "role": "reception",
  "status": "active",
  "created_at": "2026-01-10T12:00:00.000Z",
  "updated_at": "2026-01-10T12:00:00.000Z"
}
```

### 3.8 `order` — compartida (crítica, **nueva** en este PR)

Pedido de Room Service. Móvil lo opera (el personal marca el avance);
la web lo cobra: al entregarse, el consumo se carga a la cuenta del
huésped vía `charge_id`. Si web y móvil divergen aquí, el cargo no se
puede generar.

| Campo DTO         | Tipo                                                                                                                    | Descripción                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `id`                | `string`                                                                                                                     |                                                     |
| `booking_id`        | `string`                                                                                                                     | Reserva/estadía a la que se carga el consumo       |
| `room_id`           | `string`                                                                                                                     | Habitación de entrega                              |
| `guest_id?`         | `string`                                                                                                                     | Denormalizado por conveniencia                     |
| `items`             | `{ product_id: string; quantity: number; unit_price_cents: number }[]`                                                      | Snapshot de precio al momento del pedido           |
| `status`            | `'pending' \| 'accepted' \| 'preparing' \| 'ready' \| 'on_the_way' \| 'delivered' \| 'rejected' \| 'cancelled'`             | Ver sección 4                                      |
| `notes?`            | `string`                                                                                                                     |                                                     |
| `currency`          | `'GTQ'`                                                                                                                     |                                                     |
| `charge_id?`        | `string`                                                                                                                     | FK a `charge`, se llena al facturar                |
| `requested_at`      | `string`                                                                                                                     |                                                     |
| `created_at`        | `string`                                                                                                                     |                                                     |
| `updated_at`        | `string`                                                                                                                     |                                                     |

```json
{
  "id": "order-1",
  "booking_id": "BKG-001",
  "room_id": "RM-101",
  "guest_id": "GST-001",
  "items": [{ "product_id": "product-1", "quantity": 2, "unit_price_cents": 1500 }],
  "status": "on_the_way",
  "notes": "Entregar sin tocar la puerta.",
  "currency": "GTQ",
  "charge_id": null,
  "requested_at": "2026-09-10T09:30:00.000Z",
  "created_at": "2026-09-10T09:30:00.000Z",
  "updated_at": "2026-09-10T09:45:00.000Z"
}
```

### 3.9 `service_request` — compartida (crítica, **nueva** en este PR)

Solicitud de limpieza o conserjería. A diferencia de `order`, no lleva
productos: viaja un `type` y una `description` libre. `charge_id` cubre el
caso poco común de una solicitud que sí genera un cargo (p. ej. un taxi
reservado por conserjería).

| Campo DTO       | Tipo                                                                       | Descripción       |
| ---------------- | ------------------------------------------------------------------------------ | ------------------- |
| `id`              | `string`                                                                        |                     |
| `booking_id`      | `string`                                                                        |                     |
| `room_id`         | `string`                                                                        |                     |
| `guest_id?`       | `string`                                                                        |                     |
| `type`            | `'housekeeping' \| 'concierge' \| 'maintenance' \| 'other'`                    |                     |
| `description`     | `string`                                                                        | Qué se solicita     |
| `status`          | `'pending' \| 'accepted' \| 'in_progress' \| 'completed' \| 'rejected'`        | Ver sección 4       |
| `notes?`          | `string`                                                                        |                     |
| `charge_id?`      | `string`                                                                        |                     |
| `requested_at`    | `string`                                                                        |                     |
| `created_at`      | `string`                                                                        |                     |
| `updated_at`      | `string`                                                                        |                     |

```json
{
  "id": "service-request-1",
  "booking_id": "BKG-001",
  "room_id": "RM-101",
  "guest_id": "GST-001",
  "type": "housekeeping",
  "description": "Toallas extra",
  "status": "in_progress",
  "notes": "Huésped en la habitación después de las 3pm.",
  "requested_at": "2026-09-10T09:00:00.000Z",
  "created_at": "2026-09-10T09:00:00.000Z",
  "updated_at": "2026-09-10T09:10:00.000Z"
}
```

### 3.10 `rate`, `charge`, `payment`, `promotion` — exclusivas de la web

No las necesita móvil. Se listan solo por completitud del inventario:

- **`rate`**: tarifa por tipo de habitación y vigencia (`room_type_id`,
  `valid_from`/`valid_to`, `price_cents`, `minimum_nights`, `refundable`).
- **`charge`**: cargo a la cuenta de una reserva (`booking_id`,
  `product_id?`, `quantity`, `unit_price_cents`, `amount_cents`, `category?`, `status`,
  `void_reason?` — **nuevo**, el motivo cuando `status === 'voided'`; el
  registro original se conserva, nunca se borra). Es el destino de
  `order.charge_id`/`service_request.charge_id`. Ya tiene dataset real y
  servicio propio (`guestAccountService.ts`, sección 3.13).
- **`payment`**: pago aplicado a una reserva (`booking_id`, `amount_cents`,
  `method`, `status`). La fuente productiva es el backend consumido por
  `guestAccountService.ts` y `paymentService.ts`. **Resuelto:** ya no existen
  dos datasets frontend para la misma entidad; los fixtures de prueba viven
  fuera del bundle productivo.
- **`promotion`**: código de descuento para el motor de reservas
  (`code`, `discount_percent`, `valid_from`/`valid_to`).

### 3.10b Lote C (WEB-11) — cuentas, pagos y caja, exclusivas de la web

`guest_account`, `deposit`, `cash_session` y `cash_movement` son nuevas en
este PR. Ninguna la necesita móvil — son recepción y dinero, operación
exclusiva de la web. Servidas por `guestAccountService.ts` (cuenta, cargo,
pago, depósito) y `cashService.ts` (jornada, movimiento).

#### `guest_account`

Folio de una estadía: agrega los cargos y pagos de una reserva. Una cuenta
por reserva (1:1) — `charge`/`payment` siguen referenciando `booking_id`
directamente, no un `account_id` nuevo.

| Campo DTO | Tipo | Descripción |
| --- | --- | --- |
| `id` | `string` | |
| `booking_id` | `string` | FK a `booking` |
| `guest_id` | `string` | FK a `guest` |
| `status` | `'open' \| 'closed'` | Ver sección 4 |
| `balance_cents` | `number` (entero) | **Guardado**, no derivado — cargos (no anulados) menos pagos completados de la misma reserva |
| `currency` | `'GTQ'` | |
| `opened_at` | `string` (timestamp) | |
| `closed_at?` | `string` (timestamp) | Solo si `status === 'closed'` |
| `created_at` / `updated_at` | `string` | |

Regla vigente #71: `balance_cents` se recalcula como cargos `posted` menos
pagos `completed` menos depositos no `refunded`. El cargo base de estancia se
identifica con `charge.category === 'stay'` y se crea de forma idempotente al
abrir/sincronizar el folio; consumos operativos usan `category: 'consumption'`.
El check-out exige `balance_cents === 0`.

```json
{
  "id": "GACC-001",
  "booking_id": "BKG-003",
  "guest_id": "GST-003",
  "status": "open",
  "balance_cents": 105500,
  "currency": "GTQ",
  "opened_at": "2026-09-07T14:00:00.000Z",
  "created_at": "2026-09-07T14:00:00.000Z",
  "updated_at": "2026-09-08T18:00:00.000Z"
}
```

#### `deposit`

Depósito o garantía entregado al check-in.

| Campo DTO | Tipo | Descripción |
| --- | --- | --- |
| `id` | `string` | |
| `booking_id` / `guest_id` | `string` | FKs |
| `amount_cents` | `number` (entero) | |
| `currency` | `'GTQ'` | |
| `method` | `'cash' \| 'credit_card' \| 'debit_card' \| 'bank_transfer'` | |
| `status` | `'held' \| 'refunded' \| 'applied'` | Ver sección 4 |
| `collected_at` | `string` (timestamp) | |
| `refunded_at?` | `string` (timestamp) | |
| `notes?` | `string` | |
| `created_at` / `updated_at` | `string` | |

```json
{
  "id": "DEP-002",
  "booking_id": "BKG-004",
  "guest_id": "GST-004",
  "amount_cents": 100000,
  "currency": "GTQ",
  "method": "credit_card",
  "status": "refunded",
  "collected_at": "2026-08-20T14:00:00.000Z",
  "refunded_at": "2026-08-23T11:00:00.000Z",
  "created_at": "2026-08-20T14:00:00.000Z",
  "updated_at": "2026-08-23T11:00:00.000Z"
}
```

#### `cash_session`

Jornada de caja: apertura, movimientos, cierre con saldo contado.

| Campo DTO | Tipo | Descripción |
| --- | --- | --- |
| `id` | `string` | |
| `opened_by_user_id?` | `string` | FK a `user`; solo si la operacion trae usuario real de sesion |
| `opened_at` | `string` (timestamp) | |
| `opening_balance_cents` | `number` (entero) | |
| `currency` | `'GTQ'` | |
| `status` | `'open' \| 'closed'` | Ver sección 4 |
| `closed_by_user_id?` / `closed_at?` | `string` | Solo si `status === 'closed'` |
| `expected_balance_cents?` | `number` (entero) | **Guardado** — apertura + ingresos - egresos de sus `cash_movement` |
| `counted_balance_cents?` | `number` (entero) | Lo que se contó físicamente |
| `difference_cents?` | `number` (entero) | **Guardado** — `counted - expected` |
| `notes?` | `string` | |
| `created_at` / `updated_at` | `string` | |

```json
{
  "id": "CS-002",
  "opened_by_user_id": "USR-001",
  "opened_at": "2026-09-09T08:00:00.000Z",
  "opening_balance_cents": 685000,
  "currency": "GTQ",
  "status": "closed",
  "closed_by_user_id": "USR-002",
  "closed_at": "2026-09-09T20:00:00.000Z",
  "expected_balance_cents": 1257000,
  "counted_balance_cents": 1253000,
  "difference_cents": -4000,
  "notes": "Faltante sin explicar; se reportó a administración.",
  "created_at": "2026-09-09T08:00:00.000Z",
  "updated_at": "2026-09-09T20:00:00.000Z"
}
```

#### `cash_movement`

Ingreso o egreso dentro de una jornada.

| Campo DTO | Tipo | Descripción |
| --- | --- | --- |
| `id` | `string` | |
| `cash_session_id` | `string` | FK a `cash_session` |
| `type` | `'income' \| 'expense'` | Clasificación, no un estado — declarado localmente |
| `concept` | `string` | |
| `amount_cents` | `number` (entero) | |
| `currency` | `'GTQ'` | |
| `responsible_user_id?` | `string` | FK a `user`; solo si la operacion trae usuario real de sesion |
| `occurred_at` | `string` (timestamp) | |
| `payment_id?` | `string` | FK a `payment`, cuando el ingreso viene de un pago de huésped |
| `created_at` | `string` | |

```json
{
  "id": "CMV-003",
  "cash_session_id": "CS-002",
  "type": "income",
  "concept": "Pago total anticipado — reserva BKG-009",
  "amount_cents": 300000,
  "currency": "GTQ",
  "responsible_user_id": "USR-001",
  "occurred_at": "2026-09-09T10:00:00.000Z",
  "payment_id": "PAY-201",
  "created_at": "2026-09-09T10:00:00.000Z"
}
```

### 3.10c Lote D (WEB-12) — personal, catálogos e inventario, exclusivas de la web

`role`, `permission`, `inventory_item`, `inventory_movement` y `audit_log`
son nuevas en este PR. Ninguna la necesita móvil. Servidas por
`personnelService.ts`, `inventoryService.ts` y `auditService.ts`.

#### `role` y `permission`

| Campo DTO (`role`) | Tipo | Descripción |
| --- | --- | --- |
| `id` | `string` | |
| `code` | `string` | **No es una FK real** — corresponde por valor a `UserRoleDto` (D-003) |
| `name` | `string` | |
| `permission_ids` | `string[]` | FKs a `permission` |
| `active` | `boolean` | |
| `created_at` / `updated_at` | `string` | |

`permission`: `id, key, name, description?, created_at, updated_at` — sin
campo `active` (un permiso no se desactiva, se quita de un rol).

```json
{
  "id": "ROLE-004",
  "code": "housekeeping",
  "name": "Limpieza",
  "permission_ids": ["PERM-005", "PERM-009"],
  "active": true,
  "created_at": "2026-08-01T00:00:00.000Z",
  "updated_at": "2026-08-01T00:00:00.000Z"
}
```

#### `inventory_item` y `inventory_movement`

`inventory_item` es **más amplio que `product`**: cubre también insumos
operativos (blancos, químicos de limpieza) que nunca se venden al
huésped. `product_id?` enlaza el subconjunto de artículos que sí son
productos de Room Service vendibles.

| Campo DTO (`inventory_item`) | Tipo | Descripción |
| --- | --- | --- |
| `id` | `string` | |
| `sku` | `string` | Catálogo de SKU **separado** del de `product` — ver decisión pendiente 6.1/D-004 |
| `name` / `description?` | `string` | |
| `category` | `'room_service' \| 'housekeeping' \| 'maintenance' \| 'office'` | Taxonomía propia, distinta de `ProductCategoryDto` — ver decisión pendiente 6.2/D-005 |
| `unit` | `'unit' \| 'box' \| 'bottle' \| 'kg' \| 'liter' \| 'roll'` | |
| `current_quantity` | `number` (entero) | **Guardado** — entradas menos salidas de sus `inventory_movement` |
| `minimum_quantity` | `number` (entero) | |
| `product_id?` | `string` | FK a `product`, cuando aplica |
| `active` | `boolean` | |
| `created_at` / `updated_at` | `string` | |

Model: agrega `isAssignable`-style `isBelowMinimum: boolean` (calculado
por el mapper — `currentQuantity < minimumQuantity`, **no existe en el
DTO**; ninguna pantalla debe recalcularlo).

`inventory_movement`: `id, inventory_item_id, type('in'|'out'),
reason('purchase'|'restock'|'consumption'|'sale'|'shrinkage'),
quantity, responsible_user_id?, occurred_at, notes?, created_at`. Los campos
de usuario operativo (`opened_by_user_id`, `responsible_user_id`) no usan
fallbacks: si se envia un ID inexistente, el servicio rechaza la operacion; si
no se envia, quedan ausentes.

```json
{
  "id": "INV-003",
  "sku": "INV-0003",
  "name": "Papas fritas",
  "category": "room_service",
  "unit": "box",
  "current_quantity": 5,
  "minimum_quantity": 10,
  "product_id": "PRD-007",
  "active": true,
  "created_at": "2026-08-01T00:00:00.000Z",
  "updated_at": "2026-09-06T00:00:00.000Z"
}
```

#### `audit_log`

Registro de auditoría: quién, cuándo, qué módulo, qué acción, sobre qué
entidad.

| Campo DTO | Tipo | Descripción |
| --- | --- | --- |
| `id` | `string` | |
| `user_id` | `string` | FK a `user` |
| `module` | `'guest_accounts' \| 'cash' \| 'inventory' \| 'catalog' \| 'users' \| 'bookings' \| string` | Valores futuros del backend se preservan; no se sustituyen por un modulo conocido. |
| `action` | `'create' \| 'update' \| 'delete' \| 'void' \| 'open' \| 'close' \| string` | Valores futuros del backend se preservan; no se sustituyen por una accion conocida. |
| `entity_type` / `entity_id` | `string` | La entidad afectada, sin FK tipado (cualquier entidad del contrato) |
| `occurred_at` | `string` (timestamp) | |
| `details?` | `string` | |
| `created_at` | `string` | |

```json
{
  "id": "AUD-004",
  "user_id": "USR-002",
  "module": "cash",
  "action": "close",
  "entity_type": "cash_session",
  "entity_id": "CS-002",
  "occurred_at": "2026-09-09T20:00:00.000Z",
  "details": "Diferencia de -4000 centavos registrada.",
  "created_at": "2026-09-09T20:00:00.000Z"
}
```

### 3.11 `notification`, `cart_item` — exclusivas de móvil

**No se definen en este contrato.** Según el reparto acordado, son
conceptos que solo existen en la app móvil (una notificación push local,
un ítem de carrito antes de confirmarse como `order`). Móvil los modela en
su propio repositorio; la web no los necesita y no debe crearlos aquí para
no inflar un contrato que no le pertenece.

### 3.12 `session` vs. `user` — no fusionar

Dos conceptos que comparten nombre por casualidad:

- **`shared/types/entities/session/`** modela la respuesta de login: el
  **rol de acceso al PMS** (`UserRole` en `common.ts`:
  `ADMIN | GUEST | RECEPTION | HOUSEKEEPING | CONCIERGE | ROOM_SERVICE`), token, expiración. Es lo que
  decide que pantallas/permisos ve una sesion autenticada en la web.
- **`shared/types/entities/user/`** modela el **puesto de un empleado** en
  el directorio de personal (`admin | guest | reception | housekeeping | concierge | roomService`), usado en catalogos/reportes.

Móvil, según su propio plan (MOV-04), solo necesita replicar `user` (el
puesto, para mostrar quién es el personal asignado a una tarea). No
necesita replicar `session` — la experiencia de personal en móvil
presumiblemente tendrá su propio mecanismo de autenticación, y la
experiencia de huésped no usa login en absoluto (se vincula con
`guest_link_code`). **Cómo se autentica el personal en la app móvil no
está resuelto por este contrato** — es una pregunta abierta para cuando se
escriba MOV-04 a fondo, no una decisión de datos.

## 4. Máquinas de estado

Definidas en `src/shared/constants/statuses.ts` (única fuente). Los
literales son los del **Model** (camelCase); el DTO los traduce a
snake_case en su mapper, igual que el resto del contrato.

### `room`: ocupación (`RoomStatus`) — dueña la web

Responde "¿se puede vender la habitación?". Decisión tomada, D-002 en
`docs/DECISIONES.md` — ya no es una decisión pendiente. Los 4 literales son
los mismos que ya usaba la web; el único cambio es que `cleaning` se retiró
de aquí porque pertenece a la otra máquina.

```
available    → occupied | maintenance | outOfService
occupied     → available | maintenance | outOfService
maintenance  → available | outOfService
outOfService → available | maintenance
```

### `room`: limpieza (`RoomHousekeepingStatus`) — dueña la app móvil

Responde "¿en qué paso de la limpieza está?". Campo nuevo
(`housekeeping_status` en el DTO). **Móvil es quien transiciona este
estado — la web solo lo lee**, nunca lo escribe.

```
dirty     → cleaning
cleaning  → clean
clean     → inspected | dirty
inspected → dirty
```

### `room`: regla de asignabilidad derivada

Una habitación es asignable solo si `status === 'available'` **y**
`housekeepingStatus` es `'clean'` o `'inspected'`. La función
`isRoomAssignable()` (`shared/constants/statuses.ts`) es la única
implementación — ninguna pantalla, de ningún lado, debe repetir esta
comparación con condicionales sueltos. Ejemplo del caso que motivó separar
los dos campos: una habitación `available` con `housekeeping_status:
'dirty'` **no es asignable**, aunque su ocupación diga que está libre.

### `booking` (`BookingStatus`)

Literales tal cual los usa el dataset del Lote B. Ninguna capa de código
imponía estas transiciones antes de este contrato; se documentan como la
interpretación de dominio más directa.

```
pending    → confirmed | cancelled | noShow
confirmed  → checkedIn | cancelled | noShow
checkedIn  → checkedOut
checkedOut → (terminal)
cancelled  → (terminal)
noShow     → (terminal)
```

### `order` (`OrderStatus`) — nuevo

```
pending   → accepted | rejected | cancelled
accepted  → preparing | cancelled
preparing → ready
ready     → onTheWay
onTheWay  → delivered
delivered → (terminal)
rejected  → (terminal)
cancelled → (terminal)
```

Cancelable solo en `pending` y `accepted`, tal como pedía el plan MOV-04.

### `service_request` (`ServiceRequestStatus`) — nuevo

```
pending   → accepted | rejected
accepted  → inProgress
inProgress→ completed
completed→ (terminal)
rejected → (terminal)
```

### `guest_account` (`GuestAccountStatus`), `deposit` (`DepositStatus`), `cash_session` (`CashSessionStatus`) — nuevos (Lote C, WEB-11)

```
guest_account: open → closed (terminal)
deposit:       held → refunded | applied (ambos terminales)
cash_session:  open → closed (terminal)
```

Ninguna se reabre — un ajuste posterior es un registro nuevo (cargo, pago,
movimiento), no una transición de vuelta.

## 5. Qué debe replicar la app móvil (MOV-04)

Lista explícita, sin necesidad de leer código web:

1. **Entidades a replicar tal cual:** `room`, `room-type`, `room_feature`,
   `guest`, `booking` (incluyendo `guest_link_code`), `product`, `amenity`,
   `user`, `order`, `service_request`. Todas con la forma de **Model**
   (camelCase) descrita en la sección 3 — móvil no necesita replicar la
   forma DTO si su propia capa de red ya hace su propia traducción
   snake_case → camelCase con la misma tabla de campos. **Importante:**
   `room_feature` y `amenity` son catálogos distintos con ciclos de vida
   distintos (D-001) — no colapsarlos en uno solo del lado de móvil.
2. **Entidades que NO debe crear:** `rate`, `charge`, `payment`,
   `promotion`, `session`, y las del Lote C/D (`guest_account`, `deposit`,
   `cash_session`, `cash_movement`, `role`, `permission`, `inventory_item`,
   `inventory_movement`, `audit_log`) — todas exclusivas de la operación
   de recepción/administración en la web; ninguna aplica al lado de móvil.
3. **Entidades propias de móvil, fuera de este contrato:** `notification`,
   `cart_item`.
4. **Literales de estado exactos** (sección 4): `RoomStatus`,
   `RoomHousekeepingStatus`, `BookingStatus`, `OrderStatus`,
   `ServiceRequestStatus` — mismo naming camelCase, ninguna variante.
5. **`room`: quién escribe qué campo (D-002).** Móvil **escribe**
   `housekeepingStatus` (el personal de limpieza transiciona
   `dirty → cleaning → clean → inspected`) y **solo lee** `status`
   (ocupación) — nunca lo modifica; el check-in/check-out y el bloqueo por
   mantenimiento son operación de recepción, en la web. Si móvil necesita
   saber si puede ofrecer una habitación para algo, consulta
   `isAssignable` (ya calculado en el Model), no reimplementa la regla.
6. **Campos de dinero:** siempre `*_cents` entero en el transporte;
   `currency` siempre `'GTQ'`.
7. **Fechas:** ISO 8601 en el transporte (civil `YYYY-MM-DD` vs. timestamp
   completo, sección 2); la presentación al huésped/personal en pantalla es
   decisión de UI de móvil, no de este contrato — pero debe usar el mismo
   criterio civil-vs-timestamp para no desplazar días.
8. **Vinculación del huésped:** el flujo de "ingresar código" en la
   pantalla de bienvenida de la app usa `booking.guest_link_code` — móvil
   nunca lo genera, solo lo valida contra lo que la web emitió.
9. **Cierre del círculo de cobro:** cuando móvil marca un `order` o
   `service_request` como `delivered`/`completed`, la web es quien crea el
   `charge` correspondiente y llena `charge_id` — móvil no calcula montos,
   solo reporta el evento de estado.

## 6. Decisiones pendientes de equipo

Documentadas con recomendación, **no implementadas** en este PR.

### 6.1 Formato de SKU de inventario — **provisional en uso, sigue sin decidirse formalmente** (D-004)

**Estado:** el Lote C/D eligió un formato provisional para poblar `product.sku`
e `inventory_item.sku` (catálogos separados) y esa decisión sigue documentada
en `docs/DECISIONES.md` D-004. **Esto no es una decisión formal tomada** — fue
el valor provisional para no bloquear el resto del trabajo; el equipo puede
cambiarlo desde backend/contrato.

**Problema:** los SKU actuales (`AGUA-600ML`, `SERV-EXPRESS`) son
inventados para el mock, sin esquema formal. El Lote D va a construir el
inventario real asumiendo lo que encuentre aquí.

**Opciones:**

- **A. Texto libre legible** (el actual): fácil de inventar, legible en
  recibos; sin garantía de unicidad ni de estructura, no valida por regex.
- **B. Prefijo por categoría + secuencia** (`MIN-0001`, `SHP-0002`,
  `FYB-0003`): ordenable, validable con un test de contrato simple, sigue
  siendo legible para el personal; requiere migrar los SKU existentes y
  mantener una tabla categoría→prefijo.
- **C. Código opaco (UUID/ULID) + `display_name`/código de barras aparte**:
  a prueba de colisiones, alineado con una integración real de inventario
  (EAN-13); exceso de complejidad para un inventario boutique pequeño, sin
  mnemónico legible sin una segunda consulta.

**Recomendación:** **B**. Da estructura suficiente para que el Lote D
valide SKUs con un test de contrato (similar a los que ya existen), sin la
sobreingeniería de C para un inventario de este tamaño. Decidir antes de
que el Lote D cargue datos reales — retrocorregir SKUs después de la carga
es más costoso que decidir el esquema ahora.

### 6.2 Catálogo de categorías de producto, amenidad e inventario (D-005)

**Problema:** `ProductCategoryDto` (`minibar | shop | food_and_beverage |
other`) y `AmenityCategoryDto` (`room | hotel | service`) no tienen un
mapeo exacto a las secciones de menú que móvil necesita para agrupar Room
Service (p. ej. "Bebidas", "Snacks", "Postres" no existen hoy). El Lote D
(este PR) agregó una **tercera** taxonomía —
`InventoryItemCategoryDto` (`room_service | housekeeping | maintenance |
office`), para `inventory_item` — que tampoco se reconcilia con las otras
dos. Cuando el equipo resuelva esta decisión, conviene resolver las tres
categorías juntas, no una a la vez.

**Opciones:**

- **A. Mantener las categorías actuales** y que móvil las agrupe del lado
  cliente con etiquetas estáticas propias: cero cambios en la web; riesgo
  de que la taxonomía de menú diverja entre versiones de la app sin que la
  web lo sepa.
- **B. Expandir las categorías existentes** con subcategorías orientadas a
  menú (p. ej. dividir `food_and_beverage` en `beverage`/`food`/`dessert`):
  una sola taxonomía compartida; es un cambio disruptivo sobre un literal
  ya usado por datos existentes, y necesita decidir las categorías nuevas
  con criterio de UX, no de código.
- **C. Campo `menu_section` independiente** de `category`: separa
  "categoría de inventario" (para reportes/caja) de "cómo se agrupa en el
  menú" (para la UI de Room Service); requiere decidir quién es dueño de
  asignar `menu_section` a cada producto/amenidad.

**Recomendación:** **C** como punto de partida — no conviene forzar que la
categorización de inventario (útil para reportes y caja) cargue también con
la taxonomía de UX del menú de Room Service. El mapeo concreto
categoría→sección de menú es una decisión de producto que el equipo debe
tomar en la sesión, no algo que se pueda inferir del código actual.

### 6.3 Tipo de los identificadores de entidad

**Problema:** todo `id` en el contrato es `string` (`ID` en
`common.ts`), pero los datasets ya usan dos esquemas de slug distintos
(`booking-1` en `mockData.ts` vs. `BKG-001` en `lot-b.ts`). Si algún lado
decidiera cambiar a entero, cada llamada entre proyectos necesitaría
conversión.

**Opciones:**

- **A. Mantener `string` opaco** (el actual): sin riesgo de precisión
  numérica, compatible con UUID/ULID si el backend real los usa; requiere
  disciplina para no comparar/ordenar como número en ningún lado.
- **B. Migrar a entero**: payloads más pequeños, autoincremental natural
  para una base relacional; rompe el contrato completo (11+ entidades),
  colisiona con que `confirmation_code`/`guest_link_code` ya son
  inherentemente strings.

**Recomendación:** **A**. Un backend real emitirá casi con certeza
identificadores tipo UUID/ULID (string), y móvil ya trata los IDs como
claves opacas en su estado local — no hay beneficio funcional en migrar a
entero, solo costo de reescritura. Se recomienda declarar esto **cerrado**
salvo que el backend real fuerce lo contrario.

### 6.4 Máquina de estado de `room`: disponibilidad vs. flujo de limpieza — **resuelta, ya no es una decisión pendiente**

**Estado: resuelta e implementada** (ver
[`docs/DECISIONES.md`, D-002](./DECISIONES.md#d-002--el-estado-de-habitación-son-dos-campos-no-uno)).
El equipo eligió la opción C que este documento recomendaba: dos campos
ortogonales, `status` (ocupación, dueña la web) + `housekeeping_status`
(limpieza, dueña la app móvil), con `isRoomAssignable()` como regla
derivada. Ver sección 3.1 (contrato de `room`) y sección 4 (las dos
máquinas) para el detalle ya implementado.

### 6.5 Referencia rota: `amenity_ids` de `lot-b.ts` — **resuelta**

**Estado: resuelta e implementada** (ver
[`docs/DECISIONES.md`, D-001](./DECISIONES.md#d-001--room_feature-es-una-entidad-distinta-de-amenity)).
El diagnóstico encontró que la referencia rota no era solo un hueco de
datos: `room-type.amenity_ids` mezclaba dos conceptos (características de
habitación y amenidades de hotel) bajo una sola entidad. Se separó en
`room_feature` (nueva, sin horario) y `amenity` (sin cambios en su
contrato, pero ya no referenciada desde `room-type`). Sección 3.2b tiene el
contrato de `room_feature`.

### 6.6 Catálogo `role`/`permission` y su relación con `user.role` — **resuelta**

**Estado: resuelta e implementada** (ver
[`docs/DECISIONES.md`, D-003](./DECISIONES.md#d-003--el-catálogo-rolepermission-no-es-una-fk-desde-userrole)).
`role.code` corresponde por **valor** a los literales de `UserRoleDto`,
no por una FK real; `user.role` mantiene el tipo `UserRoleDto` alineado. Seccion 3.10c tiene el
contrato completo.

## 7. Cómo se cambia este contrato

1. **Proponer el cambio** en un issue que describa el campo/entidad/estado
   nuevo y quién lo necesita (web, móvil, o ambos).
2. **Anunciarlo a ambos equipos** antes de tocar código — este documento
   existe para que móvil no tenga que leer el código web, así que un
   cambio sin anuncio rompe esa promesa aunque el código compile.
3. **Un solo PR en la web** que actualice, juntos: el DTO, el Model, el
   mapper, `shared/constants/statuses.ts` si agrega un estado, el dataset
   mock si aplica, la prueba de contrato correspondiente
   (`scripts/test-shared-contract.mjs` o la que corresponda), y este
   documento (la tabla de la entidad y, si aplica, la sección 4 o 5).
4. **Nunca quitar o renombrar un campo/literal existente** sin periodo de
   aviso — móvil puede estar en producción leyendo la forma anterior.
   Agregar es seguro; quitar/renombrar requiere coordinar una fecha de
   corte con el equipo de móvil.
5. **Actualizar la fecha de "Última actualización"** al inicio de este
   documento en el mismo commit que documenta el cambio.
