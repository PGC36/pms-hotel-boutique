# Cierre de la Fase 0 — auditoría contra `develop`

**Fecha:** 2026-09-10 · **Commit verificado:** `origin/develop` @ `c5ee429`
(merge de PR #34, que a su vez sigue al merge de PR #33 @ `e2ca9d6`).
**Método:** clon en worktree separado (`../pms-check-develop`), `npm run check`
completo, lectura de código, y una revisión visual en vivo (`npm run dev` +
Chrome headless) de las rutas públicas y privadas. No se modificó código, no
se hicieron commits ni push, no se fusionó ningún PR — solo se comentó,
marcó checklists y cerró/mantuvo issues según la evidencia.

## 1. Resultado de `npm run check`

Verde de punta a punta en un worktree limpio de `origin/develop`:

| Paso | Resultado |
| --- | --- |
| `format:check` | ✅ "All matched files use Prettier code style!" |
| `typecheck` | ✅ sin salida (0 errores) |
| `lint` | ✅ sin salida (0 errores) |
| `build` | ✅ `vite build`, 1628 módulos, sin errores |
| `test` | ✅ **160 pruebas, 9 suites, 0 fallos** |

Desglose de `test`: auth 14 · currency 11 · date 35 · money-contract 13 ·
contract 20 · shared-contract 23 · referential-integrity 31 · services 7 ·
presentation 6.

## 2. Tabla ticket por ticket

| # | Ticket | Veredicto | Evidencia (ruta) | Acción tomada |
| --- | --- | --- | --- | --- |
| 13 | WEB-01 | ✅ cumple todo | `CLAUDE.md`, `README.md`, `tsconfig.app.json:19`, `vite.config.ts` (alias), `eslint.config.js`, `.prettierrc.json`, estructura `src/{public,private,layouts,pages,modules,shared,services,assets,styles}/` | Comentario con evidencia; marqué las 6 tareas del checklist (estaban sin marcar pese a estar cerrada); ya estaba cerrada |
| 14 | WEB-02 | ✅ cumple todo | `src/app/router.tsx` (solo usa `routePaths.*`), `src/public/pages/PublicNotFoundPage.tsx`, `src/private/pages/PrivateNotFoundPage.tsx`, `test-auth.mjs` | Comentario con evidencia; ya estaba cerrada |
| 15 | WEB-03 | ✅ cumple todo | `src/styles/tokens.css` (470 líneas, 440 tokens), `src/styles/README.md` | Comentario con evidencia; ya estaba cerrada |
| 16 | WEB-04 | ✅ cumple todo | `src/shared/components/{Button,Input,Select,Modal,DatePickerRange}.tsx` | Comentario con evidencia; ya estaba cerrada |
| 17 | WEB-05 | ✅ cumple todo | `src/shared/types/common.ts:3` (`Currency='GTQ'`), DTOs `_cents`, `src/services/*Service.ts` (async/latencia/Models), `test-services.mjs` | Comentario con evidencia (atención especial: confirmado que ya no queda ningún `'USD'`); ya estaba cerrada |
| 18 | WEB-06 | ✅ cumple todo | `src/private/guards/{RequireSession,RequirePermission}.tsx`, `src/public/pages/StaffLoginPage.tsx`, `test-auth.mjs` (14/14) | Comentario con evidencia; ya estaba cerrada |
| 19 | WEB-07 | ✅ cumple todo | `src/shared/utils/currency.ts:24`, `src/shared/utils/date.ts:42,51,71,83` | Comentario con evidencia; ya estaba cerrada |
| 20 | WEB-08 | N/A — no verificable desde el repositorio (entregable de Figma/prototipo) | — | Sin acción — no se cierra ni se abre; decisión de una persona |
| 21 | WEB-09 | ⚠️ cumple en parte | Código: 14 entidades DTO→Mapper→Model, `test-contract.mjs` (20/20). **Falta:** sin comentario ni constancia de revisión de los 4 integrantes ni de contraste explícito con MOV-04 en la issue ni en PR #32/#33 | Comentario explicando qué falta; **no marqué los 2 checklist restantes; no cerré ni reabrí** (ya estaba cerrada de antes) |
| 22 | WEB-10 | ✅ cumple todo | `src/shared/mocks/lot-b.ts`: 15 rooms, 5 roomTypes, 12 guests, 20 bookings (6 estados), 10 rates, 3 promotions; `test-referential-integrity.mjs` (31/31) | Comentario con evidencia (con nota sobre la lectura del criterio de fechas — ver sección 5); ya estaba cerrada |
| 23 | WEB-11 | ❌ sin evidencia | No existe `lot-c.ts` ni dataset de cuentas/pagos/caja en ningún lado de `src/` | Comentario explicando la ausencia; **queda abierta** |
| 24 | WEB-12 | ❌ sin evidencia | No existe `lot-d.ts` ni catálogo de usuarios/roles/amenidades con horario/inventario | Comentario explicando la ausencia; **queda abierta** |
| 25 | WEB-13 | ✅ cumple todo | `src/public/pages/ComponentsCatalogPage.tsx`, `src/shared/components/DataTable.tsx` (única tabla), `test-presentation.mjs` (6/6), revisión visual en vivo de `/components` | Comentario con evidencia completa; **cerrada**; Status → Hecho en el project |

## 3. Qué cerré y qué dejé abierto

**Cerré:**
- **#25 (WEB-13)** — era el único ticket ✅ que seguía abierto con código completo ya fusionado. Evidencia completa en la sección 2; Status del project puesto en "Hecho".
- **#9 (padre, Base compartida)** — sus 8 sub-issues (#13, #14, #15, #16, #17, #18, #19, #25) quedaron todas cerradas tras cerrar #25.

**Comenté pero no toqué el estado (ya estaban cerradas, con evidencia ahora confirmada):** #13, #14, #15, #16, #17, #18, #19, #22.

**Dejé abiertas, con motivo comentado en la issue:**
- **#23 (WEB-11)** — sin ningún dato mock de cuentas/pagos/caja.
- **#24 (WEB-12)** — sin ningún catálogo de usuarios/roles/amenidades/inventario.
- **#12 (padre, Definición compartida)** — bloqueado por #23 y #24 abiertas.

**No toqué (no aplica cerrar/abrir):**
- **#20 (WEB-08)** — ya cerrada, entregable de Figma no verificable desde el repositorio.

**Caso especial — #21 (WEB-09):** ya estaba **cerrada** antes de esta auditoría. El código cumple los criterios técnicos, pero **no encontré ninguna constancia** (ni en la issue, ni en comentarios de PR #32/#33) de los dos criterios de proceso humano: revisión por los cuatro integrantes del frontend web, y contraste explícito con MOV-04 de la app móvil. Siguiendo la regla "ante la duda, no cierres" y la instrucción específica para este ticket, **no marqué esos dos ítems del checklist y no cambié su estado** (ni cerrarla de nuevo — ya lo estaba — ni reabrirla: reabrir una issue cerrada no estaba entre las acciones que se me pidió tomar). Lo dejo comentado como hallazgo para que el equipo decida si agrega la constancia faltante o lo deja así a sabiendas.

## 4. Estado de los padres

| Padre | Estado final | Motivo |
| --- | --- | --- |
| **#9** — Base compartida | **CERRADO** (por esta auditoría) | Las 8 sub-issues (#13–#19, #25) están cerradas |
| **#12** — Definición compartida | **CERRADO** (ver adenda 7bis) | Las 5 sub-issues (#20–#24) están cerradas |

## 5. Estado corregido de la Fase 0

La Fase 0 está cerrada. Esta sección se escribió originalmente antes de la
adenda 7bis, cuando #23 (WEB-11) y #24 (WEB-12) todavía no tenían evidencia en
`develop`; la adenda posterior verificó el PR #36, cerró #23/#24 y cerró el
padre #12. Se conserva el contexto original solo como historial de auditoría.

Notas que siguen siendo útiles, pero ya no bloquean el cierre:

1. **#21 (WEB-09):** el código cumple; la observación era de constancia humana
   de revisión/contraste con MOV-04.
2. **#20 (WEB-08):** entregable de diseño externo al repositorio; no bloquea
   nada técnico después de WEB-03.
3. **#22 (WEB-10):** el criterio de fechas se interpreta como presentación
   (`dd-mm-aaaa`), mientras los DTOs/datasets usan ISO 8601 según contrato.

## 6. Deuda técnica que sigo viendo

- **Alias `XDto = XDTO` sin limpiar.** 12 de las 14 entidades (`amenity`, `booking`, `charge`, `guest`, `order`, `payment`, `product`, `rate`, `room`, `room-feature`, `service-request`, `user`) definen `XDTO` (mayúsculas) y lo alían a `XDto` (minúsculas) que es lo que todo el código real usa — el nombre en mayúsculas no tiene ningún consumidor. No es un bug funcional, pero no es "una sola definición por entidad" en sentido estricto; `test-contract.mjs` no lo detecta porque solo vigila que no reaparezca un archivo plano.
- **`src/index.css` sin separar.** Sigue en 7.937 líneas, mezclando estilos base en uso real con reglas del árbol muerto de Bolt ya eliminado. Documentado como pendiente en `src/ARCHITECTURE.md`, sin ticket propio todavía.
- **Conviven dos sistemas de estilos.** Tailwind (`@tailwind base/components/utilities` en `src/index.css`, `tailwind.config.js` mapeado a las variables de `tokens.css`) y CSS por componente escrito a mano (`Button.css`, `Modal.css`, `DatePickerRange.css`, etc.) que consume directamente las custom properties de `tokens.css`. Funciona porque ambos apuntan a la misma fuente de tokens, pero es dos formas de llegar al mismo lugar — vale la pena que el equipo decida cuál es la convención hacia adelante antes de que el Lote B/C/D construya más pantallas.
- **`main` con un solo commit.** `git log --oneline origin/main` muestra únicamente el "Initial commit" (`4a01295`). Todo el trabajo de la Fase 0 vive en `develop`, consistente con la nota de `CLAUDE.md`/`README.md` ("el trabajo vive en `develop`, no en `main`"), pero significa que `main` no refleja el estado real del proyecto — si alguien clona desde `main` por defecto, no encuentra nada de esto.

## 7bis. Adenda — reverificación de #23/#24 tras el PR #36

**Fecha:** 2026-09-10 (misma tarde) · **Commit verificado:** `origin/develop`
@ `d179209` (merge del PR #36, fusionado después de escrita la sección 1-7 de
este documento). **Método:** mismo que el resto del documento — worktree
separado y limpio de `origin/develop`, `npm run check` completo, lectura de
código. No se modificó código, no se hicieron commits ni push al código.

El PR #36 agregó exactamente lo que la sección 2 señalaba como ausente para
#23 y #24: `src/shared/mocks/lot-c.ts` (437 líneas: `guestAccounts`,
`charges`, `payments`, `deposits`, `cashSessions`, `cashMovements`) y
`src/shared/mocks/lot-d.ts` (1163 líneas: usuarios, roles, permisos,
amenidades con horario, productos, artículos e inventario, auditoría), cada
uno con su servicio dedicado (`guestAccountService`, `cashService`,
`personnelService`, `inventoryService`, `auditService`, más
`catalogService` redirigido) y documentados en
`docs/CONTRATO-DATOS.md` (secciones 3.10b/3.10c).

`npm run check` completo en el worktree de `origin/develop` @ `d179209`:
verde de punta a punta — 11 suites, 0 fallos (formato, typecheck, lint,
build y test).

**Acción tomada, revirtiendo lo dicho en la sección 3 para estos dos
tickets:**

| # | Ticket | Veredicto revisado | Acción tomada |
| --- | --- | --- | --- |
| 23 | WEB-11 | ✅ cumple todo | Comentario con evidencia nueva; **cerrada** |
| 24 | WEB-12 | ✅ cumple todo | Comentario con evidencia nueva; **cerrada** |
| 12 | (padre) Definición compartida | ✅ sus 5 sub-issues (#20-#24) cerradas | Comentario; **cerrada** (cumple su propio criterio de cierre) |

Con esto, de los puntos abiertos en la sección 5 de este documento solo
quedan pendientes el **#21 (constancia de revisión humana)** y el
**#20 (confirmación del prototipo de Figma)** — ninguno de los dos es un
faltante de código.

**Nota:** el commit `ebbd47f` (el más reciente en `feat/mocks-lotes-c-d` al
momento de esta adenda) agrega además un vínculo `product` ↔
`inventory_item` con cantidad y una unificación de taxonomía de categorías
— trabajo posterior al merge del PR #36, en la misma rama pero sin PR propio
todavía. No forma parte de los criterios de #23/#24 (ya cumplidos sin él) y
queda fuera del alcance de esta auditoría.

## 7. Lo que no pude verificar

- **#20 (WEB-08):** entregable de diseño (Figma/Bolt) fuera del alcance de una auditoría de código — ni lo confirmo ni lo niego.
- **Revisión humana de #21:** no puedo confirmar ni negar que la revisión de los cuatro integrantes o el contraste con MOV-04 ocurrieron *fuera* de GitHub (una llamada, un chat de equipo) — solo puedo decir que no hay constancia *en el repositorio ni en las issues/PRs*.
- **404 privada en vivo:** la revisión visual de `/pms/no-existe` requiere una sesión activa que no pude establecer sin interacción de formulario en el navegador headless usado; me apoyé en `test-auth.mjs` (prueba real con React Test Renderer, no una suposición) en su lugar.
