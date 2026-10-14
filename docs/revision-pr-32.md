# Revisión del PR #32 — Cierre de la Fase 0

> **Nota de contexto (agregada al archivar este registro):** este documento es un
> **registro histórico** del estado del repositorio y del PR #32 **antes de que se
> fusionara**. Se escribió el **2026-09-09**, cuando el PR #32 todavía estaba abierto.
> El PR #32 se fusionó a `develop` el **2026-09-10T02:14:27Z**. Por eso el cuerpo del
> documento habla en presente de un PR sin fusionar y de un "modo REVISIÓN" ("El PR NO
> está fusionado", sección 8: "Qué falta... 1. Fusionar el PR #32") — son correctos
> para la fecha en que se escribieron y no se actualizaron para reflejar la fusión
> posterior, precisamente porque este documento es un registro de lo que se observó en
> ese momento, no una página viva. Leerlo con esa fecha en mente.

Auditoría de verificación, no de confianza en lo reportado por el agente que escribió el
código. Toda afirmación de esta sección va respaldada por un comando corrido o un archivo
leído durante esta revisión, en un clon aislado (`$CLAUDE_JOB_DIR/tmp/pr32-review/`), sin
tocar la copia de trabajo del usuario ni la rama `feat/fase-0-cierre` que ya tenía abierta.

## 1. Modo de trabajo

`gh pr view 32 --json state,mergedAt,baseRefName,headRefName` →
`{"baseRefName":"develop","headRefName":"feat/fase-0-cierre","mergedAt":null,"state":"OPEN"}`.

**El PR NO está fusionado → modo REVISIÓN.** Se ejecutaron los pasos 2 a 5. No se cerró, no
se comentó y no se modificó ninguna issue ni ningún archivo de código. La única excepción que
permitían las instrucciones — cerrar un ticket cuyo trabajo ya estuviera íntegro en `develop`
antes del PR — resultó **no accionable**: los tickets que sí cumplen esa condición (ver
sección 7) ya estaban cerrados de antes, así que no había nada que cerrar. No se tocó ningún
ticket.

## 2. Veredicto general

**El PR no debería fusionarse todavía tal como está.** Mecánicamente es intachable —
`format:check`, `typecheck`, `lint`, `build` y las 103 pruebas de las 7 suites pasan
limpiamente en un checkout aislado con terminadores LF — y las rutas verificadas en el
navegador se comportan como describen los criterios de aceptación. El problema no es el
código: es que tres de los tickets que la auditoría anterior marcó como cerrados sin cumplir
(#13, #17, #21) siguen sin cumplirse **en `develop`** hoy, porque su arreglo vive únicamente
en esta rama. Fusionar resuelve exactamente eso, así que el bloqueo real es de proceso —
revisión de los cuatro integrantes que pide WEB-09 y decisión del equipo — no de calidad de
código. No hay bloqueantes técnicos nuevos encontrados en esta revisión.

## 3. Bloqueantes

Ninguno de origen técnico. Los tres que existían (CLAUDE.md ausente, `Currency` sin cerrar a
`'GTQ'`, contrato de entidades duplicado) están resueltos en esta rama; lo que falta es que
esa rama se integre a `develop`, que es justamente lo que este PR propone.

## 4. Observaciones (no bloquean, conviene atenderlas)

1. **Alias de compatibilidad `XDto = XDTO` sin limpiar en 9 de 12 entidades.** `amenity`,
   `booking`, `charge`, `guest`, `payment`, `product`, `rate`, `room` y `user` definen una
   interfaz `XDTO` (mayúsculas) que nadie usa —confirmado por grep, cero referencias fuera del
   propio archivo `.dto.ts` y de los barrels— y la alias inmediatamente en minúscula
   (`export type BookingDto = BookingDTO;`, `src/shared/types/entities/booking/booking.dto.ts:6,25`).
   Todo el código real (mappers, servicios, mocks) usa `XDto`. `scripts/test-contract.mjs`
   solo vigila que no reaparezca un archivo plano (líneas 32-43); no detecta este tipo de
   duplicado de nombre. No es un bug funcional, pero no es "una sola definición por entidad"
   en sentido estricto y es exactamente el patrón de alias que se pidió buscar.
2. **Datos aproximados documentados en `PROGRESO-FASE-0.md` pero no marcados en el código.**
   El propio documento (líneas 153-159 en la rama del PR) reconoce que `Product.category`/
   `Amenity.category` no tienen mapeo 1 a 1 (`ROOM_SERVICE` → `'other'` en
   `src/shared/types/entities/product/product.dto.ts:3`; ver también
   `src/shared/types/entities/amenity/amenity.dto.ts:1`) y que los SKU (`'AGUA-600ML'`,
   `'SERV-EXPRESS'` en `src/services/mockData.ts`) y `reorder_level` son inventados, pidiendo
   revisión del equipo. Nada de eso está marcado con un comentario en el código mismo — quien
   lea solo el archivo, sin haber leído la bitácora, no tiene forma de saber que son
   aproximaciones pendientes de validar antes de que WEB-12 construya el catálogo real.
3. **`httpClient.ts` duplicado en `develop` (no en esta rama).** De paso, se encontró que
   `develop` tenía dos clientes HTTP (`http-client.ts` y `httpClient.ts`), violando la propia
   regla de nombres de `CLAUDE.md` ("no mezclar los dos [estilos] dentro del mismo
   directorio"). Este PR ya lo corrige (elimina `httpClient.ts`), es solo una nota para que no
   se pierda de vista por qué desaparece ese archivo en el diff.
4. **#13 WEB-01 sigue cerrado en GitHub** sin que su entregable exista en `develop`
   (ver sección 7). No se reabrió porque esta revisión no toca issues sin PR fusionado, pero
   el equipo debería saberlo: el estado en GitHub no refleja la realidad del repositorio.

## 5. Verificación mecánica

Todo corrido en un clon fresco de `feat/fase-0-cierre` con `core.autocrlf=false` y
`core.eol=lf`. **Nota importante:** un primer intento con el clonado por defecto de Windows
(`core.autocrlf=true`, sin `.gitattributes` en el repo) hizo fallar `format:check` en 149
archivos — es un artefacto del checkout (CRLF), no un defecto del PR: confirmado comparando
`git config core.autocrlf` (`true` global), la ausencia de `.gitattributes`, y re-clonando con
terminadores LF forzados, tras lo cual `format:check` pasa limpio. Vale la pena que el repo
agregue un `.gitattributes` con `* text=auto eol=lf` para que el equipo no tropiece con esto
en Windows.

| Paso | Resultado | Evidencia |
|---|---|---|
| `npm ci` | OK | exit 0 |
| `format:check` | ✅ PASS | "All matched files use Prettier code style!" (clon LF) |
| `typecheck` | ✅ PASS | `tsc --noEmit -p tsconfig.app.json`, sin salida, exit 0 |
| `lint` | ✅ PASS | `eslint .`, sin salida, exit 0 |
| `build` | ✅ PASS | `vite build`, 1628 módulos, built in 4.94s |
| `test` | ✅ PASS | **103/103**, 0 fallos, **7 suites** — coincide exactamente con lo que declara el PR |

Desglose de la suite (orden real de `npm run test`, `package.json:15`):
auth 14 · currency 11 · date 35 · money-contract 13 · contract 17 · services 7 ·
presentation 6 → 14+11+35+13+17+7+6 = **103**.

### Rutas (servidor `vite` local, verificadas en navegador)

| Ruta | Resultado |
|---|---|
| `/` | Landing pública "Hotel Aurora" renderiza correctamente |
| `/auth/login` | Formulario de login del personal renderiza |
| `/pms` sin sesión | Redirige a `/auth/login` (confirmado por URL tras navegar) |
| `/pms` con sesión (`recepcion@hotelboutique.test`) | Panel privado con nav por rol ("Panel operativo", "Recepción") |
| `/pms/no-existe` | 404 privado dentro del layout privado ("Volver al panel operativo") |
| `/no-existe-publica` | 404 público dentro del layout público ("Volver al inicio") |
| `/components` | Catálogo completo: Tarjetas, Indicadores, 3 Estados de pantalla (vacío/cargando/error con reintento), Tabla con orden y paginación sin recarga, primitivos de WEB-04 |

## 6. Los diez puntos de riesgo

**3.1 · Contrato de entidades — ✅ con una observación.** Sin archivos planos residuales:
`scripts/test-contract.mjs:32-43` es una prueba de regresión específica para esto y pasa. Se
confirmó además que el problema que esa prueba previene era real: en `develop` (antes de este
PR), `src/shared/types/entities/booking.ts` (plano) y `src/shared/types/entities/booking/`
(carpeta) coexistían — mismo patrón para `guest`, `payment`, `room`, `user`, más
`catalog.ts` duplicando `product`/`amenity`. Los servicios importan siempre desde la ruta de
su propia entidad, nunca del barrel (`grep` sobre `src/services/*.ts`, cero resultados de
`from '@/shared/types/entities'` salvo un ejemplo en un `README.md`). Ver la observación del
alias `XDto`/`XDTO` en la sección 4.

**3.2 · Montos — ✅ ninguna magnitud cambió.** Único archivo con valores de dinero
modificados: `src/services/mockData.ts` (`src/shared/mocks/lot-b.ts`, el dataset del Lote B,
no tiene diff contra `develop` — no se tocó).

| Registro | Campo antes (`develop`) | Valor antes | Campo después (PR) | Valor después |
|---|---|---|---|---|
| Tarifa suite jardín | `pricePerNightCents` (en `Room`) | 95000 | `price_cents` (en `Rate`) | 95000 |
| Tarifa deluxe | `pricePerNightCents` (en `Room`) | 78000 | `price_cents` (en `Rate`) | 78000 |
| Reserva PMS-0001 | `totalAmountCents` | 285000 | `total_amount_cents` | 285000 |
| Pago de la reserva | `amountCents` | 285000 | `amount_cents` | 285000 |
| Producto agua 600ml | `priceCents` | 1500 | `price_cents` | 1500 |
| Producto servicio express | `priceCents` | 7500 | `price_cents` | 7500 |

Los seis valores se preservan exactamente; solo cambió el nombre del campo (camelCase →
snake_case) y, en el caso de la tarifa, de qué entidad cuelga (`Room` → `Rate`, que es lo que
manda el contrato oficial). `scripts/test-money-contract.mjs` valida enteros y `currency ===
'GTQ'` sobre estos mismos datos y pasa.

**3.3 · Moneda — ✅, con el hallazgo de que el defecto era real.** `Currency` es el literal
`'GTQ'` (`src/shared/types/common.ts:3`). Cero residuales de `'USD'`/`'MXN'`/`'EUR'` en `src`.
Cero símbolos `'Q'` escritos a mano fuera de `currency.ts`. `formatCurrency(125000)` produce
`Q1,250.00` (verificado ejecutando el `Intl.NumberFormat` real de Node con la config del
archivo). **Se confirmó que en `develop`, antes del PR, `Currency` era
`'USD' | 'MXN' | 'EUR' | 'GTQ'`** (`git show develop:src/shared/types/common.ts`) — el defecto
que motivó cerrar #17 con "moneda incorrecta" es real, y su arreglo vive solo en esta rama.

**3.4 · Campos `_cents` — ✅.** `grep` sobre los 12 `.dto.ts` no encontró ningún campo
`price`/`amount`/`total`/`balance`/`cost` sin sufijo `_cents`. Los siete campos de dinero que
existen (`total_amount_cents`, `unit_price_cents`, `amount_cents` ×2, `price_cents` ×2) están
todos correctamente sufijados y tipados `number`.

**3.5 · Regla de oro — ✅.** Cero archivos fuera de `src/services/` importan de `shared/mocks`
o `services/mockData` (verificado con `grep` y con la prueba estática de
`scripts/test-services.mjs:12-42`, que pasa). `simulateLatency` (`src/services/mockUtils.ts:3`)
usa 300-600 ms por defecto. Hay dos formas documentadas de forzar un error: parámetro de URL
`?mockError=true` y `localStorage.PMS_FORCE_MOCK_ERROR` (`mockUtils.ts:10-20`).

**3.6 · Borrado de Bolt — ✅.** Confirmado el borrado de `App.tsx`, `AdminContent.tsx`,
`GuestContent.tsx`, `GuestModals.tsx`, `ReceptionContent.tsx`, `ReceptionModals.tsx`,
`ReservationDetail.tsx`, `RoomServiceContent.tsx` y los archivos planos de entidades — 6312
líneas borradas en total en el diff (magnitud consistente con las ~5.550 que declara el PR;
la diferencia es el resto de la limpieza, no solo Bolt). Sin referencias colgando: build,
typecheck y lint pasan limpio, y las rutas visitadas en el paso 2.4 renderizan sin errores de
consola.

**3.7 · Sin duplicados — ✅.** Solo existen `src/shared/components/DataTable.tsx` y
`Pagination.tsx` en todo el árbol. La tabla del catálogo (`/components`) ordena columnas y
pagina sin recargar, confirmado visualmente.

**3.8 · Datos aproximados — ⚠️ documentados pero no marcados en el código.** Ver el hallazgo
detallado en la sección 4, observación 2.

**3.9 · Separación `session/` vs `user/` — ✅ coherente y necesaria, no era un simple rename.**
`src/modules/auth/README.md` documenta explícitamente por qué existen separados y advierte "no
usar `shared/types/entities/user/`" para sesión. Nada la importa todavía (`grep` sobre
`from '@/shared/types/entities/user'`, cero resultados) — consistente con que WEB-12 (el
directorio de personal) todavía no se construye. Se confirmó además que la separación **no**
era cosmética: en `develop`, `src/services/authService.ts` importaba `User`/`UserDTO` del
barrel general para modelar la sesión —la confusión exacta que `CLAUDE.md` prohíbe—; el PR es
lo que introduce `session/` y corta esa dependencia (`authService.ts`, `authMockData.ts`).
Este arreglo tampoco está en `develop` todavía.

**3.10 · `index.css` — ✅ decisión documentada, no un defecto.** Sigue en 7.937 líneas, sin
tocar por este PR. `PROGRESO-FASE-0.md` (líneas 58, 75-86, 280-287 en la rama del PR) explica
la decisión ("Opción A", resuelta por el usuario), por qué separar la hoja es trabajo de
análisis y no una poda simple, y que el equipo abrirá un ticket aparte.

## 7. Ticket por ticket

Números verificados con `gh issue list` — todos coinciden con los que dio la tarea.

| # | Ticket | Veredicto | ¿Dónde vive el código? | Qué falta (si aplica) |
|---|---|---|---|---|
| #13 | WEB-01 · Estructura y convenciones | ❌ sin evidencia en `develop` | Solo en la rama del PR | `CLAUDE.md` no existe en `develop` (`git show develop:CLAUDE.md` falla; sí existe en `feat/fase-0-cierre`, añadido en el commit `18d3278`). Además, `npm run check` **falla hoy en `develop`**: `format:check` reporta 3 archivos reales con problemas de formato (`.codex/CONTEXT.md`, `PROJECT_STATUS.md`, `src/shared/README.md`) en un clon con terminadores LF — no es el artefacto de CRLF de la sección 5. Cerrado el 2026-09-06 sin que ninguno de los dos existiera todavía. |
| #14 | WEB-02 · Routing y layouts | ✅ cumple | **Ya en `develop`** antes del PR | — |
| #15 | WEB-03 · Sistema de diseño | ✅ cumple | **Ya en `develop`** antes del PR (`tokens.css` con 416 líneas; el PR solo añade 54 más para WEB-13) | — |
| #16 | WEB-04 · Primitivos de formulario | ✅ cumple | **Ya en `develop`** antes del PR (`Button/Input/Select/Modal/DatePickerRange.tsx`, el PR no los toca en absoluto) | — |
| #17 | WEB-05 · Capa de servicios | ⚠️ cumple en parte | Estructura de servicios (async, latencia, mapeo a Model, mecanismo de error) **ya en `develop`**; pero los datos que esos servicios sirven dependían de un `Currency` inseguro (`'USD'\|'MXN'\|'EUR'\|'GTQ'`) y de una sesión modelada como `User` — ambos arreglados **solo en esta rama** | El cierre de `Currency` a `'GTQ'` y la separación `session/user` (secciones 3.3 y 3.9) tienen que llegar a `develop` para que el "moneda incorrecta" que motivó reabrir esta issue quede realmente resuelto |
| #18 | WEB-06 · Auth y guardas de ruta | ✅ cumple | **Ya en `develop`** antes del PR (`RequireSession`, `RequirePermission`, `StaffLoginPage`, `AuthProvider`); el PR solo realinea tipos de sesión | — |
| #19 | WEB-07 · Formato moneda y fecha | ✅ cumple | **Ya en `develop`** antes del PR (`currency.ts`, `date.ts` sin diff funcional; el PR solo retira monedas no usadas de la tabla de locales) | — |
| #20 | WEB-08 · Prototipo UI/UX | ⚠️ no verificable por código | N/A | Es un entregable de diseño (Figma/paleta), fuera del alcance de esta auditoría de código. No se puede confirmar ni negar con las herramientas de esta revisión. |
| #21 | WEB-09 · Contrato de datos | ❌ sin evidencia en `develop` | Solo en la rama del PR | Confirmado que en `develop`, antes del PR, coexistían el archivo plano y la carpeta oficial para `booking`/`guest`/`payment`/`room`/`user`, y `catalog.ts` duplicaba `product`/`amenity` — el contrato "congelado" nunca estuvo realmente unificado en `develop`. Además, los dos criterios sin marcar en la checklist ("contrastar con MOV-04", "revisar con los cuatro integrantes") son de proceso, no de código: ningún PR los puede cerrar por sí solo. |
| #22 | WEB-10 · Datos mock Lote B | ✅ cumple | **Ya en `develop`** antes del PR (`shared/mocks/lot-b.ts`, sin diff) | — |
| #23 | WEB-11 · Datos mock Lote C | ❌ sin evidencia | No existe en ninguna rama | Sigue abierta, checklist sin marcar. No se encontró `lot-c.ts` ni datos de cuentas/pagos/caja en ningún lado del repo. |
| #24 | WEB-12 · Datos mock Lote D | ❌ sin evidencia | No existe en ninguna rama | Sigue abierta, checklist sin marcar. No se encontró `lot-d.ts` ni catálogos/inventario en ningún lado del repo. |
| #25 | WEB-13 · Primitivos de presentación | ⚠️ cumple en la rama del PR, no en `develop` | **Solo en la rama del PR** — `src/modules/ui-catalog/` y la ruta `/components` no existen en `develop` | Los cinco criterios se verificaron visualmente en el navegador (sección 5) y parecen cumplidos, pero la issue sigue abierta en GitHub y su código no está integrado — no se puede cerrar bajo la regla 4 de esta auditoría aunque el trabajo se vea completo. |

Datos verificados de #22: 15 habitaciones, 5 tipos de habitación, 12 huéspedes, 20 reservas
(con las 6 combinaciones de estado: `pending` ×4, `confirmed` ×7, `checked_in` ×1,
`checked_out` ×4, `cancelled` ×2, `no_show` ×2), 3 promociones — todo en
`src/shared/mocks/lot-b.ts`, sin cambios de este PR.

### Padres

- **#9 (Base compartida):** sigue abierto correctamente — #13 y #17 (parcial) no cumplen en
  `develop`, y #25 tampoco está integrado.
- **#12 (Definición compartida):** sigue abierto correctamente — #21, #23 y #24 no cumplen.

Ningún padre se tocó (ninguna sub-issue se cerró en esta revisión).

## 8. Qué falta para dar la Fase 0 por cerrada

1. **Fusionar el PR #32** — es el paso que resuelve #13, la mitad de #17 y da a #21 y #25 su
   base de código en `develop`. Mecánicamente ya está listo (sección 5).
2. **WEB-09 (#21) necesita algo que ningún PR resuelve solo:** la revisión de los cuatro
   integrantes del frontend web y el contraste con MOV-04 de la app móvil. Son los dos ítems
   sin marcar de su checklist.
3. **WEB-11 (#23) y WEB-12 (#24)** siguen sin ningún dato — son trabajo pendiente real, no
   solo de proceso.
4. **WEB-08 (#20)** no se pudo verificar con las herramientas de esta auditoría; alguien del
   equipo con acceso al prototipo tendría que confirmarlo aparte.
5. Antes de fusionar, vale la pena que alguien revise las dos observaciones no bloqueantes de
   la sección 4 (el alias `XDto`/`XDTO` y las aproximaciones de `Product`/`Amenity` sin marcar
   en el código), aunque ninguna impide fusionar.

## Lo que no se pudo verificar

- **WEB-08 (#20):** entregable de diseño fuera del alcance de una auditoría de código.
- **Contenido visual exacto de las 5.550 líneas eliminadas de Bolt:** por instrucción de la
  tarea, no se revisaron línea por línea; la evidencia usada fue build + pruebas + revisión
  visual de las rutas, como se pidió.
- **Revisión de los cuatro integrantes y contraste con MOV-04 (criterio 4 de WEB-09):** es un
  criterio de proceso humano, no verificable con herramientas de código.
