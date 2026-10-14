# Recursos Compartidos

`components/` aloja controles genéricos como botones, campos, modales, tablas,
badges y layouts. `constants/` contiene valores globales; `hooks/` hooks
reutilizables; `lib/` configuración de librerías; `types/` tipos que no
pertenecen a un solo módulo; y `utils/` funciones puras de utilidad.

Un archivo solo debe entrar en `shared/` cuando sea usado por dos o más zonas
o módulos. Si pertenece a una sola funcionalidad, debe permanecer dentro de
`src/modules/<modulo>/`.

Antes de crear un componente, revisar `src/index.css` para reutilizar las
variables, clases y patrones visuales del diseño original de Bolt.

## Moneda y fecha (WEB-07)

### Moneda

Todos los montos se almacenan como enteros en centavos, nunca como decimales.
Convención de nombre: sufijo `Cents` (`amountCents`, `priceCents`,
`pricePerNightCents`, `totalAmountCents`, `unitPriceCents`).

Ejemplos de conversión:

| Quetzales | Centavos almacenados |
| --------- | -------------------- |
| Q15.00    | `1500`               |
| Q950.00   | `95000`              |
| Q2,850.00 | `285000`             |

`formatCurrency(amountCents, currency = 'GTQ')` (`src/shared/utils/currency.ts`)
es la **única** función de formato de moneda autorizada. Para GTQ produce
exactamente `Q1,250.00` (símbolo, coma de miles, punto decimal, sin espacio
entre el símbolo y el monto). Ninguna pantalla debe formatear dinero por su
cuenta ni escribir el símbolo `Q` a mano.

Todo DTO que transporte dinero debe incluir `currency: Currency`, reutilizando
el tipo `Currency` ya existente en `src/shared/types/common.ts` — no crear un
tipo `Currency` alternativo.

### Reservas

`validateBookingCapacity()` (`src/shared/utils/bookingCapacity.ts`) concentra la
regla compartida de capacidad de reservas: `adults + children <= roomType.capacity`.
Los formularios la usan para feedback inmediato y `bookingService` la aplica
antes de crear o actualizar una reserva, de modo que ningun flujo pueda saltarla.
El check-in usa la misma regla para validar `booking-companion`: el titular
cuenta como adulto y los acompañantes deben completar exactamente la composición
`booking.adults/children` sin superar la capacidad del tipo de habitación.

### Fechas

Dos contratos distintos, según lo que representa el valor:

- **Fecha civil** (check-in, check-out, valid_from, valid_to): un día, sin
  hora ni zona.
  - DTO: `"YYYY-MM-DD"`.
  - Dominio: `Date` construido preservando la identidad del día calendario
    local (nunca desplazado por zona horaria).
  - Display: `dd-mm-aaaa`.
- **Timestamp** (created_at, updated_at, paid_at, charged_at): un instante
  real.
  - DTO/dominio: ISO 8601 completo.
  - Display de hora: `HH:mm` en 24 horas.

Funciones de presentación (`src/shared/utils/date.ts`):

- `formatDateGT(date)` → `dd-mm-aaaa`.
- `formatTimeGT(date)` → `HH:mm`, 24 horas.
- `formatStayRange(checkIn, checkOut)` → `"dd-mm-aaaa – dd-mm-aaaa"`.
- `calculateNights(checkIn, checkOut)` → número de noches por identidad de
  día calendario (nunca por diferencia cruda de milisegundos, para evitar
  errores de horario de verano/zona horaria).

Funciones de contrato/transporte (`src/shared/types/common.ts`), distintas de
las de presentación:

- `toDomainCalendarDate(value)` / `toDtoCalendarDate(date)`: para fecha civil
  (`"YYYY-MM-DD"` ↔ `Date`).
- `toDomainDate(value)` / `toDtoDate(date)`: para timestamp (ISO 8601 completo
  ↔ `Date`).

**Nunca usar `toISOString()` para serializar una fecha civil** — convierte a
UTC y puede desplazar el día según la zona horaria de ejecución.

### Migración de contratos activos

| Entidad | Campo legacy    | Campo actual         |
| ------- | --------------- | -------------------- |
| Payment | `amount`        | `amountCents`        |
| Room    | `pricePerNight` | `pricePerNightCents` |
| Booking | `pricePerNight` | `pricePerNightCents` |
| Booking | `totalAmount`   | `totalAmountCents`   |
| Product | `price`         | `priceCents`         |

Los cuatro contratos mantienen `currency: Currency` explícita. Este es un
cambio de contrato del **frontend** (tipos y datos simulados); no hay
evidencia de un backend real en este repositorio, así que no se documenta
como breaking change de API.

### Deuda técnica conocida

`src/app/App.tsx` y `src/components/` conservan su propio formato de moneda y
fecha (decimales, símbolo `$`, `toLocaleString` manual), independiente de las
utilidades de esta sección. La auditoría de WEB-07 confirmó que esta capa
está excluida de `tsconfig.app.json`, no es alcanzada desde `src/main.tsx` (el
punto de entrada real), y no aparece en el bundle de producción compilado. No
se modifica como parte de WEB-07.

### Pendiente — AC5 (mobile)

PENDIENTE DE VALIDACIÓN CONTRA MOBILE — el repositorio actual no contiene
implementación ni especificación de formato mobile suficiente para realizar
una comparación verificable.

Esto no es una falla detectada en la implementación web; es una limitación de
evidencia. `mobile/README.md` es la única fuente relacionada con la app móvil
en este repositorio y no define formato de moneda, fecha, hora, locale ni
representación en centavos.

Web actualmente define:

- Moneda GTQ → `Q1,250.00`.
- Fecha → `dd-mm-aaaa`.
- Hora → `HH:mm`, 24 horas.
- Dinero → enteros en centavos.

Acción futura: cuando exista implementación o especificación mobile,
verificar explícitamente que use estas mismas reglas, o resolver cualquier
diferencia mediante el contrato compartido que acuerde el equipo.

### Pruebas

| Script                            | Pruebas |
| --------------------------------- | ------- |
| `scripts/test-currency.mjs`       | 11      |
| `scripts/test-date.mjs`           | 35      |
| `scripts/test-money-contract.mjs` | 13      |
| **Total**                         | **59**  |

Además de estas pruebas, toda la superficie de WEB-07 pasa `npm run
typecheck`, `npm run lint` y `npm run build`.

## Presentación — WEB-13

Componentes disponibles en `shared/components/`:

| Componente   | API principal                                                                           |
| ------------ | --------------------------------------------------------------------------------------- |
| Card         | `title`, `description`, `children`, `footer`, `variant`: outlined / raised / muted      |
| Badge        | `children`, `tone`: neutral / info / success / warning / danger, `size`: small / medium |
| EmptyState   | `title`, `description`, `action` opcional                                               |
| LoadingState | `label`, `variant`: block / inline; anuncio mediante `role=status`                      |
| ErrorState   | `title`, `description`, `onRetry` obligatorio, síncrono o asíncrono                     |
| DataTable    | `columns`, `data`, `getRowId`, `caption`, `pageSize` (5 por defecto), `emptyMessage`    |
| Pagination   | `currentPage`, `totalPages`, `onPageChange`, `label` accesible                          |

La columna conserva `id`, `header` y `cell`; agregar `sortValue` habilita la
ordenación. Ordena todos los datos antes de paginar, sin mutar el arreglo
original. Los números se comparan numéricamente; el texto usa colación española
con orden natural. Los valores nulos quedan al final; los empates conservan su
orden original. Cambiar la ordenación vuelve a la primera página. Al reducir
datos se limita la página activa a un valor válido. `getRowId` recibe el índice
original; se recomienda devolver siempre un identificador estable del dominio.

`ErrorState` deshabilita el reintento mientras se resuelve, evita llamadas
duplicadas y muestra un mensaje si la promesa falla. El consumidor actualiza
los datos y cambia al estado de éxito. El catálogo `/components` incluye una
demostración con servicio asíncrono y recuperación de 13 registros.

### Tabla única

`TableFrame`, exportado desde `DataTable.tsx`, contiene el único elemento
`<table>` del código TSX; no introducir otro renderizador. Hasta el cierre de
la Fase 0, `AdminContent`/`ReceptionModals` (UI heredada de Bolt, nunca
alcanzada desde `src/main.tsx`) también lo usaban para su propia tabla; se
eliminaron junto con el resto de esa capa muerta — ver
`PROGRESO-FASE-0.md`, FASE 6.

### Tema y dependencias

`presentation.css` y `components-catalog.css` usan exclusivamente tokens
`--ui-*`, definidos en `src/styles/tokens.css` (no en un archivo aparte): cada
uno apunta a un token real de WEB-03 (`--color-*`, `--space-*`, `--font-size-*`,
`--radius-*`) cuando existe un equivalente, y los que no tienen equivalente
(anchos de layout, alto de control, foco, duración de motion, fondos con tinte
para Badge/alertas vía `color-mix()`) se definen una sola vez ahí mismo. Ya no
existe `presentation-tokens.css`.

El catálogo (`/components`) incorpora Button, Input, Select, Modal y
DatePickerRange de WEB-04 en sus variantes y estados; ya no usa controles
nativos `.ui-action` como sustituto.

### Verificación

Ejecutar `npm run test:presentation`. No sustituye una revisión visual en
navegador.
