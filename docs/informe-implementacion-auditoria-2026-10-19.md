# Informe — Implementación de decisiones aprobadas y auditoría de César Ramos (19-10-2026)

Sin commits, push, PR, merge, cambio de rama, reset, clean ni `stash pop`. Docker no se
tocó. Ninguna migración se ejecutó. No corrí pruebas `@SpringBootTest` contra la base
compartida ni modifiqué el formulario demostrativo de tarjeta.

- Frontend `pms-hotel-boutique`, rama `fix/reception-summary` @ `77f7750`.
- Backend `pms-hotel-boutique-backend`, rama `develop` @ `6c8108b`.

Estados que uso, tal como se pidieron:

| Estado | Significado |
|---|---|
| **Implementado y probado unitariamente** | Código hecho y cubierto por pruebas automáticas que pasan (Mockito en el backend, `node --test` con mocks en el frontend). |
| **Implementado, pendiente de integración** | Código hecho, pero falta correr pruebas Spring en una base aislada o probar contra el backend desplegado. |
| **Pendiente de decisión** | Necesita una regla de negocio, una autorización de migración o una decisión de diseño. No se implementó. |
| **Bloqueado por infraestructura o acceso** | Sin acceso al repositorio móvil, al VPS o a una base aislada. |
| **Verificado funcionalmente** | Probado a mano contra el sistema desplegado. **Ningún caso está en este estado**: no desplegué ni probé contra Docker. |

Agregué un sexto estado, **Sin defecto en el código actual**, para los casos que César
marcó pero que no se reproducen y no necesitan cambios. Sin él tendría que forzarlos en
una categoría incorrecta.

---

## 1. Qué se implementó en esta etapa

| Fase | Decisión | Resultado |
|---|---|---|
| 1 · A4 | Cargo automático de alojamiento | **Hecho (backend).** Al crear el folio por primera vez, `openFolio` registra **un** cargo `stay` por `booking.totalAmountCents`, en la misma transacción, con actor y auditoría. Solo lo hace quien inserta la cuenta (`ON CONFLICT DO NOTHING` → `inserted == 1`), así que reintentos y aperturas concurrentes no duplican. Además verifica que no exista ya un cargo `stay` contabilizado. El check-out ya exige saldo 0, por lo que no puede ignorar el alojamiento. **Sin cargo cuando el total es 0** (reserva sin tarifa): se conserva el comportamiento actual; ver la pregunta P1. No es retroactivo: los folios ya abiertos no reciben el cargo. |
| 2 · A6 | Temporada sobre la tarifa base | **No implementado: pendiente de decisión** (P2, P3). Requiere una migración (tipo de tarifa base/temporada) y cambiar la regla «una sola tarifa por estancia» (`booking.rate` es una FK única). |
| 3 · B3 | Roles personalizados | **Hecho (frontend).** El login acepta un rol con código propio y conserva su código real (`SessionUser.roleCode`). El panel se elige por sus permisos `navigation.<área>.*`: exactamente un área operativa → ese panel; ninguna, varias o un área de Administración/Huésped → rechazo explícito, nunca un panel por defecto. Los permisos de la sesión salen **solo** de sus permisos reales: no hereda los del rol predefinido. La cabecera muestra el código real. En Administración el usuario conserva y muestra su rol real, y editarlo ya no lo reasigna a Recepción. Los seis roles predefinidos no cambian. |
| 4 | Cancelación persistente | **Hecho (backend y frontend).** El backend audita la cancelación (actor, motivo, estado anterior). Se retiró el botón «Anular reserva», que solo cambiaba la pantalla; la ruta antigua ahora usa la cancelación persistente. «Cancelar» solo aparece en reservas pendientes o confirmadas. **Corregí un doble envío real:** dos clics seguidos en `ReasonModal` mandaban dos solicitudes. |
| 5 | Bloqueos de habitación | **Migración preparada, no incluida ni ejecutada** (`037-room-blocks.sql`). El código Java **no** se escribió: con `ddl-auto: validate`, una entidad sin su tabla impediría arrancar el backend a todo el equipo. Pendiente de autorización (P4). |
| 6 · B7 | No-show manual | **No implementado: pendiente de decisión** (P5). |
| 7 · B9 | Cierre de caja | **Hecho.** Backend: solo el dueño cierra su caja; Administración puede hacer un cierre excepcional con motivo obligatorio, que queda auditado con esperado, contado y diferencia; nadie más puede cerrar una caja ajena (403). Frontend: Administración › Caja lista las cajas abiertas de otros usuarios y permite el cierre excepcional con conteo físico y motivo. |
| 8 · B13 | Puntos obligatorios del checklist | **Migración preparada, no incluida ni ejecutada** (`038-checklist-required-items.sql`, `DEFAULT FALSE`: no bloquea ninguna tarea existente). La validación en el backend espera la decisión de qué puntos son obligatorios (P6). |
| 9 · B1 | Auditoría persistente | **Hecho, en `audit_logs`, sin migración nueva.** Componente `AuditTrail` (`Propagation.MANDATORY`): se escribe en la misma transacción que la operación, **solo si termina con éxito** (si la operación falla, el rollback también descarta el registro). Descarta claves sensibles (contraseñas, tokens, secretos, número de tarjeta, CVC). Cubre: cancelación, cierre de caja normal y excepcional, creación y anulación de cargos (incluido el automático), pagos, depósitos (crear, aplicar, devolver) y cambios de usuarios, roles y permisos. Faltan no-show y bloqueos porque esas funciones no existen todavía. |
| 10 · C2 | Latencia simulada | **No implementado: pendiente de decisión** (P7). Choca con la regla de CLAUDE.md que `test-services.mjs` verifica. |
| 11 · B4 | Sesión unificada | **Presento el mapa** (sección 4); no cambié código. Pendiente de decisión (P8). |
| 12 · B11 | Aplicar y devolver depósitos | **Hecho.** Backend: la devolución exige motivo (400 si falta). Aplicar y devolver solo funcionan sobre depósitos retenidos, una vez, con actor y auditoría. Frontend: botones en el folio para depósitos retenidos. Aplicar pide confirmación; devolver pide motivo. Ambos bloquean el doble clic. El saldo solo cambia después de la respuesta del backend y, si el backend rechaza, el modal sigue abierto con el error. No hay devoluciones parciales ni aplicación automática. |
| 13 | Validaciones de inputs | **Se conservan todas** (nombres Unicode, Nombre/Apellido separados, teléfono, correo, fechas de Guatemala, edad 0 en acompañantes, dinero, accesibilidad, doble envío). El formulario de tarjeta no se modificó. |

---

## 2. Matriz de los 41 casos

**Conteo corregido.** El informe anterior sumaba 13+3+11+9+4 = 40 porque A2 («parcial»)
quedó sin contar. Este es el conteo nuevo, sobre 41 IDs (A1–A9, B1–B20, C1–C12):

| Estado | Casos | Total |
|---|---|---|
| Implementado y probado unitariamente | A1, A2, A3, A5, A7, B2, B3, B8, B9, B10, B11, B17, C1, C9, C11 | 15 |
| Implementado, pendiente de integración | A4, A8, B1, B20 | 4 |
| Pendiente de decisión | A6, A9, B4, B6, B7, B13, B14, B18, B19, C2, C4, C5, C8 | 13 |
| Bloqueado por infraestructura o acceso | B5, C3, C7, C10, C12 | 5 |
| Sin defecto en el código actual | B12, B15, B16, C6 | 4 |
| Verificado funcionalmente | — | 0 |
| **Total** | | **41** |

Columnas: ID · Hallazgo · Causa raíz · Regla aprobada · Corrección implementada · Archivos · Pruebas · Resultado · Estado · Pendientes de integración · Validación manual.

| ID | Hallazgo | Causa raíz | Regla aprobada | Corrección implementada | Archivos | Pruebas | Resultado | Estado | Pendientes de integración | Validación manual |
|---|---|---|---|---|---|---|---|---|---|---|
| A1 | Folio sin abrir tras check-in | Ningún cliente llamaba a `/folio/open` | Abrir el folio al hacer check-in | El frontend abre el folio tras el check-in y antes de cargos o pagos (idempotente) | `PrivateWorkspace.tsx`, `CheckInScreen.tsx`, `guestAccountService.ts` | workspace «A2 · cargo…», «asigna habitación…» | ✔ | Implementado y probado unitariamente | Probar contra el backend desplegado | Check-in → la pestaña Folio muestra la cuenta abierta |
| A2 | Acciones de Recepción se pierden al recargar | Handlers solo locales | Persistir en el backend | Cargos, anulación de cargos, pagos, depósitos, check-out y **cancelación** persistentes; «Anular reserva» (local) retirado | `PrivateWorkspace.tsx`, `ReceptionModals.tsx`, `ReservationDetail.tsx` | «A2/A7/B10/B11», «Fase 4 ×3» | ✔ | Implementado y probado unitariamente | «Bloquear habitación» espera la migración 037 (P4) | Hacer cada acción, recargar y verificar que se conserva |
| A3 | Ocupantes en el check-in | Acompañantes y documento no se enviaban | Composición igual a adultos y menores declarados | Acompañantes, documento y nacionalidad persistentes, con validación | `ReceptionModals.tsx`, `CheckInScreen.tsx`, `guestService.ts` | «check-in (recepción)…» | ✔ | Implementado y probado unitariamente | Fecha de nacimiento y edad sin campo en el backend | Check-in con 2 adultos y 1 menor de edad 0 |
| A4 | El alojamiento nunca se carga | No existía el cargo `stay` automático | Cargo único al abrir el folio, calculado por el backend | `openFolio` crea el cargo `stay` por `totalAmountCents` solo cuando inserta la cuenta; protección contra duplicados; auditoría | `GuestFolioServiceImpl.java`, `GuestFolioService.java`, `GuestFolioController.java` | `GuestFolioServiceImplOpenTest` (6: apertura, reapertura, reintento concurrente, sin tarifa, cargo ya existente, reserva cancelada) | ✔ 6/6 | Implementado, pendiente de integración | Correr en una base aislada `GuestFolioControllerTest`, `PaymentDepositControllerTest` y `RoomServiceControllerTest`: abren folios de reservas con tarifa y ahora verán el cargo en el saldo (probablemente hay que ajustar sus aserciones). P1 (total 0) | Reserva de 3 noches → check-in → folio con «Alojamiento · 3 noches» y saldo igual al total; el check-out se rechaza hasta pagar |
| A5 | Creación de tarifas | Faltaba `minimumNights` | — | Se envía; el error se muestra | `AdminContent.tsx` | «tarifas de temporada…» | ✔ | Implementado y probado unitariamente | — | Crear tarifa base y de temporada |
| A6 | Temporada choca con la base | Una sola tarifa por tipo y vigencia; la base es abierta | La temporada reemplaza a la base en sus fechas | Ninguna | — | — | — | Pendiente de decisión | Migración del tipo de tarifa (P2, P3) | — |
| A7 | Método de pago y caja | Siempre `cash`; tarjeta ambigua | Métodos reales; efectivo exige caja abierta | Métodos reales y aviso de caja | `paymentMethods.ts`, `ReceptionModals.tsx`, `GuestAccountScreen.tsx` | «A7/B10 · pago…» | ✔ | Implementado y probado unitariamente | — | Efectivo con caja cerrada → mensaje en español |
| A8 | 409 al editar habitación | Se enviaba `housekeeping_status` | — | No se envía al editar | `RoomFormScreen.tsx` | — | — | Implementado, pendiente de integración | Sin prueba automática | Editar una habitación desde la pantalla clásica |
| A9 | Sin plantilla de limpieza → 500 | `IllegalStateException` sin manejador | — | Ninguna | — | — | — | Pendiente de decisión | ¿409 o 503? | — |
| B1 | Sin auditoría | Ningún servicio escribía `audit_logs` | Auditoría persistente, solo de éxitos, sin datos sensibles | `AuditTrail` + llamadas en caja, cancelación, folio, pagos, depósitos, usuarios y roles | `AuditTrail.java`, servicios `*ServiceImpl` | `CashSessionServiceImplTest` 7, `BookingServiceImplCancelTest` 4, `DepositServiceImplTest` 6, `GuestFolioServiceImplOpenTest` 6 | ✔ | Implementado, pendiente de integración | La auditoría de usuarios y roles solo compila; falta prueba Spring. No-show y bloqueos esperan sus funciones | Revisar Administración › Auditoría tras cada operación |
| B2 | Usuario desactivado conserva acceso | El filtro JWT no comprobaba `isEnabled()` | — | El filtro exige un usuario habilitado | `JwtAuthenticationFilter.java` | `JwtAuthenticationFilterTest` 2/2 | ✔ | Implementado y probado unitariamente | Desplegar el backend | Desactivar un usuario con sesión abierta → la siguiente petición da 401 |
| B3 | Rol personalizado | 6 roles fijos; fallback a `reception` | Código y permisos reales, sin fallback inseguro | Ver Fase 3 | `authService.ts`, `session-mapper.ts`, `session.*`, `user.*`, `personnelService.ts`, `AdminContent.tsx`, `PrivateSessionWorkspace.tsx` | auth «B3 ×4», services «B3 personnelService» | ✔ | Implementado y probado unitariamente | — | Crear el rol `QA_CESAR` con permisos de Recepción → login → panel Recepción con el código en la cabecera; editar ese usuario → el rol se conserva |
| B4 | Doble login | El login general prueba primero como huésped | Sesión unificada (Fase 11) | Solo el mapa (sección 4) | — | — | — | Pendiente de decisión | P8 | — |
| B5 | Renovación en la app móvil | Sin acceso | — | — | — | — | — | Bloqueado por infraestructura o acceso | — | — |
| B6 | Fechas pasadas y reservas sin tarifa | El backend no valida | — | Ninguna (el frontend sí valida) | — | — | — | Pendiente de decisión | Relacionado con P1 | — |
| B7 | No-show | No existe la transición | No-show manual desde Recepción | Ninguna | — | — | — | Pendiente de decisión | P5 | — |
| B8 | Transiciones de habitación | `PUT /rooms` ignoraba la ocupación | — | 409 si hay una reserva en check-in | `RoomServiceImpl.java`, `BookingRepository.java` | `RoomServiceImplTest` 9/9 | ✔ | Implementado y probado unitariamente | — | Cambiar el estado de una habitación ocupada → error |
| B9 | Cierre de caja ajena | Sin restricción | El dueño cierra la suya; Administración, excepcional con motivo | Backend (403 / 400 / auditoría) + UI de cierre excepcional | `CashSessionServiceImpl.java`, `CashSessionController.java`, `CashSessionRepository.java`, `CloseCashSessionRequest.java`, `cashService.ts`, `AdminContent.tsx` | `CashSessionServiceImplTest` 7/7, workspace «B9 · caja», services «B9» | ✔ | Implementado y probado unitariamente | `CashSessionControllerTest` (Spring, modificado) sin correr | Cajero A abre caja; Administración la cierra con conteo y motivo; el cajero B recibe 403 |
| B10 | Saldos y depósitos | Se restaban depósitos retenidos | El saldo es el del backend | Saldo igual al del backend | `PrivateWorkspace.tsx` | «A7/B10», «B11» | ✔ | Implementado y probado unitariamente | — | — |
| B11 | Aplicar y devolver depósito | Sin UI; devolución sin motivo | Motivo y actor; una sola vez | Backend con motivo y auditoría + botones en el folio | `DepositServiceImpl.java`, `DepositController.java`, `ReservationDetail.tsx`, `ReceptionContent.tsx`, `ReceptionModals.tsx`, `PrivateWorkspace.tsx` | `DepositServiceImplTest` 6/6, workspace «B11 ×3» | ✔ | Implementado y probado unitariamente | `PaymentDepositControllerTest` (Spring, modificado) sin correr | Depósito Q20 → aplicar → saldo −Q20; otro → devolver sin motivo (deshabilitado) → con motivo |
| B12 | Tarjeta en la reserva pública | El payload no incluye la tarjeta | No tocar la demo | — | — | — | — | Sin defecto en el código actual | ¿Retirar los campos? | — |
| B13 | Checklist incompleto se puede finalizar | El backend no lo exige | Puntos obligatorios validados en el backend | Solo la migración 038 preparada | `038-checklist-required-items.sql` | — | — | Pendiente de decisión | P6 + autorización de la migración | — |
| B14 | Estados y notificaciones de limpieza | Flujo incompleto | — | — | — | — | — | Pendiente de decisión | — | — |
| B15 | Conserjería | No reproducido | — | — | — | — | — | Sin defecto en el código actual | Cancelación móvil bloqueada | — |
| B16 | Room service y stock | «Sistema» = huésped no registrado | — | — | — | — | — | Sin defecto en el código actual | ¿Registrar al huésped como actor? | — |
| B17 | Duplicados y «Guardando…» | `useModalSave` no se reiniciaba | — | Corregido (etapa anterior) | `AdminContent.tsx` | — | ✔ | Implementado y probado unitariamente | Mensajes del backend en inglés | — |
| B18 | Rol y permisos no atómicos | Dos PUT separados | — | — | — | — | — | Pendiente de decisión | Cambio de API | — |
| B19 | Pantallas duplicadas | El router declara dos interfaces | — | — (router congelado) | — | — | — | Pendiente de decisión | — | — |
| B20 | Configuración de camas | Se sobrescribía al editar | — | No se envía al editar | `AdminContent.tsx` | — | — | Implementado, pendiente de integración | Al crear sigue sin campo propio | Editar un tipo de habitación |
| C1 | API sin pantalla | — | — | Ahora tienen UI: aplicar/devolver depósito, roles personalizados y cierre excepcional | ver B3, B9, B11 | ver B3, B9, B11 | ✔ | Implementado y probado unitariamente | Recibo en el panel | — |
| C2 | Latencia simulada en producción | `simulateLatency` siempre activo | Quitarla en producción | — | — | — | — | Pendiente de decisión | P7 | — |
| C3 | Móvil | Sin acceso | — | — | — | — | — | Bloqueado por infraestructura o acceso | — | — |
| C4 | Restablecer contraseña y eliminar recursos | Sin endpoints | — | — | — | — | — | Pendiente de decisión | — | — |
| C5 | Duración de sesión | El access token dura 30 min | No cambiar expiraciones | — | — | — | — | Pendiente de decisión | Lista de bloqueo | — |
| C6 | Auditoría desde todos los roles | (resuelto en `e6a8fdf`) | — | — | — | «auditoría…» ×3 | ✔ | Sin defecto en el código actual | — | — |
| C7 | IP real tras Cloudflare | Sin acceso al VPS | — | — | — | — | — | Bloqueado por infraestructura o acceso | — | — |
| C8 | Estados financieros y reembolsos | No se asignan | Sin reembolsos parciales | — | — | — | — | Pendiente de decisión | §20 de REGLAS-NEGOCIO | — |
| C9 | Moneda y paginación | Se mostraba `$` | — | GTQ | `ReservationDetail.tsx` y otros | — | ✔ | Implementado y probado unitariamente | Paginación (API) | — |
| C10 | Conserjería móvil | Sin acceso | — | — | — | — | — | Bloqueado por infraestructura o acceso | — | — |
| C11 | Checklist de salida | Nunca se creaba | — | Se crea y persiste | `PrivateWorkspace.tsx`, `housekeepingService.ts` | — | ✔ | Implementado y probado unitariamente | `completeCleaning` no exige el checklist (B13) | — |
| C12 | Catálogos según rol | Reglas propias en `SecurityConfig` | — | — | — | — | — | Bloqueado por infraestructura o acceso | Pruebas Spring en una base aislada | — |

---

## 3. Preguntas que necesito que respondas antes de seguir

- **P1 · A4/B6, reserva sin tarifa (total 0).** Hoy el folio se abre sin cargo. ¿Se mantiene así, se bloquea la apertura del folio (y el check-in) o se exige tarifa al crear la reserva?
- **P2 · A6, modelo de temporadas.** ¿Agrego un tipo `base` / `season` a `rates`, permito que una temporada se cruce con la base (pero no con otra temporada) y resuelvo el precio por noche? Requiere la migración 039 y cambiar `booking.rate` (FK única) por un total calculado noche a noche.
- **P3 · A6, estancias entre periodos.** Para una estancia que cruza base y temporada: ¿qué `minimumNights` se aplica (el de la temporada, el mayor o por tramo) y qué tarifa se guarda en `booking.rate`?
- **P4 · Fase 5, autorización de la migración 037.** Al incluirla en `db.changelog-master.yaml`, Liquibase crea `room_blocks` en el siguiente arranque contra la base compartida. ¿Autorizas incluirla y escribir la entidad, el servicio, el controlador (permiso `rooms.write`) y el efecto en la disponibilidad?
- **P5 · B7, no-show.** ¿Desde qué momento una reserva es elegible (día de llegada después de qué hora, o a partir del día siguiente)? ¿Qué pasa con sus pagos y depósitos retenidos? ¿Qué roles pueden marcarlo?
- **P6 · B13, puntos obligatorios.** ¿Qué puntos de cada plantilla son obligatorios? ¿Autorizas la migración 038?
- **P7 · C2, latencia.** CLAUDE.md exige la latencia simulada en los servicios y `test-services.mjs` la verifica. ¿Autorizas que se active solo en demo y pruebas (`import.meta.env.DEV` o una variable) y que se ajuste esa regla?
- **P8 · B4, sesión unificada.** Ver el mapa de la sección 4. ¿Prefieres (a) un selector explícito «Personal / Huésped» en el login general, o (b) un endpoint único en el backend que resuelva el tipo de cuenta?

---

## 4. Mapa actual de autenticación (Fase 11)

| Identidad | Endpoint | Token | Duración | Frontend |
|---|---|---|---|---|
| Personal (ADMIN, RECEPTION, HOUSEKEEPING, CONCIERGE, ROOM_SERVICE y roles personalizados) | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` | JWT `type: staff`, con `ROLE_<code>` y permisos; refresh token rotativo | Access 30 min (`JWT_ACCESS_EXPIRATION`), refresh 7 días; la sesión web se limita a 8 h | `authService.login` |
| Huésped con cuenta | `POST /guest/auth/login` (correo y contraseña) | JWT `type: guest`, `ROLE_GUEST`, sin refresh | Lo que dure el token; al vencer se pide de nuevo el acceso | `authService.loginGuest` |
| Huésped con código de reserva | `POST /guest/auth/link` | JWT `type: guest`, sin refresh | Igual | Acceso de huésped |
| Visitante público | Endpoints `/public/**` sin token | — | — | Sitio público y reserva pública |

**Problema B4.** El login general (`modules/auth/services/auth-service.ts`) llama primero
a `/guest/auth/login` y, solo si falla con credenciales inválidas, a `/auth/login`: cada
intento de un empleado son **dos peticiones**, y cada fallo cuenta dos veces en el límite
de intentos. Personal y huésped **deben seguir siendo identidades distintas**: viven en
tablas diferentes, sus tokens tienen tipos diferentes y el huésped no tiene refresh token.
No cambié expiraciones ni nada que debilite B2.

---

## 5. Archivos

### Backend (`pms-hotel-boutique-backend`)

Modificados: `docs/REGLAS-NEGOCIO.md`; controladores `AdminUserController`, `BookingController`, `CashSessionController`, `DepositController`, `GuestFolioController`; `dto/request/CloseCashSessionRequest`; repositorios `BookingRepository`, `CashSessionRepository`; `security/JwtAuthenticationFilter`; servicios `AdminUserService`, `BookingService`, `CashSessionService`, `DepositService`, `GuestFolioService`; implementaciones `AdminUserServiceImpl`, `BookingServiceImpl`, `CashSessionServiceImpl`, `DepositServiceImpl`, `GuestFolioServiceImpl`, `PaymentServiceImpl`, `RoomServiceImpl`; pruebas `CashSessionControllerTest`*, `PaymentDepositControllerTest`*, `JwtAuthenticationFilterTest`, `RoomServiceImplTest` (* = Spring, no ejecutadas).

Nuevos: `service/impl/AuditTrail.java`; migraciones **preparadas, no incluidas** `037-room-blocks.sql` y `038-checklist-required-items.sql`; pruebas `BookingServiceImplCancelTest`, `CashSessionServiceImplTest`, `DepositServiceImplTest`, `GuestFolioServiceImplOpenTest`.

### Frontend (`pms-hotel-boutique`), acumulado de las tres etapas

Modificados (37): `scripts/test-services.mjs`, `src/index.css`, `AdminContent.css/.tsx`, `HousekeepingChecklistTemplatePanel.tsx`, `session-mapper.ts`, `BookingFormScreen.tsx`, `SearchScreen.tsx`, `ReceptionContent.tsx`, `ReceptionModals.tsx`, `ReservationDetail.tsx`, `CheckInScreen.tsx`, `GuestAccountScreen.tsx`, `GuestModals.tsx`, `BookingDetailScreen.tsx`, `ManualBookingScreen.tsx`, `RoomServiceContent.tsx`, `RoomFormScreen.tsx`, `RoomTypeFormScreen.tsx`, `PrivateSessionWorkspace.tsx`, `PrivateWorkspace.tsx`, `PublicAuthModal.tsx`, `StaffLoginPage.tsx`, servicios `authService`, `cashService`, `guestAccountService`, `guestService`, `housekeepingService`, `personnelService`, contratos `session.dto/model`, `user.dto/mapper/model`, pruebas `auth`, `public-booking`, `workspace`.

Nuevos (6 + este informe): `docs/validacion-formularios.md`, `front-desk/utils/{checkinComposition,documentTypes,frontDeskErrors,paymentMethods}.ts`, `shared/utils/formValidation.ts`, `docs/informe-implementacion-auditoria-2026-10-19.md`.

`routes.ts`, `router.tsx` y `Permission`/`rolePermissions` de `session.ts` **no se tocaron**.

### Endpoints, DTO y servicios nuevos o cambiados

- `GET /api/v1/cash-sessions?status=open` (nuevo, solo ADMIN; 403 al resto).
- `POST /cash-sessions/{id}/close`: acepta `reason`; 403 si no es el dueño ni ADMIN; 400 si es ADMIN y falta el motivo.
- `POST /bookings/{id}/deposits/{depositId}/refund`: ahora **exige** `reason` (antes el body era opcional). **Cambio de contrato:** el frontend ya lo envía; cualquier otro cliente (por ejemplo, la app móvil) debe revisarse.
- `POST /bookings/{id}/folio/open`: al crear el folio registra el cargo de alojamiento.
- Contratos aditivos en el frontend: `SessionUser.roleCode?`, `User.roleCode?` / `UserDTO.role_code?`.

---

## 6. Resultados de pruebas

| Suite | Resultado |
|---|---|
| `npm run check` (format:check, typecheck, lint, build y 18 suites) | ✔ exit 0: formato, tipos, lint y build limpios; 18 suites, **478 pruebas, 0 fallos** |
| `test:auth` | 34/34 (4 nuevas B3) |
| `test:services` | 35/35 (B3, B9) |
| `test:workspace` | 147/147 (nuevas: Fase 4 ×3, B11 ×2, B9 ×1) |
| `test:public-booking` | 24/24 |
| Backend, pruebas unitarias puras (20 clases, sin Spring ni base) | 137 ejecutadas, **136 ✔, 1 ✖** (`RequestLoggingFilterTest.reusesValidRequestIdAndRealIp`, anterior a estos cambios) |
| Backend `test-compile` | ✔ |
| Pruebas `@SpringBootTest` / `AbstractCatalogApiTest` | **No ejecutadas** (usan la base compartida `localhost:5432/pms_hotel_db`) |

**`RequestLoggingFilterTest`: falla anterior a estos cambios.** La prueba espera
`[abc-123.DEF_4]` en la salida, es decir, el patrón de `logback-spring.xml`, que incluye el
`requestId` del MDC. Corrida sin contexto Spring, Logback usa su patrón por defecto
(`HH:mm:ss.SSS [main] INFO pms.access -- …`), que no imprime el MDC. El resultado depende de
si otra prueba Spring inicializó antes el logging en la misma JVM. Ni el paquete `logging`
ni la configuración de Logback están en mi diff (`git status`); su último cambio es
`f4ac709`. No lo modifiqué.

---

## 7. Riesgos de compatibilidad

1. **Devolución de depósito con motivo obligatorio**: cualquier cliente que la llame sin body recibe 400.
2. **Cargo automático de alojamiento**: las pruebas Spring que abren folios de reservas con tarifa verán saldos distintos. Los reportes de ingresos empezarán a incluir el alojamiento de los folios nuevos.
3. **Roles personalizados**: un rol con permisos de varias áreas, o solo de Administración, ahora recibe un mensaje claro en lugar del panel de Recepción.
4. **Cierre de caja ajena**: quien antes lo hacía sin ser ADMIN recibirá 403.
5. **Migraciones 037 y 038**: no están incluidas en el changelog maestro. Si alguien las incluye, se aplican en el siguiente arranque.

## 8. Cambios necesarios en Docker

Ninguno de configuración. Para validar hay que **reconstruir la imagen del backend y la del
frontend** con estos cambios (no lo hice). Las migraciones 037 y 038 solo se aplican si se
autorizan e incluyen.

## 9. Casos que requieren una base aislada

`GuestFolioControllerTest`, `PaymentDepositControllerTest`, `RoomServiceControllerTest` (A4); `CashSessionControllerTest` (B9); la auditoría de usuarios y roles (B1); A9; C12; las migraciones 037 y 038 (`liquibase update` en una base desechable).

## 10. Validación manual por módulo

- **Recepción:** check-in → folio con alojamiento; cargo, pago y depósito → recargar; aplicar depósito (confirmación, un solo clic); devolver (motivo obligatorio); cancelar una reserva confirmada (motivo, un solo clic) → recargar; una reserva en check-in no ofrece «Cancelar»; ya no existe «Anular».
- **Administración › Caja:** abrir caja como cajero; desde ADMIN, ver «Cajas abiertas de otros usuarios» → cierre excepcional sin motivo (error) → con motivo; ver Auditoría.
- **Administración › Usuarios y roles:** crear el rol `QA_CESAR` con permisos `navigation.recepcion.*`; asignarlo a un usuario; editar solo el estado → el rol se conserva; login de ese usuario → panel Recepción con el código en la cabecera; un rol con dos áreas → mensaje de rechazo.
- **Auditoría:** cada operación anterior aparece una vez, con actor, y ninguna operación fallida aparece.
- **Regresión:** login de los 6 roles predefinidos y del huésped; reserva pública sin cambios en la tarjeta.

## 11. Estado Git

- Frontend: `fix/reception-summary` @ `77f7750`, 43 entradas sin commit (37 modificadas + 6 nuevas, más este informe).
- Backend: `develop` @ `6c8108b`, 33 entradas sin commit (26 modificadas + 7 nuevas).
- **Los 3 stashes siguen intactos:** frontend `stash@{0}` (nav/footer, `fix/public-nav-footer`) y `stash@{1}` (responsive, `fix/room-service-responsive`); backend `stash@{0}` (kitchen-inventory, 2026-10-18).
