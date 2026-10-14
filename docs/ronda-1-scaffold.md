# Ronda 1 — andamiaje de rutas y módulos

**Fecha:** 2026-09-11 · **Rama:** `feat/web-round-1-scaffold` contra `develop`.
Ver también `src/ARCHITECTURE.md`, `src/modules/README.md` y
`docs/DECISIONES.md` D-006 (registro formal de esta decisión).

Este PR no construye ninguna pantalla real. Crea el árbol de los cuatro
módulos de la Ronda 1 y registra sus 14 rutas de una sola vez, para que los
cuatro lotes puedan ramificar sin pisarse el primer día en `routes.ts` /
`router.tsx`.

**Actualizacion 2026-09-16 (`feat/migracion-bolt-completa-20260916`):** las
rutas privadas principales dejan de depender solo de placeholders y conectan el
workspace privado y componentes migrados desde Bolt en las carpetas de dominio. El login y los
guards actuales se mantienen; el rol Pasarela de pago no se migra como rol de
navegacion. Perfil, Preferencias y Cerrar sesion viven en el menu superior de
usuario, no en el lateral.

**Actualizacion 2026-09-16 (`frontend-beta`):** el workspace operativo migrado
desde Bolt deja de inicializar recepcion, limpieza, room service, conserjeria,
administracion y portal de huesped solo con arrays locales. `PrivateWorkspace.tsx`,
`AdminContent.tsx` y `GuestContent.tsx` ahora adaptan `bookingsDB`, `roomsDB`,
`guestsDB`, `ordersDB`, `serviceRequestsDB`, folios, productos, roles,
inventario, caja, auditoria y amenidades desde `src/data/db.ts`, manteniendo
los arrays antiguos solo como fallback visual.

**Reemplazado 2026-10-05 (#135 / INT-FINAL):** `src/data/db.ts` fue eliminado.
El workspace operativo debe consumir backend real mediante `src/services/`; las
pruebas de contrato usan fixtures bajo `scripts/fixtures/`.

**Actualización posterior (#50/#51/#52, rama `web-50-51-52-occupancy-manual`):**
el módulo `occupancy` ya dejó de ser stub. `#51` (`OccupancyScreen`) carga
habitaciones, reservas y tipos de habitación para mostrar disponibilidad por
fecha y los estados reales de habitación/limpieza; también lista reservas
activas sin habitación asignada. `#52`
(`ManualBookingScreen`) carga huéspedes y tipos de habitación activos, valida
campos requeridos y crea reservas vía `bookingService.createBooking`. Con esas
dos sub-tareas queda cubierto el padre `#50`.


**Actualización WEB-30 / #56 (2026-09-13):** `CheckOutScreen` carga la reserva
con `bookingService.getBookingById`, su cuenta y cargos con
`guestAccountService`, y presenta el comprobante con `formatDateGT` y
`formatCurrency`. El botón de salida consulta `BOOKING_STATUS_TRANSITIONS` y
solo permite ejecutar `bookingService.checkOut` cuando la reserva está en
`checkedIn`; los estados loading, error con reintento, listo y confirmado
quedan reflejados en pantalla.

**Actualizacion 2026-09-21 (#71):** el check-out ya no depende solo del estado
de reserva. `CheckOutScreen` carga cargos, pagos y depositos; bloquea el cierre
si el folio conserva `balance_cents !== 0` e informa el saldo actual. El cierre llama
a `bookingService.checkOut`, que cierra el folio, pasa la reserva a
`checkedOut` y devuelve la habitacion al flujo de limpieza (`available` +
`dirty`). `GuestAccountScreen` permite registrar pagos en el folio ademas de
consumos.

**Actualizacion 2026-10-03 (#103):** los folios integrados con backend (UUID)
no usan calculo local de saldo ni apertura/cierre mock. Las utilidades legacy
de folio rechazan UUID y `voidCharge(chargeId, reason)` queda solo para cargos
mock; un cargo UUID debe anularse con `voidCharge(chargeId, reason, bookingId)`.
`GuestAccountScreen` carga folios UUID por `GET /bookings/{bookingId}/folio`
y refresca el folio despues de registrar cargos o pagos, sin sumar/restar saldo
en estado local.

**Actualizacion 2026-10-04 (#102 / INT-04):** recepcion integrada usa backend
real para acompanantes, asignacion, check-in y check-out en reservas UUID.
`bookingCompanionService` sincroniza con `GET`/`POST /bookings/{bookingId}/companions`
y `PUT`/`DELETE /bookings/{bookingId}/companions/{companionId}`;
`bookingService.assignRoom` envia `roomId` por `PUT /bookings/{id}`;
`checkIn` y `checkOut` llaman `POST /bookings/{id}/check-in` y
`POST /bookings/{id}/check-out`. `CheckOutScreen` ya no bloquea el intento por
saldo local: muestra el aviso de saldo y deja que el backend responda `409`,
sin forzar cierre local. Los cambios de acompanantes se aplican en orden
`DELETE` -> `PUT` -> `POST`, y despues de check-in/check-out las pantallas
refrescan reserva, folio y habitaciones desde servicios.

**Actualizacion 2026-09-22 (#72):** `GuestContent` resuelve al huesped desde la
sesion, muestra sus reservas reales y ya no usa habitacion 402, fechas 2024 ni
estancia fija del prototipo. Crear/cancelar pedidos y solicitudes, editar perfil,
modificar/cancelar reservas, vincular codigos del mismo huesped y marcar
notificaciones como leidas pasan por servicios; el boton de reintento vuelve a
consultar datos.

**Actualizacion 2026-09-27:** el recibo del portal de huesped se descarga como
PDF generado en navegador. El boton ya no usa `window.print()` ni abre el
dialogo de impresion como sustituto de descarga.

**Actualización WEB-29 (2026-09-13):** `GuestAccountScreen` dejó de ser stub.
Carga la cuenta por `GACC-*` y sus cargos por `booking_id`, muestra el desglose
con saldo y estado, y permite registrar consumos mediante
`guestAccountService.createCharge`. El formulario valida concepto y monto
positivo en GTQ, conserva estados de carga/error y actualiza el saldo visible
después de una creación exitosa. La pantalla reutiliza los componentes de
presentación y patrones Bolt existentes; no agrega un sistema visual nuevo.
**Actualización posterior (#54, WEB-28, rama `fix/web-28-check-in`):** el
módulo `front-desk` deja de ser stub en `CheckInScreen.tsx`. Carga la reserva
(`bookingService.getBookingById`) y al huésped asociado
(`guestService.getGuestById`), permite asignar una habitación entre las que
`isRoomAssignable()` considera asignables (`bookingService.assignRoom`) y
habilita "Completar check-in" solo cuando la reserva tiene habitación
asignada y su estado admite la transición a `checkedIn` según
`BOOKING_STATUS_TRANSITIONS`; si no la admite, la pantalla lo explica en vez
de fallar en silencio. Al completar el check-in
(`bookingService.checkIn`) redirige a `/pms/accounts/:accountId` usando
`guestAccountService.getAccountByBookingId`.

**Actualización 2026-09-21 (#70):** `CheckInScreen` deja de tratar
acompañantes como texto local. `booking-companion` queda como entidad
DTO/Model/Mapper y `bookingCompanionService` persiste acompañantes por
`booking_id`. El check-in guarda documento del titular con
`guestService.updateGuest`, valida que huésped principal + acompañantes no
supere `roomType.capacity`, exige coherencia con `booking.adults/children` y
marca la habitación asignada como `occupied` al pasar la reserva a
`checkedIn`.

**Actualización 2026-09-26 (#76):** la pasada de consistencia visual mantiene
el contrato Bolt sin rediseño: `RoomDetailScreen` reutiliza una galería de
imágenes del motor público mediante `room-media.ts` y conserva un fallback
visual cuando un tipo no tiene fotos. En confirmación pública, cuenta y
check-out se muestra el nombre completo del huésped cuando se puede resolver
con `guestService`; los IDs `GST-*` quedan como referencia secundaria cuando
aportan valor operativo.


## 1. Reglas de la ronda

1. **`src/app/routes.ts` y `src/app/router.tsx` quedan congelados.** Quien
   necesite una ruta nueva la pide por PR a JEPG321. Lo mismo aplica a
   `src/modules/auth/models/session.ts` (la unión `Permission` y
   `rolePermissions`): un permiso nuevo también se pide por PR a JEPG321,
   mismo dueño, mismo procedimiento — ver sección 3.
2. **Cada lote escribe solo dentro de su carpeta de módulo**
   (`src/modules/rooms/`, `src/modules/booking-engine/`,
   `src/modules/occupancy/`, `src/modules/front-desk/`). Nada en `shared/`,
   nada en `app/`.
3. **Los primitivos de `shared/components/` son el sistema de estilos del
   proyecto.** `src/index.css` no se extiende; a futuro se reduce a reset y
   variables.
   El diseno visual sigue siendo el prototipo Bolt: cada pantalla nueva debe
   reutilizar tokens y patrones existentes (`visitor-*`, `reservation-*`,
   `rc-*`, `adm-*`, `.panel`, `.button`, `.content`) y solo agregar wrappers
   pequenos por modulo. La excepcion funcional es el login general: Bolt
   separaba huesped/empleado, pero la app decide el acceso por credenciales.
4. **Sigue viva la regla de oro**: nada fuera de la capa de servicios
   (`src/services/`) importa de `src/data/`.
5. **Estados** desde `shared/constants/statuses.ts` (`isRoomAssignable()`
   para asignabilidad, nunca un condicional propio). **Dinero** desde
   `shared/utils/currency.ts` (`formatCurrency`). **Fecha/hora** desde
   `shared/utils/date.ts` (`formatDateGT`/`formatTimeGT`). No existe
   `shared/utils/formatters.ts` — es el nombre que usaba el ticket original;
   se corrige aquí a los dos archivos reales.

## 2. Rutas registradas y su permiso

Públicas (`PublicLayout`, sin guarda):

| Ruta | Pantalla | Módulo |
| --- | --- | --- |
| `/` | `SearchScreen` | booking-engine |
| `/rooms/:roomTypeId` | `RoomDetailScreen` | booking-engine |
| `/booking/new` | `BookingFormScreen` | booking-engine |
| `/booking/:bookingId/done` | `BookingConfirmationScreen` | booking-engine |
| `/auth/register` | `StaffLoginPage` en modo registro de huesped demo | auth/public |

Nota 2026-09-17 (`pulir-detalles`): desde la home publica, `Iniciar sesion`
abre `PublicAuthModal` sobre la pagina en vez de navegar inmediatamente. El
registro se alcanza desde ese mismo modal. Las rutas `/auth/login` y
`/auth/register` siguen existiendo para enlaces directos. `BookingFormScreen`
captura datos del huesped, crea un `Guest` demo mediante
`guestService.createGuest` y luego crea la reserva con el ID generado. El flujo
avanza dentro de la misma pantalla por `Datos y habitacion`, `Confirmacion` y
`Pago`; la reserva se persiste solo en el ultimo paso. El paso de pago es demo
y ofrece metodos frecuentes para hotel: tarjeta, transferencia, pago en hotel y
billetera digital, sin procesar cobros reales.

Nota 2026-10-04 (#129): ese pago publico sigue siendo demo. No representa
pasarela local, no captura datos sensibles, no confirma cobros ni emite FEL. La
frontera de Guatemala para pagos locales y SAT/FEL queda documentada en
[`docs/guatemala-pagos-fel-frontend.md`](guatemala-pagos-fel-frontend.md).

Nota 2026-09-21 (#69): la creacion publica, la reserva manual y la edicion de
reservas validan capacidad con la misma regla compartida:
`adults + children <= roomType.capacity`. La UI revalida al cambiar tipo de
habitacion, adultos o menores, y `bookingService.createBooking/updateBooking`
rechazan cualquier intento invalido antes de mutar datos mock.

Privadas (`RequireSession` + `RequirePermission`):

| Ruta | Pantalla | Módulo | Permiso |
| --- | --- | --- | --- |
| `/pms/rooms` | `RoomListScreen` | rooms | `rooms:manage` |
| `/pms/rooms/new` | `RoomFormScreen` | rooms | `rooms:manage` |
| `/pms/rooms/:roomId/edit` | `RoomFormScreen` | rooms | `rooms:manage` |
| `/pms/room-types` | `RoomTypeListScreen` | rooms | `rooms:manage` |
| `/pms/room-types/new` | `RoomTypeFormScreen` | rooms | `rooms:manage` |
| `/pms/occupancy` | `OccupancyScreen` | occupancy | `occupancy:view` |
| `/pms/bookings/new` | `ManualBookingScreen` | occupancy | `occupancy:view` |
| `/pms/check-in/:bookingId` | `CheckInScreen` | front-desk | `front-desk:operate` |
| `/pms/accounts/:accountId` | `GuestAccountScreen` | front-desk | `front-desk:operate` |
| `/pms/check-out/:bookingId` | `CheckOutScreen` | front-desk | `front-desk:operate` |

Nota 2026-09-16: la migracion Bolt agrega workspaces privados dedicados fuera
del `PrivateLayout` clasico para `/pms/reception`, `/pms/housekeeping`,
`/pms/room-service`, `/pms/concierge` y `/pms/dashboard`. `StaffLoginPage`
restaura una URL privada segura si existe; si no existe, usa el rol de sesion
para entrar directo al workspace operativo correspondiente.

Nota 2026-10-01 (#99 / INT-01): el login y las guardas conservan la UI y rutas
existentes, pero la sesion ya no nace de `sessionAccountsDB`. `authService`
usa `/auth/login`, `/auth/refresh` y `/auth/logout` del backend Spring, y los
roles/permisos de navegacion se derivan del JWT (`ROLE_*` y `authorities`).
No cambia el alcance de pantallas ni el contrato visual Bolt.

Nota 2026-10-04 (#100 / INT-02): la integracion de habitaciones, tipos,
caracteristicas y tarifas se hizo en `roomService` sin cambiar pantallas ni CSS.
Las rutas existentes de habitaciones, ocupacion, recepcion, motor publico y
Administracion conservan su UI, pero ahora consumen `/rooms`, `/room-types`,
`/room-features` y `/rates` mediante `http-client.ts`. `priceCents` permanece
en centavos y `status`/`housekeepingStatus` siguen separados.

Nota 2026-10-04 (#111 / INT-13): esa integracion ya no conserva fallback local
de listados en `roomService`; las rutas anteriores deben recibir backend real o
mostrar el error. Huespedes y reservas tambien dejan de caer automaticamente a
mocks para llamadas integradas; solo los IDs legacy explicitos del prototipo
(`GST-*`, `BKG-*`, `RT-*`) mantienen comportamiento local.

Nota 2026-09-30 (#95): el workspace de Administracion usa el sidebar como
navegacion primaria para subsecciones. `PrivateWorkspace` define grupos
desplegables para Usuarios y roles, Habitaciones, Tarifas, Servicios,
Reportes e Inventario; `AdminContent` renderiza el contenido segun el subitem
activo y ya no muestra tabs internas para esas secciones. Reportes mantiene
los siete tipos originales agrupados en Resumen operativo, Reportes
financieros y Analisis comercial. En Roles y permisos, las tarjetas muestran
la matriz de accesos por dashboard/vista para todos los roles, agrupada por
Administracion, Recepcion, Limpieza, Room Service, Conserjeria y Huesped.
El sidebar consume esa organizacion: admin despliega todos los grupos y los
roles operativos solo muestran su grupo habilitado; el editor de rol conserva
visibles tanto permisos marcados como no marcados, y permite seleccionar o
deseleccionar permisos por grupo sin perder la seleccion individual. Las
tarjetas de roles, en cambio, ocultan los permisos no seleccionados para que
reflejen solo lo habilitado. Para demostracion sin backend, los permisos
editados se guardan en `localStorage` (`pms.demo.rolePermissions`) y alimentan
el sidebar filtrado de cualquier rol en ese navegador. Si un rol operativo
solo tiene permisos de su modulo, mantiene menu plano; si se le agregan
permisos cruzados, el menu se agrupa por modulo para distinguir accesos con
el mismo nombre.

## 3. Permisos nuevos en `session.ts`

El guarda `RequirePermission` (WEB-06) valida contra la unión cerrada
`Permission` de `src/modules/auth/models/session.ts` — **no** contra
el catálogo operativo de roles/permisos del backend. Los dos no
están conectados (por diseño, ver D-003 en `docs/DECISIONES.md`): el primero
es el contrato de sesion de acceso/login (`UserRole`: ADMIN/GUEST/RECEPTION/HOUSEKEEPING/CONCIERGE/ROOM_SERVICE); el segundo es el catalogo configurable de puesto/permiso
(`role.code`/`user.role`). Se siguió la convención de `session.ts` por ser la
que de verdad consume el guarda.

Se agregaron tres permisos de Ronda 1 sobre la matriz vigente de roles de sesion:

| Permiso | ADMIN | GUEST | RECEPTION | HOUSEKEEPING | CONCIERGE | ROOM_SERVICE |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| `rooms:manage` | si | - | - | - | - | - |
| `occupancy:view` | si | - | si | - | - | - |
| `front-desk:operate` | si | - | si | - | - | - |
**Deuda registrada, sin resolver en este PR**: coexisten dos vocabularios de
permisos — la unión `Permission` de `session.ts` (la que aplica el guarda de
rutas) y el catálogo operativo de roles/permisos del backend. No hay nada que
los mantenga sincronizados; si divergen, solo lo detecta lectura manual, no una
prueba. Antes de que el Lote D construya la pantalla
de "roles y permisos" hace falta un ticket propio que decida si se
unifican, se mapean explícitamente, o se documentan como capas
deliberadamente separadas (en la línea de D-003).

## 4. Colisión resuelta: `'/'`

`routePaths.public.home = '/'` ya servía `PublicHomePage` — un shell mínimo
(`src/public/page.tsx` + `src/pages/PublicHomePage.tsx`) con un único botón
"Iniciar sesión". No hacía nada más. Se confirmó que el login tiene rutas
propias independientes (`/auth/login`, `/login` → `LoginPage` →
`StaffLoginPage`), así que `'/'` pasa a servir `SearchScreen` (booking-engine,
Lote B) sin perder alcance del login: `PublicLayout` ahora incluye un enlace
fijo "Personal · Iniciar sesión" hacia `routePaths.public.login`, visible en
toda la zona pública. `PublicHomePage.tsx` y `public/page.tsx` se eliminaron
del árbol (código muerto, sin otras referencias) y se corrigieron sus
menciones en `src/ARCHITECTURE.md` y `src/modules/README.md`.

## 5. Parámetros tipados

No existía un helper de rutas con parámetros tipados en el proyecto; se usa
el genérico de una sola clave de `react-router-dom` (`useParams<'roomId'>()`)
en cada pantalla que lee un parámetro — leer una clave que no se declaró es
error de compilación dentro de esa pantalla. No se instaló ninguna librería
nueva.
