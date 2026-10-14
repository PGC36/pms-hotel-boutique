# PMS Hotel Boutique

Frontend del sistema de gestión hotelera (PMS) para Hotel Aurora. Incluye una
web pública para reservas y una web privada para la operación y administración.

> **El trabajo vive en `develop`, no en `main`.** `main` solo tiene el commit
> inicial del repositorio; clonar y trabajar siempre sobre `develop` (o una
> rama creada a partir de ella).

## Objetivo

Ofrecer rutas base para el motor de reservas público y el panel operativo
privado, dejando una estructura lista para que el equipo implemente módulos.

## Base técnica

- React 18, TypeScript y Vite.
- npm como gestor de paquetes.
- React Router para la navegación web.
- Tailwind CSS y sistema de diseno centralizado en `src/styles/tokens.css`.
- Iconos de `lucide-react`.
- Alias `@/` para importar desde `src/`.

## Requisitos

- Node.js 20 o superior.
- npm 10 o superior.

## Instalación

```bash
git clone <URL_DEL_REPOSITORIO>
cd pms-hotel-boutique
git checkout develop
npm install
copy .env.example .env
npm run dev
```

En macOS o Linux, usar `cp .env.example .env`.

El repositorio normaliza los finales de línea a LF vía `.gitattributes`; no
cambiar `core.autocrlf` a mano localmente, no hace falta y puede generar
diffs espurios.

## Variables de entorno

Crear `.env` a partir de `.env.example`. Nunca incluir credenciales reales en
el repositorio.

```env
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

Para la validacion E2E local, levantar el backend Spring en `develop` con
PostgreSQL real antes de abrir el frontend. El frontend usa un unico cliente
HTTP (`src/services/http-client.ts`) y lee esta URL como prefijo para todos los
endpoints integrados; si la variable no existe, el valor por defecto es
`http://localhost:8080/api/v1`.

## Estructura

`src/public/` contiene las vistas sin sesión y `src/private/` el layout con
menú principal para vistas internas. `src/modules/` organiza el dominio por
módulos con sus modelos, DTOs, mappers, adaptadores, servicios y componentes.
`src/shared/` contiene componentes, constantes, hooks, tipos y utilidades
reutilizables. `src/layouts/`, `src/services/`, `src/assets/` y `src/styles/`
alojan recursos transversales.

Rutas base disponibles: `/` (pública), `/auth/login` (inicio de sesión) y
`/pms/dashboard` (panel privado). `/login` y `/pms` siguen disponibles por
compatibilidad. Las rutas inexistentes muestran una página 404; bajo `/pms/`
se conserva el menú privado y se ofrece volver al panel operativo con sesión
activa. Sin sesión, toda ruta bajo `/pms` redirige al login.

`src/app/routes.ts` centraliza las URL: `routePaths` contiene las entradas
implementadas, los alias y los comodines que consume el router; `routes`
conserva el catalogo de rutas previstas por modulo y referencia las entradas
implementadas. Al conectar una vista nueva, definir su URL en ese archivo y
referenciarla desde `src/app/router.tsx`.

El prototipo Bolt original se migro parcialmente a
`src/private/workspace/` y los modulos de dominio (`front-desk`, `administration`, `guest-portal`, `room-service`) para cubrir las experiencias privadas completas
sin reemplazar el login actual. Las rutas protegidas siguen usando sesion y
permisos del proyecto; el rol Pasarela de pago no se conserva como rol de
navegacion. Su hoja de estilos global, `src/index.css`, sigue siendo parte del
contrato visual (ver [src/ARCHITECTURE.md](src/ARCHITECTURE.md)).

## Comandos

```bash
npm install
npm run dev
npm run check
npm run test
npm run format
```

`npm run check` ejecuta formato, TypeScript, ESLint, compilación de
producción y `npm run test` (incluye la suite INT-FINAL/INT-13 de validacion
estatica E2E: `src/data/db.ts` debe seguir eliminado, no puede haber imports a
`src/data/db`, no se aceptan clientes HTTP alternativos y se verifica el manejo
de `401/403/404/409` — ver [src/ARCHITECTURE.md](src/ARCHITECTURE.md) y
[docs/int-final-db-mocks.md](docs/int-final-db-mocks.md)). Cada suite también se puede
correr por separado: `npm run test:auth`, `test:currency`, `test:date`,
`test:money-contract`, `test:contract`, `test:services`,
`test:e2e-integration`, `test:presentation`.

## Autenticacion con backend (INT-01 / AUTH-GUEST #134)

- **Personal:** Abrir `/auth/login`. Desde 2026-10-01, `services/authService.ts` usa el backend
  Spring real: `POST /auth/login`, JWT Bearer automático, `POST /auth/refresh`
  ante `401` con retry único y `POST /auth/logout` con `refreshToken`.
- **Huéspedes:** Abrir `/auth/register` (Acceso de huésped). Desde Issue #134,
  el huésped se autentica con correo electrónico y contraseña contra
  `POST /guest/auth/login` (credenciales demo: `ana.demo@aurora.test` / `huesped1`,
  `carlos.demo@aurora.test` / `huesped2`). La vinculación por código de reserva
  (`POST /guest/auth/link`) se conserva como flujo secundario de compatibilidad.

Las credenciales ya no se validan contra `sessionAccountsDB`; deben existir en
PostgreSQL/backend. El frontend deriva email, rol y authorities del JWT
(`sub`, `ROLE_*`, permisos backend) y conserva los guards actuales mediante la
matriz de permisos de `src/modules/auth/models/session.ts`.

Nota CORS: el backend local revisado permite `http://localhost:3000`. La
configuracion de Vite fija el servidor dev en ese mismo origen para que el
login real contra backend no falle por CORS.

## Catálogo de interfaz — WEB-13

Abrir `/components` para revisar Card (outlined, raised, muted), Badge (cinco
tonos y dos tamaños), EmptyState, LoadingState, ErrorState, DataTable con
paginación y ordenación, y los primitivos de formulario de WEB-04 (Button,
Input, Select, Modal, DatePickerRange). El ejemplo de error ejecuta una
solicitud simulada fallida; «Reintentar» recupera los registros y permite
reproducir el fallo.

Los colores y medidas de esta entrega salen de `src/styles/tokens.css`, la
misma hoja de tokens que consume el resto del frontend.

`npm run test:presentation` verifica comportamiento y compatibilidad con las
tablas heredadas. Ver [la guía de componentes](src/shared/README.md).

## Seguimiento y contexto

- [PROJECT_STATUS.md](PROJECT_STATUS.md): estado, prioridades y decisiones.
- [src/ARCHITECTURE.md](src/ARCHITECTURE.md): contrato de carpetas y reglas.
- [src/styles/README.md](src/styles/README.md): tokens de diseno de WEB-03,
  extraidos desde WEB-08.
- [src/shared/README.md](src/shared/README.md): convenciones compartidas de
  moneda y fecha de WEB-07 (centavos enteros, GTQ, dd-mm-aaaa, HH:mm).
- [.codex/CONTEXT.md](.codex/CONTEXT.md): instrucciones de continuidad para agentes.
- [mobile/README.md](mobile/README.md): alcance de la futura aplicación nativa.
- [NEXT_CONTRIBUTOR.md](NEXT_CONTRIBUTOR.md): guía de trabajo para el siguiente compañero.
