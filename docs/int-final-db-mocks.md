# INT-FINAL — Retiro de `src/data/db.ts` y mocks productivos

Fecha: 2026-10-05.

## Inventario antes del retiro

No quedaban imports productivos a `src/data/db.ts` en pantallas, módulos ni
servicios. La dependencia viva estaba en scripts de prueba y documentación:

| Área | Uso encontrado | Resolución |
| --- | --- | --- |
| `scripts/test-contract.mjs` | Compilaba `src/data/db.ts` para validar montos de `ratesDB` y `bookingsDB`. | Se reemplazó por guardas de estructura; los montos viven en `test-money-contract.mjs`. |
| `scripts/test-money-contract.mjs` | Validaba `paymentsDB`, `ratesDB`, `bookingsDB` y `productsDB`. | Usa fixtures mínimos en `scripts/fixtures/domain-fixtures.mjs`. |
| `scripts/test-shared-contract.mjs` | Usaba todos los arrays `*DB` para mappers, estados y fechas. | Usa fixtures de contrato por entidad. |
| `scripts/test-referential-integrity.mjs` | Validaba FKs del dataset consolidado. | Valida FKs de fixtures mínimos. |
| `scripts/test-room-status.mjs` | Validaba habitaciones desde `roomsDB`. | Usa fixtures de habitaciones. |
| `scripts/test-lot-c-d.mjs` | Recalculaba cuentas, caja, inventario y horarios sobre `db.ts`. | Usa fixtures mínimos y mantiene las reglas aritméticas. |
| `scripts/test-services.mjs` | Exportaba `roomsDB` para dos pruebas legacy. | Usa el fake backend del propio test. |
| Documentación viva | Describía `db.ts` como base simulada o checklist sin contrato. | Actualizada para backend real y fixtures de prueba. |

## Decisión

`src/data/db.ts` queda eliminado. Ninguna pantalla productiva lee o escribe
datos de dominio desde archivos locales. Las pruebas que necesitan datos de
contrato usan fixtures bajo `scripts/fixtures/`, fuera del bundle productivo.

Los checklists de Limpieza se conectan al contrato backend real asociado a
`ServiceRequest` de tipo housekeeping:

- `GET /housekeeping/checklists`.
- `POST /housekeeping/checklists`.
- `PUT /housekeeping/checklists/{id}`.

Para crear, el payload incluye `serviceRequestId`, `observations?` e
`items: [{ label, checked }]`. El frontend mapea `checked` a `done` dentro de
`housekeepingService` para conservar la UI existente. Cuando una solicitud
stayover se completa, la UI crea o actualiza los items, completa la solicitud
real y luego envía `status: "completed"` por `PUT /housekeeping/checklists/{id}`.
No existe endpoint para guardar checklists de turnover por `roomId`; esos
controles quedan como apoyo visual y no se asocian a checklists reales aunque
compartan habitación con un stayover.

## Almacenamiento local

El almacenamiento del navegador queda limitado a sesión/autenticación y avisos
mínimos:

- `localStorage.PMS_AUTH_SESSION`: tokens y metadatos de sesión.
- `sessionStorage.PMS_GUEST_ACCESS_EXPIRED`: aviso temporal para huésped.

No se persisten reservas, huéspedes, habitaciones, folios, pagos, roles,
checklists ni datos operativos en `localStorage`.

## Guardas

`npm run test:e2e-integration` falla si reaparece `src/data/db.ts`, si algún
archivo lo importa, si se agrega un cliente HTTP paralelo fuera de
`src/services/http-client.ts`, o si servicios integrados vuelven a fallback
mock silencioso.
