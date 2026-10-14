# Convenciones del proyecto

Frontend web del PMS Hotel Boutique. Este archivo es el criterio de
aceptación de WEB-01 ("Escribir `CLAUDE.md` con las convenciones de código,
nombres y estructura") que había quedado sin cumplir — ver `PROGRESO-FASE-0.md`.
Para la estructura de carpetas y el contrato de datos completo, ver
`src/ARCHITECTURE.md`; para el estado del proyecto, `PROJECT_STATUS.md`.

**El trabajo vive en `develop`, no en `main`.**

## Ronda 1 (rutas y módulos)

`src/app/routes.ts`, `src/app/router.tsx` y la unión `Permission`/
`rolePermissions` de `src/modules/auth/models/session.ts` quedan
**congelados** — una ruta o un permiso nuevo se piden por PR a JEPG321, no
se agregan desde la rama de un lote. Cada lote de la Ronda 1 (`rooms`,
`booking-engine`, `occupancy`, `front-desk`) escribe solo dentro de
`src/modules/<módulo>/`; nada en `shared/`, nada en `app/`. Tabla completa
de las 14 rutas con su permiso, y la deuda pendiente entre `Permission` de
`session.ts` (WEB-06) y `permissionsDB`/`rolesDB` de `db.ts` (WEB-12,
D-003), en `docs/ronda-1-scaffold.md` y `docs/DECISIONES.md` D-006.

## Idioma

Todo el código en inglés: nombres de archivo, carpetas, variables, funciones,
tipos y propiedades. El español solo en texto visible al usuario, comentarios
y documentación (`.md`).

## Nombres de archivo

- Componentes React: `PascalCase.tsx` (`Button.tsx`, `StaffLoginPage.tsx`).
- Todo lo demás en TypeScript (servicios, mappers, utilidades, hooks):
  `kebab-case.ts` (`http-client.ts`, `session-mapper.ts`) o `camelCase.ts`
  según lo que ya exista en esa carpeta — no mezclar los dos dentro del mismo
  directorio. Antes de crear un archivo, mirar cómo se llaman sus vecinos.
- Un componente y su CSS coubicado comparten nombre: `Modal.tsx` +
  `Modal.css`.

## Contrato de datos

Una sola definición por entidad, en `src/shared/types/entities/<entidad>/`:
`<entidad>.dto.ts` (snake_case, forma de API real) → `<entidad>.mapper.ts`
(`toDomain`/`toDTO`) → `<entidad>.model.ts` (camelCase, forma de dominio).
Nunca un segundo archivo plano para la misma entidad — `test-contract.mjs`
falla si aparece uno.

Los mappers se importan siempre desde la ruta de su propia entidad
(`@/shared/types/entities/booking`), nunca del barrel `entities/index.ts`:
`toDomain`/`toDTO` se llaman igual en las veintitrés entidades del barrel
y colisionarían si lo reexportara.

`shared/types/entities/session/` (login/sesión, rol de acceso al PMS) y
`shared/types/entities/user/` (puesto de un empleado) son conceptos
distintos que comparten nombre por casualidad. No fusionarlos, no crear un
tercer contrato de usuario.

`shared/types/entities/room-feature/` (características de habitación) y
`shared/types/entities/amenity/` (servicios compartidos del hotel, con
horario) son igual de distintos — no colgar una amenidad de `room`/
`room-type`. Ver `docs/DECISIONES.md`, D-001.

El estado de `room` son dos campos, no uno: `status` (ocupación, la
escribe la web) y `housekeepingStatus` (limpieza, la escribe la app
móvil). La asignabilidad se consulta con `isRoomAssignable()`
(`shared/constants/statuses.ts`), nunca con un condicional propio. Ver
`docs/DECISIONES.md`, D-002.

`role.code` (catálogo de roles/permisos, WEB-12) corresponde por **valor**
con `user.role` — no es una FK y no cambia el tipo de `user.role`. Ver
`docs/DECISIONES.md`, D-003. El formato de SKU de `product`/
`inventory-item` y el catálogo unificado de categorías siguen sin decidir
en equipo — valor provisional en uso, ver D-004 y D-005 en el mismo
documento antes de asumir que son definitivos.

## Moneda y fecha

- Quetzal guatemalteco. Todo campo de dinero en un DTO termina en `_cents`
  y es un **entero** — nunca un decimal. `currency` es el literal `'GTQ'`
  (`shared/types/common.ts`), no una unión de monedas ni un `string` suelto.
- `formatCurrency` (`shared/utils/currency.ts`) es la única función de
  formato de moneda. Ninguna pantalla escribe `Q` a mano.
- `formatDateGT`/`formatTimeGT` (`shared/utils/date.ts`) son las únicas
  funciones de formato de fecha/hora. Un DTO distingue fecha civil
  (`"YYYY-MM-DD"`) de timestamp (ISO 8601 completo) — nunca `new Date(value)`
  a secas sobre un string de solo fecha, desplaza el día según zona horaria.

## Regla de oro de los datos

Ningún componente ni pantalla importa `shared/mocks/` o `services/mockData.ts`
directamente. Todo pasa por un servicio en `src/services/`. Un servicio es
`async`, devuelve Models (nunca DTOs) y simula latencia de 300 a 600 ms
(`services/mockUtils.ts`). `test-services.mjs` verifica esto de forma
estática en cada `npm run test`.

## Tema

Ningún color, tamaño o espaciado escrito a mano en un componente o CSS
nuevo — todo sale de `src/styles/tokens.css`. Si el valor que necesitás no
existe en la escala, agregalo ahí (con nombre semántico), no lo hardcodees
en el archivo que lo consume.

## Pruebas

Mismo patrón en las once suites de `scripts/*.mjs`: esbuild empaqueta el
módulo a CommonJS y se corre con `node --test`. No instalar un framework de
pruebas nuevo (Jest, Vitest, etc.) — extender este patrón. `npm run test`
las corre todas; `npm run check` las incluye al final.

## Antes de publicar cambios

`npm run check` (`format:check && typecheck && lint && build && test`) tiene
que pasar completo.
