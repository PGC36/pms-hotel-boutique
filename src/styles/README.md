# Design Tokens

WEB-03 centraliza el sistema de diseno web en `src/styles/tokens.css`.
Ese archivo es el unico punto de entrada para paleta, estados, tipografia,
espaciado y radios. `src/index.css` lo importa antes de Tailwind para que los
tokens esten disponibles en toda la aplicacion.

## Fuente

Los valores vienen de WEB-08, que cerro la revision del prototipo Bolt
`sb1-8sal4vhj` y dejo paleta, tipografia, espaciado y radios concretos para
WEB-03.

## Paleta Base

| Uso                      | Token                       | Valor     |
| ------------------------ | --------------------------- | --------- |
| Brand / dorado principal | `--color-brand-gold`        | `#B88D50` |
| Dorado oscuro            | `--color-brand-gold-dark`   | `#9B713D` |
| Fondo general            | `--color-background`        | `#F7F4EF` |
| Superficie principal     | `--color-surface`           | `#FFFFFF` |
| Superficie secundaria    | `--color-surface-secondary` | `#FBF9F7` |
| Texto principal          | `--color-text-primary`      | `#2E211A` |
| Texto secundario         | `--color-text-secondary`    | `#49372E` |
| Texto tenue              | `--color-text-muted`        | `#92857B` |
| Bordes                   | `--color-border`            | `#EBE4DC` |
| Success                  | `--color-success`           | `#5E8A6C` |
| Info                     | `--color-info`              | `#5B7C99` |
| Warning                  | `--color-warning`           | `#C08A2E` |
| Error / Terracotta       | `--color-terracotta`        | `#A9483C` |

## Estados

| Estado de reserva | Token                            |
| ----------------- | -------------------------------- |
| Pendiente         | `--reservation-status-pending`   |
| Confirmada        | `--reservation-status-confirmed` |
| Check-in          | `--reservation-status-check-in`  |
| Check-out         | `--reservation-status-check-out` |
| Cancelada         | `--reservation-status-cancelled` |
| Anulada           | `--reservation-status-voided`    |

| Estado de habitacion | Token                       |
| -------------------- | --------------------------- |
| Disponible           | `--room-status-available`   |
| Ocupada              | `--room-status-occupied`    |
| Limpieza             | `--room-status-cleaning`    |
| Mantenimiento        | `--room-status-maintenance` |
| Bloqueada            | `--room-status-blocked`     |

## Tipografia

| Uso               | Token                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| Fuente principal  | `--font-family-sans`                                                                            |
| Fuente de titulos | `--font-family-heading`                                                                         |
| Pesos             | `--font-weight-regular`, `--font-weight-medium`, `--font-weight-semibold`, `--font-weight-bold` |
| Escala            | `--font-size-2xs` a `--font-size-hero`                                                          |
| Alturas de linea  | `--line-height-tight`, `--line-height-snug`, `--line-height-normal`, `--line-height-relaxed`    |

## Espaciado y Radios

La escala de espaciado de WEB-08 esta en `--space-1` a `--space-12`.
Los radios estan en `--radius-sm`, `--radius-md`, `--radius-lg`,
`--radius-xl`, `--radius-2xl`, `--radius-pill` y `--radius-round`.

Los tokens `--color-legacy-*`, `--font-size-legacy-*`, `--size-legacy-*` y
`--radius-legacy-*` existen para cubrir valores heredados del prototipo sin
cambiar visualmente la app mientras se completa la migracion por modulos.
