# Guía para el Siguiente Compañero

## Objetivo asignado

Iniciar la aplicación móvil nativa para empleados en la carpeta `mobile/`.
Usar React Native con Expo, TypeScript y una navegación sencilla por pestañas
o por menú, según resulte más clara para la operación.

## Primera entrega sugerida

1. Inicializar Expo dentro de `mobile/` sin tocar el frontend web.
2. Crear inicio de sesión simulado para un empleado.
3. Crear un inicio con tareas pendientes.
4. Implementar el flujo básico de una tarea: pendiente, en proceso y completada.
5. Agregar una pantalla de habitaciones para consultar y cambiar su estado.

## Módulos móviles

- `features/auth`: sesión del empleado.
- `features/tasks`: tareas de limpieza u operación.
- `features/rooms`: habitaciones y estado operativo.
- `features/requests`: solicitudes de huéspedes.
- `features/orders`: pedidos de Room Service.
- `navigation`: rutas y tabs de la aplicación.
- `shared`: componentes, servicios y tipos comunes.

En cada módulo, crear archivos dentro de `models`, `dtos`, `mappers`,
`services`, `components` y `screens`. Mantener la transformación de datos en
los mappers, no directamente en las pantallas.

## Reglas importantes

- La app móvil es solo para empleados, no para huéspedes ni administración completa.
- Reutilizar nombres de estados y modelos del frontend web cuando sea posible.
- Mantener datos simulados al inicio; no construir backend nuevo sin acuerdo del equipo.
- No mover, eliminar ni reescribir archivos del frontend web.
- Trabajar en una rama propia `feature/<nombre-del-modulo>`.

## Referencias del proyecto

- `README.md`: contexto general.
- `src/ARCHITECTURE.md`: estructura y reglas del frontend web.
- `src/styles/README.md`: contrato de tokens web de WEB-03; usar
  `src/styles/tokens.css` como punto unico para paleta, tipografia, espaciado,
  radios y colores por estado.
- `.codex/CONTEXT.md`: reglas de arquitectura y continuidad.
- `PROJECT_STATUS.md`: estado y deuda técnica registrada.
- `mobile/README.md`: alcance específico de la aplicación nativa.
