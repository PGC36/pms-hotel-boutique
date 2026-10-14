# Progreso de pantallas — Ronda 1

## Ticket 2 — acciones de Recepción (2026-09-27)

En la rama `fix/recepcion-huesped-acciones`, el botón **Actualizar** del
calendario del workspace vuelve a cargar reservas, habitaciones y bloqueos
mediante `loadWorkspaceData`, por lo que la vista ya no depende solo de un
toast; la recarga relee las colecciones persistidas de reservas, huéspedes y
habitaciones desde `localStorage`. El botón **Editar** del detalle navega a la pantalla de edición
existente (`bookingService.updateBooking`), y las mutaciones de reservas y
huéspedes se persisten en `localStorage` desde sus servicios mock. Se
mantienen los flujos existentes de check-in, check-out y cambio de habitación.

### Ticket 2 — acciones del portal de Huésped (2026-09-27)

Las acciones rápidas de **Room Service** navegan a la sección existente del
portal. El recibo de reserva usa la vista recibible existente y `window.print`,
con estilos de impresión que aíslan el comprobante. Modificar y cancelar
consumen `bookingService.updateBooking` y `bookingService.cancelBooking`,
respectivamente, actualizando la UI solo después de persistir el cambio.

Bitácora de la rama `feat/pantallas-ronda-1`. Contexto completo en la
conversación que originó esta rama: antes de escribir código se hizo un
inventario que encontró que 13 de las 14 pantallas de la Ronda 1 ya
existían en `develop` (trabajo de otros colaboradores), pero casi ninguna
era alcanzable desde el menú, y varias tenían huecos de calidad (rooms era
puro stub, check-out sin confirmación, etc.). El trabajo de esta rama es
esa auditoría más las correcciones y pantallas que faltaban, no un
scaffold desde cero.

## Fallos reportados por el propietario del repo tras probar en el navegador

Después del primer push (commits hasta `dc59dfa`), se probó de verdad en el
navegador y aparecieron 4 fallos; se reportó un falso positivo:

- **"Fallo 1" (descartado):** recepción con menú vacío — era una sesión de
  administración residual en el navegador, no un bug. Confirmado en incógnito.
- **Fallo 2 (grave, confirmado):** `/pms/rooms`, `/pms/room-types` y
  `/pms/occupancy` mostraban el placeholder `ModuleHomePage`
  ("...disponibles próximamente"), no las pantallas reales construidas en
  esta rama. Causa: al agregar esas tres rutas a `privateNavigation`
  (`12708d7`), quedaron declaradas dos veces en `router.tsx` — la genérica
  (placeholder) y la dedicada (pantalla real) — como hermanas bajo el mismo
  padre. React Router desempata por orden de declaración: la primera
  (el placeholder) ganaba siempre, en silencio. Arreglado en `e83fceb`.
- **Fallo 3 (confirmado):** el panel operativo (`/pms`, primera pantalla al
  iniciar sesión) era un placeholder estático sin contenido. Reemplazado en
  `14012a1` por un dashboard real con datos de servicio.
- **Fallo 4 (confirmado):** recepción (rol RECEPTION) no tenía ninguna forma
  de llegar a check-in, cuenta del huésped ni check-out sin escribir la URL
  a mano, aunque el rol tiene `front-desk:operate`. Arreglado en `ca79b5d`
  con una pantalla real de Recepción que lista las reservas del día.

## Commits

| Commit    | Qué hace                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Historias / pantallas que cubre                                                                               |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `12708d7` | Conecta las 13 pantallas existentes al flujo de navegación: entradas nuevas en `privateNavigation` para Habitaciones, Tipos de habitación y Ocupación; botón "Nueva reserva" y columna de acciones (check-in / cuenta de huésped) en `OccupancyScreen`; botón "Ir a check-out" en `GuestAccountScreen`.                                                                                                                                                                      | Transversal — sin esto ninguna pantalla era alcanzable clickeando.                                            |
| `39d51cc` | Actualiza los conteos de menú por rol en `tests/auth.test.jsx` (Recepción 2→3, Admin 7→10) tras agregar las entradas de navegación.                                                                                                                                                                                                                                                                                                                                          | Corrección de `npm run check` sobre el commit anterior.                                                       |
| `88e6b8c` | Agrega un `Modal` de confirmación antes de ejecutar el check-out en `CheckOutScreen` (cerraba la cuenta y la estadía con un solo clic, sin confirmación).                                                                                                                                                                                                                                                                                                                    | Grupo 4, pantalla 14 — "acciones destructivas piden confirmación".                                            |
| `34115fc` | `RoomListScreen` real: filtros por estado y tipo de habitación sobre `roomService.getRooms()`/`getRoomTypes()`, enlace a edición por fila. Reemplaza el stub.                                                                                                                                                                                                                                                                                                                | Grupo 1, pantalla 1/4 — "listado de habitaciones con filtros por tipo y estado" (WEB-16).                     |
| `92a1f4b` | `RoomFormScreen` real: alta y edición de habitación contra `roomService.createRoom`/`updateRoom`, con validación. Reemplaza el stub.                                                                                                                                                                                                                                                                                                                                         | Grupo 1, pantalla 2/4 — "alta y edición de habitación" (WEB-17).                                              |
| `89069f4` | `RoomTypeListScreen` real: listado de tipos con características resueltas por nombre. Reemplaza el stub. Sin acción de editar todavía (bloqueado).                                                                                                                                                                                                                                                                                                                           | Grupo 1, pantalla 3/4 — "listado de tipos de habitación" (WEB-18).                                            |
| `49fd5c0` | Agrega `CreateRoomTypeDto`/`UpdateRoomTypeDto`, `roomService.createRoomType`/`updateRoomType`/`getRoomTypeById`, y la ruta `roomTypeEdit` en `routes.ts`/`router.tsx` — no existían y bloqueaban la pantalla 4/4. Autorizado explícitamente por el propietario del repo para esta excepción puntual (ver nota en el commit).                                                                                                                                                 | Infraestructura — desbloquea Grupo 1, pantalla 4/4.                                                           |
| `4d22d27` | `RoomTypeFormScreen` real: alta y edición de tipo de habitación. Reemplaza el stub.                                                                                                                                                                                                                                                                                                                                                                                          | Grupo 1, pantalla 4/4 — "alta y edición de tipo de habitación" (WEB-18).                                      |
| `b383a8a` | Agrega el botón "Editar" por fila en `RoomTypeListScreen`, ahora que la ruta y el formulario de edición existen.                                                                                                                                                                                                                                                                                                                                                             | Cierra el Grupo 1 completo (4/4).                                                                             |
| `a3c72cb` | Agrega `UpdateBookingDto`, `bookingService.updateBooking`/`confirmBooking`/`cancelBooking`, y las rutas `bookingDetail`/`bookingEdit` — no existían y bloqueaban la pantalla 11. Autorizado con el mismo criterio general que `roomTypeEdit` (ver nota en el commit).                                                                                                                                                                                                        | Infraestructura — desbloquea Grupo 3, pantalla 11.                                                            |
| `cae6964` | `BookingDetailScreen`: detalle de reserva, edición (solo si `pending`/`confirmed`), "Confirmar reserva" (solo si la transición es válida) y "Cancelar reserva" (Modal, exige motivo). Enlazada desde el código de confirmación en `OccupancyScreen`, antes sin ningún lugar desde el que hacer clic.                                                                                                                                                                         | Grupo 3, pantalla 11/11 — cierra el grupo.                                                                    |
| `cfc0cec` | `bookingService.checkIn` ahora crea la cuenta del huésped (saldo cero) si no existe, en vez de asumir que ya está sembrada en el mock. Bug preexistente encontrado al rastrear el ciclo completo (crear → confirmar → check-in → cargo → check-out) para verificar la pantalla 11: sin esto, el check-in de **cualquier** reserva creada en vivo (manual o del motor público) fallaba siempre en el último paso. Incluye prueba de regresión en `scripts/test-services.mjs`. | Corrección transversal, no específica de una pantalla — ver "Verificación del ciclo completo" abajo.          |
| `e83fceb` | **Fallo 2.** `dedicatedPmsRoutes` pasa a ser la única fuente de verdad de qué rutas ya tienen pantalla propia; `placeholderPmsRoutes` se calcula excluyéndolas, no al revés. Agrega `scripts/test-router.mjs` + `tests/router.test.jsx`: ninguna ruta duplicada bajo el mismo padre, rooms/room-types/occupancy resuelven a su pantalla real.                                                                                                                                | Fix — sin esto, `34115fc`/`89069f4`/`OccupancyScreen` nunca se veían pese a estar bien construidas.           |
| `b0abe91` | Agrega `isSameCalendarDay` a `shared/utils/date.ts` (con pruebas en `scripts/test-date.mjs`).                                                                                                                                                                                                                                                                                                                                                                                | Infraestructura — desbloquea el panel operativo.                                                              |
| `14012a1` | **Fallo 3.** `OperationsHomePage` real: ocupación actual, llegadas/salidas de hoy, limpieza pendiente, accesos rápidos según permiso en sesión.                                                                                                                                                                                                                                                                                                                              | Panel operativo — primera pantalla que ve cualquier usuario privado.                                          |
| `ca79b5d` | **Fallo 4.** `ReceptionScreen` real en `/pms/reception`: reservas con movimiento hoy y acciones (Check-in, Ver cuenta, Check-out, Ver reserva) según estado.                                                                                                                                                                                                                                                                                                                 | Reemplaza el placeholder de Recepción; le da a RECEPTION una forma de completar su trabajo sin escribir URLs. |

## Estado por grupo

- **Grupo 1 (inventario del hotel): 4/4 completas.**
- **Grupo 2 (motor de reservas público): ya estaba completo en `develop`** antes de esta rama (no se tocó en este trabajo, salvo lo señalado en el reporte de auditoría de la conversación: falta captura de datos personales reales en `BookingFormScreen` y fotografías en `RoomDetailScreen`, ninguno de los dos es un hueco de navegación).
- **Grupo 3 (recepción): 3/3 completas.** `OccupancyScreen` y `ManualBookingScreen` ya estaban en `develop` (navegación agregada en `12708d7`); `BookingDetailScreen` (pantalla 11) se construyó en esta rama.
- **Grupo 4 (operación y dinero): ya estaba completo en `develop`**, con el fix de confirmación de `88e6b8c`.

**Las 14 pantallas de la Ronda 1 están completas y alcanzables por navegación.**

## Verificación del ciclo completo

No fue posible probar en el navegador: la extensión Claude in Chrome no
estuvo conectada en ningún momento de esta sesión (`tabs_context_mcp`
devolvió "Browser extension is not connected" en dos intentos, separados
por casi toda la sesión). Lo que sigue es un **rastreo de código**, no una
verificación visual — pendiente de que alguien lo confirme en el
navegador antes de dar el ciclo por probado de verdad.

Rastreado: crear reserva manual → confirmar → check-in (con asignación de
habitación) → agregar un cargo → check-out.

1. `ManualBookingScreen` → `bookingService.createBooking`: status `pending`. OK.
2. `BookingDetailScreen` → `bookingService.confirmBooking`: `pending → confirmed` es válida. OK.
3. `CheckInScreen` → `assignRoom` + `checkIn`: `confirmed → checkedIn` es válida; con el fix de `cfc0cec`, la cuenta del huésped se crea aquí (antes fallaba siempre en este paso para una reserva nueva). OK tras el fix.
4. `GuestAccountScreen` → `createCharge`: ahora encuentra la cuenta (existe desde el paso 3) y agrega el cargo correctamente. OK.
5. `CheckOutScreen` → `checkOut`: encuentra booking y cuenta (ambos ya existen), `checkedIn → checkedOut` es válida, ahora pide confirmación (`88e6b8c`). OK.

**El ciclo cierra en el rastreo de código.** Dos observaciones menores, no bloqueantes, encontradas de paso:

- `CheckInScreen` navega a la cuenta con una ruta escrita a mano
  (`` `/pms/accounts/${account.id}` ``) en vez de
  `routePaths.pms.guestAccount.replace(...)` como el resto de las
  pantallas. Inconsistente pero funciona igual.
- `bookingService.checkOut` no cierra la `GuestAccount` (`status` se
  queda en `'open'`) — no se tocó porque no estaba pedido y no rompe el
  ciclo solicitado, pero vale una decisión aparte.

## Alcanzabilidad por rol (tras el fix del fallo 4)

Para cada rol de `sessionAccountsDB`, qué entradas de `privateNavigation`
ve (según `rolePermissions`) y si cada permiso que posee tiene una forma
de llegar a una pantalla real desde el menú — directa (ítem de menú) o
transitiva (acción dentro de otra pantalla ya alcanzable).

| Rol          | Entradas de menú que ve                                                                                                            | Permisos sin pantalla real alcanzable                                                                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADMIN        | Panel operativo, Recepción, Limpieza, Room Service, Conserjería, Caja, Usuarios, Habitaciones, Tipos de habitación, Ocupación (10) | Ninguno. `front-desk:operate` se alcanza vía Recepción/Ocupación (sin ítem de menú propio, no le hace falta).                                                                    |
| RECEPTION    | Panel operativo, Recepción, Ocupación (3)                                                                                          | Ninguno. `front-desk:operate` se alcanza vía las acciones de fila en Recepción/Ocupación (check-in, ver cuenta, check-out) — este era el fallo 4, ya corregido.                  |
| HOUSEKEEPING | Panel operativo, Limpieza (2)                                                                                                      | `housekeeping:view` tiene ítem de menú, pero la pantalla detrás sigue siendo el placeholder `ModuleHomePage` — módulo fuera del alcance de esta rama, no un hueco de navegación. |
| CONCIERGE    | Panel operativo, Conserjería (2)                                                                                                   | Igual que Limpieza: `concierge:view` con ítem de menú, pantalla real pendiente (fuera de alcance).                                                                               |
| ROOM_SERVICE | Panel operativo, Room Service (2)                                                                                                  | Igual: `room-service:view` con ítem de menú, pantalla real pendiente (fuera de alcance).                                                                                         |
| GUEST        | Panel operativo (1)                                                                                                                | Ninguno — su único permiso (`dashboard:view`) tiene pantalla real.                                                                                                               |

Nota sobre `cash:view`/`users:view` (solo ADMIN los tiene): mismo caso que
Limpieza/Conserjería/Room Service — ítem de menú presente, pantalla real
pendiente, fuera del alcance de este trabajo.
