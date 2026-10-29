# Autenticacion del personal - INT-01

## Contrato

El flujo es `StaffLoginPage` -> `AuthProvider` -> fachada de
`modules/auth/services` -> `services/authService.ts` -> backend Spring.

`services/authService.ts` conserva la API que consume la UI (`login`,
`restore`, `logout`, `getCurrentSession`, `getCurrentUser`) pero ya no valida
credenciales contra `sessionAccountsDB`. El backend esperado expone:

- `POST /auth/login` con `{ email, password }`.
- `POST /auth/refresh` sin cuerpo: el refresh token llega en la cookie httpOnly.
- `POST /auth/logout` sin cuerpo y respuesta `204` (revoca y borra la cookie).

Las tres llamadas mandan `X-Client: web` y usan `credentials: 'include'` (valor
por defecto del `http-client`). Con ese header el backend omite `refreshToken`
del JSON; la app móvil no lo manda y sigue recibiéndolo en el cuerpo.

`VITE_API_BASE_URL` debe apuntar al prefijo del backend, por defecto
`http://localhost:8080/api/v1` en desarrollo y `/api/v1` en un build de
producción. Puede ser relativa (`/api/v1`, como en la imagen Docker): el
`http-client` la resuelve contra el origen de la página.

## Sesion y permisos

El backend devuelve `accessToken`, `tokenType` y `expiresIn` (sin `refreshToken`
para la web, ver arriba).
El frontend normaliza esa respuesta al contrato `AuthSession`: decodifica el
JWT para leer `sub`, `ROLE_*`, `authorities`, `iat` y `exp`.

La fachada del modulo agrega permisos de navegacion (`Permission`) a partir del
rol y de las authorities reales. `RequireSession` y `RequirePermission` siguen
usando la sesion del provider, sin consultar fixtures mock.

Los roles de sesion vigentes siguen siendo:

- `ADMIN`
- `GUEST`
- `RECEPTION`
- `HOUSEKEEPING`
- `CONCIERGE`
- `ROOM_SERVICE`

La matriz de navegacion vive en `models/session.ts`. Si el backend cambia
literales de roles o authorities, actualizar mapper, guards, tests y docs en el
mismo PR.

## Persistencia, refresh y logout

Desde la cookie httpOnly (backend: `docs/adr/0002-auth-cookie-httponly.md`):

- **Refresh token** del personal: solo en la cookie `pms_refresh_token`
  (`HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`). JavaScript no la
  puede leer, así que un XSS no puede robarlo.
- **Access token** del personal: solo en memoria (`authService`), nunca en
  `localStorage`/`sessionStorage`. Se pierde al recargar.
- `PMS_AUTH_SESSION` guarda para el personal solo `{ kind: 'staff', expiresAt }`:
  indica que hay sesión, fija el tope de 8 horas y avisa a las otras pestañas
  (evento `storage`) de un login o logout. Nunca guarda tokens, password ni
  permisos materializados.
- Una sesión de personal del formato anterior (con tokens en `localStorage`) se
  descarta al restaurar: hay que iniciar sesión una vez tras el despliegue.

Al recargar, `restore` ve la marca y llama `POST /auth/refresh`; el navegador
adjunta la cookie, el backend la rota y devuelve un access token nuevo. En la
misma pestaña, si el token en memoria no está por vencer, se reutiliza sin
refrescar. Si una petición protegida responde `401`, se intenta un refresh una
sola vez y se reintenta la petición original una sola vez. Si refresh falla, se
limpia la sesión local y el usuario debe iniciar sesión de nuevo.

`logout` llama `POST /auth/logout` (el backend revoca el token de la cookie y la
borra con `Max-Age=0`) y siempre limpia la sesión local aunque el backend falle.
La clave legacy `hotel-aurora.auth.v1` se elimina durante restauración o limpieza.

Limitación conocida: el huésped no tiene refresh token (el backend solo le
emite un access token), así que su sesión sigue guardando el JWT de huésped en
`PMS_AUTH_SESSION` para sobrevivir a una recarga. Dos pestañas que refresquen
exactamente a la vez pueden hacer que una reciba `401` (rotación) y pida login.

La salida voluntaria desde cualquier workspace privado navega a la home publica
(`/`) con reemplazo de historial, tanto para personal como para huespedes. Esta
regla no cambia el comportamiento de `RequireSession`: una sesion ausente o
vencida conserva la redireccion a `/auth/login` o `/auth/register`, incluyendo
la URL privada de destino cuando corresponde.

## CORS

El backend local revisado permite `http://localhost:3000` en `CorsConfig`.
Este frontend fija Vite en `http://localhost:3000` con `strictPort` para que el
origen de desarrollo coincida con ese contrato. Si el puerto 3000 esta ocupado,
liberarlo o ampliar CORS del backend antes de probar login real.

## Pruebas

`npm run test:auth` mockea `fetch` con el contrato Spring y cubre:

- login exitoso y credenciales invalidas;
- Bearer automatico;
- login sin tokens en el almacenamiento (cookie simulada + memoria);
- recuperación de sesión tras recargar con `POST /auth/refresh` por cookie;
- descarte de sesiones del formato anterior con tokens;
- refresh + retry unico;
- refresh fallido con limpieza local;
- logout sin cuerpo que revoca la cookie;
- restauracion de sesion;
- guards por rol y permisos.
