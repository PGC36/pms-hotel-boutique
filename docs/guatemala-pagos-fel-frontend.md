# Limites Guatemala: pagos locales, FEL/SAT y alcance frontend

**Fecha:** 2026-10-04  
**Issue:** #129 `[WEB][ARQ] Documentar limites Guatemala: pagos locales, FEL/SAT y alcance frontend`

## Contexto

El PMS opera en Guatemala: moneda `GTQ`, fechas en zona local y folios de
hospedaje con cargos, pagos, depositos y caja. Eso no significa que el frontend
deba resolver por si mismo una pasarela local ni la emision fiscal FEL.

El frontend ya tiene dos alcances distintos:

- **Folio operativo:** registrar cargos, pagos y depositos sobre una reserva,
  mostrar saldos y permitir check-out cuando el backend lo autoriza.
- **Pago publico demo:** en el motor de reservas, mostrar opciones frecuentes
  de hotel para completar el flujo visual, sin capturar tarjetas ni confirmar
  dinero real.

La integracion con Guatemala agrega decisiones de arquitectura, no pantallas
nuevas en esta issue.

## Fuentes externas de referencia

- SAT Guatemala publica la documentacion tecnica del regimen FEL en su portal:
  `https://portal.sat.gob.gt/portal/documentacion-tecnica-del-regimen-fel/`.
- Stripe publica su disponibilidad global en:
  `https://stripe.com/global`. Al 2026-10-05, Guatemala no aparece en la lista
  de paises/regiones donde Stripe permite abrir una cuenta productiva directa.
- Las pasarelas de pago documentan metodos y restricciones por proveedor. Como
  ejemplo de mercado, dLocal lista Guatemala con moneda `GTQ`, tarjetas y
  metodos alternativos como PayCash/SoyFRI:
  `https://docs.dlocal.com/docs/guatemala`.

Estas fuentes son referencia de alcance. No son contrato del proyecto hasta que
exista una decision de backend/producto sobre certificador FEL o proveedor de
pagos.

## Limite para pagos locales

El frontend puede:

- Mostrar metodos abstractos del contrato actual:
  `cash`, `credit_card`, `debit_card`, `bank_transfer`, `online`.
- Enviar pagos del folio a los servicios existentes:
  `guestAccountService.createPayment()` / `paymentService.addCharge()`.
- Mostrar referencia transaccional cuando el backend la devuelve o cuando un
  pago manual la captura como comprobante operativo.
- Refrescar folio, cargos, pagos y depositos desde el backend despues de cada
  mutacion.
- Mostrar errores de backend (`400`, `403`, `404`, `409`) sin simular exito.

El frontend no debe:

- Capturar PAN/CVV, tokenizar tarjetas, guardar credenciales de pasarela ni
  hablar directo con un PSP desde componentes o servicios.
- Elegir proveedor local por su cuenta (VisaNet, BAC, dLocal, PayCash, SoyFRI,
  transferencia bancaria u otro).
- Inventar estados propios de pasarela como autoridad contable.
- Confirmar un pago asincrono por polling local si el backend no lo confirma.
- Convertir montos a otra moneda: `GTQ` y centavos enteros siguen siendo el
  unico contrato.

Si se integra un proveedor local, el frontend solo debe consumir endpoints del
backend, por ejemplo para crear una intencion de pago, redirigir a una URL,
mostrar instrucciones o refrescar el estado confirmado por webhook/backend.

### Stripe en Guatemala

Stripe no debe asumirse como proveedor productivo del PMS para Guatemala. La
decision actual del proyecto es no integrar Stripe desde frontend ni presentarlo
como opcion real de cobro local.

La restriccion que motiva esta decision es operativa: Guatemala no figura en la
lista oficial de paises/regiones soportados por Stripe para abrir una cuenta
productiva directa. Por eso, el frontend no debe modelar Stripe como metodo de
liquidacion directa a cuenta bancaria guatemalteca ni exponerlo como alternativa
disponible para el hotel.

Si producto/backend decide usar Stripe mediante una entidad extranjera, Stripe
Atlas, stablecoins, un adquirente intermedio u otra estructura, esa decision debe
registrarse antes como arquitectura/backend. El frontend solo consumiria el
contrato resultante; no debe inferirlo desde UI.

### Proveedores locales a evaluar

Ejemplos de proveedores o adquirentes que podrian evaluarse en una issue futura:

- VisaNet.
- NeoNet.
- QPayPro.
- Otro proveedor definido por producto/backend.

La inclusion en esta lista no constituye seleccion, recomendacion ni
integracion. Cualquier proveedor requiere decision de producto/backend,
contrato HTTP, estados, errores, webhooks, conciliacion y reglas de seguridad.

## Limite para FEL/SAT

FEL/SAT es responsabilidad de backend y de operacion fiscal, no de React.

El frontend puede:

- Mostrar un estado fiscal ya calculado por backend, por ejemplo
  `pendiente`, `certificando`, `certificada`, `rechazada` o `anulada`, cuando
  ese contrato exista.
- Mostrar identificadores oficiales devueltos por backend/certificador
  (`uuid`, serie, numero, fecha de certificacion, enlace o PDF), sin
  reconstruirlos.
- Permitir acciones explicitas contra endpoints del backend, como solicitar
  emision, reintento o anulacion, si el permiso y contrato existen.
- Mostrar errores de certificacion de forma visible y recuperable.

El frontend no debe:

- Construir XML DTE, firmar documentos, calcular frases/regimenes SAT,
  certificarlos, anularlos o conectarse directo al SAT/certificador.
- Calcular impuestos fiscales definitivos, retenciones, frases ISR,
  complementos FEL o reglas especificas de documento.
- Emitir una "factura" como si fuera DTE certificado solo por renderizar un
  recibo, PDF o modal.
- Decidir si corresponde FACT, FCAM, nota de credito/debito u otro tipo de DTE.

Mientras no exista contrato backend de FEL, el recibo de estancia del frontend
es solo comprobante operativo del PMS. Debe evitar texto como "Factura FEL",
"DTE certificado" o "SAT autorizado".

### Certificadores FEL a evaluar

Ejemplos de certificadores o proveedores FEL que podrian evaluarse en una issue
futura:

- Infile.
- GFACE.
- Megaprint.
- Otro certificador autorizado que se seleccione posteriormente.

La inclusion en esta lista no constituye seleccion ni integracion. El frontend
solo mostrara metadatos FEL cuando backend entregue un contrato fiscal explicito.

## Contrato vigente

- Moneda: `GTQ` literal, montos en `_cents`, enteros.
- Pagos: `PaymentMethodDto` conserva metodos abstractos, no nombres de
  proveedor.
- Folio integrado: reservas UUID consultan el saldo oficial desde backend.
- Folio legacy: IDs `BKG-*` conservan calculo mock solo para prototipo y
  pruebas historicas.
- Pago publico: demo visual, sin cobro real ni pasarela.
- Recibos: comprobantes operativos hasta que backend entregue metadatos FEL.

## Criterios para futuras issues

Una issue de pagos locales debe definir antes de tocar UI:

- Proveedor o abstraccion backend aprobada.
- Endpoints, payloads, estados, errores y politica de webhooks.
- Campos visibles permitidos para el frontend.
- Reglas de conciliacion con folio/caja.
- Reglas de seguridad para datos sensibles.

Una issue FEL/SAT debe definir antes de tocar UI:

- Certificador o mecanismo backend.
- Tipo de documentos soportados.
- Estados fiscales oficiales y transiciones.
- Metadatos que el frontend puede mostrar.
- Permisos para emitir, reintentar, anular y descargar.
- Diferencia explicita entre recibo operativo y DTE certificado.

## Decision de alcance

Para #129 no se agregan rutas, componentes, CSS, servicios ni entidades. La
salida esperada es documentar frontera y evitar que futuras tareas de frontend
implementen responsabilidades fiscales o financieras que pertenecen al backend.
