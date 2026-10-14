# Progreso — Contrato de datos compartido (web como fuente de verdad)

**Rama:** `feat/contrato-compartido`
**Base:** `origin/develop` @ `5d86514` (Merge pull request #32 from DougGM/feat/fase-0-cierre)
**Iniciado:** 2026-09-09

> Nota de arranque: la rama local `develop` de este checkout estaba desactualizada
> (apuntaba a `a1c07cd`, antes del PR #32). Se ramificó directamente desde
> `origin/develop`, que sí tiene el PR #32 fusionado, tal como exige la regla 2.
> No se movió ni se tocó la rama local `develop`.
>
> Al ramificar había cambios sin commit en `feat/fase-0-cierre` (una
> reorganización de `PROGRESO-FASE-0.md`/`PROJECT_STATUS.md` hacia `docs/`) que
> no pertenecen a esta tarea. Se guardaron con `git stash -u` en esa rama antes
> de crear esta, para no perderlos ni arrastrarlos aquí.

## FASE 1 — Inventario del contrato actual

### Entidades existentes en `src/shared/types/entities/`

Las once entidades de la barrel (`amenity`, `booking`, `charge`, `guest`,
`payment`, `product`, `promotion`, `rate`, `room`, `room-type`, `user`) más
`session/` (aparte, no reexportada). Todas siguen el patrón
DTO (snake_case) → Mapper → Model (camelCase). Resumen:

| Entidad            | Campos DTO relevantes                                                                                                                                                             | Campos Model (diffs de nombre)                                                                    | Nota del mapper                                                                                                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `amenity`          | `id, name, description?, category(room\|hotel\|service), location?, active, created_at, updated_at`                                                                               | igual, camelCase; `createdAt/updatedAt: Date`                                                     | 1:1, solo fechas                                                                                                                                                                                       |
| `booking`          | `id, confirmation_code, guest_id, room_id?, room_type_id, rate_id?, check_in, check_out, status, adults, children, total_amount_cents, currency, notes?, created_at, updated_at`  | `confirmationCode, guestId, roomId, roomTypeId, rateId, checkIn/checkOut: Date, totalAmountCents` | traduce `status` (`checked_in→checkedIn`, `checked_out→checkedOut`, `no_show→noShow`); `check_in/check_out` con `toDomainCalendarDate` (civil, no timestamp)                                           |
| `charge`           | `id, booking_id, product_id?, description, quantity, unit_price_cents, amount_cents, currency, status(pending\|posted\|voided), charged_at, created_by_user_id?, created_at`      | `bookingId, productId, unitPriceCents, amountCents, chargedAt: Date, createdByUserId`             | **sin servicio ni dataset mock todavía** — contrato listo, sin consumidor (igual que antes de WEB-11/12)                                                                                               |
| `guest`            | `id, first_name, last_name, email?, phone?, nationality?, document_type?, document_number?, notes?, created_at, updated_at`                                                       | `firstName, lastName, documentType, documentNumber`                                               | traduce `document_type` (`national_id→nationalId`, `driver_license→driverLicense`)                                                                                                                     |
| `payment`          | `id, booking_id, amount_cents, currency, method, status, transaction_reference?, paid_at?, processed_by_user_id?, created_at`                                                     | `bookingId, amountCents, transactionReference, paidAt?: Date, processedByUserId`                  | traduce `method` (`credit_card→creditCard`, etc.)                                                                                                                                                      |
| `product`          | `id, sku, name, description?, category(minibar\|shop\|food_and_beverage\|other), price_cents, currency, stock_quantity, reorder_level, active, created_at, updated_at`            | `priceCents, stockQuantity, reorderLevel`                                                         | traduce `category` (`food_and_beverage→foodAndBeverage`)                                                                                                                                               |
| `promotion`        | `id, code, name, description, discount_percent, valid_from, valid_to, active, created_at, updated_at`                                                                             | `discountPercent, validFrom/validTo: Date`                                                        | `valid_from/valid_to` civiles vía `toDomainCalendarDate`                                                                                                                                               |
| `rate`             | `id, room_type_id, name, valid_from, valid_to, price_cents, currency, minimum_nights, refundable, active, created_at, updated_at`                                                 | `roomTypeId, validFrom/validTo, priceCents, minimumNights`                                        | igual patrón de fecha civil                                                                                                                                                                            |
| `room`             | `id, room_number, room_type_id, floor, status(available\|occupied\|cleaning\|maintenance\|out_of_service), notes?, created_at, updated_at`                                        | `roomNumber, roomTypeId, status: outOfService`                                                    | traduce solo `out_of_service→outOfService`                                                                                                                                                             |
| `room-type`        | `id, code, name, description?, capacity, bed_configuration, amenity_ids[], active, created_at, updated_at`                                                                        | `bedConfiguration, amenityIds`                                                                    | 1:1                                                                                                                                                                                                    |
| `user`             | `id, first_name, last_name, email, role(admin\|manager\|front_desk\|housekeeping\|maintenance), status(active\|inactive), created_at, updated_at`                                 | `firstName, lastName, role: frontDesk`                                                            | modela **puesto de personal**, no rol de acceso                                                                                                                                                        |
| `session` (aparte) | `LoginDTO`, `BackendAuthResponseDTO{accessToken,refreshToken,tokenType,expiresIn}`, `AuthResponseDTO{user,token,refreshToken,expiresAt,accessExpiresAt?,tokenType?,authorities?}` | `AuthSession{user,token,refreshToken,expiresAt:Date,accessExpiresAt?:Date,authorities}`           | modela **rol de acceso al PMS** (`UserRole` de `common.ts`: `ADMIN\|GUEST\|RECEPTION\|HOUSEKEEPING\|CONCIERGE\|ROOM_SERVICE`); INT-01 adapta la respuesta real del backend Spring decodificando el JWT |

`common.ts`: `Currency = 'GTQ'` (literal, no unión), `ID = string`, `ISODateString = string`,
`UserRole` (rol de acceso). `toDomainDate/toDtoDate` (timestamp completo, `Date.toISOString`)
vs. `toDomainCalendarDate/toDtoCalendarDate` (fecha civil `YYYY-MM-DD`, construida con
getters locales para no desplazar el día por zona horaria).

### Datasets de mock

- `services/mockData.ts`: sesión demo, `amenity-1/2`, `room-type-suite-jardin/deluxe`,
  `rate-suite-jardin/deluxe`, `room-101/202`, `guest-1`, `booking-1`, `payment-1`,
  `product-1/2`. IDs con prefijo legible (`room-101`, `booking-1`).
- `shared/mocks/lot-b.ts`: 5 `roomTypes` (`RT-01..05`), 14 `rooms` (`RM-101..503`),
  12 `guests` (`GST-001..012`), 10 `rates` (`RATE-01..10`), 20 `bookings`
  (`BKG-001..020`, código de confirmación `AUR-260NN`), 3 `promotions` (`PROMO-01..03`).
  IDs con prefijo en mayúsculas y numeración con cero a la izquierda.
- **Todas las fechas de ambos datasets ya están en ISO 8601** (`YYYY-MM-DD` para
  fecha civil, timestamp completo con `Z` para `created_at/updated_at`). No se
  encontró ningún literal `dd-mm-aaaa` en un DTO ni en un dataset — ver FASE 2.1.
- **Inconsistencia encontrada (no es uno de los huecos a resolver en este plan,
  se reporta y no se toca):** `lot-b.ts` referencia `amenity_ids: ['AM-01', ...,
'AM-06']` en sus `roomTypes`, pero ningún dataset define amenidades con esos
  IDs — `mockData.ts` solo tiene `amenity-1`/`amenity-2`. Es una referencia rota
  preexistente (ningún servicio sirve amenidades desde `lot-b.ts` hoy, así que no
  falla en runtime), pero es relevante para la FASE 3.2 (catálogo de amenidades)
  y para cuando alguien conecte `catalogService` a `lot-b.ts`. Se documenta en
  `docs/CONTRATO-DATOS.md` como pendiente separado, no se corrige aquí.

### Qué necesita móvil (MOV-04) vs. qué tiene la web — tabla de huecos

| Entidad que móvil necesita  | ¿Existe en la web?                    | Hueco                                                                                                                                                | Se resuelve en                                                            |
| --------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `user` (puesto de personal) | Sí, `entities/user/`                  | Ninguno                                                                                                                                              | —                                                                         |
| `room`                      | Sí, `entities/room/`                  | Literales de estado no alineados con el flujo de limpieza que móvil necesita (`dirty/cleaning/clean/inspected/blocked`)                              | Documentado como conflicto en FASE 2.2, **no se cambia en silencio**      |
| `guest`                     | Sí, `entities/guest/`                 | Ninguno                                                                                                                                              | —                                                                         |
| `booking`                   | Sí, `entities/booking/`               | Falta el código de vinculación que el huésped teclea en la app (MOV-14)                                                                              | FASE 2.3                                                                  |
| `service_request`           | **No existe**                         | Entidad completa                                                                                                                                     | FASE 2.4                                                                  |
| `order`                     | **No existe**                         | Entidad completa                                                                                                                                     | FASE 2.4                                                                  |
| `product`                   | Sí, `entities/product/`               | Catálogo de categorías sin mapeo exacto para agrupar el menú de Room Service                                                                         | Documentado como decisión de equipo, FASE 3.2                             |
| `amenity`                   | Sí, `entities/amenity/`               | Mismo problema de catálogo de categorías; además la referencia rota `AM-0N` en `lot-b.ts`                                                            | Decisión de equipo FASE 3.2 (catálogo); referencia rota solo reportada    |
| `notification`              | No existe, **y no debe existir aquí** | No es un hueco del contrato web — es una entidad exclusiva de móvil (según la tabla de la consigna, "Solo móvil"). Móvil la define en su propio repo | Se documenta en el contrato como "fuera de alcance de la web", no se crea |

Adicional, no pedido por móvil pero cruzado por `order`/`service_request`:

- `charge`: ya existe como entidad de la web (contrato listo, sin dataset/servicio).
  `order`/`service_request` necesitan enlazar ahí el consumo — se referencia por
  `chargeId?` opcional, sin forzar a wire-earlo en este PR (fuera de alcance).

## FASE 2 — Huecos conocidos (verificación y resolución)

| #   | Hueco                                    | ¿Seguía presente?                                                                   | Resolución                                                                                            |
| --- | ---------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 2.1 | Fechas `dd-mm-aaaa` en DTO               | **No** — ya resuelto en un cierre anterior (Fase 0). Todo DTO usa ISO 8601          | Sin cambios de código; se documenta que ya cumple                                                     |
| 2.2 | Máquinas de estado compartidas           | Sí — no existía `shared/constants/statuses.ts`                                      | Ver commit "feat: extraer las máquinas de estado a un contrato compartido"                            |
| 2.3 | Código de vinculación de reserva         | Sí — `BookingDTO` no lo tenía                                                       | Ver commit "feat: agregar código de vinculación de reserva"                                           |
| 2.4 | `order`/`service_request` como entidades | Sí — no existían                                                                    | Ver commit "feat: incorporar order y service_request al contrato"                                     |
| 2.5 | `session/` vs `user/`                    | Ya estaba bien separado y documentado (`modules/auth/README.md`, `ARCHITECTURE.md`) | Se traslada esa explicación a `docs/CONTRATO-DATOS.md` para que móvil no tenga que leer el código web |

## Bitácora de commits

| Fase | Descripción                                                                                                      | Commit        | Estado |
| ---- | ---------------------------------------------------------------------------------------------------------------- | ------------- | ------ |
| 1    | Rama creada desde `origin/develop`; inventario de contrato, mocks y huecos                                       | `a0223cf`     | hecho  |
| 2.2  | `shared/constants/statuses.ts`; `RoomStatus`/`BookingStatus` derivados de ahí; conflicto de room reportado       | `5e4f997`     | hecho  |
| 2.3  | `guest_link_code`/`guestLinkCode` en `booking`, datasets y `bookingService.createBooking`                        | `82eb17c`     | hecho  |
| 2.4  | Entidades `order` y `service-request` (DTO → Mapper → Model), sin servicio ni dataset propio todavía             | `fb49e4b`     | hecho  |
| 5    | `scripts/test-shared-contract.mjs`: fechas, `_cents`, estados, `guest_link_code`, round-trip de mappers          | `fecab16`     | hecho  |
| 3+4  | `docs/CONTRATO-DATOS.md`: contrato completo + cinco decisiones de equipo (FASE 3) documentadas, no implementadas | `ba0d38b`     | hecho  |
| 6    | `src/ARCHITECTURE.md` remite a `docs/CONTRATO-DATOS.md`; cierre de esta bitácora                                 | (este commit) | hecho  |

## FASE 6 — Cierre

- `npm run check` completo (`format:check && typecheck && lint && build && test`,
  8 suites, 123 pruebas) pasa en verde sobre el estado final de la rama.
- Se corrigió el formato de Prettier de `PROGRESO-FASE-0.md`/`PROJECT_STATUS.md`
  (heredado de `develop`, no relacionado con este contrato) para que `npm run
check` quedara limpio de punta a punta antes del PR.
- No se fusiona nada ni se cierran issues, según la regla 4 del encargo.
- El PR se abre contra `develop` (regla 3), no contra `main`.
- Decisiones de equipo (sección 6 de `docs/CONTRATO-DATOS.md`), sin implementar:
  formato de SKU, catálogo de categorías de producto/amenidad, tipo de ID,
  conflicto de `RoomStatus` vs. flujo de limpieza de móvil, y la referencia
  rota `amenity_ids` de `lot-b.ts`.
- Pregunta abierta que este contrato **no resuelve** (fuera de alcance de datos):
  cómo se autentica el personal en la app móvil — ver sección 3.12 de
  `docs/CONTRATO-DATOS.md`.

## Seguimiento — separar `room_feature` de `amenity` (post-cierre)

**Iniciado:** 2026-09-10. Sigue en `feat/contrato-compartido` (PR #33, sin fusionar),
por indicación explícita — no se abre rama nueva.

### Diagnóstico (antes de tocar código)

- `amenity` hoy: `id, name, description?, category('room'|'hotel'|'service'), location?,
active, created_at, updated_at`. **No tiene horario de funcionamiento** — la premisa
  de que ya lo tenía no se cumplía; es un campo que habría que agregar si el equipo
  decide modelar horarios más adelante, fuera de alcance de este arreglo.
- Catálogo real de amenidades en todo el repo: solo 2 registros (`amenity-1` Wi-Fi/hotel,
  `amenity-2` Desayuno/service, ambos en `mockData.ts`). `lot-b.ts` no define ningún
  catálogo de amenidades.
- El campo roto vive en **`room-type`** (`RoomTypeDTO.amenity_ids`), no en `room`
  directamente — `room` solo llega a él indirectamente vía `room_type_id`.
- Escaneo completo de ambos datasets (no solo la referencia reportada): la única
  referencia rota en todo el repo es `room-type.amenity_ids` en `lot-b.ts` — 21
  referencias (`AM-01`..`AM-06` en los 5 tipos de habitación), ninguna resuelve porque
  ese catálogo no existe ahí. El resto de relaciones (`room→room-type`, `rate→room-type`,
  `booking→guest/room/room-type/rate`, `payment→booking`) resuelve correctamente en
  ambos datasets.
- `mockData.ts` también referencia `amenity_ids` desde sus 2 room-types, y esas
  referencias sí resuelven (apuntan a `amenity-1`/`amenity-2`, que existen) — pero
  cuelgan amenidades de hotel (Wi-Fi, Desayuno) de un tipo de habitación específico,
  el mismo sinsentido de dominio que la consigna describe.
- El patrón acumulativo de `lot-b.ts` (Estándar = 3 IDs → Suite Presidencial = 6 IDs,
  creciendo con la categoría) es el comportamiento de una **característica de
  habitación** (A/C, balcón, jacuzzi), no de una amenidad compartida (una piscina no
  "crece" por tipo de habitación).
- Cero consumidores en runtime: no existe `roomTypeService`; `catalogService.getAmenities()`
  lee únicamente `mockData.ts:mockAmenities`, nunca toca `room-type.amenityIds`. Ningún
  componente ni prueba lo usaba antes de este arreglo.

**Conclusión: dos conceptos mezclados bajo la misma entidad** (no un simple hueco de
datos) — se procede con la separación que pedía la consigna para este caso.

### Bitácora de commits

| Commit                                                                 | Descripción                                                                                                                                                                                      | Hash      | Estado |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ------ |
| `fix: separar caracteristicas de habitacion de amenidades de hotel`    | Entidad `room_feature` nueva; `room-type` pasa de `amenity_ids` a `room_feature_ids`; catálogos corregidos en ambos datasets                                                                     | `6ac1383` | hecho  |
| `docs: actualizar la bitacora con el diagnostico y el commit del fix`  | —                                                                                                                                                                                                | `c6f16f9` | hecho  |
| `test: verificar la integridad referencial de los datasets`            | `scripts/test-referential-integrity.mjs` (31 pruebas): toda referencia entre entidades de ambos datasets, sin IDs duplicados. No se encontró ninguna otra referencia rota además de la reportada | `723e599` | hecho  |
| `docs: actualizar la bitacora con el commit de la suite de integridad` | —                                                                                                                                                                                                | `d38db1c` | hecho  |
| `docs: registrar la distincion entre caracteristica y amenidad`        | `docs/DECISIONES.md` (D-001, nuevo archivo); `docs/CONTRATO-DATOS.md` secciones 3.2/3.2b/3.6/5/6.5; línea corta en `ARCHITECTURE.md` y `CLAUDE.md`                                               | `345434f` | hecho  |

### Cierre de este seguimiento

- `npm run check` completo (9 suites) pasa en verde sobre el estado final.
- No se fusionó nada, no se cerró ninguna issue, no se creó rama nueva — todo en
  `feat/contrato-compartido` (PR #33), según las reglas de este encargo.
- `docs/DECISIONES.md` no existía en ningún punto del historial del repo antes de
  este seguimiento — se creó desde cero con esta como entrada D-001; no había un
  D-001 real que "igualar en formato", se diseñó un formato ADR razonable
  (Contexto/Decisión/Qué NO hacer/Alternativas) para que el usuario lo ajuste si
  esperaba algo distinto.
- Pendiente, fuera de alcance de este seguimiento: `amenity` sigue sin campo de
  horario (la premisa del encargo asumía que ya lo tenía); agregarlo es trabajo
  futuro si el equipo lo decide.
