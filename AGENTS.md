# AGENTS.md

## Regla visual obligatoria

No crear pantallas, layouts, componentes visuales ni CSS que se salgan del
diseno establecido por el prototipo Bolt.

La fuente visual del proyecto es:

- `src/index.css`
- `src/styles/tokens.css`
- los patrones heredados de Bolt: `visitor-*`, `reservation-*`, `rc-*`,
  `adm-*`, `.panel`, `.button`, `.content`, `.brand`, `.visitor-header`,
  `.search-panel`, `.room-cards`, entre otros.

Antes de crear una clase nueva, revisar si ya existe una clase o patron Bolt
equivalente. Si hace falta una clase nueva, debe ser un wrapper pequeno sobre
el lenguaje visual existente, no un sistema paralelo.

## Zonas con propietario

No tocar la web publica / motor de reservas sin validar primero las issues de
GitHub correspondientes. Actualmente ese bloque esta bajo las tareas:

- `#45` Ronda 1 - Motor de reservas
- `#46` SearchScreen
- `#47` RoomDetailScreen
- `#48` BookingFormScreen
- `#49` BookingConfirmationScreen

Estas tareas pertenecen a la vertical `web-publica`.

## Estado actual de esta revision visual

En la revision del 2026-09-12 se detecto que el merge del booking publico
respetaba carpetas, pero no el diseno Bolt. Se hicieron ajustes locales para
marcar la direccion visual correcta y dejar trazabilidad:

- `src/layouts/PublicLayout.tsx`: se cambio el link suelto de login por un
  header publico estilo Bolt con marca, tabs y acciones.
- `src/modules/booking-engine/screens/SearchScreen.tsx`: se acerco la home a
  la composicion Bolt con hero, buscador horizontal y cards de habitaciones.
- `src/modules/booking-engine/screens/BookingFormScreen.tsx`: se ajusto el
  formulario para usar pasos/resumen/secciones mas cercanas al flujo de
  reserva Bolt.
- `src/modules/booking-engine/screens/booking-engine.css`: se agregaron
  wrappers visuales para reutilizar el lenguaje `visitor-*`, `search-panel`,
  `room-cards` y `reservation-*`.
- `src/modules/occupancy/screens/occupancy.css`: se alineo la pantalla privada
  de ocupacion/reserva manual al estilo backoffice Bolt.
- `src/ARCHITECTURE.md`, `docs/ronda-1-scaffold.md` y
  `docs/AVISO-DISENO-BOLT.md`: se documento que Bolt es el contrato visual.

Estos cambios no cierran las issues de `web-publica`. Si otro agente continua
esa zona, debe tomar estos ajustes como referencia visual, validar ownership en
GitHub y coordinar con la persona asignada antes de ampliar el alcance.

No rehacer desde cero estas pantallas ni reemplazar el CSS por otro sistema. Si
algo visual todavia no calza con Bolt, corregirlo incrementalmente sobre los
patrones ya existentes.

## Documentacion siempre al dia

Cada agente debe actualizar los `.md` relacionados cuando cambie codigo,
estructura, rutas, permisos, contrato visual, datos mock, servicios o decisiones
de arquitectura. No dejar documentacion desactualizada para "despues".

Antes de cerrar una tarea, revisar al menos estos archivos segun aplique:

- `AGENTS.md`: reglas para agentes y contexto operativo vigente.
- `src/ARCHITECTURE.md`: estructura, capas, contrato visual y reglas generales.
- `docs/ronda-1-scaffold.md`: cambios de Ronda 1, rutas, permisos y ownership.
- `docs/DECISIONES.md`: decisiones de arquitectura/modelado que no deben
  rediscutirse.
- `docs/AVISO-DISENO-BOLT.md`: avisos sobre diseno Bolt y ownership visual.
- `docs/AVISO-ROLES-PERMISOS.md`: roles finales de login, permisos y cuentas
  mock.
- README del modulo tocado, si existe (`src/modules/<modulo>/README.md`,
  `src/services/README.md`, `src/shared/README.md`, etc.).

Si el cambio contradice un `.md`, primero corregir el documento o registrar la
decision nueva. Si no hay documento apropiado, crear uno pequeno en `docs/` con
fecha, contexto, decision y alcance.

## Login y registro

El login es una excepcion funcional respecto a Bolt: Bolt separaba huesped y
empleado, pero este proyecto usa un login general y decide el acceso segun las
credenciales y permisos de sesion.

No implementar un flujo de registro nuevo desde el boton `Registrarse` sin una
issue explicita. Si se necesita registro de huesped, cuenta de cliente o portal
de huesped, crear/asignar la tarea antes de tocar UI o rutas.
