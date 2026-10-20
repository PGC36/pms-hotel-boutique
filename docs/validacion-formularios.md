# Validación de inputs y formularios

Fecha: 2026-10-19 · Rama: `fix/reception-summary`

## Contexto

Revisión integral de los formularios del frontend después de las subfases ya
aprobadas de Recepción (Resumen, Nueva reserva, Editar reserva y
Disponibilidad). Solo se tocaron campos y validaciones de interfaz: ningún
contrato de API, servicio ni regla de negocio nueva.

## Decisiones

- **Utilidad genérica** `src/shared/utils/formValidation.ts`: textos
  obligatorios, montos (`isMoneyInput`, `validateMoneyAmount`,
  `moneyInputToCents`), enteros (`isWholeNumberInput`, `validateWholeNumber`),
  rangos de fechas (`validateDateRange`) y atributos ARIA (`fieldErrorProps`).
  No define límites de negocio: cada formulario pasa los suyos.
- **Nombres, teléfonos, correos, fechas de estancia y huéspedes** reutilizan las
  reglas aprobadas de `modules/front-desk/utils/reservationFormValidation.ts`
  (sin modificarla) cuando el contexto es equivalente.
- **Límites**: solo los que ya existen en el backend (`@Size`, `@Min`, `@Max`,
  `@Positive`, CHECK de base de datos). Cuando el backend no define límite, no
  se inventa uno.
- **Montos**: texto con teclado decimal, dígitos y hasta 2 decimales; se
  convierten a centavos sin coma flotante. Sin máximo de negocio; solo se
  rechaza lo que no cabe en un entero seguro.
- **Cantidades enteras**: texto con teclado numérico (`type="number"` admite
  `e`, `-` y decimales); vacío nunca se convierte en 0 o 1 en silencio.
- **Datos guardados**: en formularios de edición, un valor histórico que hoy no
  cumpliría las reglas se conserva si no se toca (mismo criterio que Editar
  reserva).
- **Envío**: un solo envío a la vez en los modales asíncronos; el error del
  backend se muestra dentro del modal, que sigue abierto.

## Excluido

- Pago público de demostración (tarjeta): sin cambios.
- Componentes sin uso en el router (`VisitorScreen`, `AuthModal` de
  `PrivateWorkspace`; `ModifyReservationModal`, `CancelReservationModal`,
  `LinkReservationModal`, `EditProfileModal` del portal; `GuestAccessScreen`).
- Paneles simulados de cuenta (`AccountPanels`): no guardan datos.
