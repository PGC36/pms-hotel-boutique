# Autenticacion del personal - INT-01

## Contrato

El flujo es `StaffLoginPage` -> `AuthProvider` -> fachada de
`modules/auth/services` -> `services/authService.ts` -> backend Spring.

`services/authService.ts` conserva la API que consume la UI (`login`,
`restore`, `logout`, `getCurrentSession`, `getCurrentUser`) pero ya no valida
credenciales contra `sessionAccountsDB`. El backend esperado expone:

- `POST /auth/login` con `{ email, password }`.
- `POST /auth/refresh` con `{ refreshToken }`.
- `POST /auth/logout` con `{ refreshToken }` y respuesta `204`.

`VITE_API_BASE_URL` debe apuntar al prefijo del backend, por defecto
`http://localhost:8080/api/v1`.

## Sesion y permisos

El backend devuelve `accessToken`, `refreshToken`, `tokenType` y `expiresIn`.
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

La persistencia local usa `PMS_AUTH_SESSION`. Guarda tokens y metadatos de
sesion, nunca password ni permisos frontend materializados.

`http-client.ts` agrega `Authorization: Bearer <accessToken>` automaticamente.
Al restaurar una sesion persistida, `authService` valida el `exp` del JWT y
refresca antes de entregar la sesion si el access token ya vencio o vence en la
ventana preventiva. Esto mantiene separadas las 8 horas de sesion frontend
(`expiresAt`) de la expiracion real del JWT (`accessExpiresAt`).
Si una peticion protegida responde `401`, intenta `POST /auth/refresh` una sola
vez, actualiza access/refresh token y reintenta la peticion original una sola
vez. Si refresh falla, limpia la sesion local y el usuario debe iniciar sesion
de nuevo.

`logout` intenta revocar el refresh token con `POST /auth/logout`, pero siempre
limpia la sesion local aunque el backend falle. La clave legacy
`hotel-aurora.auth.v1` se elimina durante restauracion o limpieza.

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
- refresh preventivo al restaurar JWT vencido;
- refresh + retry unico;
- refresh fallido con limpieza local;
- logout con envio de refresh token;
- restauracion de sesion;
- guards por rol y permisos.
