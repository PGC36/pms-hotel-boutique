# Aviso: roles finales de login y permisos

Fecha: 2026-09-12

Durante la revision de roles se detecto que las issues cerradas `#18`
(WEB-06, shell de autenticacion y guardas por rol) y `#24` (WEB-12, datos
mock de roles/permisos) dejaron una base tecnica funcional, pero no terminaron
de alinear los roles finales del producto.

Antes convivian roles de sesion genericos:

- `ADMIN`
- `RECEPTIONIST`
- `MANAGER`
- `STAFF`

Y roles operativos/catalogo separados:

- `admin`
- `manager`
- `front_desk`
- `housekeeping`
- `maintenance`
- `room_service`
- `concierge`

## Decision aplicada

Se actualizaron los roles de sesion/login a roles funcionales finales:

- `ADMIN`
- `GUEST`
- `RECEPTION`
- `HOUSEKEEPING`
- `CONCIERGE`
- `ROOM_SERVICE`

Tambien se alineo el catalogo operativo compartido (`user.role`/roles backend) a
los mismos roles, en formato de datos:

- `admin`
- `guest`
- `reception`
- `housekeeping`
- `concierge`
- `room_service`

El catalogo de permisos conserva sus llaves actuales porque representan acciones, no
roles. Para la pantalla administrativa de usuarios, `personnelService.getUsers`
usa `sessionAccountsDB` como fuente base: esos son los usuarios/roles que se
usan para login y para gestionar accesos visibles en el frontend beta.
`usersDB` queda como directorio operativo historico del Lote D, no como la
fuente visible principal de gestion de usuarios.

## Cuentas mock para pruebas (Personal)

Nota 2026-10-01 (#99 / INT-01): estas cuentas quedan como referencia historica
del frontend beta y para datos administrativos mock. No usar estas cuentas
`@hotelboutique.test` ni la contraseña compartida para iniciar sesión contra el
backend real. El login real valida contra las cuentas sembradas en PostgreSQL.

Para el seed local del backend (migration `021-simple-demo-users.sql`),
Recepción usa:

- Correo: `recepcion@aurora.test`
- Contraseña: `recepcion`

Verificado el 2026-10-06 contra `POST /api/v1/auth/login`: devuelve un JWT con
`ROLE_RECEPTION`. Estas son credenciales solo para desarrollo local; no deben
usarse en producción. Las credenciales del resto de roles dependen del seed
vigente y no deben inferirse desde la tabla histórica de cuentas mock.

## Credenciales reales de Huésped (AUTH-GUEST #134)

Para acceder al portal de huésped (`/auth/register`), el backend provee credenciales reales autenticadas contra `POST /api/v1/guest/auth/login`:

| Huésped       | Correo                   | Contraseña | Reserva       | Código de enlace (secundario) |
| ------------- | ------------------------ | ---------- | ------------- | ----------------------------- |
| Ana Morales   | `ana.demo@aurora.test`   | `huesped1` | `AUR-DEMO-001` | `HUESPED-DEMO-UNO`            |
| Carlos Reyes  | `carlos.demo@aurora.test`| `huesped2` | `AUR-DEMO-002` | `HUESPED-DEMO-DOS`            |

## Notas de alcance

- `GUEST` inicia sesión con correo y contraseña en `/auth/register` (Acceso de huésped) y consume los endpoints `/guest/...` del backend. El flujo con código de reserva queda disponible como método secundario de compatibilidad.
- `CONCIERGE` se conserva como literal interno; la UI puede mostrar
  "Conserjeria" para mantener el termino hotelero.
- No mezclar `HOUSEKEEPING` con `CONCIERGE`: limpieza y conserjeria son flujos
  operativos distintos.
- Cualquier cambio futuro a literales de roles debe actualizar permisos,
  navegacion, mocks, tests y documentacion en el mismo cambio.
