# Aplicación Móvil para Empleados

Esta carpeta está reservada para la aplicación nativa en React Native. Su
objetivo es apoyar la operación diaria del hotel, no replicar toda la web.

## Alcance inicial

- Inicio de sesión por empleado.
- Tareas asignadas y cambio de estado.
- Consulta y actualización del estado de habitaciones.
- Solicitudes de huéspedes.
- Pedidos de Room Service.
- Notificaciones operativas.

## Fuera de alcance

La aplicación no debe incluir reportes, gestión de usuarios, roles, tarifas,
promociones, caja, auditoría ni configuración administrativa avanzada. Estas
funciones continúan en el frontend web.

## Estructura

```text
mobile/
  assets/
  src/
    app/             Configuración de la aplicación
    navigation/      Navegación entre pantallas
    features/        Funcionalidades por dominio y sus capas
    shared/          Componentes, servicios y tipos reutilizables
```

Cada funcionalidad dentro de `features/` usa esta estructura:

```text
<feature>/
  models/        Modelo de dominio usado por la app
  dtos/          Contratos de entrada y salida de datos
  mappers/       Conversión entre DTOs y modelos de dominio
  services/      Llamadas a API o datos simulados
  components/    Componentes propios de la funcionalidad
  screens/       Pantallas conectadas a la navegación
```

`navigation/` y `shared/` permanecen fuera de los módulos porque se usan en
toda la aplicación. `shared/` también incluye `constants`, `hooks` y `utils`.

Cuando se inicie el desarrollo, crear el proyecto con Expo dentro de esta
carpeta y conservar esta organización bajo `src/`.
