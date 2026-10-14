# Capa de servicios

Los componentes consumen servicios, no datos mock ni DTOs directamente. Cada
servicio simula latencia, puede lanzar un error controlado y transforma los
DTOs mediante el mapper correspondiente antes de devolver modelos de dominio.

```tsx
import { useEffect, useState } from 'react';
import { roomService } from '@/services/roomService';
import type { Room } from '@/shared/types/entities';

export function RoomsView() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    roomService
      .getRooms()
      .then((data) => {
        if (active) setRooms(data);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Error inesperado');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <p>Cargando...</p>;
  if (error) return <ErrorState message={error} />;
  return <RoomList rooms={rooms} />;
}
```

Servicios disponibles: `authService`, `roomService`, `bookingService`,
`bookingCompanionService`, `guestService`, `paymentService`, `catalogService`,
`guestAccountService`, `cashService`, `personnelService`, `inventoryService`,
`auditService`, `orderService`, `serviceRequestService` y `notificationService`. Las
operaciones de creación reciben los DTOs de entrada definidos en
`src/shared/types/entities`; sus respuestas siempre son modelos de dominio.
Desde INT-FINAL (#135), `src/data/db.ts` no existe: las pantallas productivas
consumen backend real mediante `http-client.ts` y las pruebas usan fixtures
bajo `scripts/fixtures/`.
Desde INT-01, `authService` usa el backend Spring configurado con
`VITE_API_BASE_URL`; las integraciones posteriores se documentan abajo.

Nota 2026-10-04 (#129): pagos locales de Guatemala y FEL/SAT no se integran
directo desde servicios frontend. `paymentService` y `guestAccountService`
mantienen metodos de pago abstractos y folio operativo; cualquier PSP,
redireccion, webhook, tokenizacion, emision FEL, anulacion o certificacion debe
exponerse primero desde backend. Stripe no se asume proveedor productivo local
para Guatemala; VisaNet, NeoNet, QPayPro, Infile, GFACE, Megaprint u otros
proveedores deben llegar por contrato backend. Ver
[`docs/guatemala-pagos-fel-frontend.md`](../../docs/guatemala-pagos-fel-frontend.md).

Nota INT-13: `personnelService` usa el backend real para usuarios, roles y
permisos. El catalogo de permisos sale de `GET /admin/permissions`; las
escrituras de roles usan `POST /admin/roles`, `PUT /admin/roles/{id}` y
`PUT /admin/roles/{id}/permissions`.

## WEB-14: servicios faltantes de la vertical Ronda 1

`roomService` expone `createRoom(data)`, `updateRoom(id, data)` y
`getRoomTypes()`. Desde INT-02, habitaciones, tipos, caracteristicas y tarifas
usan el backend real; ver la seccion "Integracion con INT-02" para endpoints y
fallbacks.

`bookingService` expone `checkIn(bookingId)`, `checkOut(bookingId)` y
`assignRoom(bookingId, roomId)`. `checkIn`/`checkOut` validan contra
`BOOKING_STATUS_TRANSITIONS`; una transición inválida lanza error. `checkIn`
abre/reutiliza la cuenta de huésped y marca la habitación asignada como
`occupied`. `assignRoom` solo asigna habitaciones que `isRoomAssignable()`
considera aptas.
`createBooking(data)` y `updateBooking(id, data)` validan la capacidad maxima
del tipo de habitacion antes de persistir: `adults + children` no puede superar
`roomType.capacity`, pero una reserva exactamente igual a la capacidad es valida.

`bookingCompanionService` expone `getCompanionsByBookingId(bookingId)` y
`saveCompanionsForBooking(bookingId, data)`. Persiste acompañantes en
`bookingCompanionsDB`, valida campos requeridos, capacidad de la habitación y
coherencia con `booking.adults/children` contando al huésped principal como un
adulto.

Desde INT-04, cuando el `bookingId` es UUID, esos mismos metodos de
acompanantes consumen las rutas reales de `BookingCompanionController`
(`GET`/`POST /bookings/{bookingId}/companions`,
`PUT`/`DELETE /bookings/{bookingId}/companions/{companionId}`) y delegan al
backend las reglas de estado, habitacion y composicion. Desde #131, las reservas
legacy `BKG-*` ya no simulan guardado productivo. La sincronizacion integrada se ejecuta en
orden (`DELETE`, luego `PUT`, luego `POST`) para evitar carreras contra las
validaciones de composicion del backend.

`guestAccountService.createCharge(data)` crea un `Charge` real, lo marca como
`posted`, calcula `amount_cents = quantity * unit_price_cents` y actualiza el
`balance_cents` guardado de la cuenta abierta de esa reserva.

Actualizacion 2026-09-21 (#71): el folio es la fuente de verdad financiera de
la estancia. `checkIn` abre/sincroniza la cuenta y crea el cargo base de
estancia de forma idempotente con `category: 'stay'`; `createCharge`,
`createPayment` y `voidCharge`
recalculan `balance_cents` como cargos `posted` menos pagos `completed` menos
depositos no `refunded`. `checkOut` bloquea si queda saldo pendiente; cuando el
saldo esta exactamente en cero cierra la cuenta, marca la reserva como
`checkedOut` y deja la habitacion `available` + `dirty` para limpieza.

Actualizacion 2026-10-02 (#103): cuando el `bookingId` pertenece al backend
real (UUID), `guestAccountService` usa `GuestFolioController`,
`PaymentController` y `DepositController` mediante `http-client.ts` para folio,
cargos, anulaciones, pagos, depositos, aplicacion y reembolso. Los IDs mock
legacy (`BKG-*`) ya no usan persistencia simulada productiva; el servicio
responde con error controlado si una pantalla intenta operar folios sin UUID de
backend.
Actualizacion 2026-10-03 (#103): las utilidades legacy
`openOrSyncAccountForBooking`, `closeAccountForCheckout` y
`calculateAccountBalanceCents` rechazan reservas UUID para evitar que un flujo
integrado mezcle datos reales con el folio mock. En reservas UUID, el saldo
oficial siempre viene de `GET /bookings/{bookingId}/folio`. `voidCharge`
tambien exige `bookingId` cuando el `chargeId` es UUID; la firma antigua
`voidCharge(chargeId, reason)` queda limitada a cargos mock.
`GuestAccountScreen` tambien usa ese contrato: si la ruta recibe un UUID lo
trata como `bookingId` y carga el folio por `getAccountByBookingId`; despues
de crear cargos o pagos vuelve a consultar el folio en vez de ajustar
`balanceCents` manualmente en React.

Actualizacion 2026-10-04 (#101 / INT-03): `guestService` y `bookingService`
integran huespedes y reservas con el backend Spring mediante `http-client.ts`.
Las lecturas `GET /guests` y `GET /bookings` normalizan las respuestas
camelCase del backend a los DTO internos y devuelven Models. Desde INT-13, una
falla del backend se propaga para mostrar el estado real de integracion.

`guestService.createGuest(data)` y `guestService.updateGuest(id, data)` envian
`POST /guests` y `PUT /guests/{id}` con camelCase (`firstName`,
`documentNumber`, etc.). IDs legacy `GST-*` se rechazan con error controlado.

`bookingService.createBooking(data)` y `bookingService.updateBooking(id, data)`
envian `POST /bookings` y `PUT /bookings/{id}` con camelCase cuando la reserva
usa IDs UUID de backend (`guestId`, `roomTypeId`, `checkIn`, etc.). Las reservas
legacy `BKG-*` y las creaciones con catalogos mock `RT-*` ya no conservan el
prototipo local productivo.

Actualizacion 2026-10-04 (#102 / INT-04): para reservas UUID,
`bookingService.assignRoom` usa `PUT /bookings/{id}` con `roomId`,
`checkIn` usa `POST /bookings/{id}/check-in` y `checkOut` usa
`POST /bookings/{id}/check-out`. El frontend no cambia estados localmente ni
recalcula reglas financieras para esas reservas: si el backend responde `409`
por saldo pendiente, el mensaje se presenta y la reserva permanece sin cerrar.
Las pantallas de recepcion vuelven a consultar reserva, folio y habitaciones
despues de check-in/check-out.

La validacion local de capacidad se mantiene para `room_type_id` mock (`RT-*`).
Cuando el `roomTypeId` es UUID se delega al backend, porque el dataset local no
es autoridad sobre tipos integrados.

Actualizacion 2026-09-22 (#72): el portal de huesped ya no confirma acciones
solo en estado local. `orderService.createOrder()` persiste pedidos de Room
Service contra `booking_id`/`room_id`/`guest_id`, valida productos activos y
`cancelOrder()` solo permite cancelar pedidos `pending` o `accepted` del mismo
huesped. `serviceRequestService.createRequest()` y `cancelRequest()` hacen lo
mismo para solicitudes de habitacion; la cancelacion de solicitudes se
representa con el estado contractual `rejected` en `service_request`.
**Reemplazado por INT-12:** el portal ya no guarda marcas de lectura locales;
las notificaciones y su estado salen del backend — ver "Integracion con
INT-12".

Actualizacion 2026-09-22 (#73): las operaciones de Limpieza que antes vivian
solo en estado React pasaron a servicios persistibles. Desde INT-02,
`roomService.updateRoom()` envia cambios de `housekeeping_status` al backend de
habitaciones; `serviceRequestService` crea reportes de desperfectos
(`maintenance`) y solicitudes generales en `/service-requests`. Los handlers del workspace esperan estos metodos
antes de mostrar mensajes de exito, por lo que un error conserva el estado
anterior visible. Desde INT-09 el turnover, las tareas stayover y el historial
de Limpieza salen del backend — ver "Integracion con INT-09".
Los reportes de desperfectos envian `roomId`, `type: maintenance`,
descripcion y notas al backend, que decide permisos y estado.

Actualizacion 2026-09-22 (#74): Room Service y Conserjeria ya no dependen de
`setState` para aceptar, rechazar, cancelar, observar o completar. Los pedidos
usan `orderService.updateOrderStatus()` y `updateOrderNotes()` sobre
`PMS_ORDERS_DB`; al pasar a `delivered` crean exactamente un `Charge` real en
el folio abierto con `guestAccountService.createCharge()` y guardan su
`charge_id`. Si el caller envia un `createdByUserId` operativo real, el cargo
lo conserva; si no, queda como cargo automatico sin inventar usuario creador.
Reintentar `delivered` conserva el mismo cargo; `rejected` y `cancelled` no
crean cargos. Conserjeria usa los endpoints reales de
`ConciergeRequestController`; la persistencia mock local quedo fuera del flujo
productivo.

Actualizacion 2026-09-29 (#87): los botones `Actualizar` de Menu/Historial de
Room Service y de Historial de Conserjeria recargan datos desde los servicios
mock vigentes en vez de solo emitir notificaciones. `Registrar insumo` en el
inventario de cocina crea un movimiento real con `inventoryService.createMovement`
(`type: in`, `reason: restock`) sobre `PMS_INVENTORY_MOVEMENTS_DB` y actualiza
`PMS_INVENTORY_ITEMS_DB`. El detalle de Conserjeria usa la solicitud real
seleccionada, muestra `bookingId`, habitacion, estado, fechas y notas disponibles,
sin completar datos ausentes con valores inventados.

Actualizacion 2026-09-24 (#75): Administracion ya no muestra metricas
operativas hardcodeadas como si fueran actuales. `AdminContent` calcula
dashboard/reportes desde habitaciones, reservas, caja, inventario y auditoria
cargadas por servicios, con moneda GTQ. Las operaciones soportadas esperan a
servicios persistibles antes de mostrar exito: habitaciones/tipos/tarifas usan
`roomService` contra backend desde INT-02,
promociones usan `promotionService` (`PMS_PROMOTIONS_DB`), inventario usa
`inventoryService` (`PMS_INVENTORY_ITEMS_DB`,
`PMS_INVENTORY_MOVEMENTS_DB`) y caja usa `cashService` contra el backend real.
Usuarios/roles,
amenidades, catalogo de Room Service y tarifas dinamicas no mutan porque no
tienen contrato de escritura vigente en esta rama; la UI informa fuera de
alcance en vez de simular guardados locales.
Inventario solo guarda `responsible_user_id` cuando el caller envia un `User.id`
existente; si no hay usuario de sesion, el campo queda ausente y nunca se
reemplaza por un administrador o recepcionista por defecto. En caja, el
responsable operativo lo define el backend desde la sesion autenticada.

## Forzar errores mock

1. En código: `mockUtils.setForceError(true)` y, al terminar la prueba,
   `mockUtils.setForceError(false)`.
2. En la URL: agrega `?mockError=true` a la ruta actual.

Todas las operaciones esperan entre 300 y 600 ms por defecto. Para pruebas
unitarias se puede usar `simulateLatency(0, 0)` directamente.

## Integracion con INT-01

`authService.login(email, password, signal?)` conserva su API y admite cancelar
una solicitud pendiente. Ya no valida contra `sessionAccountsDB`: envia
`{ email, password }` a `POST /auth/login` del backend Spring.

El backend devuelve `accessToken`, `refreshToken`, `tokenType` y `expiresIn`.
`authService` normaliza esa respuesta al contrato de sesion del frontend,
decodifica el JWT para obtener `sub`, `ROLE_*` y `authorities`, y persiste solo
tokens/metadatos en `PMS_AUTH_SESSION`.
La sesion persistida conserva dos vencimientos: `expiresAt` para la ventana de
8 horas del frontend y `accessExpiresAt` para el JWT. Al restaurar, si el `exp`
del access token ya vencio o esta dentro de la ventana preventiva,
`authService` llama `POST /auth/refresh` antes de devolver la sesion como
valida.

`http-client.ts` agrega `Authorization: Bearer <accessToken>` automaticamente.
Ante un `401` protegido, llama `POST /auth/refresh` con `{ refreshToken }`,
actualiza ambos tokens y reintenta la solicitud original una sola vez. Si el
refresh falla, limpia la sesion local para obligar un nuevo login.

`logout()` envia `POST /auth/logout` con el refresh token y siempre limpia la
persistencia local, incluso si la confirmacion remota falla. `clearSession()`
expone la limpieza local sincrona. La clave legacy `hotel-aurora.auth.v1` se
elimina al restaurar o limpiar sesion.

## INT-13: validacion E2E y mocks restantes

La integracion frontend-backend usa un unico punto de salida HTTP:
`src/services/http-client.ts`. No agregar `fetch`, `axios`, `XMLHttpRequest` ni
clientes paralelos en modulos o componentes; los servicios deben consumir
`httpClient` y traducir DTOs backend a modelos de dominio.

`src/data/db.ts` fue retirado en INT-FINAL (#135). Los componentes, modulos y
servicios no deben importarlo ni recrear bases locales de dominio. Si una
prueba necesita datos de contrato, debe usar fixtures en `scripts/fixtures/`,
fuera del bundle productivo. La suite `npm run test:e2e-integration` falla si
reaparece el archivo, si aparece un import a `src/data/db`, si se agrega un
cliente HTTP alternativo o si servicios integrados vuelven a introducir
fallbacks silenciosos tipo `isOfflineError`; las rutas integradas deben
propagar el error del backend.

El cliente central propaga `403`, `404` y `409` como `HttpError` con el payload
del backend para que la UI pueda mostrar errores controlados. Ante un `401`
protegido, intenta un refresh una sola vez y reintenta la solicitud original con
el nuevo JWT; si falla, el handler de sesion limpia el estado local.

## Integracion con INT-02

`roomService` conserva su API de dominio para pantallas publicas, privadas y
Administracion, pero las operaciones oficiales de habitaciones, tipos,
caracteristicas y tarifas ya pasan por `http-client.ts`:

- `GET /rooms`, `GET /rooms/{id}`, `POST /rooms`, `PUT /rooms/{id}`.
- `GET /room-types`, `GET /room-types/{id}`, `POST /room-types`,
  `PUT /room-types/{id}`.
- `GET /room-features`.
- `GET /rates`, `POST /rates`, `PUT /rates/{id}`. No se asume
  `GET /rates/{id}`.

El backend usa camelCase (`roomNumber`, `roomTypeId`, `housekeepingStatus`,
`roomFeatureIds`, `priceCents`). El servicio adapta esas respuestas a los DTOs
internos snake_case y despues aplica los mappers existentes para devolver
Models. `status` y `housekeepingStatus` permanecen separados; `priceCents` se
mantiene en centavos y no se duplica ninguna regla de negocio del backend.

Los listados ya no conservan fallback local cuando el backend no esta
disponible: `getRooms()`, `getRoomTypes()`, `getRoomFeatures()` y `getRates()`
deben recibir datos reales o propagar el error. Los detalles por ID no ocultan
un 404 real: `getRoomById()` y `getRoomTypeById()` devuelven `undefined` si el
backend indica que el recurso no existe. Las escrituras de habitaciones, tipos
y tarifas usan el contrato HTTP real; los errores 400, 401, 403, 404 y 409 se
propagan como mensajes de operacion para que la UI existente muestre el fallo
sin mutar estado local.

`PrivateWorkspace` carga `rooms` solo para roles con dominio de habitaciones
(`admin`, `reception`, `housekeeping`), y carga `room-types`/`room-features`
solo para `admin` y `reception`. Limpieza carga sus habitaciones desde
HousekeepingController. Room Service usa el `roomNumber`, `guestName` y
`productName` que entrega su propio backend de pedidos, sin depender de
`rooms.read`. Asi se evitan llamadas que el backend rechazaria con 403 por falta
de permisos de catalogo.

## Integracion con INT-03 (#101)

Huespedes y reservas dependen del backend real:

- `guestService`: `GET /guests`, `GET /guests/{id}`, `POST /guests`,
  `PUT /guests/{id}`.
- `bookingService`: `GET /bookings`, `GET /bookings/{id}`, `POST /bookings`,
  `PUT /bookings/{id}`.
  El backend habla camelCase; la web conserva su contrato interno DTO
  snake_case -> Mapper -> Model. Las pantallas no reciben DTOs ni importan
  datos locales.

INT-13 elimina el fallback automatico de esos endpoints: `GET/POST/PUT` contra
UUID/backend debe responder desde la API real o fallar. El acceso a datos mock
queda cerrado para servicios integrados: IDs legacy (`GST-*`, `BKG-*`, `RT-*`)
producen errores controlados en lugar de persistencia mock.

`PrivateWorkspace` carga `bookings` y `guests` solo para roles con permisos de
ese dominio (`admin` y `reception`). Roles como Limpieza, Room Service y
Conserjeria no disparan `GET /bookings` ni `GET /guests`, evitando que un 403
tumbe todo el workspace.

## Integracion con INT-08

`auditService.getLogs({ from, to })` consume `GET /admin/audit-logs` enviando
los parametros reales `from` y `to` como date-time ISO. Si no se indica rango,
usa una ventana amplia para mantener la carga inicial de Administracion.
Si el backend agrega modulos o acciones nuevas, el servicio conserva esos
valores en lugar de mapearlos a un fallback conocido.

`reportingService.getOperationalReport({ from, to })` consume
`GET /admin/reports/operations` y la vista de Reportes de Administracion usa
ese agregado oficial para ingresos, reservas, cancelaciones, noches ocupadas y
ordenes de Room Service del periodo seleccionado.
Cuando existe ese reporte oficial, Administracion no mezcla sus cifras con
reservas, habitaciones o cortes de caja locales: las reservas vigentes salen de
`bookingsByStatus` y los promedios o tendencias no expuestos por Reporting API
se muestran como no disponibles.

`reportingService.getStayReceipt(bookingId)` consume
`GET /admin/bookings/{bookingId}/receipt`, normaliza cargos, pagos y depositos
a modelos de dominio y se usa al descargar recibos de estancia cuando la
reserva tiene un UUID de backend. Las reservas demo `BKG-*` conservan el
recibo local como fallback de prototipo.

## Integracion con INT-07

`catalogService.getProducts()` conserva el catalogo operativo de Room Service
en `GET /room-service/products`, pensado para devolver productos disponibles.
Para Administracion se agrego `getAdminProducts()` sobre
`GET /admin/room-service/products`, que incluye activos e inactivos, junto con
`POST /admin/room-service/products` y
`PUT /admin/room-service/products/{id}` para crear, editar y activar/desactivar
productos sin cambiar el comportamiento de las pantallas operativas.

`getAmenities()` conserva la lectura compatible con huespedes en
`GET /admin/amenities?active=true`. Administracion usa `getAdminAmenities()`
sobre `GET /admin/amenities` para ver activas e inactivas, y las escrituras
`POST /admin/amenities` / `PUT /admin/amenities/{id}` para crear, editar y
cambiar estado.

`personnelService.getUsers()`, `getUserById()`, `getRoles()` y
`getPermissions()` consumen `GET /admin/users`, `GET /admin/users/{id}`,
`GET /admin/roles` y `GET /admin/permissions`; `roleCode` se normaliza al
literal de rol usado por el frontend solo en respuestas.
`createUser()` usa el DTO real del backend con `firstName`, `lastName`,
`email`, `password` y `roleId`; no envia `roleCode` ni `status`.
`updateUser()` usa `firstName`, `lastName`, `email`, `roleId` y `status` para
edicion y activacion/desactivacion. `createRole()`, `updateRole()` y
`updateRolePermissions()` persisten roles y permisos en el backend.

`promotionService` usa `GET/POST/PUT /admin/promotions`. Como el backend no
expone `GET /admin/promotions/{id}`, las actualizaciones obtienen primero la
lista, mezclan los campos parciales del UI y envian el request completo que
requiere Spring.

`inventoryService` usa `GET /inventory/items`,
`GET /inventory/items/{id}`, `GET /inventory/items/{id}/movements`,
`POST /inventory/items/{id}/movements` y
`PUT /admin/inventory/items/{id}`. El backend no acepta `currentQuantity` en
el upsert administrativo, por lo que un ajuste manual de existencias se aplica
con un movimiento compensatorio `restock` o `shrinkage`.

Las lecturas anteriores conservan un fallback local solo cuando el backend no
esta disponible o el harness de pruebas responde 404 a rutas no mockeadas; las
respuestas HTTP reales distintas de 404 se propagan como error. Las escrituras
usan el contrato HTTP del backend.

## Integracion con INT-06 (#104)

`cashService` conserva su API de dominio para las pantallas administrativas,
pero ya no usa `cashSessionsDB`, `cashMovementsDB` ni `localStorage` como fuente
oficial. Las operaciones de caja se envian al backend Spring mediante
`http-client.ts`:

- `GET /cash-sessions/current` para consultar la jornada abierta del usuario.
- `GET /cash-sessions/{id}/movements` para consultar movimientos.
- `POST /cash-sessions/open` con `openingBalanceCents` y `notes`.
- `POST /cash-sessions/{id}/movements` con `type`, `concept` y `amountCents`.
- `POST /cash-sessions/{id}/close` con `countedBalanceCents` y `notes`.

`getSessions()` mantiene el nombre de la API de dominio por compatibilidad con
las pantallas existentes, pero hoy representa como maximo `[currentSession]`; no
es un historial. Al cerrar caja, la UI debe volver a consultar `/current` y
esperar `[]` si ya no hay jornada abierta. La apertura de una jornada envia el
saldo inicial indicado por la pantalla de apertura y no hereda automaticamente
el saldo esperado de una jornada anterior.

Los montos siguen en centavos y la moneda se mantiene como `GTQ`. Los totales
`totalIncomeCents`, `totalExpenseCents` y `expectedBalanceCents` son autoridad
del backend; Administracion los usa cuando vienen en la respuesta y solo
conserva calculos locales como respaldo visual para datos historicos sin esos
campos.

## Integracion con INT-09 (#107)

`housekeepingService` ya no guarda estados, tiempos ni historial en
`localStorage`. Todas las operaciones van a `HousekeepingController` del backend
mediante `http-client.ts` y devuelven Models (`Room`, `ServiceRequest`):

- `getRooms({ housekeepingStatus? })` → `GET /housekeeping/rooms`.
- `getRoom(roomId)` → `GET /housekeeping/rooms/{roomId}`.
- `startCleaning` / `completeCleaning` / `inspectRoom` →
  `POST /housekeeping/rooms/{roomId}/start|complete|inspect`.
- `getStayoverCleanings({ bookingId?, status? })` →
  `GET /housekeeping/rooms/stayover-cleanings`. Ambos filtros son opcionales:
  sin filtros devuelve la cola completa (el rol housekeeping no tiene
  `bookings.read`). Requiere el cambio de backend de la rama
  `feature/housekeeping-stayover-listing`.
- `createStayoverCleaning(roomId, { bookingId, description? })` →
  `POST /housekeeping/rooms/{roomId}/stayover-cleanings`.
- `startStayoverCleaning` / `completeStayoverCleaning` →
  `POST /housekeeping/rooms/stayover-cleanings/{requestId}/start|complete`.

Reglas:

- `Room.status` (ocupacion) y `Room.housekeepingStatus` (limpieza) siguen
  separados. El turnover `dirty -> cleaning -> clean -> inspected` solo cambia
  `housekeepingStatus`; stayover es otro flujo (`ServiceRequest` con
  `type: 'housekeeping'`) y no toca ninguno de los dos estados.
- El backend decide si una transicion es valida. El frontend no replica las
  reglas: la UI ofrece la accion y, si el backend responde `400`, `403` o `404`,
  muestra el error y recarga el estado real.
- `room` incorpora la trazabilidad opcional (`cleaningStartedAt`,
  `cleaningCompletedAt`, `inspectedAt` y los correos de quien hizo cada paso).
  Los tiempos e historial de la pantalla se calculan con esos campos y con
  `startedAt`/`completedAt` de stayover. El backend solo conserva el ultimo
  turnover de cada habitacion, asi que el historial muestra ese ultimo ciclo
  mas las tareas stayover completadas.
- Un `cancelled` de stayover se representa como `rejected`, igual que el resto
  del contrato `service_request` del frontend.
- `getChecklists` consume `GET /housekeeping/checklists`,
  `createChecklist` consume `POST /housekeeping/checklists` y `saveChecklist`
  consume `PUT /housekeeping/checklists/{id}`. El checklist pertenece a una
  `ServiceRequest` de housekeeping (`serviceRequestId`), no al turnover normal
  de una habitación; el servicio mapea `items[].checked` del backend a
  `items[].done` para la UI y puede enviar `status` cuando la acción debe cerrar
  el checklist real. Los checklists ya no se guardan en `localStorage`.
- El workspace solo consulta Limpieza para el rol `housekeeping`; los demas
  roles no tienen `housekeeping.read` y recibirian `403`.

## Integracion con INT-10 (#108)

El lado del personal de `orderService` ya no usa `ordersDB` ni `localStorage`.
Todas sus operaciones van a `RoomServiceController` mediante `http-client.ts`:

- `getOrders({ bookingId?, status? })` → `GET /room-service/orders`.
- `getOrderById(id)` → `GET /room-service/orders/{id}` (`undefined` si no existe).
- `createStaffOrder({ bookingId, items, notes? })` → `POST /room-service/orders`.
  El backend toma habitacion, huesped y precios de la reserva.
- `updateOrderStatus(id, status, notes?)` → `POST /room-service/orders/{id}/status`.
  `notes` viaja junto con el cambio (motivo de rechazo o cancelacion); si se
  omite, el backend conserva las notas actuales.
- `updateOrderNotes(id, notes)` → `PATCH /room-service/orders/{id}/notes`.

Ambos endpoints de notas requieren la rama de backend
`feature/room-service-order-notes`. El catalogo sigue en `catalogService`
(`GET /room-service/products`, desde INT-07).

Reglas:

- El backend decide las transiciones (`pending -> accepted -> preparing ->
ready -> on_the_way -> delivered`; se cancela hasta `ready`; `pending`
  tambien puede rechazarse). `ORDER_STATUS_TRANSITIONS` quedo alineado con
  esas reglas solo como referencia; el servicio no lo usa para validar.
- El frontend no toca inventario ni crea cargos: aceptar descuenta stock,
  cancelar lo devuelve y entregar genera el cargo al folio, todo en backend. La
  UI solo refleja el `chargeId` que devuelve la respuesta.
- Ante `400`/`403`/`404` la pantalla muestra el error y recarga los pedidos
  reales.
- La respuesta incluye `roomNumber`, `guestName`, `productName` y los totales
  con precios congelados, porque el rol `room_service` no tiene `rooms.read`.
- El workspace solo consulta catalogo y pedidos para admin, recepcion y room
  service (`room-service.read`).
- El portal del huesped usa `getGuestOrders`, `createGuestOrder` y
  `cancelGuestOrder` (`/guest/room-service/...`, INT-12); los metodos mock
  `createOrder`, `cancelOrder` y `getOrdersByGuestId` se eliminaron.

## Integracion con INT-11 (#109)

`serviceRequestService` mezcla cuatro flujos; solo Conserjeria paso al backend
(`ConciergeRequestController`, via `http-client.ts`):

- `getConciergeRequests({ bookingId?, status? })` → `GET /concierge/requests`.
- `getConciergeRequestById(id)` → `GET /concierge/requests/{id}` (`undefined` si
  no existe). El detalle se pide al abrirlo.
- `createConciergeRequest({ bookingId, description, notes? })` →
  `POST /concierge/requests`.
- `updateConciergeRequest(id, { description?, notes? })` →
  `PUT /concierge/requests/{id}`: notas hasta `in_progress`, descripcion solo en
  `pending`.
- `updateConciergeRequestStatus(id, status, { notes?, responsibleUserId? })` →
  `POST /concierge/requests/{id}/status`.

`getRequests`, `getRequestById`, `createRequest`, `createMaintenanceReport` y
`updateRequestStatus` usan `ServiceRequestController` (`/service-requests`);
ver "Integracion con #126". `createMaintenanceReport` envia
`type: maintenance`; no usa `src/data/db.ts`.
Desde INT-12 el portal del huesped usa los metodos `*Guest*` y se eliminaron
`cancelRequest` y `getRequestsByGuestId`. Se eliminaron `updateRequestNotes` y
`updateRequestType`, que solo usaba Conserjeria; el `updateRequestStatus` de
Conserjeria paso a `updateConciergeRequestStatus`, y desde #126 el nombre
`updateRequestStatus` corresponde a la ruta general.

Reglas:

- El backend valida las transiciones (`pending -> accepted | rejected |
cancelled`, `accepted -> in_progress | cancelled`, `in_progress -> completed |
cancelled`). Ante `400`/`403`/`404` la pantalla muestra el error y recarga las
  solicitudes reales.
- Las notas de un cambio de estado se **agregan** a las existentes. Por eso los
  avances normales no mandan notas; rechazar y cancelar mandan el motivo.
- El responsable lo asigna el backend: al aceptar, iniciar o completar una
  solicitud sin responsable queda el usuario autenticado. La respuesta trae
  `responsibleUserName`, `roomNumber` y `guestName` (el rol `concierge` no tiene
  `rooms.read` ni acceso a `/admin/users`).
- `cancelled` es un estado propio del contrato (`docs/DECISIONES.md`, D-013) y se
  muestra como "Cancelada".
- El workspace solo consulta Conserjeria para admin, recepcion y conserjeria
  (`concierge.read`).

Requiere la rama de backend `feature/concierge-responsible-notes`.

## Integracion con #126: mantenimiento, confirmacion/cancelacion y finanzas globales

Contrato final de los flujos operativos que aun conservaban estado local:

| Servicio                | Metodo                                                            | Endpoint                             | Permiso backend          |
| ----------------------- | ----------------------------------------------------------------- | ------------------------------------ | ------------------------ |
| `bookingService`        | `confirmBooking(bookingId)`                                       | `POST /bookings/{id}/confirm`        | `bookings.write`         |
| `bookingService`        | `cancelBooking(bookingId, reason)`                                | `POST /bookings/{id}/cancel`         | `bookings.write`         |
| `serviceRequestService` | `getRequests({ type?, bookingId?, roomId?, status? })`            | `GET /service-requests`              | `service-requests.read`  |
| `serviceRequestService` | `getRequestById(id)` (`undefined` ante 404)                       | `GET /service-requests/{id}`         | `service-requests.read`  |
| `serviceRequestService` | `createRequest(...)` / `createMaintenanceReport(...)`             | `POST /service-requests`             | `service-requests.write` |
| `serviceRequestService` | `updateRequestStatus(id, status, { notes?, responsibleUserId? })` | `POST /service-requests/{id}/status` | `service-requests.write` |
| `guestAccountService`   | `getAccounts()`                                                   | `GET /guest-accounts`                | `folios.read`            |
| `guestAccountService`   | `getCharges()`                                                    | `GET /charges`                       | `charges.read`           |
| `guestAccountService`   | `getPayments()` (`paymentService` delega aqui)                    | `GET /payments`                      | `payments.read`          |
| `guestAccountService`   | `getDeposits()`                                                   | `GET /deposits`                      | `deposits.read`          |

Los endpoints por reserva (`/bookings/{id}/folio|charges|payments|deposits`)
no cambian; ver #103.

Reglas (las decide el backend, el frontend no las replica):

- Confirmar solo aplica a reservas `pending`; cancelar, a `pending` o
  `confirmed`, con `reason` obligatorio (`@NotBlank`). El servicio rechaza un
  motivo vacio antes de llamar. Fuera de estado el backend responde `400` y su
  mensaje se muestra tal cual. IDs legacy `BKG-*` se rechazan sin simular la
  transicion.
- `BookingResponse` incluye `cancellationReason` y `cancelledAt`; el contrato
  `booking` los expone como `cancellation_reason`/`cancelled_at` (DTO) y
  `cancellationReason`/`cancelledAt` (Model). Recepcion muestra ese motivo, ya no
  `notes`.
- `/service-requests` solo crea y cambia de estado `maintenance` y `other`;
  `housekeeping` (stayover, INT-09) y `concierge` (INT-11) tienen endpoints
  propios y el backend responde `400` si llegan por aqui. Por eso
  `createRequest` acepta solo esos dos tipos.
- Dominio por rol: admin y recepcion leen todos los tipos y escriben
  `maintenance`/`other`; Limpieza lee `housekeeping`/`maintenance` y solo crea
  `maintenance`; Conserjeria solo lee `concierge`. Transiciones:
  `pending -> accepted | rejected | cancelled`, `accepted -> in_progress |
cancelled`, `in_progress -> completed | cancelled`. Las notas de un cambio de
  estado se agregan a las existentes y el responsable se asigna desde la sesion
  al aceptar/iniciar/completar.
- `ServiceRequestResponse` de esta ruta no trae `chargeId`.

En `PrivateWorkspace`, `getRequests()` se carga solo para admin, recepcion y
Limpieza, y `getCharges`/`getPayments`/`getDeposits` solo para admin y
recepcion. Ya no pasan por `safeList`: un error real del backend se propaga en
vez de mostrar listas vacias. Cancelar una reserva desde Recepcion llama
`cancelBooking` y recarga reservas y habitaciones; si el backend rechaza, la
reserva sigue igual y se muestra el error. Reportar un desperfecto espera la
respuesta de `POST /service-requests` antes de sumarlo al panel de Limpieza.

## Integracion con INT-12 (#110) y AUTH-GUEST (#134)

El portal del huésped usa **Guest Access**, separado del login del personal:

1. **Flujo principal:** El huésped inicia sesión con su correo electrónico y
   contraseña en "Acceso de huésped" (`/auth/register`). `authService.loginGuest(email, password)`
   llama a `POST /guest/auth/login` y recibe un JWT de tipo `guest` (`ROLE_GUEST`),
   sin refresh token.
2. **Flujo secundario:** Como alternativa de compatibilidad/demo, el huésped
   puede canjear el código de vinculación de su reserva (`guestLinkCode`) entregado en check-in.
   `authService.linkGuest(code)` llama a `POST /guest/auth/link`.
3. La sesión de rol `GUEST` dura lo mismo que el token (sin refresh token) y,
   al vencer, se solicita nuevamente la autenticación al huésped.
4. `authService.login()` del personal rechaza cuentas `ROLE_GUEST`.

Todas las llamadas del portal van a `/guest/...` con ese JWT. **Ninguna envia
`bookingId`**: el backend toma la reserva del token (ownership); un recurso ajeno
responde `403`. Los errores se traducen en `guestHttp.ts`.

| Servicio                | Metodo                                                                                                          | Endpoint                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `guestPortalService`    | `getStay()`                                                                                                     | `GET /guest/stay`                  |
| `catalogService`        | `getGuestAmenities()`                                                                                           | `GET /guest/amenities`             |
| `catalogService`        | `getGuestProducts()`                                                                                            | `GET /guest/room-service/products` |
| `orderService`          | `getGuestOrders` / `createGuestOrder` / `cancelGuestOrder`                                                      | `/guest/room-service/orders`       |
| `housekeepingService`   | `getGuestStayoverRequests` / `createGuestStayoverRequest` / `cancelGuestStayoverRequest`                        | `/guest/housekeeping/requests`     |
| `serviceRequestService` | `getGuestConciergeRequests` / `createGuestConciergeRequest` / `cancelGuestConciergeRequest`                     | `/guest/concierge/requests`        |
| `notificationService`   | `getGuestNotifications` / `getGuestUnreadCount` / `markGuestNotificationRead` / `markAllGuestNotificationsRead` | `/guest/notifications`             |

La UI del portal permite cancelar Room Service mientras el backend lo admite
(`pending`, `accepted`, `preparing`, `ready`) y Conserjeria en `pending`,
`accepted` e `in_progress`. Housekeeping queda mas restrictivo en el portal:
solo muestra cancelar en `pending`, porque su flujo de stayover es distinto.

`GET /guest/room-service/products` y `POST /guest/notifications/read-all`
requieren la rama de backend `feature/int-12-guest-portal-support`.

Sin endpoint de huesped (se muestra "Consulta en recepcion" en lugar de
consumir servicios del personal): editar perfil, otras reservas, modificar o
cancelar la reserva, detalle del folio, tarifa y recibo. Las notificaciones mock
(`notificationReadsDB`) ya no son fuente: solo se muestran las del backend.

## Integracion web publica (#127)

`publicBookingCatalogService` usa solo los contratos publicos del backend, sin
JWT de personal (`skipAuthorization` y `skipRefresh`):

- `GET /public/room-types` → `getRoomTypes()` / `getRoomTypeCatalog()`.
- `GET /public/rates` → `getRates()` (tarifas vigentes, referencia "desde").
- `GET /public/availability` → `getAvailability({ checkIn, checkOut, adults,
children?, roomTypeId? })`: tarifa, total y `availableRooms` de la estadia.
- `POST /public/bookings` → `createBooking()`: body por lista blanca, sin
  `rateId`, `roomId`, `status`, importes ni `guestId`; responde la confirmacion
  `pending`.

Los errores salen como `PublicBookingError` (`kind` + mensaje en espanol); el
texto del backend nunca llega a la UI. No hay fallback local. Detalle en
`docs/DECISIONES.md`, D-016.
