# Sentry en el frontend web

Fase 5 del plan de observabilidad. Sentry recibe los errores de JavaScript del
sitio público y del PMS, con el archivo y la línea originales gracias a los
source maps. **Todo es opcional:** sin las variables, la app y la imagen se
construyen igual y no cargan nada de Sentry.

## Qué hace

| Pieza | Dónde | Comportamiento |
| --- | --- | --- |
| SDK `@sentry/react` | `src/main.tsx`, `src/app/observability/sentry.ts` | Se carga con `import()` solo si el build tiene `VITE_SENTRY_DSN`. Sin DSN, Vite elimina el `import()` y el bundle no contiene código de Sentry. |
| Error boundary | `SentryErrorBoundary` (con DSN) / `AppErrorBoundary` (sin DSN) | Envuelve toda la app y muestra `AppErrorFallback`: pantalla en español sin mensaje ni pila del error. |
| Errores de rutas | `RouteErrorBoundary`, `errorElement` de las dos rutas raíz de `src/app/router.tsx` | React Router atrapa los errores de render de sus rutas antes que cualquier boundary externo; aquí se reportan a Sentry y se muestra la misma pantalla. Sin esto, React Router mostraba su pantalla por defecto con el mensaje del error. |
| Limpieza | `src/app/observability/scrub.ts` (`beforeSend`, `beforeBreadcrumb`) | Ver abajo. Probado en `npm run test:sentry-scrub`. |
| Source maps | `vite.config.ts` + `@sentry/vite-plugin` | Solo si existen `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` y `SENTRY_PROJECT`: el build genera los `.map` (`hidden`), los sube y los borra. Si Sentry no responde, el build sigue con un aviso. |
| Imagen Docker | `Dockerfile` | Borra cualquier `.map` de `dist` y falla si queda alguno. El token entra como secret de BuildKit, no como `ARG`. |
| Nginx | `docker/nginx.conf` | `*.map` responde 404 aunque llegara a existir uno. |
| CI | `.github/workflows/ci-cd.yml` | En cada PR, job *Imagen Docker sin source maps*; en `main`, el build de la imagen pasa los secrets y comprueba lo mismo antes del push. Script: `docker/check-no-sourcemaps.sh`. |

### Privacidad

- **Sin datos personales del SDK.** El SDK 11 reemplazó `sendDefaultPii` por
  `dataCollection`; se configura lo equivalente a `sendDefaultPii: false`, más
  estricto: sin usuario (`userInfo: false`, que además le pide a Sentry **no
  inferir la IP**), sin cookies, sin cuerpos, solo la cabecera `User-Agent`
  (para saber navegador y sistema) y sin variables locales.
- **`beforeSend` / `beforeBreadcrumb`** quitan, en todo el evento (mensaje,
  excepciones, breadcrumbs, request, extras, contextos y tags):
  - cabeceras `Authorization` y `Cookie`, cookies y cuerpo de la petición;
  - JWT (`eyJ…`), `Bearer …`, correos y códigos de vinculación de reserva
    (`GL-XXXXXXXX`) en cualquier texto;
  - parámetros de query con nombre sensible (`token`, `code`, `password`,
    `email`, `session`, `key`…), y claves de objetos como `accessToken`,
    `refreshToken`, `password`, `code` o `linkCode`;
  - el usuario del evento.
- **Sin Session Replay**: graba la pantalla del usuario (formularios con datos
  de huéspedes y del personal).
- **`tracesSampleRate: 0`, sin trazas de rendimiento.** La latencia de la API
  ya se mide en Prometheus/Grafana (fases 1–3). Las trazas del navegador
  enviarían la URL de cada navegación y petición, agregarían cabeceras
  `sentry-trace`/`baggage` a las llamadas a la API y gastarían la cuota del plan
  gratuito. Si algún día se activan, empezar con `0.1` y
  `browserTracingIntegration`.

## Crear el proyecto en Sentry

1. Crear la cuenta/organización en [sentry.io](https://sentry.io) (plan
   *Developer*, gratuito: 5 000 errores al mes).
2. **Projects → Create Project → React**. Nombre sugerido: `pms-web`. Saltar el
   asistente de instalación (el código ya está).
3. Copiar el **DSN**: *Project Settings → Client Keys (DSN)*. Es público por
   diseño (va dentro del JavaScript), pero solo sirve para enviar eventos.
4. En el proyecto:
   - *Settings → Security & Privacy*: activar **Prevent Storing of IP
     Addresses** y dejar activos *Data Scrubber* y *Use Default Scrubbers*
     (segunda barrera, del lado de Sentry).
   - *Client Keys → Configure*: limitar la tasa (por ejemplo 100 eventos por
     minuto), para que el pentest o un bucle de errores no agoten la cuota.
   - *Settings → General → Allowed Domains*: el dominio de producción, para
     que no se acepten eventos enviados desde otros sitios con el DSN.
5. **Token para subir source maps**: *Settings (organización) → Developer
   Settings → Organization Tokens → Create New Token*, nombre `github-actions`.
   Se muestra una sola vez.
6. Anotar el **slug** de la organización (en la URL:
   `sentry.io/organizations/<slug>/`) y el del proyecto (`pms-web`).

## Secrets en GitHub

*Repositorio → Settings → Secrets and variables → Actions → New repository
secret*:

| Secret | Valor | Para qué |
| --- | --- | --- |
| `SENTRY_DSN` | DSN del paso 3 | Activa el SDK en la imagen (`VITE_SENTRY_DSN`). |
| `SENTRY_ORG` | slug de la organización | Subida de source maps. |
| `SENTRY_PROJECT` | slug del proyecto | Subida de source maps. |
| `SENTRY_AUTH_TOKEN` | token del paso 5 | Subida de source maps (secret de BuildKit). |

Se pueden cargar por separado: con solo `SENTRY_DSN` llegan los errores, pero
minificados; con los tres de subida y sin DSN se suben los mapas y no se envía
nada. El `release` es el SHA del commit (`github.sha`) y el `environment`,
`production`.

## Cómo verificar (después del merge a `main`)

1. En el run de *CI/CD*, job **Imagen Docker en GHCR**:
   - el build no muestra `[sentry] no se subieron los source maps`;
   - el paso *La imagen no contiene source maps* lista la carpeta de Nginx y
     termina con `Sin archivos .map en la imagen.`
2. En Sentry, *Releases*: aparece el SHA del commit con sus archivos
   (*Source Maps → Artifact Bundles*).
3. En producción:
   - `curl -sI https://<dominio>/assets/<archivo>.js.map` → `404`;
   - en DevTools → *Network*, ninguna petición a `ingest.sentry.io` mientras no
     haya errores (sin trazas ni replay).
4. Llegada de eventos: en la consola del navegador del sitio de producción,
   `setTimeout(() => { throw new Error('Prueba Sentry') })`. En Sentry →
   *Issues* aparece con `environment: production` y el release del commit (la
   pila apunta a la consola, no a `src/`: el error no salió del código de la
   app). En el evento, *Request* no tiene `Authorization` ni `Cookie`, y *User*
   está vacío (sin IP).

### Error de prueba con source maps (rama local, sin commitear)

Para ver un error de la app con el archivo y la línea originales:

1. `git switch -c prueba/sentry-local` y agregar un botón que lance un error,
   por ejemplo en `src/public/pages/PublicNotFoundPage.tsx`:
   ```tsx
   const [boom, setBoom] = useState(false);
   if (boom) throw new Error('Prueba de Sentry desde PublicNotFoundPage');
   // …
   <button type="button" onClick={() => setBoom(true)}>Lanzar error</button>
   ```
2. Build y vista previa con los cuatro datos (PowerShell: `$env:VAR="…"`):
   ```bash
   VITE_SENTRY_DSN=<dsn> VITE_SENTRY_ENVIRONMENT=verificacion VITE_SENTRY_RELEASE=prueba-local \
   SENTRY_ORG=<org> SENTRY_PROJECT=<proyecto> SENTRY_AUTH_TOKEN=<token> \
   npm run build && npx vite preview
   ```
   Si se configuró *Allowed Domains*, agregar temporalmente `localhost:4173`.
3. Abrir `http://localhost:4173/no-existe`, pulsar el botón: se ve la pantalla
   *Algo salió mal* y en Sentry aparece el issue con la pila en
   `src/public/pages/PublicNotFoundPage.tsx` y la línea del `throw`.
4. `git switch -` y `git branch -D prueba/sentry-local`. Borrar el release
   `prueba-local` en Sentry si se quiere.

## Desarrollo local

Sin `VITE_SENTRY_DSN` en `.env`, Sentry no se carga (lo normal). Para probarlo,
poner el DSN en `.env`: los eventos llegan con `environment: development`.
No poner `SENTRY_AUTH_TOKEN` en `.env` salvo para probar la subida.

## Pendiente: CSP

Cuando se agregue la `Content-Security-Policy` en `docker/nginx.conf`, permitir
el dominio de ingesta de Sentry en `connect-src`. Es el host del DSN, por
ejemplo `connect-src 'self' https://o123456.ingest.us.sentry.io;` (o
`https://*.ingest.sentry.io https://*.ingest.us.sentry.io`). Sin eso, el
navegador bloquea el envío de los errores en silencio. El SDK no usa `eval` ni
scripts externos: no hace falta tocar `script-src`.
