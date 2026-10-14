# Ticket 4 — Exportaciones de reportes

Fecha: 2026-09-28

Se agregó `src/shared/utils/exportCsv.ts` para descargar CSV UTF-8 desde el
frontend. Recepción, Room Service, Conserjería, Dashboard, Reportes, Caja y
Auditoría exportan datos del estado o servicios actuales, respetan los
filtros activos donde aplica y muestran un aviso cuando no hay filas.

Revisión funcional 2026-09-28:

- Reportes aplica el periodo seleccionado antes de renderizar/exportar datos
  fechados: ingresos por fecha de movimiento, reservas por check-in y
  cancelaciones por fecha de actualización. Ocupación sigue mostrando el estado
  actual de habitaciones porque el contrato vigente no guarda histórico de
  ocupación por periodo.
- `Temporada` se interpreta temporalmente como el trimestre calendario actual
  hasta que exista un contrato de temporadas del hotel.
- Caja no tiene filtros propios en la pantalla actual; el export recibe
  explícitamente los movimientos visibles del bloque y las sesiones de caja en
  estado para incluir aperturas/cierres.
