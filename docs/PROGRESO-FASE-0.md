# Progreso del cierre de la Fase 0

**Rama:** feat/fase-0-cierre
**Base:** origin/develop @ `a1c07cd` (Merge pull request #31 from DougGM/feat/web-07-format-utils)
**Iniciado:** 2026-09-08

## Revalidación previa (FASE PREVIA)

| #   | Punto del plan original                                                                          | Estado encontrado                                                                                                                                                                                                                                                                | Veredicto  |
| --- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | Contrato de entidades duplicado (`booking`/`guest`/`room`/`payment`/`user` planos vs. oficiales) | Sin cambios: `entities/index.ts` sigue exportando los archivos planos.                                                                                                                                                                                                           | CONFIRMADO |
| 2   | Moneda `'USD'` y montos sin centavos en `bookingService.ts`/`mockData.ts`                        | Corregido por PR #31 (WEB-07, fusionado 2026-09-08T08:18:18Z): `currency: 'GTQ'`, campos `*Cents` con valores ×100 correctos. Pero aplicado sobre el contrato **duplicado** (camelCase), no el oficial (snake_case). `Currency` en `common.ts` seguía siendo unión de 4 monedas. | CAMBIÓ     |
| 3a  | `origin/feat/web-07-format-utils` sin fusionar                                                   | Fusionada (PR #31). Issue #19 CLOSED. Trae `formatCurrency`/`formatDateGT`/`formatTimeGT` y 3 suites de prueba (`test-currency.mjs`, `test-date.mjs`, `test-money-contract.mjs`), no enganchadas a `package.json`.                                                               | CAMBIÓ     |
| 3b  | `origin/feat/web-13-presentation-catalog` sin fusionar                                           | Sin cambios: 1 commit (`ab32a9a`), sin PR, issue #25 OPEN.                                                                                                                                                                                                                       | CONFIRMADO |
| 4   | Código muerto de Bolt (`src/app/App.tsx`, `src/components/*`) sin referencias                    | Sin cambios: 5.359 líneas, sin importar desde `main.tsx`/`router.tsx`. `tokens.css` con 312 alias legacy.                                                                                                                                                                        | CONFIRMADO |

**Ajustes acordados con el usuario tras esta revalidación** (sustituyen lo que decía el plan original en esos puntos; todo lo demás del plan queda igual):

- **FASE 2:** se elimina el paso de fusionar `feat/web-07-format-utils` (ya heredado desde `develop`). Solo se integra `feat/web-13-presentation-catalog`. Se verifica que `test-currency.mjs`, `test-date.mjs` y `test-money-contract.mjs` sigan pasando después del merge.
- **FASE 3 + FASE 4 fusionadas** en una sola fase y un solo commit: sobrevive el contrato oficial de WEB-09 (snake_case, `_cents`); los valores de `mockData.ts` (ya en centavos correctos) se trasladan **sin volver a multiplicar por 100**; se cierra `Currency` a literal `'GTQ'`; se migran los servicios; se elimina el parche `f5ad36c`; se adapta (no se reescribe) `test-money-contract.mjs` a los nombres snake_case. Antes de ese commit se presenta una tabla campo/valor-antes/valor-después para verificación humana.
- **FASE 7:** no se duplican `test-currency.mjs`/`test-date.mjs`/`test-money-contract.mjs`. Se enganchan a `npm run test` y `npm run check`. Solo se agregan `test-contract.mjs` y `test-services.mjs`.
- `format:check` está en **137 archivos** al momento de crear la rama (no 131 ni 136 exactamente; ver estado inicial).

## Estado inicial (en `feat/fase-0-cierre`, recién creada desde `origin/develop`)

| Comando                                                                                                                                         | Resultado                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `npm install` (falló `npm ci` por `EPERM` en `node_modules/@esbuild`, posiblemente locked por otro proceso; se usó `npm install` como fallback) | ✅ 233 paquetes añadidos, 64 cambiados   |
| `npm run lint`                                                                                                                                  | ✅ limpio                                |
| `npm run typecheck`                                                                                                                             | ✅ limpio                                |
| `npm run build`                                                                                                                                 | ✅ compila (`dist/` generado)            |
| `npm run format:check`                                                                                                                          | ❌ 137 archivos con problemas de formato |
| `node scripts/test-auth.mjs`                                                                                                                    | ✅ 14/14                                 |
| `node scripts/test-currency.mjs`                                                                                                                | ✅ 11/11                                 |
| `node scripts/test-date.mjs`                                                                                                                    | ✅ 35/35                                 |
| `node scripts/test-money-contract.mjs`                                                                                                          | ✅ 13/13                                 |

## Bitácora

| Fase | Descripción                                                                                  | Commit                       | Estado                                                             |
| ---- | -------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------ |
| 0    | Crear rama `feat/fase-0-cierre` desde `origin/develop`, línea base, esta bitácora            | `74919dd`                    | ✅ hecho                                                           |
| 1    | Verificación previa al borrado (aislamiento del código de Bolt)                              | — (sin commit, solo lectura) | ⚠️ parcial — desbloqueado por el usuario: Opción A (ver más abajo) |
| 2    | Integrar `feat/web-13-presentation-catalog` (WEB-07 ya venía heredado en `develop`)          | `af96f51`                    | ✅ hecho                                                           |
| 3+4  | Unificar el contrato de entidades y portar los montos en centavos al contrato oficial        | `a2fd595`                    | ✅ hecho                                                           |
| 5    | Conectar el dataset del Lote B (`lot-b.ts`) a `roomService`/`guestService`/`bookingService`  | `22fdd2c`                    | ✅ hecho                                                           |
| 6    | Eliminar la UI muerta de Bolt (alcance reducido, Opción A)                                   | `e09eeb7`                    | ✅ hecho                                                           |
| 7a   | Pruebas nuevas (`test-contract.mjs`, `test-services.mjs`) + enganchar `npm run test`/`check` | `e71723e`                    | ✅ hecho                                                           |
| 7b   | Formato de Prettier a todo el árbol (commit aislado, al final)                               | `0dc2707`                    | ✅ hecho                                                           |

### FASE 1 — detalle del bloqueo

**TSX: aislado.** Ningún archivo vivo (`src/main.tsx`, `src/app/router.tsx`, `src/app/routes.ts`,
`src/public/*`, `src/private/*`, `src/modules/*`, `src/shared/*`) importa `src/app/App.tsx` ni
`src/components/{admin,guest,reception,roomservice}`. Verificado por grep transitivo desde
`index.html`. Seguro de eliminar en la FASE 6.

**CSS: NO aislado.** `src/index.css` (7.937 líneas, 1.243 selectores) se importa desde
`src/main.tsx:5` — es decir, está vivo. La mayoría de sus selectores (`.adm-*`, etc.) parecen
pertenecer solo al árbol muerto de Bolt, pero **al inicio del archivo hay reglas base
genuinamente en uso por la app real**: `body` (línea 20, `min-width: var(--size-legacy-1100)`),
`.app-shell` (línea 34), `.public-page-shell`/`.public-page-card` (líneas 39-60, usadas por
`PublicPage.tsx` y `StaffLoginPage.tsx`), `.eyebrow`/`.workspace-label` (línea ~107, usadas por
`StaffLoginPage.tsx`, `PublicPage.tsx`, `PrivateLayout`), `.content`/`.welcome-row` (línea 377,
usadas por `OperationsHomePage.tsx`, `RequirePermission.tsx`), `.button`/`.button.primary`/
`.button.secondary` (línea 407, usadas en todos lados). Esas reglas, activas hoy, referencian
directamente variables `--*-legacy-*`: `--size-legacy-1100`, `--size-legacy-38`,
`--color-legacy-a89c91`, `--color-legacy-91847a`, `--color-legacy-b88d5030`,
`--color-legacy-c9a36d`, `--color-legacy-e4dcd4`, `--color-legacy-efe5d8`, `--size-legacy-31/36/42/1600/26/5`,
entre otras.

Esto contradice la premisa de la auditoría original ("los alias legacy solo los consume la UI
muerta") y activa la cláusula de la propia FASE 1: **"si un primitivo vivo consume una variable
legacy: DETENTE y repórtalo. No borres."** No hay forma mecánica y segura de separar, dentro de
`index.css`, qué variables legacy son puramente del árbol muerto y cuáles sostienen el layout
básico que sí se renderiza hoy (login, landing pública, shell operativo) sin trazar selector por
selector — es un trabajo de análisis/repartición de `index.css` en sí mismo, no una simple poda.

**Decisión:** me detuve aquí, sin tocar código, y reporté al usuario en vez de improvisar una
forma de separar `index.css`.

**Resolución del usuario (Opción A):** FASE 6 queda reducida a eliminar `src/app/App.tsx` y
`src/components/{admin,guest,reception,roomservice}`, retirar `@supabase/supabase-js` si sigue
sin usarse, y resolver `httpClient.ts` vs. `http-client.ts`. **No se toca `tokens.css` ni
`index.css` en este cierre de Fase 0** — ni un alias `--*-legacy-*` se borra. La separación de
`index.css` en estilos base vivos vs. estilos del árbol muerto queda fuera de este cierre; el
usuario la convertirá en un ticket aparte (se deja constancia en la FASE 8 y en el PR).

### FASE 2 — integración de WEB-13

Se fusionó `origin/feat/web-13-presentation-catalog` (commit único `ab32a9a`, forkeada antes de
que WEB-03/04/06/07 llegaran a `develop`). Conflictos en `.codex/CONTEXT.md`, `PROJECT_STATUS.md`,
`README.md`, `package.json`, `src/ARCHITECTURE.md`, `src/app/router.tsx`, `src/shared/README.md`
resueltos conservando ambos lados. `src/app/routes.ts`, `src/app/routes.ts`, `AdminContent.tsx`,
`ReceptionModals.tsx` y `tokens.css` fusionaron sin conflicto.

Trabajo adicional durante la integración (parte del mandato original de la FASE 2, no eliminado
por el usuario):

- **Tokens reconciliados**: `presentation-tokens.css` (segundo sistema de tokens `--ui-*`
  provisional, con ~46 valores hardcodeados propios) se eliminó. Sus variables ahora se definen
  dentro de `tokens.css`, apuntando a los tokens reales de WEB-03 donde existe equivalente
  (`--space-*`, `--font-size-*`, `--radius-*`, `--color-*`); las tintas de fondo de Badge/alerta
  (`--ui-*-bg`) se derivan con `color-mix()` desde los colores semánticos existentes en vez de
  hex nuevos; los pocos valores sin equivalente (anchos de layout, alto de control, foco, motion)
  se definen una sola vez ahí. `components-catalog.css` y `presentation.css` no se tocaron —
  siguen usando los mismos nombres `--ui-*`, ahora resueltos contra la escala real.
- **Primitivos de WEB-04 incorporados al catálogo**: la sección "05 / Componentes de formulario"
  mostraba solo insignias "· pendiente"; se reemplazó por ejemplos reales de `Button`, `Input`,
  `Select`, `Modal` y `DatePickerRange` (`src/public/pages/ComponentsCatalogPage.tsx`).
  `tests/presentation.test.jsx` se ajustó (la aserción que buscaba el texto retirado
  "Pendientes de WEB-04") sin tocar las 8 pruebas originales.

Verificado tras el merge: `npm run lint`, `npm run typecheck`, `npm run build`,
`node scripts/test-auth.mjs` (14/14), `scripts/test-currency.mjs` (11/11),
`scripts/test-date.mjs` (35/35), `scripts/test-money-contract.mjs` (13/13),
`scripts/test-presentation.mjs` (8/8) — todos en verde.

### FASE 3+4 — unificación del contrato de entidades + moneda en centavos

Sobrevive el contrato oficial de WEB-09 (`entities/<x>/<x>.dto.ts`, snake_case, `_cents`) en las
6 entidades duplicadas encontradas — 6, no 5: la auditoría original no había detectado que
`entities/catalog.ts` duplicaba **product y amenity** además de `booking.ts`/`guest.ts`/
`payment.ts`/`room.ts`/`user.ts`. Se corrige aquí.

**Tabla de montos (verificada antes del commit, ningún valor cambió de magnitud):**

| Campo                                            | Antes  | Después | ¿Cambió? |
| ------------------------------------------------ | ------ | ------- | -------- |
| pricePerNightCents (room-101) → Rate.price_cents | 95000  | 95000   | No       |
| pricePerNightCents (room-202) → Rate.price_cents | 78000  | 78000   | No       |
| totalAmountCents (booking-1)                     | 285000 | 285000  | No       |
| amountCents (payment-1)                          | 285000 | 285000  | No       |
| priceCents (product-1)                           | 1500   | 1500    | No       |
| priceCents (product-2)                           | 7500   | 7500    | No       |

**Decisiones de diseño no triviales, para que quien revise las entienda sin releer el diff:**

1. **`user` no se unificó como las otras 5.** El contrato oficial `entities/user/` modela el
   puesto de un empleado (admin/guest/reception/housekeeping/concierge/roomService, alineado con la app
   móvil) — un concepto distinto del rol de acceso/login (ADMIN/GUEST/RECEPTION/HOUSEKEEPING/CONCIERGE/ROOM_SERVICE) que
   ya usa WEB-06, probado con 14 pruebas. `modules/auth/README.md` ya advertía explícitamente no
   mezclarlos. Se creó `shared/types/entities/session/` (SessionUserDTO, LoginDTO,
   AuthResponseDTO, AuthSession, `toAuthSession`) como contrato neutral que consumen tanto
   `services/authService.ts` como `modules/auth/`, en vez de colgarlo de `modules/auth/`
   (invertiría la dependencia: un servicio transversal importando de un módulo de dominio).
2. **Room pierde precio/capacidad/amenidades.** El contrato oficial ya los modela en `RoomType`
   (capacidad, descripción, amenidades) y `Rate` (price_cents, currency) — igual que ya hace el
   dataset del Lote B. Se agregaron `mockRoomTypes`/`mockRates` a `mockData.ts` en vez de
   forzar esos campos de vuelta a `Room`, que habría deshecho la normalización de WEB-09.
3. **Campos sin equivalente en el contrato oficial, descartados (no forzados):** `Booking.guests`
   (redundante), `Booking.source`, `Payment.type`/`.description` (pertenecen a `Charge`, entidad
   ya separada — no se inventan datos de Charge aquí, eso es WEB-11), `Amenity.icon`. Ninguno
   tenía consumidor vivo (verificado por grep antes de descartarlos).
4. **Campos portados a la oficial (adición, no pérdida):** `Guest.notes?` (existía sin usar),
   `CreateBookingDto` y `AddPaymentDto` (capacidad de creación que sí usan los servicios).
5. **Aproximaciones sin mapeo 1 a 1:** `Product.category`/`Amenity.category` no tenían
   equivalente exacto en el enum oficial (MINIBAR→minibar, ROOM_SERVICE→other; Wi-Fi→hotel,
   Desayuno→service); `Product.sku`/`.reorder_level` son datos inventados razonables — el mock
   original nunca los tuvo. Vale la pena que alguien del equipo revise estas dos aproximaciones.
6. **`entities/index.ts`** vuelve a ser un barrel de _tipos_ únicamente: `toDomain`/`toDTO`
   colisionan de nombre entre las 11 entidades si se reexportan con `export *`, así que los
   mappers se importan siempre desde la ruta específica (`@/shared/types/entities/booking`),
   igual que ya hacía `shared/mocks/lot-b.ts` antes de este cambio.
7. **`Currency`** se cerró a literal `'GTQ'` en `common.ts`; también se retiraron de ahí
   `BookingStatus`/`RoomStatus`/`PaymentStatus`/`PaymentMethod`/`ChargeType`/`ProductCategory`
   por quedar sin ningún consumidor tras borrar los archivos planos.
8. **`test-money-contract.mjs`** se adaptó (no se reescribió): mismas 13 pruebas, apuntando a
   `mockRates` en vez de `mockRooms` para el precio (ya no vive ahí) y a los nombres snake_case.

Verificado: `npm run lint`, `npm run typecheck`, `npm run build`, y las 5 suites de prueba
(`test-auth` 14/14, `test-currency` 11/11, `test-date` 35/35, `test-money-contract` 13/13,
`test-presentation` 8/8) — 81/81 en verde.

### FASE 5 — conectar el dataset del Lote B

`roomService`, `guestService` y `bookingService` ahora leen `lotBMockData` (`shared/mocks/lot-b.ts`,
15+ habitaciones/12 huéspedes/20 reservas) en vez de las fixtures mínimas de `mockData.ts` (que
solo tenían 1-2 registros por entidad, creados para que WEB-05 pudiera probar el patrón de
servicio antes de que existiera WEB-10). El dato de `lot-b.ts` ya encajaba con el contrato
unificado de la FASE 3+4 sin ajustes — el typecheck ya venía limpio con `lot-b.ts` incluido desde
esa fase. `paymentService`/`catalogService` siguen en `mockData.ts`: `lot-b.ts` no cubre pagos,
productos ni amenidades (WEB-11/WEB-12, aún sin código).

**Nota para seguimiento (no bloqueante):** `mockData.ts` conserva `mockRoomTypes`/`mockRates`/
`mockRooms`/`mockGuests`/`mockBookings` sin usar por ningún servicio — sirven de fixture para
`scripts/test-money-contract.mjs`. Hay dos datasets de las mismas entidades conviviendo (uno
mínimo en `mockData.ts`, uno rico en `lot-b.ts`); no se consolidaron en esta fase por alcance
(la instrucción era conectar el huérfano, no reescribir las pruebas de nuevo). Candidato a
limpieza futura si el equipo quiere una sola fuente.

Verificado: regla de oro (`grep` confirma que ningún archivo fuera de `services/` importa de
`shared/mocks` ni de `services/mockData`), `npm run lint`, `npm run typecheck`, `npm run build`,
`test-auth` (14/14), `test-money-contract` (13/13), `test-presentation` (8/8).

### FASE 6 — eliminar la UI muerta de Bolt (alcance reducido)

Re-verificación de aislamiento inmediatamente antes de borrar (el árbol había cambiado bastante
desde la FASE 1): ningún archivo vivo importa `src/app/App.tsx` ni `src/components/*`; ningún
`.css` colocalizado dentro de esas carpetas (toda su hoja de estilos vive en `index.css`, que
—junto con `tokens.css`— **no se tocó**: `git diff origin/develop -- src/styles/tokens.css`
solo muestra líneas añadidas, cero borradas, en todo el cierre de Fase 0). Se eliminó
`src/app/App.tsx` (1.466 líneas) y `src/components/{admin,guest,reception,roomservice}/`
(3.893 líneas): el build antes y después tiene exactamente el mismo tamaño de JS/CSS,
confirmando que ya estaban fuera del bundle de producción.

Se retiró `@supabase/supabase-js` (sin uso, remanente de la plantilla Bolt) y se resolvió
`httpClient.ts` vs. `http-client.ts` eliminando el primero (reexport de 2 líneas, cero
importadores) — `http-client.ts` sobrevive.

**Efecto en cascada que hubo que resolver dentro del mismo commit:** `tests/presentation.test.jsx`
tenía 2 de sus 8 pruebas ("legacy administration...", "legacy invoice...") que importaban
`AdminContent`/`InvoiceModal` directamente para comprobar que ya usaban el `TableFrame`
compartido de WEB-13. Al borrar esos componentes, esas 2 pruebas dejan de poder importar nada;
se retiraron junto con sus imports (`AdminContent`, `InvoiceModal`, `TableFrame`). Las 6 pruebas
restantes —las que ejercitan los primitivos en sí, no los consumidores heredados— no se tocaron.
`src/shared/README.md` se actualizó para no seguir describiendo a esos componentes como
consumidores de `TableFrame`.

**Verificación completa, en el orden pedido:** `npm run build` → `npm run lint` →
`npm run typecheck` → `test-auth` (14/14) → `test-currency` (11/11) → `test-date` (35/35) →
`test-money-contract` (13/13) → `test-presentation` (6/6, tras el ajuste) → revisión visual en
Chrome de `/`, `/auth/login`, `/pms` (con y sin sesión, rol ADMIN), 404 pública y privada, y
`/components` incluido el modal de WEB-04 — las cinco vistas se ven igual que antes del borrado
(capturas revisadas en la sesión, no adjuntas aquí).

### FASE 7 — pruebas nuevas, `npm run test`/`check`, formato

`test-currency.mjs`, `test-date.mjs` y `test-money-contract.mjs` ya existían (WEB-07); solo se
engancharon a `package.json`, sin tocarlas. Se agregaron dos suites nuevas, sin instalar ningún
framework de pruebas nuevo (mismo patrón esbuild → cjs → `node --test` de `test-auth.mjs`):

- **`test-contract.mjs`** (17 pruebas): guarda de regresión de que no vuelva a aparecer un
  archivo plano junto a la carpeta oficial de una entidad (el error real que motivó la FASE 3+4,
  no una hipótesis), y que `shared/mocks/lot-b.ts` —el dataset que sirven los servicios desde la
  FASE 5— tenga `price_cents`/`total_amount_cents` enteros y `currency: 'GTQ'`.
- **`test-services.mjs`** (7 pruebas): `bookingService`/`roomService`/`guestService`/
  `paymentService`/`catalogService` son `async`, su latencia cae en un rango tolerante
  (250-900 ms; el nominal es 300-600 ms, con margen por scheduling/CI), devuelven Models
  (camelCase) y no DTOs (snake_case), el forzado de error (`mockUtils.setForceError`) los hace
  rechazar y se puede desactivar, y una verificación estática (recorre `src/` en JS puro, sin
  depender de `grep`/`rg`) de que ningún archivo fuera de `services/` importa mocks. `authService`
  no se repite: sus 14 pruebas en `test-auth.mjs` ya cubren ese mismo contrato a fondo.
  - Detalle técnico: para que `mockUtils.setForceError(true)` afecte de verdad a los servicios,
    el bundle de prueba se arma con un entry point `stdin` sintético que importa los cinco
    servicios y `mockUtils` **en un solo grafo de esbuild**, para que compartan una única
    instancia del módulo. Bundlarlos por separado (como hace `test-money-contract.mjs` con datos
    sin estado) habría dado a cada uno su propia copia aislada de `mockUtils`, y el forzado de
    error de una no afectaría a las demás.

`package.json`: se agrega `"test"` (corre las 7 suites en orden) y se encadena al final de
`"check"` (`format:check && typecheck && lint && build && test`).

**Antes del commit de formato**, se corrió `npm run check` completo tal como estaba (sin
formatear) para confirmar que el único paso que fallaba era `format:check` — el log no contiene
ninguna salida de `typecheck`/`lint`/`build`/`test` porque la cadena `&&` corta ahí mismo; exit
code 1 atribuible solo a Prettier.

El commit de formato fue el último de la fase, aislado. `npm run format:check` reportaba
137-138 archivos, casi todos de antes de esta rama (nunca tocados en el cierre de la Fase 0).
Tras `npm run format`, `git status` solo mostró diferencias reales de contenido en **10
archivos** — el resto eran diferencias de fin de línea (CRLF/LF) que `core.autocrlf` ya
normalizaba de forma invisible para git en este entorno Windows. Los 10 son reenvuelto de líneas
largas (imports, tablas Markdown), sin cambio semántico — revisado línea por línea antes de
commitear. De paso se limpió `.prettierignore`: se quitaron las entradas a `src/app/App.tsx` y
`src/components/` (ya no existen, eliminados en la FASE 6) y se agregó `docs/` (carpeta de
trabajo del usuario, ajena al código fuente; se confirmó que `npm run format` no la había tocado
antes de este cambio, comparando fecha de modificación de sus archivos).

Verificado: `npm run check` completo corre y termina en verde (exit 0) después del commit de
formato.

## Decisiones tomadas

- Se usó `npm install` en vez de `npm ci` en el paso de línea base por un error `EPERM` de Windows al desinstalar un binario de `esbuild` bloqueado; no afecta el resultado (mismas versiones resueltas por `package-lock.json`).
- La rama `feat/fase-0-cierre` se creó **sin upstream** (`git branch --unset-upstream`) para que ningún `git push` sin argumentos pueda apuntar accidentalmente a `develop`. El push final se hará explícito: `git push -u origin feat/fase-0-cierre`.

## Pendientes y bloqueos

- **Ya no es un bloqueo activo** (resuelto por el usuario, Opción A): `src/index.css` sigue sin
  separarse — mezcla en un solo archivo de 7.937 líneas estilos base realmente en uso (`body`,
  `.app-shell`, `.public-page-shell`, `.public-page-card`, `.eyebrow`, `.content`,
  `.button`/`.primary`/`.secondary`, `.workspace-label`, `.welcome-row`) con estilos exclusivos
  del árbol muerto de Bolt (`.adm-*` y probablemente `.rec-*`/`.guest-*`/`.rs-*`), y varias de
  esas reglas en uso real dependen de variables `--*-legacy-*` de `tokens.css`. Por decisión del
  usuario, **queda fuera de este cierre de Fase 0** — ni `tokens.css` ni `index.css` se tocan en
  la FASE 6 reducida. El usuario abrirá un ticket aparte para separar `index.css`.

## Resumen final

Cierre de la Fase 0 completo, 14 commits en `feat/fase-0-cierre` sobre `origin/develop`
(`a1c07cd`). `npm run check` completo (`format:check && typecheck && lint && build && test`)
pasa en verde: 103 pruebas en 7 suites, build de producción, lint y formato limpios. Siguiente
paso mecánico: push de la rama y apertura del PR hacia `develop` (sin fusionar — eso lo decide
una persona).

**Los cuatro problemas del encargo original, resueltos:**

1. Contrato de entidades duplicado — unificado (FASE 3+4). Alcance real: 6 entidades, no 5
   (`catalog.ts` también duplicaba product y amenity, no detectado en la auditoría previa).
2. Moneda `USD`/sin centavos — ya no existe en el contrato que sobrevivió; `Currency` cerrado a
   `'GTQ'` literal (FASE 3+4).
3. WEB-07 y WEB-13 sin integrar — WEB-07 llegó a `develop` por otra vía (PR #31) durante la
   FASE PREVIA de este cierre; WEB-13 se integró aquí (FASE 2).
4. Código muerto de Bolt — eliminado (FASE 6), con `tokens.css`/`index.css` intactos por decisión
   explícita del usuario tras el bloqueo de la FASE 1.

**Lo que NO se resolvió, y por qué, queda documentado en cada sección de arriba:** la separación
de `index.css` (FASE 1/6), WEB-11 y WEB-12 sin código (fuera del alcance de este cierre — son
tickets de datos mock de otros lotes), y la duplicación menor entre las fixtures de
`mockData.ts` y `lot-b.ts` (FASE 5, no bloqueante).

Próximo paso: revisión humana del PR y fusión a `develop` por quien corresponda — este cierre no
se fusiona a sí mismo.
