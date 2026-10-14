# Progreso — Separar el estado de habitación en ocupación y limpieza

**Rama:** `feat/estados-habitacion`
**Base:** `origin/develop` @ `c5ee429` (Merge pull request #34; incluye PR #32 y #33)
**Iniciado:** 2026-09-10

## FASE 1 — Inventario (solo lectura)

### 1.1 Definición actual

Un solo campo `status` en toda la cadena:

- `src/shared/constants/statuses.ts` — `ROOM_STATUSES = ['available', 'occupied',
'cleaning', 'maintenance', 'outOfService']` (Model, camelCase) +
  `ROOM_STATUS_TRANSITIONS`.
- `src/shared/types/entities/room/room.dto.ts` — `RoomStatusDto = 'available' |
'occupied' | 'cleaning' | 'maintenance' | 'out_of_service'`, campo `status`.
- `src/shared/types/entities/room/room.model.ts` — `status: RoomStatus` (importado
  de `statuses.ts`).
- `src/shared/types/entities/room/room.mapper.ts` — traduce únicamente
  `out_of_service ↔ outOfService`; el resto es 1:1.

### 1.2 Consumidores reales (grep sobre `src/` y `scripts/`)

| Archivo                                                                     | Qué hace con el estado                                                                     |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/shared/constants/statuses.ts`                                          | Define `ROOM_STATUSES`/`ROOM_STATUS_TRANSITIONS`                                           |
| `src/shared/types/entities/room/{room.dto,room.model,room.mapper,index}.ts` | Contrato de la entidad                                                                     |
| `src/shared/types/entities/index.ts`                                        | Barrel de tipos (re-exporta `RoomStatus`)                                                  |
| `src/services/mockData.ts`                                                  | Dataset mock: 2 habitaciones (`room-101`=`available`, `room-202`=`occupied`)               |
| `src/shared/mocks/lot-b.ts`                                                 | Dataset mock: 15 habitaciones (ver 1.3)                                                    |
| `scripts/test-shared-contract.mjs`                                          | Prueba que el `status` de cada registro pertenece a `ROOM_STATUSES`; round-trip del mapper |

**Cero consumidores en UI.** No existe `roomTypeService` ni ningún componente
`.tsx` que lea `room.status`/`RoomStatus` para pintar un badge o filtrar una lista
— confirmado con grep sobre todo `src/**/*.tsx`. El único hit de `.status ===`
fuera de las entidades es `src/public/pages/ComponentsCatalogPage.tsx:44`, y es
un demo de tabla con strings sueltos (`'Disponible'`/`'Ocupada'`) sin relación con
`RoomStatus` — no es un consumidor real, no se migra.

**Tema:** `src/styles/tokens.css` (líneas 27-31) tiene `--room-status-{available,
occupied,cleaning,maintenance,blocked}`. `src/index.css` (líneas 5149-5162) los
consume en selectores `.rc-room-card.rc-room-*` — pero esas clases no las usa
ningún componente `.tsx` vivo (grep limpio): son CSS muerto de la pantalla de
recepción de Bolt, ya eliminada en el cierre de la Fase 0 (ver
`src/ARCHITECTURE.md`, sección "`index.css`: pendiente de separar"). No se toca
`index.css` en este trabajo — fuera de alcance, ya documentado como deuda técnica
aparte. Sí se agregan tokens nuevos a `tokens.css` para las dos máquinas (FASE 3.6).

**No hay filtro de calendario que consumir.** `/pms/reception/calendar` existe
solo como entrada de ruta en `src/app/routes.ts:63`, sin pantalla implementada
todavía.

### 1.3 Literales reales usados hoy en los datasets

`src/shared/mocks/lot-b.ts` (15 habitaciones): `available` ×8, `occupied` ×3,
`cleaning` ×2 (`RM-103`, `RM-503`), `maintenance` ×1 (`RM-202`), `out_of_service`
×1 (`RM-303`).
`src/services/mockData.ts` (2 habitaciones): `available` ×1, `occupied` ×1.

Ningún literal fuera de los 5 ya definidos en `ROOM_STATUSES`. Las dos
definiciones (mockData.ts y lot-b.ts) no han divergido entre sí.

### 1.4 Qué dice ya la documentación

- `docs/CONTRATO-DATOS.md`, sección 6.4 ("Máquina de estado de `room`:
  disponibilidad vs. flujo de limpieza") ya recomienda la opción **C: dos campos
  ortogonales** — `status` (disponibilidad, el actual) + `housekeepingStatus`
  nuevo (`dirty | cleaning | clean | inspected`), con `blocked` ya cubierto por
  `maintenance`/`outOfService` del campo existente. Es la misma decisión que este
  trabajo implementa; se mantienen esos dos nombres de campo por continuidad
  (`status` para ocupación, `housekeeping_status`/`housekeepingStatus` para
  limpieza) en vez de inventar nombres nuevos.
- `docs/DECISIONES.md` **ya tiene una entrada D-001** (`room_feature` vs.
  `amenity`, del trabajo anterior). La plantilla de esta tarea pide escribir
  "D-001" para esta decisión, pero ese número ya está tomado — se registra como
  **D-002** para no pisar la entrada existente. Se avisa aquí explícitamente.
- `src/shared/constants/statuses.ts` ya tiene el comentario que anticipa este
  cambio (líneas 11-20).

### 1.5 Plan de literales para las dos máquinas nuevas

**Ocupación** (dueño: web) — se conservan los 4 literales de disponibilidad que
ya existían, se retira `cleaning` (pasa por completo a la máquina de limpieza,
es la causa original de la mezcla):

    available | occupied | maintenance | outOfService

**Limpieza** (dueño: móvil) — literales nuevos, tal como los pide el plan y
móvil (MOV-04), sin choque con nada existente:

    dirty | cleaning | clean | inspected

Migración de los datasets: cada registro que hoy es `status: 'cleaning'`
(`RM-103`, `RM-503`) pasa a `status: 'available'` (ocupación) +
`housekeeping_status: 'cleaning'` (limpieza) — conserva exactamente el
significado original ("no se puede vender porque la están limpiando"), que
ahora la regla `isRoomAssignable` expresa correctamente: libre pero no apta
todavía.

**No se encontraron usos inesperados ni definiciones divergentes.** Se procede
a la FASE 2.

## FASE 2 — Las dos máquinas de estado

Commit `9bdbed9`. `src/shared/constants/statuses.ts`:

- `ROOM_STATUSES` (ocupación, dueño web): `available | occupied | maintenance |
outOfService` — los mismos 4 literales que ya existían; solo se retiró
  `cleaning`.
- `ROOM_HOUSEKEEPING_STATUSES` (limpieza, dueño móvil, **nueva**):
  `dirty | cleaning | clean | inspected`, con sus transiciones tal como las
  pedía el plan (`dirty→cleaning→clean→inspected`, `inspected→dirty`,
  `clean→dirty`).
- `isRoomAssignable(room)`: `status === 'available' && housekeepingStatus in
('clean', 'inspected')`. Toma un tipo estructural (`RoomAssignabilityInput`)
  en vez de importar `Room` del Model, para no crear un import circular entre
  `shared/constants` y `shared/types/entities/room`.

**Commit deliberadamente rompe el typecheck** en `room.mapper.ts` (todavía
referencia el `RoomStatusDto` viejo, con `cleaning` incluido) — se corrige en
la FASE 3, que es la que migra la entidad. No se corre `npm run check` hasta
el final de la FASE 3.

## FASE 3 — Entidad, mappers y datos

Commit `fcf1404`.

- **DTO** (`room.dto.ts`): `status: RoomStatusDto` (ocupación, sin `cleaning`)
  - `housekeeping_status: RoomHousekeepingStatusDto` (limpieza, nueva).
- **Model** (`room.model.ts`): `status`, `housekeepingStatus` y
  `isAssignable: boolean` — este último **no existe en el DTO**, lo calcula
  el mapper.
- **Mapper** (`room.mapper.ts`): convierte los dos campos reales y calcula
  `isAssignable` con `isRoomAssignable()` de `statuses.ts`.
- **Datasets**: las 15 habitaciones de `lot-b.ts` y las 2 de `mockData.ts`
  (17 en total) tienen ahora ambos campos. Las dos que eran `status:
'cleaning'` (`RM-103`, `RM-503`) pasaron a `available` +
  `housekeeping_status: 'cleaning'`, conservando el significado original.
  Cubre las 6 combinaciones pedidas — la crítica (libre y sucia, no
  asignable) está en `RM-201` y `RM-502`.
- **Consumidores**: barrels de entidades actualizados
  (`shared/types/entities/index.ts`, `room/index.ts`). `roomService.ts` no
  necesitó cambios — solo pasa por el mapper. Cero componentes `.tsx`
  consumían `RoomStatus` (confirmado en la FASE 1), así que no hubo
  pantallas que migrar — **no hubo ningún sitio donde no estuviera claro
  qué estado aplicaba.**
- **Tema**: `tokens.css` gana `--room-status-out-of-service` y
  `--room-housekeeping-{dirty,cleaning,clean,inspected}`. Los tokens
  `--room-status-cleaning`/`--room-status-blocked` quedan intactos (CSS
  muerto de la recepción de Bolt en `index.css`, sin consumidor vivo) —
  deliberadamente no se reutilizan para evitar que dos máquinas comparen la
  misma variable con significados distintos.

`npm run check` completo: **verde** (9 suites, 160 pruebas, 0 fallos).

## FASE 4 — Pruebas

Commit `7f61a07`. `scripts/test-room-status.mjs` (9 pruebas nuevas):

- Toda habitación de ambos datasets tiene `status`/`housekeeping_status`
  válidos; ninguna sigue usando `'cleaning'` como ocupación.
- `isRoomAssignable`: las 6 combinaciones de la FASE 3 (incluida la crítica
  — libre y sucia → no asignable) y, exhaustivamente, las 16 combinaciones
  posibles de ambas máquinas, más una verificación contra cada registro
  real de los datasets.
- Transiciones inválidas rechazadas en ambas máquinas (p. ej. `maintenance
→ occupied`, `dirty → clean` saltándose `cleaning`, `inspected → clean`).
- El mapper conserva ambos campos en el round-trip DTO → Model → DTO.
- **Verificación estática**: ningún archivo fuera de
  `shared/constants/statuses.ts` combina una comparación real
  `status === 'available'` con una mención a `housekeepingStatus`/
  `housekeeping_status` — la primera versión de esta prueba daba falso
  positivo contra `room.model.ts` porque su propio comentario JSDoc describe
  la regla en prosa; se ajustó la heurística a una comparación real (regex
  sobre `===`) en vez de la mera coexistencia de los literales, y se
  añadió `room.model.ts` a la lista de archivos permitidos por ese motivo.

`npm run check` completo: **verde** (10 suites, 169 pruebas, 0 fallos).

## FASE 5 — Documentación

Commit `208b6cf`.

- `docs/CONTRATO-DATOS.md`: sección 3.1 (`room`) con los dos campos y el
  derivado `isAssignable`; sección 4 con las dos máquinas nuevas y la regla;
  sección 5 (qué replica móvil) con el punto explícito de quién escribe qué
  campo; sección 6.4 marcada **resuelta**, ya no es una decisión pendiente.
- `docs/DECISIONES.md`: entrada **D-002** (no D-001 — ver nota en la FASE 1).
- `src/ARCHITECTURE.md`, `CLAUDE.md` y `.codex/CONTEXT.md`: línea corta
  remitiendo a D-002 en cada uno.

## FASE 6 — Cierre

- `npm run check` completo (10 suites, 169 pruebas) pasa en verde sobre el
  estado final de la rama.
- No se fusionó nada, no se cerró ninguna issue — todo en
  `feat/estados-habitacion`, según las reglas de este encargo.
- **Discrepancia con la plantilla**, ya avisada en la FASE 1: esta decisión
  se registró como **D-002**, no D-001, porque D-001 ya existía
  (`room_feature` vs. `amenity`, trabajo anterior).
- **Ningún sitio donde no estuviera claro qué estado aplicaba** — cero
  consumidores de UI antes de este trabajo, así que no hubo ambigüedad que
  resolver en la migración (FASE 3).
- Pendiente para la app móvil: implementar el flujo
  `dirty → cleaning → clean → inspected` en su propia UI, escribiendo
  `housekeeping_status` vía el servicio que integre contra la web; y no
  escribir nunca `status` (ocupación) — eso es de recepción. Detalle
  completo en `docs/CONTRATO-DATOS.md` sección 5, punto 5.
