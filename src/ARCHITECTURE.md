# Arquitectura del Frontend

```text
src/
  public/                 Vistas disponibles sin sesión
    pages/                Páginas públicas adicionales (incluye el catálogo de UI, /components)
  private/                Vistas autenticadas de empleados y administración
    page.tsx              Layout con menú principal
    pages/                Páginas privadas que combinan módulos
    guards/                RequireSession, RequirePermission
    routes/                Catálogo de navegación privada por permiso
  layouts/                Layouts conectados a React Router (PublicLayout incluye el
                          enlace "Personal · Iniciar sesión" hacia el login de staff)
  pages/                  Páginas base conectadas a las rutas (LoginPage, OperationsHomePage)
  modules/
    auth/                 Sesión de personal: modelos, mappers, servicios (fachada) y componentes
    ui-catalog/            Ejemplos asíncronos del catálogo de componentes
    rooms/                 Lote D (Ronda 1) — screens/, components/
    booking-engine/        Lote B (Ronda 1) — screens/, components/ (motor de reserva público)
    occupancy/              Lote A (Ronda 1) — screens/, components/
    front-desk/             Lote C (Ronda 1) — screens/, components/
  shared/
    components/           Button, Input, Select, Modal, DatePickerRange, Card, Badge,
                           EmptyState, LoadingState, ErrorState, DataTable (TableFrame), Pagination
    constants/
      statuses.ts          Literales y transiciones de estado compartidos con la app móvil
                           (room, booking, order, service_request) — ver "Contrato de datos" abajo
    types/
      common.ts            ID, ISODateString, Currency ('GTQ' literal), UserRole
      entities/<entidad>/  Un DTO + Model + Mapper por entidad (ver "Contrato de datos" abajo)
    utils/
      currency.ts          formatCurrency — única función de formato de moneda
      date.ts               formatDateGT/formatTimeGT/formatStayRange/calculateNights — únicas de fecha
  services/                Cliente HTTP y servicios transversales (capa de datos, ver "Servicios" abajo)
  assets/                  Imágenes, fuentes e iconos propios
  styles/
    tokens.css             Única fuente de tokens de diseño (color, tipografía, espaciado, radios)
  index.css                Hoja de estilos global heredada del prototipo Bolt (ver nota al final)
  app/router.tsx           Configuración explícita de React Router
  app/routes.ts             Catálogo tipado y constantes de rutas
```

## Contrato visual Bolt

El prototipo Bolt es la fuente visual del producto. Las pantallas nuevas pueden
vivir en `modules/<modulo>/screens/`, pero su CSS debe reutilizar el lenguaje
existente en `src/index.css` y `src/styles/tokens.css`: layouts, paneles,
formularios, tablas, cards, botones, estados, tipografia y colores deben partir
de las clases/tokens heredados (`visitor-*`, `reservation-*`, `rc-*`, `adm-*`,
`.panel`, `.button`, `.content`, etc.) antes de crear una familia nueva de
clases.

La estructura de carpetas de Ronda 1 esta aceptada; lo que no se acepta es que
una pantalla mergeada parezca otra app. Si un modulo necesita clases propias,
deben ser wrappers pequenos alrededor del diseno Bolt, no un sistema visual
paralelo. La excepcion funcional definida por producto es el login: Bolt lo
separaba en huesped/empleado, pero la app usa un login general y decide el
tipo de usuario segun credenciales y permisos de sesion.

`src/private/workspace/` y los modulos de dominio (`front-desk`, `administration`, `guest-portal`, `room-service`) contiene la migracion privada del prototipo Bolt
para recuperar las experiencias completas de Recepcion, Administracion,
Limpieza, Room Service, Conserjeria y huesped sin reemplazar el login actual.
El workspace se monta desde rutas privadas protegidas por `RequireSession` y
recibe el rol desde la sesion o desde una ruta dedicada. No reintroduce el rol
de Pasarela de pago: los pagos viven en Caja/Reservas.

Perfil, Preferencias y Cerrar sesion pertenecen al menu superior del usuario,
no al menu lateral. En listados administrativos, la accion de editar debe
quedar como lapiz y activar/desactivar debe representarse como switch.
El nombre visible, saludo y preferencias de vista inicial deben salir de la
sesion y del menu disponible para el rol actual, no de nombres fijos heredados
del prototipo Bolt.
Nota 2026-09-27 (#89): la navegacion persistente pertenece al shell. En
escritorio, `PrivatePage` y el workspace Bolt mantienen sidebar y header
visibles mientras `.main-area` concentra el scroll; el sidebar reserva su
cabecera y ayuda al fondo, con scroll interno solo en `.side-nav`. En la web
publica, `PublicLayout` mantiene `.visitor-header` sticky y aplica un estado
visual discreto al comenzar el scroll.
Los controles visibles del backoffice deben ejecutar una accion real o no
renderizarse. En administracion, los tabs y filtros de reportes/dashboard
deben cambiar metricas, grafica o filas visibles; no deben ser decorativos.
Los botones de resumen como Ver todo o Gestionar deben navegar a la vista
operativa correspondiente. La campana de notificaciones debe mostrar alertas
accionables del rol actual; en Administracion incluye alertas de stock bajo
para que no dependan solo del dashboard.

Nota 2026-09-30 (#95): en Administracion, las secciones grandes se navegan
desde submenus desplegables del sidebar, no desde tabs internas. Usuarios y
roles, Habitaciones, Tarifas, Servicios, Reportes e Inventario conservan sus
servicios, formularios, modales y persistencia; el sidebar decide la pantalla
activa. Reportes agrupa solo vistas con datos disponibles en Resumen operativo
y Reportes financieros; las vistas comerciales sin contrato backend no se
muestran en el sidebar.
El panel Roles y permisos representa permisos como accesos agrupados a las
vistas reales de Administracion, Recepcion, Limpieza, Room Service,
Conserjeria y Huesped; no debe volver a mostrar solo permisos genericos si se
esta configurando acceso a dashboards por rol. Esa misma matriz determina el
sidebar del workspace: admin ve todos los grupos y submenus; los demas roles
ven solo el grupo/vistas que tienen marcados. En las tarjetas del panel se
renderizan solo permisos seleccionados; el modal de edicion muestra todos los
permisos disponibles para poder habilitarlos, con acciones por grupo para
seleccionar o deseleccionar sus permisos y toggles individuales para ajustes
puntuales. Desde INT-13, los cambios hechos en el editor se persisten en el
backend de roles/permisos y el workspace solo refleja en memoria la
actualizacion de la sesion actual.
Cuando un rol operativo tiene permisos de un solo modulo, el sidebar conserva
la lista plana original; si recibe permisos cruzados de dos o mas modulos,
agrupa automaticamente por modulo para evitar opciones duplicadas sin contexto.

## Reglas de capas

Nota 2026-09-17: en la home publica, `PublicLayout` abre login y registro como
modal flotante con `PublicAuthModal`; las rutas `/auth/login` y
`/auth/register` se conservan como fallback para acceso directo. La reserva
publica ya no solicita un `guest_id` manual: `BookingFormScreen` captura datos
basicos del huesped, confirma la seleccion en pantalla, pasa por un pago demo y
recien al final llama a `guestService.createGuest` para usar el ID generado en
`bookingService.createBooking`. El pago publico presenta opciones frecuentes de
hotel (tarjeta, transferencia, pago en hotel y billetera digital), pero no
procesa cobros reales en esta fase.

Nota 2026-10-05 (#127): lo anterior sobre `guestService`/`bookingService` ya no
aplica. Todo el motor publico (`modules/booking-engine/`) pasa solo por
`publicBookingCatalogService`, que usa los contratos publicos reales del backend
sin JWT de personal: `GET /public/room-types`, `GET /public/rates`,
`GET /public/availability` y `POST /public/bookings`. La tarifa, el total y la
disponibilidad de una estadia siempre salen de `/public/availability`; ninguna
pantalla los calcula. La reserva se crea `pending` y la confirmacion muestra la
respuesta del POST. Ver `docs/DECISIONES.md`, D-016.

Nota 2026-09-26 (#76): en pantallas orientadas a personas, el nombre completo
del huesped es la etiqueta primaria cuando puede resolverse por `guestService`;
`GST-*` se mantiene solo como referencia secundaria.

Nota 2026-10-07 (#146): las fotos de tipos de habitación, productos y
amenidades salen del backend (#82), nunca de URLs fijas en el código. Llegan
como `images` en sus modelos (`shared/types/entities/media-image/`); se suben
con `services/mediaService.ts` y se asocian al guardar el registro. Para
mostrarlas se usa `shared/components/CatalogImage.tsx`, que pinta un
placeholder neutral si el registro no tiene foto (nunca la foto de otro), y
para editarlas `shared/components/ImageGalleryField.tsx`.

- Una vista sin sesión se crea en `public/pages/`.
- Una vista autenticada se crea en `private/pages/`; su lógica de negocio se
  consume desde el módulo correspondiente.
- Todo lo específico de un dominio se coloca en `modules/<modulo>/`.
- Solo código reutilizable por dos o más áreas debe estar en `shared/`.
- Auth vive en `modules/auth/`; su proveedor envuelve el router desde `main.tsx`.
  El login está en `public/pages/StaffLoginPage.tsx`. Las guardas y el catálogo
  de navegación por permiso se mantienen en `private/guards/` y `private/routes/`.
  La fachada de auth consume `services/authService.ts`. Consultar
  `modules/auth/README.md` para el contrato y la política de permisos.
  `/auth/register` reutiliza `StaffLoginPage` en modo registro publico de
  huesped demo; no otorga permisos del PMS ni reemplaza el login de personal.
- El catálogo de UI está en `public/pages/ComponentsCatalogPage.tsx` (ruta
  `/components`); sus ejemplos asíncronos viven en `modules/ui-catalog/`. Los
  primitivos están en `shared/components/` y consumen tokens desde
  `styles/tokens.css`.
- `TableFrame` en `shared/components/DataTable.tsx` es el único renderizador
  de tablas del árbol.

## Contrato de datos: DTO → Mapper → Model

**Este contrato es compartido con la app móvil (`pms-hotel-mobile`): la web
es la fuente de verdad, móvil lo consume y no lo redefine.** El documento de
referencia — pensado para leerse sin abrir este código — es
[`docs/CONTRATO-DATOS.md`](../docs/CONTRATO-DATOS.md): ahí están las
veinticuatro entidades del barrel con su DTO/Model/ejemplo JSON, las máquinas
de estado, qué debe replicar móvil (MOV-04) y las decisiones de equipo
pendientes (formato de SKU — [D-004](../docs/DECISIONES.md), catálogo de
categorías — [D-005](../docs/DECISIONES.md), tipo de ID, la máquina de
estado de `room` vs. el flujo de limpieza que móvil necesita). Cualquier
cambio a una entidad compartida se anuncia a ambos equipos antes de tocar
código — ver la sección 7 de ese documento.

Nueve de esas entidades llegaron con los Lotes C (WEB-11: `guest-account`,
`deposit`, `cash-session`, `cash-movement`) y D (WEB-12: `role`,
`permission`, `inventory-item`, `inventory-movement`, `audit-log`) — ver
`PROGRESO-MOCKS.md`. `role.code` corresponde por valor (no por FK) con
`user.role`, ver [D-003](../docs/DECISIONES.md), ya aceptada.

Cada entidad vive en `shared/types/entities/<entidad>/`, con cuatro
archivos: `<entidad>.dto.ts` (forma cruda, snake_case, tal como la devolvería
una API real), `<entidad>.model.ts` (forma de dominio, camelCase, la que
consume la UI), `<entidad>.mapper.ts` (`toDomain`/`toDTO`, el único punto que
conoce ambas formas) e `index.ts` (reexporta los tres). Es **una sola
definición por entidad** — hasta el cierre de la Fase 0 convivían un archivo
plano (`entities/<x>.ts`, camelCase, sin distinción real DTO/Model) y esta
carpeta oficial; el plano se eliminó. `order` y `service-request` (Room
Service y limpieza/conserjería, las entidades que móvil opera y la web
cobra) siguen el mismo patrón.

`room-type` referencia `room_feature` (características de habitación, sin
horario), nunca `amenity` (servicios del hotel, con horario): son entidades
distintas a propósito — ver [`docs/DECISIONES.md`, D-001](../docs/DECISIONES.md).

Los literales de estado y sus transiciones válidas (`room`, `booking`,
`order`, `service_request`) viven en `shared/constants/statuses.ts`, para
que móvil use exactamente los mismos nombres.

**El estado de `room` son dos campos con dueños distintos, no uno:**
`status` (ocupación, la controla la web) y `housekeepingStatus` (limpieza,
la controla la app móvil). La asignabilidad se consulta con
`isRoomAssignable()`, nunca reimplementada en una pantalla — ver
[`docs/DECISIONES.md`, D-002](../docs/DECISIONES.md). Cualquier cambio a
esto pasa por una entrada nueva en ese documento.

Actualizacion 2026-09-22 (#73): dentro de la web, el workspace de Limpieza
tambien puede escribir `housekeepingStatus` a traves de `roomService` para
persistir iniciar/finalizar/cambiar estado. Desde INT-02 esa escritura viaja al
backend de habitaciones; Recepcion, Ocupacion y Administracion siguen leyendo
ese campo como estado operativo compartido.

`shared/types/entities/index.ts` es un barrel de **tipos únicamente**:
`toDomain`/`toDTO` no se reexportan ahí porque las veinticuatro entidades
usan exactamente esos dos nombres y colisionarían. Importar un mapper
siempre desde la ruta específica de su entidad:

```ts
import { toDomain as toBooking } from '@/shared/types/entities/booking';
```

**`shared/types/entities/session/` es un caso aparte, y no se reexporta desde
el barrel.** Modela la respuesta de login/sesión (`SessionUserDTO`,
`BackendAuthResponseDTO`, `AuthResponseDTO`, `AuthSession`, `LoginDTO`) con el
rol de acceso al PMS
(`UserRole` de `common.ts`: ADMIN/GUEST/RECEPTION/HOUSEKEEPING/CONCIERGE/ROOM_SERVICE). Es un concepto
distinto de `shared/types/entities/user/`, que modela el puesto de un
empleado en el directorio de personal
(admin/guest/reception/housekeeping/concierge/roomService, alineado con la app
móvil). Comparten nombre por casualidad, no por ser la misma entidad; no
fusionarlos. Ver `modules/auth/README.md`.

## Moneda y fecha

- **Moneda:** quetzal guatemalteco. `Currency` (`shared/types/common.ts`) es
  el literal `'GTQ'`, no una unión de monedas. Todo campo de dinero en un DTO
  termina en `_cents` (`total_amount_cents`, `price_cents`, `amount_cents`) y
  es un entero — nunca un decimal. `formatCurrency` (`shared/utils/currency.ts`)
  es la única función de formato; ninguna pantalla escribe `Q` a mano.
- **Fecha:** `formatDateGT` da `dd-mm-aaaa`, `formatTimeGT` da `HH:mm` en 24
  horas (`shared/utils/date.ts`). Un DTO distingue fecha civil (`"YYYY-MM-DD"`,
  sin hora ni zona: check-in, check-out, vigencias) de timestamp (ISO 8601
  completo: `created_at`, `updated_at`). Ninguna pantalla formatea fechas por
  su cuenta.

## Limites Guatemala: pagos locales y FEL/SAT

Nota 2026-10-04 (#129): Guatemala usa `GTQ` como moneda operativa del PMS, pero
eso no autoriza al frontend a implementar pasarelas locales ni facturacion
electronica FEL. Los pagos del folio siguen pasando por `guestAccountService` y
`paymentService`; los metodos son abstractos (`cash`, `credit_card`,
`debit_card`, `bank_transfer`, `online`) y cualquier proveedor local debe
integrarse primero en backend. El frontend no captura datos sensibles de tarjeta,
no tokeniza, no confirma webhooks y no decide conciliacion contable.
Stripe no se asume proveedor productivo para Guatemala ni opcion de liquidacion
directa local desde frontend; proveedores como VisaNet, NeoNet o QPayPro deben
evaluarse por producto/backend antes de aparecer como integracion real.

FEL/SAT queda fuera del frontend hasta que exista contrato backend: React no
construye XML DTE, no firma, no certifica, no calcula frases/impuestos fiscales
definitivos, no anula documentos y no se conecta directo al SAT o a un
certificador. El recibo/PDF actual es comprobante operativo del PMS, no factura
FEL ni DTE certificado. Certificadores como Infile, GFACE o Megaprint deben
seleccionarse por contrato backend antes de reflejarse en UI. Ver
[`docs/guatemala-pagos-fel-frontend.md`](../docs/guatemala-pagos-fel-frontend.md).

## Servicios y regla de oro

Nota 2026-10-05 (#135): `src/data/db.ts` fue eliminado. La migracion privada
Bolt (`src/private/workspace/PrivateWorkspace.tsx`,
`src/modules/guest-portal/components/GuestContent.tsx` y
`src/modules/administration/components/AdminContent.tsx`) debe consumir datos
de dominio mediante servicios HTTP reales. No agregar nuevas bases locales ni
fallbacks mock productivos.

Nota 2026-09-22 (#72): el portal de huesped conserva la UI Bolt pero sus
operaciones soportadas escriben mediante servicios (`orderService`,
`serviceRequestService`, `guestService`, `bookingService` y
`notificationService`). La pantalla resuelve sesion -> huesped -> reserva activa
-> habitacion y no debe volver a introducir datos fijos de prototipo.

Nota 2026-09-27: el boton de recibo del portal de huesped descarga un PDF
generado en navegador con `Blob` y enlace `download`; no debe volver a depender
de `window.print()` ni prometer descarga si solo abre el dialogo de impresion.

Ningún componente, pantalla ni servicio importa `src/data/db.ts`: el archivo
no existe desde INT-FINAL (#135). Cada servicio productivo es `async`, devuelve
Models (nunca DTOs), usa `http-client.ts` para hablar con backend y no debe
ocultar errores reales con fallbacks locales automaticos. Las pruebas que
necesitan datos de contrato usan fixtures bajo `scripts/fixtures/`, fuera del
bundle productivo; ver [`docs/int-final-db-mocks.md`](../docs/int-final-db-mocks.md).
`authService.ts` conecta al backend Spring desde INT-01: login, Bearer JWT,
refresh con retry unico y logout contra `/auth/*`. Desde INT-02, `roomService`
tambien usa backend para habitaciones, tipos, caracteristicas y tarifas
(`/rooms`, `/room-types`, `/room-features`, `/rates`).
Única excepción documentada a "un solo
archivo con datos inventados": el fixture de demo de
`src/modules/ui-catalog/services/catalog-service.ts`, que no representa
ninguna entidad del contrato y existe solo para renderizar `/components`.

Nota INT-13: `personnelService` toma usuarios, roles y permisos desde el
backend real (`/admin/users`, `/admin/roles`, `/admin/permissions`) y persiste
ediciones de roles con `/admin/roles/{id}` y `/admin/roles/{id}/permissions`.

Nota 2026-10-04 (#101 / INT-03): `guestService` y `bookingService` usan el
backend para CRUD de huespedes y reservas (`/guests`, `/bookings`). Desde el
corte final INT-13, esos servicios no aceptan IDs legacy (`GST-*`, `BKG-*`,
`RT-*`) para simular exito local: si el recurso no es UUID de backend, lanzan
un error controlado. El backend devuelve camelCase; los servicios lo
normalizan al DTO snake_case interno y despues devuelven Models. INT-04 integra
las acciones operativas para reservas UUID: asignacion de habitacion via
`PUT /bookings/{id}`, check-in via `POST /bookings/{id}/check-in`, check-out via
`POST /bookings/{id}/check-out` y acompanantes via
`/bookings/{id}/companions`.
`PrivateWorkspace` solo carga reservas y huespedes para `admin`/`reception`,
que son los roles con permisos `bookings.read`/`guests.read` en este dominio.

Nota 2026-09-21 (#69): la regla reusable de capacidad vive en
`shared/utils/bookingCapacity.ts` y exige
`adults + children <= roomType.capacity`; los formularios publicos y de
ocupacion la reutilizan para mostrar el limite al cambiar habitacion, adultos o
menores cuando trabajan con catalogos locales de prueba. En flujo productivo,
el backend valida la reserva.
Cuando `roomTypeId` es UUID, INT-03 delega esa validacion al backend porque el
dataset local `RT-*` no es autoridad sobre catalogos integrados.

Nota 2026-09-21 (#70): `booking-companion` registra acompañantes por
`booking_id` durante check-in. `bookingCompanionService` valida campos,
capacidad y composición (`principal + acompañantes` contra
`booking.adults/children`), `guestService.updateGuest` conserva cambios de
documento del titular y `bookingService.checkIn` marca la habitación asignada
como `occupied`.

Nota 2026-10-04 (#102 / INT-04): para reservas UUID,
`bookingCompanionService` usa las rutas reales de `BookingCompanionController`:
`GET`/`POST /bookings/{bookingId}/companions` y
`PUT`/`DELETE /bookings/{bookingId}/companions/{companionId}`. Las validaciones
de estado, habitacion y composicion quedan en backend; la sincronizacion corre
en orden `DELETE` -> `PUT` -> `POST` para no depender del orden de red. En
reservas legacy `BKG-*` conserva las validaciones locales de campos, capacidad y
composicion para sostener el prototipo. **Obsoleto por #131:** el frontend ya
no ejecuta ese camino productivo; las pruebas legacy quedaron marcadas como
historia del corte. `CheckInScreen` y `CheckOutScreen`
refrescan reserva, folio y habitaciones despues de check-in/check-out para
reflejar el estado real devuelto por la API.

Nota 2026-10-03 (#103): en folios financieros integrados, un `bookingId` UUID
nunca debe caer al recalculo local mock. `guestAccountService` consulta el
saldo oficial desde `GET /bookings/{bookingId}/folio`; las utilidades legacy
de apertura/cierre/calculo local ahora rechazan cualquier uso productivo y
`voidCharge` exige `bookingId`. Las pantallas de folio deben
refrescar ese endpoint despues de una mutacion financiera y no modificar
`balanceCents` manualmente.

## Pruebas

`npm run test` corre doce suites (`scripts/*.mjs`), todas con el mismo
patrón: esbuild empaqueta el módulo a probar a CommonJS y se ejecuta con
`node --test` — sin ningún framework de pruebas externo.

| Suite                            | Qué cubre                                                                                                                                    |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `test-auth.mjs`                  | Sesión, roles, guardas de ruta, 404 por área (14 pruebas)                                                                                    |
| `test-currency.mjs`              | `formatCurrency` (11 pruebas)                                                                                                                |
| `test-date.mjs`                  | `formatDateGT`/`formatTimeGT`/`calculateNights`/mappers de fecha civil (44 pruebas)                                                          |
| `test-money-contract.mjs`        | Fixtures de contrato: montos enteros, `currency: 'GTQ'`, sufijo `_cents`                                                                     |
| `test-contract.mjs`              | Una sola definición por entidad, incluidas las nueve de los Lotes C/D (30 pruebas)                                                           |
| `test-shared-contract.mjs`       | Fechas ISO, `_cents`, estados dentro de `statuses.ts`, `guest_link_code` único, mappers sin pérdida (35 pruebas)                             |
| `test-referential-integrity.mjs` | Ninguna referencia queda colgada entre fixtures de contrato (bookings, guests, users, cuentas, caja, inventario)                             |
| `test-room-status.mjs`           | Separación `status`/`housekeepingStatus` de `room`, `isRoomAssignable()` (9 pruebas)                                                         |
| `test-lot-c-d.mjs`               | Aritmética de cuentas/caja/inventario y horario de amenidades sobre fixtures de contrato                                                     |
| `test-services.mjs`              | Servicios async con latencia, Models, forzado de error, regla de oro, metodos WEB-14, capacidad, check-in y check-out con folio (20 pruebas) |
| `test-presentation.mjs`          | Primitivos de `shared/components/` y el catálogo `/components` (6 pruebas)                                                                   |
| `test-router.mjs`                | Duplicados y resolucion de rutas principales (4 pruebas)                                                                                     |

Total: 259 pruebas. `npm run check` encadena
`format:check && typecheck && lint && build && test`.

## `index.css`: pendiente de separar

`src/index.css` (heredado del prototipo Bolt) mezcla en un solo archivo
estilos base que la app real usa hoy (`.button`, `.content`, `.eyebrow`,
`.public-page-shell`, `body`) con estilos que solo aplicaban a las pantallas
de Bolt ya eliminadas (`src/app/App.tsx` y `src/components/`, retirados en el
cierre de la Fase 0). No se separó en ese cierre porque varias de esas reglas
en uso real dependen de variables `--*-legacy-*` de `tokens.css`, y no hay
forma mecánica de distinguir qué alias son solo del árbol muerto sin trazar
selector por selector — es trabajo de análisis, no una poda. Pendiente como
ticket aparte.
