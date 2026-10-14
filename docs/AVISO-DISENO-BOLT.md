# Aviso: diseno Bolt y ownership de web publica

Fecha: 2026-09-12

Durante la revision visual de `develop` se detecto que algunas pantallas
mergeadas de la Ronda 1 estaban respetando la estructura de carpetas, pero no
el diseno heredado de Bolt.

La estructura actual es valida; el problema a cuidar es visual/CSS:

- No crear sistemas visuales paralelos al prototipo Bolt.
- Reutilizar `src/index.css`, `src/styles/tokens.css` y los patrones existentes
  (`visitor-*`, `reservation-*`, `rc-*`, `adm-*`, `.panel`, `.button`,
  `.content`, etc.).
- Si una pantalla necesita CSS propio, debe envolver patrones Bolt, no
  reemplazarlos.

## Web publica / booking engine

La zona publica del motor de reservas esta asociada a las issues:

- `#45` Ronda 1 - Motor de reservas
- `#46` SearchScreen
- `#47` RoomDetailScreen
- `#48` BookingFormScreen
- `#49` BookingConfirmationScreen

Antes de continuar con cambios visuales en esa zona, validar ownership en
GitHub para no pisar trabajo asignado.

Actualizacion 2026-09-16: los tabs publicos del header (`Habitaciones`,
`Amenidades`, `Promociones`, `Politicas`) funcionan como vistas conmutadas en
la home publica mediante hash (`/#amenidades`, etc.). No deben volver a quedar
como secciones apiladas ni links decorativos.

## Boton `Registrarse`

Actualizacion 2026-09-17: `Iniciar sesion` abre un modal flotante sobre la home
publica mediante `PublicAuthModal`; desde ese modal se puede cambiar a registro.
`/auth/login` y `/auth/register` se conservan como rutas directas/fallback. El
registro publico de huesped sigue en modo demo y no cambia el contrato de
autenticacion del PMS ni crea permisos de personal.

Actualizacion 2026-09-16: por solicitud directa de producto durante la
migracion visual, `Registrarse` apunta a `/auth/register` y muestra un
formulario publico de huesped en modo demo. Este formulario no cambia el
contrato de autenticacion del PMS ni crea permisos de personal.

El login general si esta definido: a diferencia del prototipo Bolt, que
separaba huesped/empleado, esta app usa un unico login y decide el acceso por
credenciales/permisos de sesion.

## Web privada / workspace Bolt

Desde 2026-09-16, las experiencias privadas completas migradas desde Bolt viven
en `src/private/workspace/` y los modulos de dominio (`front-desk`, `administration`, `guest-portal`, `room-service`). Esta carpeta no reemplaza el contrato de
login, permisos ni rutas: solo porta las pantallas privadas al lenguaje visual
Bolt dentro de la arquitectura actual.

El rol Pasarela de pago no se conserva como rol lateral. Perfil, Preferencias y
Cerrar sesion deben permanecer en el menu superior del usuario. Para acciones de
administracion, usar lapiz para editar y switch para activar/desactivar.
