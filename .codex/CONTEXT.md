# Contexto para Agentes

## Proyecto

PMS Hotel Boutique para Hotel Aurora. La interfaz original proviene del ZIP de
Bolt `project-bolt-sb1-8sal4vhj.zip`; su hoja de estilos (`src/index.css`) y
su paleta siguen siendo la referencia visual, aunque las pantallas que Bolt
generó (`src/app/App.tsx`, `src/components/`) se eliminaron en el cierre de
la Fase 0 por no estar conectadas a la aplicación real.

**El trabajo vive en `develop`, no en `main`.** `main` solo tiene el commit
inicial del repositorio.

## Arquitectura

- `src/public/`: vistas sin sesión. `page.tsx` es su entrada; `pages/` para
  vistas adicionales, incluida `ComponentsCatalogPage.tsx` (`/components`).
- `src/private/`: zona autenticada. `page.tsx` contiene el layout y menú;
  `pages/` para vistas compuestas, `guards/` para sesión/permisos, `routes/`
  para el catálogo de navegación por permiso.
- `src/modules/<dominio>/`: `models`, `dtos`, `mappers`, `services`,
  `components` propios de ese dominio. Hoy: `auth/` (sesión de personal) y
  `ui-catalog/` (ejemplos del catálogo de componentes).
- `src/shared/types/entities/<entidad>/`: DTO (snake_case) → Mapper → Model
  (camelCase), una sola definición por entidad. `entities/index.ts` es un
  barrel de tipos únicamente — los mappers (`toDomain`/`toDTO`) se importan
  siempre desde la ruta de su propia entidad, nunca del barrel, porque las
  once entidades usan esos mismos dos nombres y colisionarían.
  `entities/session/` (respuesta de login, rol de acceso al PMS) es distinto
  de `entities/user/` (puesto de un empleado, alineado con la app móvil) y no
  se reexporta desde el barrel — ver `src/ARCHITECTURE.md` y
  `src/modules/auth/README.md` antes de tocar cualquiera de los dos.
- `src/shared/components/`: piezas genéricas reutilizables, con `tokens.css`
  como única fuente de valores de diseño.
- `src/shared/constants/statuses.ts`: literales y transiciones de estado
  compartidos con la app móvil. **`room` tiene dos campos de estado, no
  uno:** `status` (ocupación, la escribe la web) y `housekeepingStatus`
  (limpieza, la escribe la app móvil). La asignabilidad se consulta con
  `isRoomAssignable()`, nunca con un condicional propio en una pantalla —
  ver `docs/DECISIONES.md`, D-002, antes de tocar cualquiera de los dos
  campos.
- `src/shared/mocks/lot-b.ts`: dataset del Lote B; lo sirven
  `bookingService`/`roomService`/`guestService`.
- `src/services/`: capa de datos. Cada servicio es `async`, devuelve Models,
  simula latencia de 300-600 ms y puede forzarse a fallar. Ningún componente
  importa mocks directamente — ver "Regla de oro" en `src/ARCHITECTURE.md`.
- `src/layouts/`: layouts de React Router.
- `src/app/router.tsx` / `src/app/routes.ts`: configuración de navegación y
  catálogo tipado de rutas.

Consultar `src/ARCHITECTURE.md` antes de crear archivos — tiene el detalle
completo del contrato de datos, moneda/fecha, servicios y pruebas.

La navegación se configura explícitamente con React Router en
`src/app/router.tsx`, que consume `routePaths` desde `src/app/routes.ts`.
Rutas base: `/`, `/auth/login`, `/pms/dashboard` (`/login` y `/pms` siguen
disponibles por compatibilidad). Hay 404 en ambos layouts; las rutas
desconocidas bajo `/pms/` conservan el menú privado. Sin sesión, el área PMS
redirige al login (`RequireSession`); el menú se arma por permiso
(`private/routes/navigation.ts`). No confiar en el nombre de un archivo para
crear una ruta.

## Estado tras el cierre de la Fase 0

La Fase 0 (issues #9 y #12) se cerró desde la rama `feat/fase-0-cierre` vía
Pull Request hacia `develop`. Resolvió, en orden: WEB-13 integrada (estaba en
una rama huérfana sin PR), el contrato de entidades duplicado (booking,
guest, payment, room, user y catalog.ts —que duplicaba product y amenity—
tenían un archivo plano y una carpeta oficial a la vez), los montos
migrados a centavos en el contrato que sobrevivió, el dataset del Lote B
conectado a los servicios, la UI muerta de Bolt eliminada, y siete suites de
prueba (103 casos) enganchadas a `npm run test`/`check`.

El detalle completo, fase por fase, con cada decisión de diseño justificada
(por qué `session/` no se fusionó con `user/`, por qué `Room` no tiene precio,
qué campos se descartaron y cuáles se inventaron) vive en
`PROGRESO-FASE-0.md` en la raíz del repositorio — no se repite aquí para no
tener dos fuentes de verdad que se desincronicen.

**Pendiente, fuera de ese cierre:** `src/index.css` sigue sin separarse en
estilos base vivos vs. estilos exclusivos del árbol de Bolt ya eliminado
(ver `src/ARCHITECTURE.md`, última sección).

## Reglas de trabajo

- Mantener TypeScript estricto y el alias `@/`.
- Copiar `.env.example` a `.env` antes de consumir servicios. Nunca versionar
  credenciales ni modificar la URL base dentro del código.
- Ejecutar `npm run check` antes de publicar cambios: valida Prettier,
  TypeScript, ESLint, la compilación y las siete suites de `npm run test`.
- Poner modelos, DTOs, mappers y servicios en el módulo o entidad que les
  corresponde. Los mappers traducen DTO ↔ Model; no debe haber esa
  conversión dispersa en las vistas.
- Actualizar los documentos `.md` afectados conforme avance el trabajo:
  `PROJECT_STATUS.md` para estado y verificaciones, `README.md` para uso y
  `.codex/CONTEXT.md` y `src/ARCHITECTURE.md` para arquitectura.

## Aplicación móvil

La futura app React Native está en `mobile/` y es solo para empleados. Cada
feature móvil usa `models`, `dtos`, `mappers`, `services`, `components` y
`screens`. Revisar `mobile/README.md` y `NEXT_CONTRIBUTOR.md` antes de
iniciar. Vive en el repositorio separado `pms-hotel-mobile`.
