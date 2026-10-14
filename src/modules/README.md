# Módulos de Dominio

Cada módulo contiene seis capas: `models`, `dtos`, `mappers`, `adapters`,
`services` y `components`. Los `mappers` concentran la conversión entre DTOs,
respuestas externas y modelos de dominio. Las carpetas ya están creadas para
los dominios del taller:

`auth`, `users`, `roles`, `guests`, `rooms`, `reservations`, `stays`, `billing`,
`payments`, `rates`, `promotions`, `amenities`, `housekeeping`, `room-service`,
`concierge`, `inventory`, `cash`, `reports`, `audit` y `notifications`.

No colocar lógica de negocio nueva en `src/app/App.tsx`. Extraerla hacia el
módulo correspondiente junto con su modelo y contrato de datos.

Las capas de navegación se separan de los módulos: `src/layouts/PublicLayout.tsx`
es el acceso público y `src/private/page.tsx` es el layout de la zona
autenticada.

Ronda 1 (WEB-round-1-scaffold) agrega cuatro módulos de pantalla sin las seis
capas completas — solo `screens/` y `components/`: `rooms`, `booking-engine`,
`occupancy` y `front-desk`. Ver `docs/ronda-1-scaffold.md`.

El módulo `occupancy` ya contiene las pantallas reales del Lote A:
`OccupancyScreen` (`#51`) cruza habitaciones y reservas por fecha, y
`ManualBookingScreen` (`#52`) crea reservas manuales usando los servicios
compartidos.
