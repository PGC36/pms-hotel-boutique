import assert from 'node:assert/strict';
import { test, afterEach, mock } from 'node:test';
import { create, act } from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';
import {
  ReservationEditModal,
  ReservationFormModal,
} from '@/modules/front-desk/components/workspace/ReceptionModals';
import {
  STAY_DATES_REQUIRED,
  STAY_RANGE_INVALID,
  hotelToday,
  isDigitsOnly,
  keepPhoneDigits,
  nextCalendarDay,
  normalizeChildren,
  normalizePersonName,
  validateEmail,
  validateGuestCounts,
  validateNotes,
  validatePersonName,
  validatePhone,
  validateStayDates,
} from '@/modules/front-desk/utils/reservationFormValidation';
import { PrivateWorkspace } from '@/private/workspace/PrivateWorkspace';
import { calculateNights } from '@/shared/utils/date';
import { toDomainCalendarDate, toDtoCalendarDate } from '@/shared/types/common';

// Entorno mínimo para los servicios mock (mismo patrón que tests/auth.test.jsx).
const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};
globalThis.window = Object.assign(new EventTarget(), {
  setTimeout: (callback, delay) => setTimeout(callback, delay).unref(),
  clearTimeout,
  scrollY: 0,
  location: { search: '' },
});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let view;
afterEach(() => {
  if (view) act(() => view.unmount());
  view = undefined;
});

const text = (node) =>
  typeof node === 'string' ? node : (node?.children ?? []).map(text).join('');
const hasClass = (node, name) =>
  typeof node.props?.className === 'string' && node.props.className.split(/\s+/).includes(name);
const buttons = (label, root = view.root) =>
  root.findAll((node) => node.type === 'button' && text(node).includes(label));
const settle = (ms = 700) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

// Permisos reales de cada rol operativo (migraciones 008/020 del backend), tal como
// los devuelve GET /auth/permissions: el workspace no se muestra sin ellos.
const SESSION_PERMISSIONS = {
  reception: [
    'booking-companions.read',
    'booking-companions.write',
    'bookings.check-in',
    'bookings.check-out',
    'bookings.read',
    'bookings.write',
    'cash.read',
    'cash.write',
    'charges.read',
    'charges.write',
    'concierge.read',
    'concierge.write',
    'deposits.read',
    'deposits.write',
    'folios.read',
    'folios.write',
    'guests.read',
    'guests.write',
    'payments.read',
    'payments.write',
    'rates.read',
    'room-features.read',
    'room-service.read',
    'room-service.write',
    'room-types.read',
    'rooms.read',
    'service-requests.read',
    'service-requests.write',
  ],
  housekeeping: [
    'housekeeping.read',
    'housekeeping.write',
    'rooms.read',
    'service-requests.read',
    'service-requests.write',
  ],
  concierge: [
    'bookings.read',
    'concierge.read',
    'concierge.write',
    'guests.read',
    'service-requests.read',
  ],
  roomService: ['bookings.read', 'guests.read', 'room-service.read', 'room-service.write'],
};
const navLabels = () =>
  view.root
    .findAll((node) => node.type === 'button' && hasClass(node, 'nav-item'))
    .map((node) => text(node).replace(/\d+$/, ''));

// --- Recepción: ReservationFormModal ------------------------------------

const INVALID_RANGE =
  'Rango de fechas no válido. La fecha de salida debe ser posterior a la fecha de entrada.';
const rooms = [
  {
    id: 1,
    number: '101',
    floor: 'Piso 1',
    type: 'Estándar',
    capacity: 2,
    rate: 500,
    status: 'Disponible',
    features: [],
  },
];
// Igual que recNights en PrivateWorkspace: pasa por calculateNights, que lanza ante un rango inválido.
const nights = (checkIn, checkOut) =>
  Math.max(1, calculateNights(toDomainCalendarDate(checkIn), toDomainCalendarDate(checkOut)));

function renderReservationForm() {
  const saved = [];
  act(() => {
    view = create(
      <ReservationFormModal
        nextCode="AUR-TEST"
        rooms={rooms}
        hasConflict={() => false}
        isRoomBlocked={() => false}
        onSave={(reservation) => saved.push(reservation)}
        onClose={() => {}}
        nights={nights}
        folioTotals={() => ({ charges: 0, deposits: 0, payments: 0, balance: 0 })}
      />,
    );
  });
  return saved;
}
const dateInputs = () =>
  view.root.findAll((node) => node.type === 'input' && node.props.type === 'date');
const setDates = (checkIn, checkOut) => {
  const [checkInInput, checkOutInput] = dateInputs();
  act(() => checkInInput.props.onChange({ target: { value: checkIn } }));
  act(() => checkOutInput.props.onChange({ target: { value: checkOut } }));
};
const dateAlert = () =>
  view.root.findAll((node) => node.props.role === 'alert').map((node) => text(node));
const formIsOpen = () => text(view.root).includes('Crear reserva manual');
const ratePreview = () => view.root.findAll((node) => hasClass(node, 'rc-rate-preview'));
const formInput = (predicate) =>
  view.root.find((node) => node.type === 'input' && hasClass(node, 'rc-input') && predicate(node));
const textInputs = () =>
  view.root.findAll(
    (node) => node.type === 'input' && hasClass(node, 'rc-input') && node.props.type === undefined,
  );
const typeInto = (input, value) => act(() => input.props.onChange({ target: { value } }));
const phoneInput = () => formInput((node) => node.props.name === 'phone');
const emailInput = () => formInput((node) => node.props.type === 'email');
const adultsInput = () => formInput((node) => node.props.name === 'adults');
const childrenInput = () => formInput((node) => node.props.name === 'children');
const fillGuestAndRoom = () => {
  const [name, lastName] = textInputs();
  typeInto(name, 'Ana');
  typeInto(lastName, 'López');
  typeInto(phoneInput(), '+502 5555-0000');
  typeInto(emailInput(), 'ana.lopez@example.com');
  act(() => buttons('Hab. 101')[0].props.onClick());
};
const fieldErrors = () =>
  view.root.findAll((node) => hasClass(node, 'rc-field-error')).map((node) => text(node));
const openSummary = () => act(() => buttons('Ver resumen')[0].props.onClick());
// Fechas relativas al día del hotel: la entrada no puede ser anterior a hoy en Guatemala.
const dayFromToday = (offset) => {
  let day = hotelToday();
  for (let i = 0; i < offset; i++) day = nextCalendarDay(day);
  return day;
};
const IN_2 = dayFromToday(2);
const IN_5 = dayFromToday(5);
const IN_7 = dayFromToday(7);

for (const [label, checkIn, checkOut, message] of [
  ['salida anterior a la entrada', IN_7, IN_2, INVALID_RANGE],
  ['misma fecha de entrada y salida', IN_7, IN_7, INVALID_RANGE],
  ['fecha de salida vacía', IN_7, '', STAY_DATES_REQUIRED],
  ['fecha de entrada vacía', '', IN_7, STAY_DATES_REQUIRED],
]) {
  test(`reserva manual: ${label} muestra error inline sin tumbar la app ni guardar`, () => {
    const saved = renderReservationForm();
    fillGuestAndRoom();
    assert.doesNotThrow(() => setDates(checkIn, checkOut));
    assert.ok(formIsOpen(), 'el modal sigue abierto');
    assert.deepEqual(dateAlert(), [message]);
    assert.equal(ratePreview().length, 0, 'no calcula tarifa con noches inválidas');
    const summary = buttons('Ver resumen')[0];
    assert.equal(summary.props.disabled, true);
    act(() => summary.props.onClick());
    assert.ok(formIsOpen(), 'no avanza al resumen');
    assert.equal(saved.length, 0);
  });
}

test('reserva manual: al corregir las fechas se recupera el flujo y guarda 2 noches', () => {
  const saved = renderReservationForm();
  fillGuestAndRoom();
  setDates(IN_7, IN_2);
  assert.deepEqual(dateAlert(), [INVALID_RANGE]);

  setDates(IN_5, IN_7);
  assert.deepEqual(dateAlert(), []);
  assert.match(text(ratePreview()[0]), /× 2 noches/);
  const summary = buttons('Ver resumen')[0];
  assert.equal(summary.props.disabled, false);
  act(() => summary.props.onClick());
  assert.match(text(view.root), new RegExp(`${IN_5} → ${IN_7} · 2 noches`));

  act(() => buttons('Confirmar reserva')[0].props.onClick());
  assert.equal(saved.length, 1);
  assert.equal(saved[0].checkIn, IN_5);
  assert.equal(saved[0].checkOut, IN_7);
  assert.equal(saved[0].folio[0].concept, 'Alojamiento 2 noches');
  assert.equal(saved[0].folio[0].amount, 1000);
});

// --- Recepción: Nueva reserva · validaciones de la subfase 1B (etapa 1) ------

test('nueva reserva · reglas: teléfono solo dígitos, de 8 a 20', () => {
  assert.equal(validatePhone('55550000'), null, '8 dígitos (mínimo)');
  assert.equal(validatePhone('50255550000'), null, '11 dígitos');
  assert.equal(validatePhone('1'.repeat(20)), null, '20 dígitos (máximo)');
  assert.equal(validatePhone(''), 'Ingresa el teléfono.');
  assert.equal(validatePhone('   '), 'Ingresa el teléfono.');
  assert.equal(validatePhone('5555000'), 'Ingresa un teléfono válido.', '7 dígitos');
  assert.equal(validatePhone('1'.repeat(21)), 'Ingresa un teléfono válido.', '21 dígitos');
  // Sin prefijo, espacios, guiones, paréntesis ni letras (validación previa a guardar).
  for (const phone of ['+50255550000', '5555 0000', '5555-0000', '(502)55550000', '5555abcd']) {
    assert.equal(validatePhone(phone), 'Ingresa un teléfono válido.', phone);
  }
});

test('nueva reserva · reglas: correo obligatorio, con formato y máximo 254', () => {
  assert.equal(validateEmail('ana.lopez@example.com'), null);
  assert.equal(validateEmail('  maria+viajes@hotel.com.gt '), null, 'se recorta y admite +');
  assert.match(validateEmail(''), /Ingresa el correo/);
  assert.match(validateEmail('   '), /Ingresa el correo/);
  for (const invalid of ['ana', 'ana@', '@example.com', 'ana@example', 'ana @x.com', 'a@b..com']) {
    assert.match(validateEmail(invalid), /formato válido/, invalid);
  }
  assert.match(validateEmail(`${'a'.repeat(250)}@x.com`), /no puede superar 254/);
});

test('nueva reserva · reglas: fechas desde hoy en Guatemala y máximo 90 noches', () => {
  const today = '2026-10-18';
  assert.equal(validateStayDates('2026-10-18', '2026-10-19', today), null, 'entrada hoy');
  assert.match(
    validateStayDates('2026-10-17', '2026-10-19', today),
    /anterior a hoy \(18-10-2026\)/,
  );
  assert.equal(validateStayDates('2026-10-18', '2027-01-16', today), null, '90 noches');
  assert.match(validateStayDates('2026-10-18', '2027-01-17', today), /no puede superar 90 noches/);
  assert.equal(validateStayDates('2026-10-20', '2026-10-20', today), STAY_RANGE_INVALID);
  assert.equal(validateStayDates('', '2026-10-20', today), STAY_DATES_REQUIRED);
  assert.match(validateStayDates('20-10-2026', '2026-10-21', today), /Formato de fecha/);
  // A las 05:30 UTC del 19 todavía es 18 en Guatemala (UTC−6).
  assert.equal(hotelToday(new Date('2026-10-19T05:30:00Z')), '2026-10-18');
  assert.equal(hotelToday(new Date('2026-10-19T06:30:00Z')), '2026-10-19');
});

test('nueva reserva · reglas: adultos y menores enteros dentro de la capacidad', () => {
  assert.deepEqual(validateGuestCounts('2', '1', 3), {});
  assert.deepEqual(validateGuestCounts('1', '0'), {});
  assert.equal(validateGuestCounts('0', '0').adults, 'Mínimo 1 adulto.');
  assert.equal(validateGuestCounts('', '0').adults, 'Ingresa la cantidad de adultos.');
  assert.equal(validateGuestCounts('-1', '0').adults, 'Ingresa un número entero.');
  assert.equal(validateGuestCounts('1.5', '0').adults, 'Ingresa un número entero.');
  assert.equal(validateGuestCounts('1', '-1').children, 'Ingresa un número entero.');
  assert.equal(validateGuestCounts('1', '0.5').children, 'Ingresa un número entero.');
  assert.match(validateGuestCounts('2', '1', 2).capacity, /admite 2 huéspedes como máximo/);
});

test('nueva reserva · reglas: filtros de escritura de cantidades y teléfono', () => {
  for (const ok of ['', '0', '1', '12']) assert.equal(isDigitsOnly(ok), true, ok);
  for (const bad of ['-9', '-', '1.5', '1,5', 'abc', '1e2', ' 1', '1 ', '+1']) {
    assert.equal(isDigitsOnly(bad), false, bad);
  }
  assert.equal(normalizeChildren(''), '0');
  assert.equal(normalizeChildren('   '), '0');
  assert.equal(normalizeChildren('2'), '2');
  assert.equal(keepPhoneDigits('+502 (5555)-0000'), '50255550000', 'pegado con formato');
  assert.equal(keepPhoneDigits('55ab55#00$00'), '55550000', 'letras y símbolos');
  assert.equal(keepPhoneDigits('1'.repeat(25)), '1'.repeat(20), 'como máximo 20 dígitos');
});

test('nueva reserva · reglas: observaciones hasta 500 caracteres', () => {
  assert.equal(validateNotes(''), null);
  assert.equal(validateNotes('a'.repeat(500)), null, '500 caracteres');
  assert.equal(validateNotes('a'.repeat(501)), 'Máximo 500 caracteres.', '501 caracteres');
});

test('nueva reserva: la textarea de observaciones limita a 500 y muestra el contador', () => {
  renderReservationForm();
  const textarea = () => view.root.find((node) => node.type === 'textarea');
  assert.equal(textarea().props.maxLength, 500);
  assert.match(text(view.root), /0\/500/);
  act(() => textarea().props.onChange({ target: { value: 'Llega tarde' } }));
  assert.match(text(view.root), /11\/500/);
});

test('nueva reserva: no guarda con teléfono, correo o cantidades inválidas', () => {
  const saved = renderReservationForm();
  fillGuestAndRoom();
  typeInto(phoneInput(), '555');
  typeInto(emailInput(), 'ana@');
  typeInto(adultsInput(), '0');
  openSummary();
  assert.ok(formIsOpen(), 'no avanza al resumen');
  const errors = fieldErrors();
  assert.ok(errors.includes('Ingresa un teléfono válido.'), errors.join(' | '));
  assert.ok(errors.some((error) => /formato válido/.test(error)));
  assert.ok(errors.includes('Mínimo 1 adulto.'), 'no corrige el 0 a 1 en silencio');
  assert.equal(adultsInput().props.value, '0');
  assert.equal(saved.length, 0);
});

test('nueva reserva: adultos solo admite dígitos al escribir', () => {
  renderReservationForm();
  assert.equal(adultsInput().props.type, 'text', 'evita los comportamientos de type="number"');
  assert.equal(adultsInput().props.inputMode, 'numeric');
  typeInto(adultsInput(), '2');
  for (const rejected of ['-9', '1.5', 'abc', '2e1', ' 2']) {
    typeInto(adultsInput(), rejected);
    assert.equal(adultsInput().props.value, '2', `"${rejected}" no se guarda en el estado`);
  }
  typeInto(adultsInput(), '');
  openSummary();
  assert.ok(fieldErrors().includes('Ingresa la cantidad de adultos.'));
});

test('nueva reserva: menores solo admite dígitos y vacío vuelve a 0', () => {
  const saved = renderReservationForm();
  fillGuestAndRoom();
  setDates(IN_5, IN_7);
  typeInto(childrenInput(), '1');
  assert.equal(childrenInput().props.value, '1', '1 es válido');
  for (const rejected of ['-5', 'abc', '0.5', '1e1']) {
    typeInto(childrenInput(), rejected);
    assert.equal(childrenInput().props.value, '1', `"${rejected}" no se guarda en el estado`);
  }
  typeInto(childrenInput(), '0');
  assert.equal(childrenInput().props.value, '0', '0 es válido');

  // Al perder el foco, vacío vuelve a 0.
  typeInto(childrenInput(), '');
  act(() => childrenInput().props.onBlur());
  assert.equal(childrenInput().props.value, '0');

  // Al pulsar "Ver resumen", vacío vuelve a 0 sin error y continúa.
  typeInto(childrenInput(), '');
  openSummary();
  assert.ok(!formIsOpen(), 'avanza al resumen');
  assert.ok(!fieldErrors().some((error) => /menores/i.test(error)));
  assert.match(text(view.root), /1 adulto · 0 menores/);
  act(() => buttons('Confirmar reserva')[0].props.onClick());
  assert.equal(saved.length, 1);
  assert.equal(saved[0].children, 0, 'nunca NaN');
  assert.ok(Number.isInteger(saved[0].adults) && Number.isInteger(saved[0].children));
});

test('nueva reserva: teléfono filtra lo que no es dígito y acepta de 8 a 20', () => {
  const saved = renderReservationForm();
  fillGuestAndRoom();
  setDates(IN_5, IN_7);
  assert.equal(phoneInput().props.type, 'text');
  assert.equal(phoneInput().props.inputMode, 'numeric');
  assert.equal(phoneInput().props.maxLength, 20);
  assert.equal(phoneInput().props.placeholder, '55550000');

  // Pegado con letras y símbolos: solo quedan los dígitos.
  typeInto(phoneInput(), '+502 (5555)-abc 0000!');
  assert.equal(phoneInput().props.value, '50255550000');
  // 21 dígitos: el adicional no se almacena.
  typeInto(phoneInput(), '1'.repeat(21));
  assert.equal(phoneInput().props.value, '1'.repeat(20));

  typeInto(phoneInput(), '5555000');
  openSummary();
  assert.ok(fieldErrors().includes('Ingresa un teléfono válido.'), '7 dígitos');
  typeInto(phoneInput(), '');
  openSummary();
  assert.ok(fieldErrors().includes('Ingresa el teléfono.'));

  typeInto(phoneInput(), '55550000');
  openSummary();
  assert.ok(!formIsOpen(), '8 dígitos avanza');
  act(() => buttons('Volver')[0].props.onClick());
  typeInto(phoneInput(), '1'.repeat(20));
  openSummary();
  assert.ok(!formIsOpen(), '20 dígitos avanza');
  act(() => buttons('Confirmar reserva')[0].props.onClick());
  assert.equal(saved[0].guest.phone, '1'.repeat(20));
});

test('nueva reserva: adultos + menores no superan la capacidad de la habitación', () => {
  const saved = renderReservationForm();
  fillGuestAndRoom();
  setDates(IN_5, IN_7);
  typeInto(adultsInput(), '2');
  typeInto(childrenInput(), '1');
  openSummary();
  assert.ok(formIsOpen(), 'no avanza al resumen con 3 huéspedes en capacidad 2');
  assert.ok(fieldErrors().some((error) => /admite 2 huéspedes como máximo/.test(error)));
  assert.equal(saved.length, 0);

  // Corregido dentro de la capacidad, sí avanza y guarda enteros.
  typeInto(childrenInput(), '0');
  openSummary();
  assert.ok(!formIsOpen());
  act(() => buttons('Confirmar reserva')[0].props.onClick());
  assert.deepEqual([saved[0].adults, saved[0].children, saved[0].guestCount], [2, 0, 2]);
});

test('nueva reserva: no admite entrada anterior a hoy en Guatemala', () => {
  const saved = renderReservationForm();
  fillGuestAndRoom();
  const yesterday = toDtoCalendarDate(
    new Date(toDomainCalendarDate(hotelToday()).getTime() - 24 * 60 * 60 * 1000),
  );
  setDates(yesterday, IN_2);
  assert.ok(dateAlert()[0].startsWith('La fecha de entrada no puede ser anterior a hoy'));
  assert.equal(buttons('Ver resumen')[0].props.disabled, true);
  assert.equal(dateInputs()[0].props.min, hotelToday(), 'el selector parte de hoy');
  assert.equal(saved.length, 0);
});

test('nueva reserva: separa adultos y menores, sin nacionalidad ni documento por defecto', () => {
  const saved = renderReservationForm();
  fillGuestAndRoom();
  setDates(IN_5, IN_7);
  typeInto(adultsInput(), '1');
  typeInto(childrenInput(), '1');
  assert.equal(
    view.root.findAll((node) => node.props?.placeholder === 'Edad').length,
    0,
    'los acompañantes se registran en el check-in',
  );
  openSummary();
  const summary = text(view.root);
  assert.match(summary, /Se asignará al confirmar/, 'no inventa el código');
  assert.ok(!summary.includes('AUR-TEST'));
  assert.match(summary, /1 adulto · 1 menor/);
  assert.match(summary, /Total estimadoQ1,000\.00/, 'monto en quetzales y marcado como estimado');
  act(() => buttons('Confirmar reserva')[0].props.onClick());
  assert.equal(saved.length, 1);
  assert.equal(saved[0].adults, 1);
  assert.equal(saved[0].children, 1);
  assert.equal(saved[0].guestCount, 2);
  assert.deepEqual(saved[0].companions, []);
  assert.equal(saved[0].guest.nationality, '');
  assert.equal(saved[0].guest.docType, '');
});

test('nueva reserva: el alta envía adultos y menores reales y no inventa nacionalidad', async () => {
  // El servicio exige UUID reales de huésped y tipo de habitación.
  await mountReception({
    rooms: [
      hkRoom('room-101', '101', 'clean', { roomTypeId: '30000000-0000-4000-8000-000000000001' }),
    ],
  });
  await act(async () => buttons('Nueva reserva')[0].props.onClick());
  fillGuestAndRoom();
  setDates(IN_5, IN_7);
  typeInto(adultsInput(), '1');
  typeInto(childrenInput(), '1');
  openSummary();
  await act(async () => {
    buttons('Confirmar reserva')[0].props.onClick();
  });
  // Huésped, tarifas, alta y confirmación: cuatro llamadas con latencia simulada.
  for (let i = 0; i < 20 && recBackend.created?.status !== 'confirmed'; i++) await settle(300);
  await settle();

  const [guestBody] = recCalls('/guests').filter(Boolean);
  assert.ok(guestBody, 'crea el huésped en el backend');
  assert.ok(!('nationality' in guestBody), 'sin nacionalidad inventada');
  assert.ok(!('documentType' in guestBody) && !('documentNumber' in guestBody));
  assert.equal(guestBody.email, 'ana.lopez@example.com');
  const bookingBody = recBackend.requests.find(({ call }) => call === 'POST /bookings')?.body;
  assert.ok(
    bookingBody,
    `crea la reserva en el backend · errores: ${fieldErrors().join(' | ')} · toasts: ${toasts().join(' | ')}`,
  );
  assert.equal(bookingBody.adults, 1);
  assert.equal(bookingBody.children, 1, 'los menores ya no se pierden');
  assert.equal(recBackend.created.status, 'confirmed');
  assert.ok(toasts().some((toast) => toast.includes('Reserva BKG-NEW00001 creada')));
});

// --- Limpieza: backend falso de HousekeepingController (INT-09) -----------
//
// Replica la regla del backend: cada acción exige un estado de origen exacto y
// responde 400 si no se cumple. La UI nunca debe cambiar sin esa confirmación.

const hkRoom = (id, roomNumber, housekeepingStatus, extra = {}) => ({
  id,
  roomNumber,
  roomTypeId: 'type-standard',
  floor: Number(roomNumber[0]),
  status: 'available',
  housekeepingStatus,
  notes: null,
  updatedAt: '2026-10-03T08:00:00Z',
  ...extra,
});
const hkStayover = (id, roomId, status, description) => ({
  id,
  bookingId: 'booking-1',
  roomId,
  roomNumber: null,
  status,
  description,
  requestedAt: '2026-10-03T09:00:00Z',
  startedAt: status === 'pending' ? null : '2026-10-03T09:10:00Z',
  completedAt: status === 'completed' ? '2026-10-03T09:40:00Z' : null,
  createdAt: '2026-10-03T09:00:00Z',
  updatedAt: '2026-10-03T09:00:00Z',
});

let hkBackend;
let originalFetch;
afterEach(() => {
  if (originalFetch) globalThis.fetch = originalFetch;
  originalFetch = undefined;
});

function installHousekeepingBackend() {
  const state = {
    rooms: [
      hkRoom('room-101', '101', 'dirty'),
      hkRoom('room-102', '102', 'dirty'),
      hkRoom('room-201', '201', 'cleaning', { cleaningStartedAt: '2026-10-03T08:30:00Z' }),
      hkRoom('room-202', '202', 'clean', {
        status: 'occupied',
        cleaningStartedAt: '2026-10-03T07:00:00Z',
        cleaningCompletedAt: '2026-10-03T07:40:00Z',
      }),
    ],
    stayovers: [
      hkStayover('stay-1', 'room-202', 'pending', 'Cambio de toallas'),
      hkStayover('stay-2', 'room-202', 'in_progress', 'Repaso de baño'),
      hkStayover('stay-3', 'room-101', 'completed', 'Tendido de cama'),
      hkStayover('stay-4', 'room-102', 'cancelled', 'Cancelada por el huésped'),
    ],
    checklists: [
      {
        id: 'check-stay-2',
        serviceRequestId: 'stay-2',
        roomId: 'room-202',
        roomNumber: '202',
        status: 'in_progress',
        observations: 'Checklist real de stayover',
        responsibleUserEmail: 'limpieza@hotelboutique.test',
        completedByUserEmail: null,
        startedAt: '2026-10-03T09:00:00Z',
        completedAt: null,
        createdAt: '2026-10-03T09:00:00Z',
        updatedAt: '2026-10-03T09:00:00Z',
        items: [
          {
            id: 'stayover-item-1',
            label: 'Checklist stayover: no usar en turnover',
            checked: false,
            position: 0,
            notes: null,
            checkedByUserEmail: null,
            checkedAt: null,
            createdAt: '2026-10-03T09:00:00Z',
            updatedAt: '2026-10-03T09:00:00Z',
          },
        ],
      },
    ],
    maintenance: [
      {
        id: 'maint-1',
        bookingId: null,
        roomId: 'room-102',
        roomNumber: '102',
        type: 'maintenance',
        description: 'Plomería: fuga en lavamanos',
        status: 'pending',
        notes: 'Alta',
        requestedAt: '2026-10-03T08:00:00Z',
        createdAt: '2026-10-03T08:00:00Z',
        updatedAt: '2026-10-03T08:00:00Z',
      },
    ],
    requests: [],
    denyMaintenanceRead: false,
  };
  const turnover = {
    start: ['dirty', 'cleaning', 'cleaningStartedAt'],
    complete: ['cleaning', 'clean', 'cleaningCompletedAt'],
    inspect: ['clean', 'inspected', 'inspectedAt'],
  };
  const stayoverFlow = {
    start: ['pending', 'in_progress', 'startedAt'],
    complete: ['in_progress', 'completed', 'completedAt'],
  };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const path = new URL(String(input)).pathname.replace(/^\/api\/v1/, '');
    const method = init.method ?? 'GET';
    state.requests.push(`${method} ${path}`);
    if (method === 'GET' && path === '/admin/audit-logs') return json([]);
    if (method === 'GET' && path === '/rooms') return json(state.rooms);
    if (path === '/room-types' || path === '/room-features') return json({ status: 403 }, 403);
    // El rol housekeeping no tiene `room-service.read`: el backend real responde 403.
    if (path.startsWith('/room-service/')) return json({ status: 403 }, 403);
    if (method === 'GET' && path === '/housekeeping/rooms') return json(state.rooms);
    if (method === 'GET' && path === '/housekeeping/rooms/stayover-cleanings') {
      return json(state.stayovers);
    }
    if (method === 'GET' && path === '/housekeeping/checklists') return json(state.checklists);
    if (method === 'GET' && path === '/housekeeping/checklist-template') {
      return json({
        code: 'guest-cleaning',
        name: 'Limpieza solicitada por huésped',
        items: ['Cama preparada', 'Baño limpio'],
      });
    }
    // ServiceRequestController: Limpieza lee housekeeping/maintenance y solo crea maintenance.
    if (method === 'GET' && path === '/service-requests') {
      return state.denyMaintenanceRead ? json({ status: 403 }, 403) : json(state.maintenance);
    }
    if (method === 'POST' && path === '/service-requests') {
      const body = JSON.parse(String(init.body ?? '{}'));
      if (body.type !== 'maintenance') return json({ status: 403 }, 403);
      const room = state.rooms.find((item) => item.id === body.roomId);
      const request = {
        id: `maint-${state.maintenance.length + 1}`,
        bookingId: null,
        roomId: body.roomId,
        roomNumber: room?.roomNumber ?? null,
        type: body.type,
        description: body.description,
        status: 'pending',
        notes: body.notes ?? null,
        requestedAt: '2026-10-03T10:00:00Z',
        createdAt: '2026-10-03T10:00:00Z',
        updatedAt: '2026-10-03T10:00:00Z',
      };
      state.maintenance.push(request);
      return json(request, 201);
    }
    if (['/charges', '/payments', '/deposits', '/guest-accounts'].includes(path)) {
      return json({ status: 403 }, 403);
    }
    if (method === 'POST' && path === '/housekeeping/checklists') {
      const body = JSON.parse(String(init.body ?? '{}'));
      const stayover = state.stayovers.find((item) => item.id === body.serviceRequestId);
      if (['completed', 'cancelled', 'rejected'].includes(stayover?.status)) {
        return json({ message: 'Cannot create checklist for terminal service request' }, 409);
      }
      const checklist = {
        id: `check-${state.checklists.length + 1}`,
        serviceRequestId: body.serviceRequestId,
        roomId: stayover?.roomId ?? 'room-101',
        roomNumber: stayover?.roomNumber ?? '101',
        status: 'pending',
        observations: body.observations ?? null,
        responsibleUserEmail: 'limpieza@hotelboutique.test',
        completedByUserEmail: null,
        startedAt: '2026-10-03T09:00:00Z',
        completedAt: null,
        createdAt: '2026-10-03T10:00:00Z',
        updatedAt: '2026-10-03T10:00:00Z',
        items: body.items.map((item, index) => ({
          id: `check-item-${index + 1}`,
          label: item.label,
          checked: item.checked,
          position: item.position ?? index,
          notes: item.notes ?? null,
          checkedByUserEmail: item.checked ? 'limpieza@hotelboutique.test' : null,
          checkedAt: item.checked ? '2026-10-03T10:00:00Z' : null,
          createdAt: '2026-10-03T10:00:00Z',
          updatedAt: '2026-10-03T10:00:00Z',
        })),
      };
      state.checklists.push(checklist);
      return json(checklist, 201);
    }
    const checklist = path.match(/^\/housekeeping\/checklists\/([^/]+)$/);
    if (method === 'PUT' && checklist) {
      const index = state.checklists.findIndex((item) => item.id === checklist[1]);
      if (index < 0) return json({ status: 404 }, 404);
      const body = JSON.parse(String(init.body ?? '{}'));
      state.checklists[index] = {
        ...state.checklists[index],
        status: body.status ?? state.checklists[index].status,
        observations: body.observations ?? state.checklists[index].observations,
        items: body.items.map((item, itemIndex) => ({
          id: item.id ?? `check-item-${itemIndex + 1}`,
          label: item.label,
          checked: item.checked,
          position: item.position ?? itemIndex,
          notes: item.notes ?? null,
          checkedByUserEmail: item.checked ? 'limpieza@hotelboutique.test' : null,
          checkedAt: item.checked ? '2026-10-03T10:00:00Z' : null,
          createdAt: '2026-10-03T10:00:00Z',
          updatedAt: '2026-10-03T10:05:00Z',
        })),
        updatedAt: '2026-10-03T10:05:00Z',
      };
      return json(state.checklists[index]);
    }
    const stayover = path.match(/^\/housekeeping\/rooms\/stayover-cleanings\/([^/]+)\/(\w+)$/);
    if (method === 'POST' && stayover) {
      const index = state.stayovers.findIndex((item) => item.id === stayover[1]);
      const [from, to, field] = stayoverFlow[stayover[2]];
      if (state.stayovers[index].status !== from) return json({ status: 400 }, 400);
      state.stayovers[index] = {
        ...state.stayovers[index],
        status: to,
        [field]: '2026-10-03T10:00:00Z',
      };
      return json(state.stayovers[index]);
    }
    const room = path.match(/^\/housekeeping\/rooms\/([^/]+)\/(start|complete|inspect)$/);
    if (method === 'POST' && room) {
      const index = state.rooms.findIndex((item) => item.id === room[1]);
      const [from, to, field] = turnover[room[2]];
      if (state.rooms[index].housekeepingStatus !== from) return json({ status: 400 }, 400);
      state.rooms[index] = {
        ...state.rooms[index],
        housekeepingStatus: to,
        [field]: '2026-10-03T10:00:00Z',
      };
      return json(state.rooms[index]);
    }
    if (method === 'GET' && path === '/auth/permissions') {
      return json({ permissions: SESSION_PERMISSIONS.housekeeping });
    }
    return json({ message: `Ruta no mockeada: ${method} ${path}` }, 404);
  };
  return state;
}

async function mountHousekeeping({ denyMaintenanceRead = false } = {}) {
  hkBackend = installHousekeepingBackend();
  hkBackend.denyMaintenanceRead = denyMaintenanceRead;
  await act(async () => {
    view = create(
      <MemoryRouter>
        <PrivateWorkspace role="housekeeping" sessionName="Limpieza Test" />
      </MemoryRouter>,
    );
  });
  for (let i = 0; i < 20 && !view.root.findAll((node) => hasClass(node, 'side-nav')).length; i++) {
    await settle(300);
  }
  assert.ok(view.root.findAll((node) => hasClass(node, 'side-nav')).length, 'workspace cargado');
}
const navItem = (label) =>
  view.root.find(
    (node) => node.type === 'button' && hasClass(node, 'nav-item') && text(node).startsWith(label),
  );
const navBadge = (label) =>
  navItem(label)
    .findAll((node) => node.type === 'b')
    .map(text)[0];
const goTo = async (label) => {
  await act(async () => navItem(label).props.onClick());
  await settle(100);
};
const headerHasDefectButton = () =>
  buttons(
    'Reportar desperfecto',
    view.root.find((node) => hasClass(node, 'welcome-row')),
  ).length > 0;
const requestRows = () =>
  view.root
    .findAll((node) => node.type === 'div' && hasClass(node, 'hk-req-row'))
    .map((row) => ({
      row,
      status: text(row.findAll((node) => hasClass(node, 'status-pill')).at(-1)),
      actions: row.findAll((node) => node.type === 'button').map(text),
    }));
const roomCards = () =>
  view.root
    .findAll((node) => node.type === 'div' && hasClass(node, 'hk-room-card'))
    .map((card) => ({
      card,
      number: text(card.find((node) => node.type === 'strong')),
      status: text(card.find((node) => hasClass(node, 'status-pill'))),
    }));
const cardFor = (number) => roomCards().find((card) => card.number === `Habitación ${number}`);
const toasts = () => view.root.findAll((node) => hasClass(node, 'toast')).map(text);
const expectedOpenRequests = () =>
  hkBackend.stayovers.filter((request) => ['pending', 'in_progress'].includes(request.status))
    .length;

test('limpieza: con sus permisos reales conserva todas sus secciones', async () => {
  await mountHousekeeping();
  assert.deepEqual(navLabels(), ['Inicio', 'Habitaciones', 'Solicitudes', 'Historial']);
});

test('limpieza: el panel carga sin pedir datos para los que el rol no tiene permiso', async () => {
  await mountHousekeeping();
  assert.ok(!hkBackend.requests.includes('GET /rooms'));
  assert.ok(hkBackend.requests.includes('GET /housekeeping/rooms'));
  assert.ok(hkBackend.requests.includes('GET /housekeeping/rooms/stayover-cleanings'));
  assert.deepEqual(
    hkBackend.requests.filter((request) => request.includes('/room-service/')),
    [],
    'el catálogo de Room Service exige room-service.read',
  );
  assert.deepEqual(
    hkBackend.requests.filter(
      (request) => request.includes('/room-types') || request.includes('/room-features'),
    ),
    [],
    'el catálogo de habitaciones exige room-types.read/room-features.read',
  );
});

test('limpieza: un 403 en solicitudes secundarias no bloquea el panel', async () => {
  await mountHousekeeping({ denyMaintenanceRead: true });
  assert.ok(hkBackend.requests.includes('GET /service-requests'));
  assert.ok(hkBackend.requests.includes('GET /housekeeping/rooms'));
});

test('limpieza: "Reportar desperfecto" solo aparece en Inicio', async () => {
  await mountHousekeeping();
  assert.equal(headerHasDefectButton(), true, 'Inicio');
  for (const nav of ['Habitaciones', 'Solicitudes', 'Historial']) {
    await goTo(nav);
    assert.equal(headerHasDefectButton(), false, nav);
  }
  await goTo('Inicio');
  assert.equal(headerHasDefectButton(), true, 'vuelve a Inicio');
});

test('limpieza: cada solicitud ofrece solo la acción que su estado permite', async () => {
  await mountHousekeeping();
  await goTo('Solicitudes');
  const rows = requestRows();
  assert.equal(rows.length, hkBackend.stayovers.length, 'las solicitudes salen del backend');
  assert.equal(
    rows.filter((row) => row.status === 'Rechazada').length,
    1,
    'una tarea cancelled del backend se muestra como Rechazada',
  );
  const allowed = {
    Pendiente: ['Atender solicitud'],
    'En proceso': ['Completar checklist', 'Completar solicitud'],
    Completada: [],
    Rechazada: [],
  };
  for (const { status, actions } of rows) {
    assert.ok(status in allowed, `estado conocido: ${status}`);
    assert.deepEqual(actions, allowed[status], `acciones para ${status}`);
  }
});

test('limpieza: atender y completar una solicitud avanza sin transición inválida y actualiza el badge', async () => {
  await mountHousekeeping();
  const openBefore = expectedOpenRequests();
  assert.equal(navBadge('Solicitudes'), openBefore ? String(openBefore) : undefined);

  await goTo('Solicitudes');
  const pending = requestRows().find((row) => row.status === 'Pendiente');
  assert.ok(pending, 'hay una solicitud pendiente para atender');
  const requestInfo = (row) => text(row.find((node) => hasClass(node, 'hk-req-info')));
  const description = requestInfo(pending.row);
  const rowFor = () => requestRows().find((row) => requestInfo(row.row) === description);

  await act(async () => buttons('Atender solicitud', pending.row)[0].props.onClick());
  await settle();
  assert.equal(rowFor().status, 'En proceso');
  assert.ok(!toasts().some((toast) => /rechaz/i.test(toast)), toasts().join());
  assert.equal(navBadge('Solicitudes'), String(openBefore), 'sigue abierta: el badge no cambia');

  const checklist = () =>
    rowFor().row.findAll((node) => hasClass(node, 'hk-request-checklist-items'))[0];
  assert.ok(checklist(), 'muestra el checklist al iniciar la atención');
  assert.deepEqual(
    checklist()
      .findAll((node) => node.type === 'input')
      .map((input) => input.props.checked),
    [false, false],
    'las tareas empiezan sin marcar',
  );
  for (const input of checklist().findAll((node) => node.type === 'input')) {
    await act(async () => input.props.onChange());
    await settle();
  }
  await act(async () => buttons('Completar checklist', rowFor().row)[0].props.onClick());
  await settle();

  await act(async () => buttons('Completar solicitud', rowFor().row)[0].props.onClick());
  await settle();
  assert.equal(rowFor().status, 'Completada');
  assert.ok(!toasts().some((toast) => /rechaz/i.test(toast)), toasts().join());
  assert.deepEqual(
    hkBackend.requests.filter((request) => request.includes('/housekeeping/checklists')),
    [
      'GET /housekeeping/checklists',
      'POST /housekeeping/checklists',
      'PUT /housekeeping/checklists/check-2',
      'PUT /housekeeping/checklists/check-2',
      'PUT /housekeeping/checklists/check-2',
    ],
    'el checklist se crea antes de cerrar la solicitud y se marca completed después',
  );
  assert.ok(hkBackend.requests.includes('GET /housekeeping/checklist-template'));
  const openAfter = expectedOpenRequests();
  assert.equal(openAfter, openBefore - 1);
  assert.equal(navBadge('Solicitudes'), openAfter ? String(openAfter) : undefined);
  assert.equal(
    hkBackend.rooms.find((room) => room.id === 'room-202').status,
    'occupied',
    'stayover no libera la habitación',
  );
});

test('limpieza: el badge de Habitaciones cuenta las pendientes y baja al iniciar una limpieza', async () => {
  await mountHousekeeping();
  await goTo('Habitaciones');
  const pendingRooms = () => roomCards().filter((card) => card.status === 'Pendiente').length;
  const before = pendingRooms();
  assert.equal(before, 2, 'las dos habitaciones dirty del backend');
  assert.equal(navBadge('Habitaciones'), String(before));

  await act(async () => buttons('Iniciar limpieza')[0].props.onClick());
  await settle();
  assert.equal(pendingRooms(), before - 1);
  assert.equal(navBadge('Habitaciones'), before - 1 ? String(before - 1) : undefined);
  assert.equal(hkBackend.rooms[0].housekeepingStatus, 'cleaning', 'la transición pasó por la API');
});

test('limpieza: el turnover no reutiliza ni modifica checklists stayover por roomId', async () => {
  await mountHousekeeping();
  await goTo('Habitaciones');

  const room202 = cardFor('202');
  assert.ok(room202, 'la habitación 202 existe');
  await act(async () => buttons('Ver detalle', room202.card)[0].props.onClick());
  await settle();

  const checklistItems = view.root.findAll((node) => hasClass(node, 'hk-check-item'));
  assert.match(text(checklistItems[0]), /Cama preparada/);
  assert.equal(
    checklistItems.some((item) => /Checklist stayover/.test(text(item))),
    false,
    'el checklist real de stayover no aparece como checklist de turnover',
  );

  await act(async () => checklistItems[0].props.onClick());
  await settle();

  assert.equal(
    hkBackend.requests.some((request) => request === 'PUT /housekeeping/checklists/check-stay-2'),
    false,
    'marcar un item visual de turnover no modifica el checklist real del stayover',
  );
});

test('limpieza: una habitación limpia se inspecciona contra el backend', async () => {
  await mountHousekeeping();
  await goTo('Habitaciones');
  assert.equal(cardFor('202').status, 'Completada');

  await act(async () => buttons('Inspeccionar', cardFor('202').card)[0].props.onClick());
  await settle();
  assert.equal(cardFor('202').status, 'Inspeccionada');
  assert.equal(hkBackend.rooms[3].housekeepingStatus, 'inspected');
  assert.equal(hkBackend.rooms[3].status, 'occupied', 'el turnover no toca Room.status');
});

test('limpieza: si el backend rechaza la transición se muestra el estado real', async () => {
  await mountHousekeeping();
  await goTo('Habitaciones');
  assert.equal(cardFor('101').status, 'Pendiente');

  // Otra persona inició la limpieza desde la app móvil; esta pantalla aún no lo sabe.
  hkBackend.rooms[0] = { ...hkBackend.rooms[0], housekeepingStatus: 'cleaning' };
  await act(async () => buttons('Iniciar limpieza', cardFor('101').card)[0].props.onClick());
  await settle();

  assert.ok(
    toasts().some((toast) => /rechazó la transición/.test(toast)),
    toasts().join(),
  );
  assert.equal(cardFor('101').status, 'En proceso', 'se recargó el estado real del backend');
});

// --- Limpieza: desperfectos contra ServiceRequestController (#126) --------

const defectsReported = () =>
  text(
    view.root
      .find((node) => hasClass(node, 'hk-summary-item') && text(node).includes('Desperfectos'))
      .find((node) => node.type === 'strong'),
  );
const openDefectModal = async () => {
  await act(async () =>
    buttons(
      'Reportar desperfecto',
      view.root.find((node) => hasClass(node, 'welcome-row')),
    )[0].props.onClick(),
  );
  return view.root.find(
    (node) => typeof node.props?.onSubmit === 'function' && Array.isArray(node.props.rooms),
  );
};
const defectReport = {
  room: '101',
  category: 'Eléctrico',
  description: 'Lámpara sin funcionar',
  priority: 'Media',
  observation: 'Revisar balastro',
  photo: '',
};

test('limpieza: los desperfectos salen de /service-requests y no pide finanzas', async () => {
  await mountHousekeeping();
  assert.ok(hkBackend.requests.includes('GET /service-requests'));
  assert.deepEqual(
    hkBackend.requests.filter((request) =>
      ['/charges', '/payments', '/deposits', '/guest-accounts'].some((path) =>
        request.endsWith(path),
      ),
    ),
    [],
    'Limpieza no tiene permisos financieros: no debe pedirlos',
  );
  assert.equal(defectsReported(), '1', 'cuenta el desperfecto que devuelve el backend');
});

test('limpieza: reportar un desperfecto lo crea como maintenance en el backend', async () => {
  await mountHousekeeping();
  const modal = await openDefectModal();
  await act(async () => modal.props.onSubmit(defectReport));
  await settle();

  const created = hkBackend.maintenance.at(-1);
  assert.equal(created.type, 'maintenance');
  assert.equal(created.roomId, 'room-101');
  assert.equal(created.description, 'Eléctrico: Lámpara sin funcionar');
  assert.equal(created.notes, 'Media - Revisar balastro');
  assert.equal(defectsReported(), '2');
  assert.ok(toasts().some((toast) => toast.includes('Reporte enviado correctamente')));
});

test('limpieza: si el backend rechaza el reporte no se agrega un desperfecto local', async () => {
  await mountHousekeeping();
  const fetchWithRules = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) =>
    (init.method ?? 'GET') === 'POST' && String(input).endsWith('/service-requests')
      ? new Response(JSON.stringify({ message: 'Room not found: room-101' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        })
      : fetchWithRules(input, init);

  const modal = await openDefectModal();
  await act(async () => modal.props.onSubmit(defectReport));
  await settle();

  assert.equal(defectsReported(), '1', 'sin confirmación del backend no cambia el contador');
  assert.ok(toasts().some((toast) => toast.includes('Room not found: room-101')));
});

// --- Room Service: backend falso de RoomServiceController (INT-10) --------
//
// Mismas reglas que RoomServiceOrderServiceImpl: transiciones exactas o 400 y
// `notes` opcional junto con el cambio de estado.

const rsOrder = (id, status, extra = {}) => ({
  id,
  bookingId: 'booking-rs',
  roomId: 'room-305',
  roomNumber: '305',
  guestId: 'guest-1',
  guestName: 'Ana López',
  status,
  notes: null,
  currency: 'GTQ',
  totalCents: 4500,
  items: [
    {
      id: `${id}-item`,
      productId: 'product-1',
      productName: 'Club sándwich',
      quantity: 1,
      unitPriceCents: 4500,
      lineTotalCents: 4500,
    },
  ],
  chargeId: null,
  requestedAt: '2026-10-03T12:00:00Z',
  createdAt: '2026-10-03T12:00:00Z',
  updatedAt: '2026-10-03T12:00:00Z',
  ...extra,
});

const rsProduct = (id, name, stockQuantity) => ({
  id,
  sku: id.toUpperCase(),
  name,
  description: `${name} de la cocina`,
  category: 'food_and_beverage',
  priceCents: 4500,
  currency: 'GTQ',
  active: true,
  stockQuantity,
  images: [],
});

const rsInventoryItem = (id, name, currentQuantity) => ({
  id,
  sku: id.toUpperCase(),
  name,
  description: null,
  category: 'room_service',
  unit: 'unit',
  currentQuantity,
  minimumQuantity: 2,
  lowStock: false,
  productId: null,
  active: true,
  images: [],
  createdAt: '2026-10-03T12:00:00Z',
  updatedAt: '2026-10-03T12:00:00Z',
});

// Opciones: `permissions` responde GET /auth/permissions ('fail' → 500; se puede cambiar en
// `state.permissions`) y tarda `permissionsDelayMs`; `inventory` es la lista de
// /inventory/items o 'forbidden' (403, rol sin inventory.read).
function installRoomServiceBackend({
  permissions = SESSION_PERMISSIONS.roomService,
  permissionsDelayMs = 0,
  inventory,
  products = [],
} = {}) {
  const state = { orders: [rsOrder('order-1', 'pending')], requests: [], inventory, permissions };
  const allowed = {
    pending: ['accepted', 'rejected', 'cancelled'],
    accepted: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['on_the_way', 'cancelled'],
    on_the_way: ['delivered'],
  };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const path = new URL(String(input)).pathname.replace(/^\/api\/v1/, '');
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    state.requests.push({ call: `${method} ${path}`, body });
    if (method === 'GET' && path === '/admin/audit-logs') return json([]);
    if (method === 'GET' && path === '/rooms') return json({ status: 403 }, 403);
    if (method === 'GET' && path === '/room-service/products') return json(products);
    if (method === 'GET' && path === '/room-service/orders') return json(state.orders);
    if (method === 'GET' && path === '/auth/permissions') {
      if (permissionsDelayMs)
        await new Promise((resolve) => setTimeout(resolve, permissionsDelayMs));
      return state.permissions === 'fail'
        ? json({ status: 500 }, 500)
        : json({ permissions: state.permissions });
    }
    if (path.startsWith('/inventory/items') && state.inventory === 'forbidden') {
      return json({ status: 403, message: 'Forbidden' }, 403);
    }
    if (method === 'GET' && path === '/inventory/items' && state.inventory) {
      return json(state.inventory);
    }
    const movement = path.match(/^\/inventory\/items\/([^/]+)\/movements$/);
    if (method === 'POST' && movement && state.inventory) {
      const item = state.inventory.find((entry) => entry.id === movement[1]);
      item.currentQuantity += body.quantity;
      return json({
        id: `movement-${state.requests.length}`,
        inventoryItemId: item.id,
        ...body,
        responsibleUserId: null,
        occurredAt: '2026-10-03T13:00:00Z',
        createdAt: '2026-10-03T13:00:00Z',
      });
    }
    const status = path.match(/^\/room-service\/orders\/([^/]+)\/status$/);
    if (method === 'POST' && status) {
      const order = state.orders.find((item) => item.id === status[1]);
      if (!(allowed[order.status] ?? []).includes(body.status)) return json({ status: 400 }, 400);
      order.status = body.status;
      if (body.notes !== undefined) order.notes = body.notes;
      return json(order);
    }
    return json({ message: `Ruta no mockeada: ${method} ${path}` }, 404);
  };
  return state;
}

let rsBackend;
async function mountRoomService(options) {
  rsBackend = installRoomServiceBackend(options);
  await act(async () => {
    view = create(
      <MemoryRouter>
        <PrivateWorkspace role="room-service" sessionName="Room Service Test" />
      </MemoryRouter>,
    );
  });
  for (let i = 0; i < 20 && !view.root.findAll((node) => hasClass(node, 'side-nav')).length; i++) {
    await settle(300);
  }
  assert.ok(view.root.findAll((node) => hasClass(node, 'side-nav')).length, 'workspace cargado');
}
const orderCards = () =>
  view.root.findAll((node) => node.type === 'article' && hasClass(node, 'rs-order-card'));
const orderStatus = (card) => text(card.find((node) => hasClass(node, 'status-pill')));
const statusCalls = () =>
  rsBackend.requests.filter(({ call }) => call.endsWith('/status')).map(({ body }) => body);

test('room service: los pedidos salen del backend con habitación, huésped y producto', async () => {
  await mountRoomService();
  assert.deepEqual(
    rsBackend.requests.filter(({ call }) => call === 'GET /rooms'),
    [],
    'Room Service no debe depender de rooms.read para cargar pedidos',
  );
  const [card] = orderCards();
  assert.ok(card, 'el pedido del backend aparece en Pedidos activos');
  assert.match(text(card), /Habitación 305 · Ana López/);
  assert.match(text(card), /Club sándwich/);
  assert.equal(orderStatus(card), 'Pendiente');
});

test('room service: aceptar envía el estado al backend sin notas', async () => {
  await mountRoomService();
  await act(async () => buttons('Aceptar pedido', orderCards()[0])[0].props.onClick());
  await settle();
  assert.deepEqual(statusCalls(), [{ status: 'accepted' }]);
  assert.equal(rsBackend.orders[0].status, 'accepted');
  assert.equal(orderStatus(orderCards()[0]), 'Aceptado');
});

test('room service: rechazar envía el motivo junto con el cambio de estado', async () => {
  await mountRoomService();
  await act(async () => buttons('Rechazar', orderCards()[0])[0].props.onClick());
  const textarea = view.root.find(
    (node) => node.type === 'textarea' && hasClass(node, 'rs-rejection-textarea'),
  );
  await act(async () => textarea.props.onChange({ target: { value: 'Cocina cerrada' } }));
  await act(async () => buttons('Confirmar rechazo')[0].props.onClick());
  await settle();
  assert.deepEqual(statusCalls(), [{ status: 'rejected', notes: 'Cocina cerrada' }]);
  assert.equal(rsBackend.orders[0].status, 'rejected');
  assert.equal(rsBackend.orders[0].notes, 'Cocina cerrada');
});

test('room service: si el backend rechaza la transición se recargan los pedidos reales', async () => {
  await mountRoomService();
  // El huésped canceló el pedido desde su portal; esta pantalla aún no lo sabe.
  rsBackend.orders[0].status = 'cancelled';
  await act(async () => buttons('Aceptar pedido', orderCards()[0])[0].props.onClick());
  await settle();
  assert.ok(
    view.root
      .findAll((node) => hasClass(node, 'toast'))
      .some((node) => /rechazó la operación/.test(text(node))),
    'se informa el rechazo del backend',
  );
  assert.equal(orderCards().length, 0, 'el pedido cancelado sale de Pedidos activos');
});

// Regresión: el Menú cargaba productos e inventario con Promise.all y el 403 de
// /inventory/items (rol room_service sin inventory.read) tumbaba todo el catálogo.
const rsMenuProducts = [
  rsProduct('product-1', 'Club sándwich', 18),
  rsProduct('product-2', 'Café de olla', 0),
];
const inventoryRequests = () =>
  rsBackend.requests.filter(({ call }) => call.includes('/inventory/'));
const sideNavCount = () => view.root.findAll((node) => hasClass(node, 'side-nav')).length;
async function createRoomServiceWorkspace(options) {
  rsBackend = installRoomServiceBackend(options);
  await act(async () => {
    view = create(
      <MemoryRouter>
        <PrivateWorkspace role="room-service" sessionName="Room Service Test" />
      </MemoryRouter>,
    );
  });
}

test('room service: sin inventory.read el Menú muestra productos con existencias y no pide inventario', async () => {
  await mountRoomService({ inventory: 'forbidden', products: rsMenuProducts });
  await settle();
  assert.ok(
    rsBackend.requests.some(({ call }) => call === 'GET /auth/permissions'),
    'consulta los permisos reales de la sesión',
  );
  assert.deepEqual(navLabels(), ['Pedidos activos', 'Menú', 'Historial']);

  await goTo('Menú');
  await settle();
  const menu = text(view.root);
  assert.ok(!menu.includes('No pudimos cargar el menú'), 'el menú no queda en error');
  assert.match(menu, /Club sándwich/);
  assert.match(menu, /18 disponibles/);
  assert.match(menu, /Café de olla/);
  assert.match(menu, /Agotado/);
  assert.deepEqual(inventoryRequests(), [], 'abrir el Menú no pide /inventory/items');

  await goTo('Historial');
  assert.match(text(view.root), /Historial de pedidos/);
  await goTo('Pedidos activos');
  assert.equal(orderCards().length, 1, 'los pedidos activos siguen cargando');
});

test('room service: el empleado respeta las secciones que Administración ocultó (navigation.*)', async () => {
  await mountRoomService({
    permissions: [
      ...SESSION_PERMISSIONS.roomService,
      'inventory.read',
      'navigation.configured',
      'navigation.room-service.pedidos-activos',
      'navigation.room-service.menu',
    ],
    inventory: [rsInventoryItem('inv-1', 'Café molido', 5)],
    products: rsMenuProducts,
  });
  assert.deepEqual(navLabels(), ['Pedidos activos', 'Menú'], 'Historial e Inventario ocultos');
  await goTo('Menú');
  await settle();
  assert.match(text(view.root), /18 disponibles/);
  assert.deepEqual(inventoryRequests(), []);
});

test('room service: mientras llegan los permisos reales no se muestra ninguna sección', async () => {
  await createRoomServiceWorkspace({ permissionsDelayMs: 1500, products: rsMenuProducts });
  await settle(800);
  assert.equal(sideNavCount(), 0, 'sin navegación antes de conocer los permisos');
  assert.match(text(view.root), /Cargando el panel privado/);
  await settle(1500);
  assert.deepEqual(navLabels(), ['Pedidos activos', 'Menú', 'Historial']);
});

test('room service: si /auth/permissions falla se muestra un error recuperable sin secciones', async () => {
  await createRoomServiceWorkspace({ permissions: 'fail', products: rsMenuProducts });
  await settle(1200);
  assert.equal(sideNavCount(), 0, 'no concede secciones por defecto');
  assert.match(text(view.root), /No pudimos verificar los permisos de tu usuario/);
  assert.ok(!text(view.root).includes('Inventario'));

  rsBackend.permissions = SESSION_PERMISSIONS.roomService;
  await act(async () => buttons('Reintentar')[0].props.onClick());
  await settle(1200);
  assert.deepEqual(navLabels(), ['Pedidos activos', 'Menú', 'Historial'], 'se recupera');
});

test('room service: un usuario sin secciones asignadas ve un error, no el menú por defecto', async () => {
  await createRoomServiceWorkspace({ permissions: ['bookings.read'] });
  await settle(1200);
  assert.equal(sideNavCount(), 0);
  assert.match(text(view.root), /no tiene secciones asignadas/);
});

test('room service: con inventory.read sin inventory.write se consulta pero no se ofrece registrar', async () => {
  await mountRoomService({
    permissions: [...SESSION_PERMISSIONS.roomService, 'inventory.read'],
    inventory: [rsInventoryItem('inv-1', 'Café molido', 5)],
  });
  await goTo('Inventario');
  await settle();
  assert.match(text(view.root), /Café molido5 piezas/);
  assert.equal(buttons('Registrar insumo').length, 0, 'requiere inventory.write');
});

test('room service: si el backend niega el inventario se muestra "Sin acceso" y no afecta al Menú', async () => {
  // Permisos de la sesión desactualizados respecto del backend: la sección maneja su 403.
  await mountRoomService({
    permissions: [...SESSION_PERMISSIONS.roomService, 'inventory.read', 'inventory.write'],
    inventory: 'forbidden',
    products: rsMenuProducts,
  });
  await goTo('Inventario');
  await settle();
  const inventory = text(view.root);
  assert.match(inventory, /Sin acceso al inventario/);
  assert.ok(!inventory.includes('No pudimos cargar el inventario'), 'sin error genérico');
  assert.equal(buttons('Registrar insumo').length, 0, 'no ofrece registrar sin acceso');

  await goTo('Menú');
  await settle();
  assert.match(text(view.root), /Club sándwich/);
});

test('room service: con inventory.read/write Inventario carga al entrar y se refresca tras registrar', async () => {
  await mountRoomService({
    permissions: [...SESSION_PERMISSIONS.roomService, 'inventory.read', 'inventory.write'],
    inventory: [rsInventoryItem('inv-1', 'Café molido', 5)],
    products: rsMenuProducts,
  });
  await settle();
  assert.deepEqual(navLabels(), ['Pedidos activos', 'Menú', 'Historial', 'Inventario']);
  assert.deepEqual(inventoryRequests(), [], 'no se pide antes de entrar a la sección');

  await goTo('Inventario');
  await settle();
  assert.match(text(view.root), /Café molido5 piezas/);

  await act(async () => buttons('Registrar insumo')[0].props.onClick());
  const quantity = view.root.find(
    (node) => node.type === 'input' && hasClass(node, 'rs-inventory-quantity'),
  );
  await act(async () => quantity.props.onChange({ target: { value: '3' } }));
  await act(async () => buttons('Registrar movimiento')[0].props.onClick());
  await settle(1500);

  assert.deepEqual(
    inventoryRequests().map(({ call }) => call),
    ['GET /inventory/items', 'POST /inventory/items/inv-1/movements', 'GET /inventory/items'],
  );
  assert.match(text(view.root), /Café molido8 piezas/, 'muestra la existencia actualizada');
});

// --- Conserjería: backend falso de ConciergeRequestController (INT-11) -----
//
// Mismas reglas que ConciergeRequestServiceImpl: transiciones exactas o 400,
// notas del cambio de estado agregadas y responsable asignado al tomar la solicitud.

const cgRequest = (id, status, extra = {}) => ({
  id,
  bookingId: 'booking-cg',
  roomId: 'room-402',
  roomNumber: '402',
  guestId: 'guest-cg',
  guestName: 'Luis Pérez',
  responsibleUserId: null,
  responsibleUserName: null,
  responsibleUserEmail: null,
  type: 'concierge',
  description: 'Reservar cena para dos',
  status,
  notes: null,
  chargeId: null,
  requestedAt: '2026-10-04T10:00:00Z',
  createdAt: '2026-10-04T10:00:00Z',
  updatedAt: '2026-10-04T10:00:00Z',
  ...extra,
});

function installConciergeBackend(initialStatus) {
  const state = { requests: [cgRequest('cg-1', initialStatus)], calls: [] };
  const allowed = {
    pending: ['accepted', 'rejected', 'cancelled'],
    accepted: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
  };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const path = new URL(String(input)).pathname.replace(/^\/api\/v1/, '');
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    state.calls.push({ call: `${method} ${path}`, body });
    if (method === 'GET' && path === '/admin/audit-logs') return json([]);
    if (method === 'GET' && path === '/concierge/requests') return json(state.requests);
    const match = path.match(/^\/concierge\/requests\/([^/]+)(\/status)?$/);
    const item = match && state.requests.find((request) => request.id === match[1]);
    if (method === 'GET' && item && !match[2]) return json(item);
    if (method === 'POST' && item && match[2]) {
      if (!(allowed[item.status] ?? []).includes(body.status)) return json({ status: 400 }, 400);
      item.status = body.status;
      if (body.notes) item.notes = body.notes;
      if (!item.responsibleUserId && body.status === 'accepted') {
        item.responsibleUserId = 'user-1';
        item.responsibleUserName = 'Douglas Gómez';
      }
      return json(item);
    }
    if (method === 'GET' && path === '/auth/permissions') {
      return json({ permissions: SESSION_PERMISSIONS.concierge });
    }
    return json({ message: `Ruta no mockeada: ${method} ${path}` }, 404);
  };
  return state;
}

let cgBackend;
async function mountConcierge(initialStatus = 'pending') {
  cgBackend = installConciergeBackend(initialStatus);
  await act(async () => {
    view = create(
      <MemoryRouter>
        <PrivateWorkspace role="concierge" sessionName="Conserjería Test" />
      </MemoryRouter>,
    );
  });
  for (let i = 0; i < 20 && !view.root.findAll((node) => hasClass(node, 'side-nav')).length; i++) {
    await settle(300);
  }
  assert.ok(view.root.findAll((node) => hasClass(node, 'side-nav')).length, 'workspace cargado');
}
const requestCards = () =>
  view.root.findAll((node) => node.type === 'article' && hasClass(node, 'cg-request-card'));
const requestStatus = (card) => text(card.findAll((node) => hasClass(node, 'status-pill')).at(-1));
const conciergeStatusCalls = () =>
  cgBackend.calls.filter(({ call }) => call.endsWith('/status')).map(({ body }) => body);
const confirmReason = async (actionLabel, reason, confirmLabel) => {
  await act(async () => buttons(actionLabel, requestCards()[0])[0].props.onClick());
  const textarea = view.root.find(
    (node) => node.type === 'textarea' && hasClass(node, 'cg-rejection-textarea'),
  );
  await act(async () => textarea.props.onChange({ target: { value: reason } }));
  await act(async () => buttons(confirmLabel)[0].props.onClick());
  await settle();
};

test('conserjería: con sus permisos reales conserva todas sus secciones', async () => {
  await mountConcierge();
  assert.deepEqual(navLabels(), ['Solicitudes', 'Por habitación', 'Historial']);
});

test('conserjería: las solicitudes salen del backend con habitación y huésped', async () => {
  await mountConcierge();
  const [card] = requestCards();
  assert.ok(card, 'la solicitud del backend aparece en Solicitudes');
  assert.match(text(card), /Habitación 402 · Luis Pérez/);
  assert.equal(requestStatus(card), 'Pendiente');
});

test('conserjería: aceptar envía solo el estado y muestra el responsable del backend', async () => {
  await mountConcierge();
  await act(async () => buttons('Aceptar solicitud', requestCards()[0])[0].props.onClick());
  await settle();
  assert.deepEqual(conciergeStatusCalls(), [{ status: 'accepted' }]);
  assert.equal(
    requestStatus(requestCards()[0]),
    'Aceptada',
    'accepted ya no se muestra como En proceso',
  );

  await act(async () => buttons('Ver detalle', requestCards()[0])[0].props.onClick());
  await settle();
  assert.ok(
    cgBackend.calls.some(({ call }) => call === 'GET /concierge/requests/cg-1'),
    'el detalle se pide al backend',
  );
  assert.match(text(view.root.find((node) => hasClass(node, 'cg-detail-modal'))), /Douglas Gómez/);
});

test('conserjería: rechazar envía el motivo junto con el cambio de estado', async () => {
  await mountConcierge();
  await confirmReason('Rechazar', 'Sin disponibilidad', 'Confirmar rechazo');
  assert.deepEqual(conciergeStatusCalls(), [{ status: 'rejected', notes: 'Sin disponibilidad' }]);
  assert.equal(cgBackend.requests[0].status, 'rejected');
});

test('conserjería: cancelar una solicitud aceptada envía el motivo y la cierra', async () => {
  await mountConcierge('accepted');
  await confirmReason('Cancelar', 'Ya no lo necesita', 'Confirmar cancelación');
  assert.deepEqual(conciergeStatusCalls(), [{ status: 'cancelled', notes: 'Ya no lo necesita' }]);
  assert.equal(cgBackend.requests[0].status, 'cancelled');
  assert.equal(requestCards().length, 0, 'la solicitud cancelada sale de las activas');
});

test('conserjería: si el backend rechaza la transición se recargan las solicitudes reales', async () => {
  await mountConcierge();
  // El huésped canceló desde su portal; esta pantalla aún no lo sabe.
  cgBackend.requests[0].status = 'cancelled';
  await act(async () => buttons('Aceptar solicitud', requestCards()[0])[0].props.onClick());
  await settle();
  assert.ok(
    view.root
      .findAll((node) => hasClass(node, 'toast'))
      .some((node) => /rechazó la operación/.test(text(node))),
    'se informa el rechazo del backend',
  );
  assert.equal(requestCards().length, 0, 'la solicitud cancelada sale de las activas');
});

// --- Portal del huésped: backend falso de GuestAccessController (INT-12) ----

function installGuestPortalBackend({ failBookings = false } = {}) {
  const state = {
    calls: [],
    notifications: [
      {
        id: 'n-1',
        type: 'room_service_accepted',
        title: 'Room Service',
        message: 'Pedido aceptado',
        read: false,
        createdAt: '2026-10-04T09:00:00Z',
      },
      {
        id: 'n-2',
        type: 'concierge_accepted',
        title: 'Concierge',
        message: 'Solicitud aceptada',
        read: false,
        createdAt: '2026-10-04T09:30:00Z',
      },
    ],
    orders: [],
  };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const path = new URL(String(input)).pathname.replace(/^\/api\/v1/, '');
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    state.calls.push({ call: `${method} ${path}`, body });
    if (path === '/guest/stay') {
      return json({
        bookingId: 'booking-guest',
        guestId: 'guest-1',
        guestFirstName: 'Ana',
        guestLastName: 'López',
        roomId: 'room-305',
        roomNumber: '305',
        roomTypeName: 'Suite Jardín',
        checkIn: '2026-10-03',
        checkOut: '2026-10-06',
        status: 'checked_in',
        balanceCents: 45000,
        currency: 'GTQ',
      });
    }
    if (path === '/guest/bookings') {
      if (failBookings) return json({ message: 'Service unavailable' }, 503);
      return json([
        {
          id: 'booking-guest',
          confirmationCode: 'CURRENT-BOOKING',
          guestId: 'guest-1',
          roomId: 'room-305',
          roomTypeId: 'type-suite',
          checkIn: '2026-10-03',
          checkOut: '2026-10-06',
          status: 'checked_in',
          adults: 2,
          children: 0,
          totalAmountCents: 135000,
          currency: 'GTQ',
          createdAt: '2026-10-01T10:00:00Z',
          updatedAt: '2026-10-01T10:00:00Z',
        },
        {
          id: 'booking-upcoming',
          confirmationCode: 'UPCOMING-BOOKING',
          guestId: 'guest-1',
          roomTypeId: 'type-standard',
          checkIn: '2026-11-03',
          checkOut: '2026-11-06',
          status: 'confirmed',
          adults: 1,
          children: 1,
          totalAmountCents: 90000,
          currency: 'GTQ',
          createdAt: '2026-10-01T10:00:00Z',
          updatedAt: '2026-10-01T10:00:00Z',
        },
      ]);
    }
    if (path === '/guest/room-service/products') {
      return json([
        {
          id: 'product-1',
          sku: 'FB-001',
          name: 'Club sándwich',
          category: 'food_and_beverage',
          priceCents: 4500,
          currency: 'GTQ',
          active: true,
        },
      ]);
    }
    if (path === '/guest/room-service/orders' && method === 'POST') {
      const order = {
        id: 'order-1',
        bookingId: 'booking-guest',
        roomId: 'room-305',
        roomNumber: '305',
        status: 'pending',
        notes: body.notes ?? null,
        currency: 'GTQ',
        items: body.items.map((item) => ({
          id: 'i-1',
          productId: item.productId,
          productName: 'Club sándwich',
          quantity: item.quantity,
          unitPriceCents: 4500,
        })),
        requestedAt: '2026-10-04T10:00:00Z',
        createdAt: '2026-10-04T10:00:00Z',
        updatedAt: '2026-10-04T10:00:00Z',
      };
      state.orders.push(order);
      return json(order, 201);
    }
    if (path === '/guest/notifications') return json(state.notifications);
    if (path === '/guest/notifications/unread-count') {
      return json({ unreadCount: state.notifications.filter((item) => !item.read).length });
    }
    if (path === '/guest/notifications/read-all' && method === 'POST') {
      state.notifications.forEach((item) => (item.read = true));
      return json(state.notifications);
    }
    if (path.startsWith('/guest/')) return json([]);
    return json({ message: `Ruta no mockeada: ${method} ${path}` }, 404);
  };
  return state;
}

let guestBackend;
async function mountGuestPortal() {
  guestBackend = installGuestPortalBackend();
  await act(async () => {
    view = create(
      <MemoryRouter>
        <PrivateWorkspace role="guest" sessionName="Ana López" />
      </MemoryRouter>,
    );
  });
  for (let i = 0; i < 20 && !text(view.root).includes('Habitacion 305'); i++) {
    await settle(300);
  }
  assert.ok(text(view.root).includes('Habitacion 305'), 'la estancia sale de /guest/stay');
}

test('portal del huésped: carga solo desde /guest, sin endpoints del personal', async () => {
  await mountGuestPortal();
  const paths = guestBackend.calls.map(({ call }) => call.split(' ')[1]);
  assert.ok(paths.includes('/guest/stay'));
  assert.ok(paths.includes('/guest/bookings'));
  assert.ok(paths.includes('/guest/notifications/unread-count'));
  assert.ok(
    paths.every((path) => path.startsWith('/guest/')),
    `solo rutas de huésped: ${paths.join(', ')}`,
  );
});

test('portal del huésped: muestra el error si falla la lista de reservas, sin fallback a la estancia', async () => {
  guestBackend = installGuestPortalBackend({ failBookings: true });
  await act(async () => {
    view = create(
      <MemoryRouter>
        <PrivateWorkspace role="guest" sessionName="Ana López" />
      </MemoryRouter>,
    );
  });
  for (
    let i = 0;
    i < 20 && !text(view.root).includes('No pudimos cargar tu portal de huésped');
    i++
  ) {
    await settle(300);
  }
  assert.ok(text(view.root).includes('No pudimos cargar tu portal de huésped'));
  assert.ok(!text(view.root).includes('Habitacion 305'));
});

test('portal del huésped: marcar todas usa read-all y el contador del backend', async () => {
  await mountGuestPortal();
  await act(async () => {
    view.root.findByProps({ className: 'icon-btn notification' }).props.onClick();
    await settle();
  });
  assert.ok(text(view.root).includes('2 notificaciones sin leer'), text(view.root));

  await act(async () => buttons('Marcar todas como leídas')[0].props.onClick());
  await settle();
  assert.ok(guestBackend.calls.some(({ call }) => call === 'POST /guest/notifications/read-all'));
  assert.ok(!text(view.root).includes('notificaciones sin leer'), 'el contador quedó en cero');
});

test('portal del huésped: el pedido de Room Service no elige la reserva', async () => {
  await mountGuestPortal();
  await goTo('Room service');
  await act(async () => buttons('Agregar')[0].props.onClick());
  await act(async () => buttons('Enviar pedido')[0].props.onClick());
  await settle();
  const post = guestBackend.calls.find(({ call }) => call === 'POST /guest/room-service/orders');
  assert.ok(post, 'el pedido va a /guest/room-service/orders');
  assert.ok(!('bookingId' in post.body), 'la reserva la toma el backend del JWT');
  assert.deepEqual(post.body.items, [{ productId: 'product-1', quantity: 1 }]);
});

// --- Recepción: cancelación formal contra BookingController (#126) --------

const REC_BOOKING_ID = '1f24bc67-4a9d-4c1d-9210-d661f60e1260';
const NEW_GUEST_ID = '40000000-0000-4000-8000-000000000001';
const NEW_BOOKING_ID = '50000000-0000-4000-8000-000000000001';

function installReceptionBackend({
  bookingStatus = 'confirmed',
  bookingRoomId = 'room-101',
  checkInDate = '2026-12-10',
  checkOutDate = '2026-12-12',
  rooms = [hkRoom('room-101', '101', 'clean')],
  payments = [],
  paymentsForbidden = false,
} = {}) {
  const now = '2026-10-05T10:00:00Z';
  const state = {
    booking: {
      id: REC_BOOKING_ID,
      confirmationCode: 'BKG-126',
      guestLinkCode: 'LNK-126',
      guestId: '7d2f8f2a-0b48-47a4-9bc3-3b1b0874d126',
      roomId: bookingRoomId,
      roomTypeId: 'type-standard',
      rateId: null,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      status: bookingStatus,
      adults: 2,
      children: 0,
      totalAmountCents: 100000,
      currency: 'GTQ',
      notes: 'Llega tarde',
      cancellationReason: null,
      cancelledAt: null,
      createdAt: now,
      updatedAt: now,
    },
    requests: [],
  };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const path = new URL(String(input)).pathname.replace(/^\/api\/v1/, '');
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    state.requests.push({ call: `${method} ${path}`, body });
    if (
      method === 'GET' &&
      (path.startsWith('/room-service/') || path === '/room-types' || path === '/room-features')
    ) {
      return json({ message: 'Forbidden' }, 403);
    }
    if (method === 'GET' && path === '/bookings') return json([state.booking]);
    if (method === 'GET' && path === `/bookings/${REC_BOOKING_ID}`) return json(state.booking);
    if (method === 'GET' && path === '/guests') {
      return json([
        {
          id: state.booking.guestId,
          firstName: 'Elena',
          lastName: 'Castro',
          email: 'elena@example.com',
          phone: '+502 5555-1010',
          documentType: 'national_id',
          documentNumber: '1000 20000 0101',
          createdAt: now,
          updatedAt: now,
        },
      ]);
    }
    if (method === 'GET' && path === '/rooms') return json(rooms);
    if (method === 'GET' && path === '/payments') {
      return paymentsForbidden ? json({ message: 'Forbidden' }, 403) : json(payments);
    }
    if (method === 'GET' && path === '/room-types') {
      return json([
        {
          id: 'type-standard',
          name: 'Estándar',
          description: 'Habitación estándar',
          capacity: 2,
          basePriceCents: 50000,
          currency: 'GTQ',
          roomFeatureIds: [],
          createdAt: now,
          updatedAt: now,
        },
      ]);
    }
    if (method === 'POST' && path === `/bookings/${REC_BOOKING_ID}/cancel`) {
      if (!['pending', 'confirmed'].includes(state.booking.status)) {
        return json({ message: 'Only pending or confirmed bookings can be cancelled' }, 400);
      }
      Object.assign(state.booking, {
        status: 'cancelled',
        cancellationReason: body.reason,
        cancelledAt: now,
      });
      return json(state.booking);
    }
    if (method === 'POST' && path === `/bookings/${REC_BOOKING_ID}/confirm`) {
      if (state.booking.status !== 'pending') {
        return json({ message: 'Only pending bookings can be confirmed' }, 400);
      }
      Object.assign(state.booking, { status: 'confirmed', updatedAt: now });
      return json(state.booking);
    }
    if (method === 'PUT' && path === `/bookings/${REC_BOOKING_ID}`) {
      Object.assign(state.booking, body);
      return json(state.booking);
    }
    if (method === 'POST' && path === `/bookings/${REC_BOOKING_ID}/check-in`) {
      state.booking.status = 'checked_in';
      return json({});
    }
    if (method === 'GET' && path === '/auth/permissions') {
      return json({ permissions: SESSION_PERMISSIONS.reception });
    }
    // Alta de "Nueva reserva": tarifa abierta, huésped nuevo y reserva confirmada.
    if (method === 'GET' && path === '/rates') {
      return json([
        {
          id: 'rate-standard',
          // Misma tarifa para el tipo de la primera habitación del escenario.
          roomTypeId: rooms[0]?.roomTypeId ?? 'type-standard',
          name: 'Tarifa estándar',
          validFrom: '2020-01-01',
          validTo: '2099-12-31',
          priceCents: 50000,
          currency: 'GTQ',
          minimumNights: 1,
          refundable: true,
          active: true,
          createdAt: now,
          updatedAt: now,
        },
      ]);
    }
    if (method === 'POST' && path === '/guests') {
      return json({ id: NEW_GUEST_ID, ...body, createdAt: now, updatedAt: now }, 201);
    }
    if (method === 'POST' && path === '/bookings') {
      state.created = {
        id: NEW_BOOKING_ID,
        confirmationCode: 'BKG-NEW00001',
        guestLinkCode: 'GL-NEW00001',
        ...body,
        status: 'pending',
        totalAmountCents: 100000,
        currency: 'GTQ',
        createdAt: now,
        updatedAt: now,
      };
      return json(state.created, 201);
    }
    if (method === 'POST' && path === `/bookings/${NEW_BOOKING_ID}/confirm`) {
      state.created.status = 'confirmed';
      return json(state.created);
    }
    if (method === 'GET') return json([]);
    return json({ message: `Ruta no mockeada: ${method} ${path}` }, 404);
  };
  return state;
}

let recBackend;
async function mountReception(options) {
  recBackend = installReceptionBackend(options);
  await act(async () => {
    view = create(
      <MemoryRouter>
        <PrivateWorkspace role="reception" sessionName="Recepción Test" />
      </MemoryRouter>,
    );
  });
  for (let i = 0; i < 20 && !view.root.findAll((node) => hasClass(node, 'side-nav')).length; i++) {
    await settle(300);
  }
  assert.ok(view.root.findAll((node) => hasClass(node, 'side-nav')).length, 'workspace cargado');
}
const receptionContent = () =>
  view.root.find(
    (node) => typeof node.props?.onCancel === 'function' && Array.isArray(node.props.reservations),
  );
const recReservation = () =>
  receptionContent().props.reservations.find((item) => item.bookingId === REC_BOOKING_ID);
const recCalls = (suffix) =>
  recBackend.requests.filter(({ call }) => call.endsWith(suffix)).map(({ body }) => body);

test('recepción: con sus permisos reales conserva todas sus secciones', async () => {
  await mountReception();
  assert.deepEqual(navLabels(), [
    'Resumen',
    'Calendario',
    'Reservas',
    'Huéspedes',
    'Disponibilidad',
    'Habitaciones',
    'Caja',
  ]);
});

test('recepción: carga solicitudes y finanzas globales desde el backend', async () => {
  await mountReception();
  for (const path of ['/service-requests', '/charges', '/payments', '/deposits']) {
    assert.ok(
      recBackend.requests.some(({ call }) => call === `GET ${path}`),
      `recepción consulta ${path}`,
    );
  }
});

test('recepción: los endpoints sin permiso no bloquean el inicio del panel', async () => {
  await mountReception();
  assert.ok(view.root.findAll((node) => hasClass(node, 'side-nav')).length);
  assert.ok(!text(view.root).includes('No tienes permisos para operar Room Service.'));
  assert.ok(!text(view.root).includes('Forbidden'));
});

test('recepción: cancelar una reserva envía el motivo al backend y muestra la reserva real', async () => {
  await mountReception();
  assert.equal(recReservation().status, 'Confirmada');

  await act(async () =>
    receptionContent().props.onCancel(recReservation().id, 'Cambio de planes del huésped'),
  );
  await settle();

  assert.deepEqual(recCalls(`/bookings/${REC_BOOKING_ID}/cancel`), [
    { reason: 'Cambio de planes del huésped' },
  ]);
  assert.equal(recReservation().status, 'Cancelada');
  assert.equal(
    recReservation().cancelReason,
    'Cambio de planes del huésped',
    'el motivo sale de cancellationReason, no de las notas',
  );
  assert.ok(toasts().some((toast) => toast.includes('Reserva cancelada correctamente')));
});

test('recepción: si el backend rechaza la cancelación la reserva no cambia', async () => {
  await mountReception();
  recBackend.booking.status = 'checked_in';

  await act(async () => receptionContent().props.onCancel(recReservation().id, 'Ya no viene'));
  await settle();

  assert.equal(recCalls(`/bookings/${REC_BOOKING_ID}/cancel`).length, 1);
  assert.equal(recReservation().status, 'Confirmada', 'no se marca cancelada sin el backend');
  assert.ok(
    toasts().some((toast) => toast.includes('Only pending or confirmed bookings can be cancelled')),
  );
});

test('recepción: confirma una reserva pendiente antes de habilitar check-in', async () => {
  await mountReception({ bookingStatus: 'pending' });
  const reservation = recReservation();
  assert.equal(reservation.status, 'Pendiente');

  act(() => receptionContent().props.onSelectRes(reservation.id));
  const confirmButton = view.root.find(
    (node) => node.type === 'button' && node.props['aria-label'] === 'Confirmar reserva',
  );
  assert.ok(confirmButton, 'el detalle muestra la acción explícita de confirmar');
  assert.equal(
    view.root.findAll(
      (node) => node.type === 'button' && node.props['aria-label'] === 'Realizar check-in',
    ).length,
    0,
    'no ofrece check-in para una reserva pendiente',
  );

  await act(async () => {
    await confirmButton.props.onClick();
    await settle();
  });

  assert.ok(
    recBackend.requests.some(({ call }) => call === `POST /bookings/${REC_BOOKING_ID}/confirm`),
    'confirma con el backend',
  );
  assert.equal(recReservation().status, 'Confirmada');
  assert.equal(
    view.root.findAll(
      (node) => node.type === 'button' && node.props['aria-label'] === 'Realizar check-in',
    ).length,
    1,
    'el check-in queda disponible tras confirmar',
  );
});

test('recepción: asigna una habitación compatible dentro del check-in', async () => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(
    new Date(),
  );
  const tomorrowDate = new Date(`${today}T12:00:00`);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(
    tomorrowDate,
  );
  await mountReception({
    bookingRoomId: null,
    checkInDate: today,
    checkOutDate: tomorrow,
    rooms: [
      hkRoom('20000000-0000-4000-8000-000000000102', '102', 'inspected', {
        roomTypeId: 'type-deluxe',
      }),
      hkRoom('20000000-0000-4000-8000-000000000201', '201', 'inspected'),
    ],
  });

  const reservation = recReservation();
  act(() => receptionContent().props.onSelectRes(reservation.id));
  assert.equal(
    view.root.findAll(
      (node) => node.type === 'button' && node.props['aria-label'] === 'Cambiar habitación',
    ).length,
    0,
    'una reserva sin habitación asignada no ofrece cambiar habitación',
  );

  const checkInButton = view.root.find(
    (node) => node.type === 'button' && node.props['aria-label'] === 'Realizar check-in',
  );
  await act(async () => {
    checkInButton.props.onClick();
    await settle();
  });

  const roomOptions = view.root.findAll(
    (node) => node.type === 'button' && hasClass(node, 'rc-room-option'),
  );
  assert.equal(roomOptions.length, 1, 'solo muestra habitaciones del mismo tipo por ID');
  assert.ok(text(roomOptions[0]).includes('201'));

  await act(async () => {
    roomOptions[0].props.onClick();
    await settle();
  });
  await act(async () => {
    buttons('Confirmar check-in')[0].props.onClick();
    await settle(1500);
  });

  const calls = recBackend.requests.map(({ call }) => call);
  const assignmentIndex = calls.indexOf(`PUT /bookings/${REC_BOOKING_ID}`);
  const checkInIndex = calls.indexOf(`POST /bookings/${REC_BOOKING_ID}/check-in`);
  assert.ok(assignmentIndex >= 0, 'asigna la habitación antes del check-in');
  assert.ok(checkInIndex > assignmentIndex, 'confirma el check-in después de asignar');
  assert.equal(
    recBackend.requests[assignmentIndex].body.roomId,
    '20000000-0000-4000-8000-000000000201',
  );
  assert.equal(recReservation().status, 'Check-in');
  assert.equal(recReservation().roomNumber, '201');
});

// --- Recepción · Resumen (subfase 1A) ---------------------------------------

const localDay = (offsetDays = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return toDtoCalendarDate(date);
};
const localNoonIso = (offsetDays = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setHours(12, 0, 0, 0);
  return date.toISOString();
};
const metric = (label) => {
  const card = view.root.find(
    (node) =>
      hasClass(node, 'metric-card') &&
      node.findAll((child) => child.type === 'p' && text(child) === label).length > 0,
  );
  return {
    value: text(card.findByType('h2')),
    change: text(card.findByType('span')),
  };
};
const statCard = (label) =>
  text(
    view.root
      .find(
        (node) =>
          hasClass(node, 'rc-stat-card') &&
          node.findAll((child) => child.type === 'small' && text(child) === label).length > 0,
      )
      .findByType('strong'),
  );
const backendPayment = (id, amountCents, status, offsetDays = 0) => ({
  id,
  bookingId: REC_BOOKING_ID,
  amountCents,
  currency: 'GTQ',
  method: 'cash',
  status,
  transactionReference: null,
  paidAt: localNoonIso(offsetDays),
  createdAt: localNoonIso(offsetDays),
});

test('recepción · resumen: llegadas con el mismo criterio en métricas y tarjetas', async () => {
  await mountReception({ checkInDate: localDay(0), checkOutDate: localDay(2) });
  assert.deepEqual(metric('Llegadas de hoy'), {
    value: '1',
    change: '1 por llegar · 0 con check-in',
  });
  assert.equal(statCard('Llegadas hoy'), '1');
  assert.equal(metric('Salidas de hoy').value, '0');
  assert.equal(statCard('Salidas hoy'), '0');
});

test('recepción · resumen: salidas con el mismo criterio en métricas y tarjetas', async () => {
  await mountReception({
    bookingStatus: 'checked_in',
    checkInDate: localDay(-2),
    checkOutDate: localDay(0),
  });
  assert.deepEqual(metric('Salidas de hoy'), {
    value: '1',
    change: '1 por salir · 0 con check-out',
  });
  assert.equal(statCard('Salidas hoy'), '1');
  assert.equal(metric('Llegadas de hoy').value, '0');
  assert.equal(statCard('Llegadas hoy'), '0');
});

test('recepción · resumen: "Pagos de hoy" solo suma pagos completados del backend', async () => {
  await mountReception({
    payments: [
      backendPayment('pay-1', 15000, 'completed'),
      backendPayment('pay-2', 5050, 'completed'),
      backendPayment('pay-3', 9999, 'refunded'),
      backendPayment('pay-4', 7000, 'completed', -1),
    ],
  });
  assert.deepEqual(metric('Pagos de hoy'), {
    value: 'Q200.50',
    change: '2 pagos registrados',
  });

  // Un pago que solo existe en el folio local no altera la métrica.
  await act(async () =>
    receptionContent().props.onAddPayment(recReservation().id, 500, 'Efectivo', 'LOCAL-1'),
  );
  assert.equal(metric('Pagos de hoy').value, 'Q200.50');
});

test('recepción · resumen: sin acceso a pagos muestra un estado claro, no Q0.00', async () => {
  await mountReception({ paymentsForbidden: true });
  assert.deepEqual(metric('Pagos de hoy'), {
    value: 'Sin datos',
    change: 'No hay acceso a los pagos registrados',
  });
});

test('recepción · resumen: sin habitaciones no muestra NaN%', async () => {
  await mountReception({ rooms: [], bookingRoomId: null });
  assert.equal(metric('Ocupación actual').value, '—');
  assert.ok(!text(view.root).includes('NaN'), 'ningún indicador muestra NaN');
});

test('recepción · resumen: las filas se abren con Enter y Espacio', async () => {
  await mountReception({ checkInDate: localDay(0), checkOutDate: localDay(2) });
  const rows = () =>
    view.root.findAll((node) => hasClass(node, 'rc-dash-row') && node.props.role === 'button');
  assert.ok(rows().length > 0, 'las filas exponen role="button"');
  assert.ok(
    rows().every((row) => row.props.tabIndex === 0),
    'todas reciben foco con Tab',
  );

  const detailOpen = () => view.root.findAll((node) => hasClass(node, 'rc-detail-modal')).length;
  act(() => rows()[0].props.onKeyDown({ key: 'a', preventDefault() {} }));
  assert.equal(detailOpen(), 0, 'otras teclas no abren el detalle');

  let prevented = false;
  act(() =>
    rows()[0].props.onKeyDown({
      key: 'Enter',
      preventDefault() {
        prevented = true;
      },
    }),
  );
  assert.equal(detailOpen(), 1, 'Enter abre el detalle');
  assert.ok(prevented);

  act(() => receptionContent().props.onCloseRes());
  act(() => rows()[0].props.onKeyDown({ key: ' ', preventDefault() {} }));
  assert.equal(detailOpen(), 1, 'Espacio abre el detalle');
});

test('recepción · resumen: fechas de reservas pendientes en formato de Guatemala', async () => {
  await mountReception();
  assert.ok(text(view.root).includes('10-12-2026 – 12-12-2026'), text(view.root));
});

test('recepción · resumen: "Bloquear habitación" no simula un bloqueo guardado', async () => {
  await mountReception();
  const quickBlock = view.root
    .find((node) => hasClass(node, 'rc-quick-actions'))
    .findAll((node) => node.type === 'button' && text(node).includes('Bloquear habitación'))[0];
  await act(async () => quickBlock.props.onClick());

  assert.ok(
    toasts().some((toast) => toast.includes('aún no está disponible')),
    'informa que el bloqueo no está disponible',
  );
  assert.ok(!toasts().some((toast) => toast.includes('bloqueada')), 'no confirma un bloqueo');
  assert.ok(!text(view.root).includes('BLOQUEAR HABITACIÓN'), 'no abre el modal de bloqueo');
  assert.equal(
    recBackend.requests.filter(({ call }) => !call.startsWith('GET ')).length,
    0,
    'no envía cambios al backend',
  );
});

// --- Auditoría administrativa: solo la pide quien tiene ROLE_ADMIN ----------------

const AUDIT_PATH = '/admin/audit-logs';

test('auditoría: recepción no solicita /admin/audit-logs', async () => {
  await mountReception();
  assert.ok(
    recBackend.requests.some(({ call }) => call === 'GET /bookings'),
    'el panel cargó',
  );
  assert.equal(
    recBackend.requests.filter(({ call }) => call.includes(AUDIT_PATH)).length,
    0,
    'recepción no pide auditoría (el backend respondería 403)',
  );
});

test('auditoría: limpieza tampoco solicita /admin/audit-logs', async () => {
  await mountHousekeeping();
  assert.equal(hkBackend.requests.filter((call) => call.includes(AUDIT_PATH)).length, 0);
});

test('auditoría: administración conserva la consulta en su panel y al ver Recepción', async () => {
  const calls = [];
  originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const path = new URL(String(input)).pathname.replace(/^\/api\/v1/, '');
    calls.push(`${init.method ?? 'GET'} ${path}`);
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const auditCalls = () => calls.filter((call) => call === `GET ${AUDIT_PATH}`).length;

  await act(async () => {
    view = create(
      <MemoryRouter>
        <PrivateWorkspace role="admin" sessionName="Admin Test" />
      </MemoryRouter>,
    );
  });
  for (let i = 0; i < 20 && auditCalls() === 0; i++) await settle(300);
  assert.ok(auditCalls() >= 1, 'el panel de administración consulta la auditoría');

  const before = auditCalls();
  const subitems = () =>
    view.root
      .findAll((node) => node.type === 'button' && hasClass(node, 'nav-subitem'))
      .map((node) => text(node));
  if (navItem('Recepción').props['aria-expanded'] !== true) {
    await act(async () => navItem('Recepción').props.onClick());
  }
  const resumen = view.root.findAll(
    (node) => node.type === 'button' && hasClass(node, 'nav-subitem') && text(node) === 'Resumen',
  )[0];
  assert.ok(resumen, `submenú de Recepción visible: ${subitems().join(', ')}`);
  await act(async () => resumen.props.onClick());
  for (let i = 0; i < 20 && auditCalls() === before; i++) await settle(300);
  assert.ok(auditCalls() > before, 'el administrador sigue consultando auditoría al ver Recepción');
});

// --- Nueva reserva: nombres, correo compatible con el backend, teléfono y cambio de día ---

const VALID_NAMES = [
  // Guatemala
  'José María',
  'María José',
  'Ana Lucía',
  'José Ángel',
  'Muñoz',
  'De la Cruz',
  'María-José de León',
  'Ma. José',
  'Xiomara Ixchel',
  // Internacionales
  "O'Connor",
  'O\u2019Connor',
  'Jean-Pierre',
  "D'Ángelo",
  'St. John',
  'Nguyễn Văn An',
  'Zoë',
  'Øyvind',
  'Đorđe',
  'Al-Hassan',
];
const INVALID_NAMES = [
  'Ana2',
  '123',
  'J0sé',
  '@na',
  'Ana!',
  'Ana_Lucía',
  'Ana/Lucía',
  '<script>',
  'Ana 😀',
  '-Ana',
  'Ana-',
  "'Ana",
  "Ana'",
  '. Ana',
  'Jean--Pierre',
  "O''Connor",
  'Ana - Lucía',
  'Ana..',
  'Ana\u200B',
];

test('nueva reserva · nombres: acepta nombres guatemaltecos e internacionales', () => {
  for (const name of VALID_NAMES) {
    assert.equal(validatePersonName(name, 'nombre'), null, name);
    assert.equal(validatePersonName(name, 'apellido'), null, name);
  }
});

test('nueva reserva · nombres: rechaza dígitos, emojis, símbolos y separadores sueltos', () => {
  for (const name of INVALID_NAMES) {
    assert.equal(validatePersonName(name, 'nombre'), 'Solo se permiten letras.', name);
  }
  assert.equal(validatePersonName('', 'nombre'), 'Ingresa el nombre.');
  assert.equal(validatePersonName('   ', 'apellido'), 'Ingresa el apellido.');
});

test('nueva reserva · nombres: mínimo 3 letras reales', () => {
  // Menos de 3 letras.
  assert.equal(validatePersonName('s', 'nombre'), 'Mínimo 3 letras.');
  assert.equal(validatePersonName('w', 'apellido'), 'Mínimo 3 letras.');
  assert.equal(validatePersonName('A', 'nombre'), 'Mínimo 3 letras.');
  assert.equal(validatePersonName('Jo', 'nombre'), 'Mínimo 3 letras.');
  assert.equal(validatePersonName('Li', 'apellido'), 'Mínimo 3 letras.');
  // Una o dos letras con separadores: los separadores no cuentan como letras.
  for (const name of ['A.', 'J.R.', 'A-B', 'A B', 'Jo.', '  s  ', 'A. B.']) {
    assert.equal(validatePersonName(name, 'nombre'), 'Mínimo 3 letras.', name);
  }
  // Separadores sueltos o en un extremo: se rechazan por formato.
  for (const name of ['-', "'", '.', '- -', "O'", '-A', 'A-']) {
    assert.equal(validatePersonName(name, 'nombre'), 'Solo se permiten letras.', name);
  }
  // 3 letras o más.
  assert.equal(validatePersonName('José', 'nombre'), null);
  assert.equal(validatePersonName('Muñoz', 'apellido'), null);
  assert.equal(validatePersonName('Ana María', 'nombre'), null);
  assert.equal(validatePersonName('Zoë', 'nombre'), null, 'ë es una sola letra');
  assert.equal(validatePersonName('Ana', 'nombre'), null, 'exactamente 3 letras');
  assert.equal(validatePersonName('Jo Li', 'nombre'), null, '4 letras en dos palabras');
  // Tilde combinada: tras NFC "e" + U+0301 es una sola letra.
  assert.equal(validatePersonName('Jose\u0301', 'nombre'), null);
  assert.equal(validatePersonName('  Ana   María  ', 'nombre'), null, 'espacios sobrantes');
});

test('nueva reserva · nombres: máximo 20 caracteres con tildes, ñ y espacios', () => {
  // Exactamente 20 caracteres.
  for (const name of ['María José Peñate Ló', 'José Ángel Muñoz Paz', 'a'.repeat(20)]) {
    assert.equal(name.length, 20, name);
    assert.equal(validatePersonName(name, 'nombre'), null, name);
  }
  // 21 caracteres.
  for (const name of ['María-José de la Cruz', 'José Ángel Muñoz Pazo', 'a'.repeat(21)]) {
    assert.equal(name.length, 21, name);
    assert.equal(validatePersonName(name, 'apellido'), 'Máximo 20 caracteres.', name);
  }
  // Los espacios sobrantes no cuentan: se normaliza antes de medir.
  assert.equal(validatePersonName('  José   Ángel  Muñoz ', 'nombre'), null);
  assert.equal(validatePersonName('Ñuñoa Peñalosa', 'apellido'), null);
});

test('nueva reserva · nombres: normaliza espacios y Unicode sin cambiar mayúsculas', () => {
  assert.equal(normalizePersonName('  José   María  '), 'José María');
  assert.equal(normalizePersonName('Ana\tLucía'), 'Ana Lucía');
  // "e" + acento combinado (U+0301) se guarda como "é" (NFC).
  assert.equal(normalizePersonName('Jose\u0301'), 'José');
  assert.equal(normalizePersonName('De la Cruz'), 'De la Cruz');
  assert.equal(normalizePersonName('mcDONALD'), 'mcDONALD');
});

test('nueva reserva · correo: rechaza lo que el backend rechaza', () => {
  // Rechazados por el @Email del backend (comprobado contra la API real).
  for (const email of [
    'a..b@x.com',
    '.ana@x.com',
    'ana.@x.com',
    'ana@-x.com',
    'ana@x-.com',
    'ana@x..com',
    'ana@.x.com',
    'ana@x.com.',
    'ana(x)@x.com',
    'ana,b@x.com',
    'ana b@x.com',
    'ana@@x.com',
  ]) {
    assert.match(validateEmail(email), /formato válido/, email);
  }
  assert.match(validateEmail(`${'a'.repeat(65)}@x.com`), /antes de @ no puede superar 64/);
  assert.match(validateEmail(`ana@${'b'.repeat(64)}.com`), /como máximo 63/);
});

test('nueva reserva · correo: acepta formatos válidos que el backend también acepta', () => {
  for (const email of [
    'ana.lopez@example.com',
    'maria+viajes@hotel.com.gt',
    "o'connor@example.com",
    'ana_b@x.com',
    'ana@ex-ample.com',
    'ana@ex_ample.com',
    'josé@correo.gt',
    'ñandú@correo.gt',
    'ana@ñandú.gt',
    'ana@x.123',
    `${'a'.repeat(64)}@x.com`,
    `ana@${'b'.repeat(63)}.com`,
  ]) {
    assert.equal(validateEmail(email), null, email);
  }
  // Más estricto que el backend a propósito: exige un dominio con punto.
  assert.match(validateEmail('ana@localhost'), /formato válido/);
});

test('nueva reserva: rechaza nombres con dígitos y guarda los nombres normalizados', () => {
  const saved = renderReservationForm();
  fillGuestAndRoom();
  setDates(IN_5, IN_7);
  const [name, lastName] = textInputs();
  assert.equal(name.props.maxLength, 20);
  assert.equal(lastName.props.maxLength, 20);
  typeInto(name, 'Ana2');
  typeInto(lastName, 'L@pez');
  openSummary();
  assert.ok(formIsOpen(), 'no avanza al resumen');
  assert.equal(
    fieldErrors().filter((error) => error === 'Solo se permiten letras.').length,
    2,
    'un error en nombre y otro en apellido',
  );

  typeInto(name, '');
  openSummary();
  assert.ok(fieldErrors().includes('Ingresa el nombre.'));

  // "s" / "w": una sola letra no permite avanzar al resumen.
  typeInto(name, 's');
  typeInto(lastName, 'w');
  openSummary();
  assert.ok(formIsOpen(), 'no avanza al resumen con "s" / "w"');
  assert.equal(fieldErrors().filter((error) => error === 'Mínimo 3 letras.').length, 2);
  assert.equal(saved.length, 0);

  typeInto(name, '  José   María ');
  typeInto(lastName, 'de la Cruz');
  openSummary();
  assert.match(text(view.root), /José María de la Cruz/);
  act(() => buttons('Confirmar reserva')[0].props.onClick());
  assert.equal(saved.length, 1);
  assert.equal(saved[0].guest.name, 'José María');
  assert.equal(saved[0].guest.lastName, 'de la Cruz', 'conserva las minúsculas originales');
});

test('nueva reserva: al cambiar el día en Guatemala, valida con la fecha nueva al guardar', () => {
  // 23:50 del 18-10-2026 en Guatemala (UTC−6) = 05:50 UTC del 19.
  mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-19T05:50:00Z') });
  try {
    const saved = renderReservationForm();
    fillGuestAndRoom();
    setDates('2026-10-18', '2026-10-20');
    assert.deepEqual(dateAlert(), [], 'el 18 todavía es hoy');
    openSummary();
    assert.ok(!formIsOpen(), 'el resumen se abre');

    // Pasa la medianoche: 00:10 del 19 en Guatemala.
    mock.timers.setTime(Date.parse('2026-10-19T06:10:00Z'));
    act(() => buttons('Confirmar reserva')[0].props.onClick());

    assert.equal(saved.length, 0, 'no guarda una entrada que ya es pasada');
    assert.ok(formIsOpen(), 'vuelve al formulario para mostrar el error');
    assert.deepEqual(dateAlert(), [
      'La fecha de entrada no puede ser anterior a hoy (19-10-2026).',
    ]);
  } finally {
    mock.timers.reset();
  }
});

// --- Recepción: Editar reserva (formulario 2) --------------------------------

// "Hoy" fijo para las reglas de fechas: 12:00 del 18-10-2026 en Guatemala.
const EDIT_TODAY = Date.parse('2026-10-18T18:00:00Z');
afterEach(() => mock.timers.reset());

/** Fila de la reserva tal como la entrega el workspace (guestCount = adultos + menores). */
const editRow = (booking) => ({
  id: 1,
  bookingId: booking.id,
  code: booking.confirmationCode,
  checkIn: booking.checkIn,
  checkOut: booking.checkOut,
  guestCount: booking.adults + booking.children,
  adults: booking.adults,
  children: booking.children,
  observations: booking.notes ?? '',
});

async function renderEditModal({
  checkIn = '2026-12-10',
  checkOut = '2026-12-12',
  notes,
  adults,
  children,
  wait = true,
} = {}) {
  mock.timers.enable({ apis: ['Date'], now: EDIT_TODAY });
  recBackend = installReceptionBackend({ checkInDate: checkIn, checkOutDate: checkOut });
  if (notes !== undefined) recBackend.booking.notes = notes;
  if (adults !== undefined) recBackend.booking.adults = adults;
  if (children !== undefined) recBackend.booking.children = children;
  const calls = { saved: 0, closed: 0 };
  await act(async () => {
    view = create(
      <ReservationEditModal
        reservation={editRow(recBackend.booking)}
        onClose={() => {
          calls.closed += 1;
        }}
        onSaved={async () => {
          calls.saved += 1;
        }}
      />,
    );
  });
  if (wait) await editLoaded();
  return calls;
}
// Espera a que cargue la reserva (los campos se habilitan).
const editLoaded = async () => {
  for (let i = 0; i < 20 && editField('edit-adults').props.disabled; i++) await settle(200);
};
/** Respuesta de error del backend al siguiente PUT (p. ej. cruce con otra reserva). */
const failNextUpdate = (status, message) => {
  const backend = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    if (init.method !== 'PUT') return backend(input, init);
    globalThis.fetch = backend;
    const path = new URL(String(input)).pathname.replace(/^\/api\/v1/, '');
    recBackend.requests.push({ call: `PUT ${path}`, body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify({ message }), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
};
const editField = (name) =>
  view.root.find((node) => ['input', 'textarea'].includes(node.type) && node.props.name === name);
const editType = (name, value) => act(() => editField(name).props.onChange({ target: { value } }));
const putCalls = () =>
  recBackend.requests.filter(({ call }) => call === `PUT /bookings/${REC_BOOKING_ID}`);
const editSave = async (calls) => {
  await act(async () => buttons('Guardar cambios')[0].props.onClick());
  // Guardado válido: espera a que termine (latencia simulada del servicio).
  for (let i = 0; i < 15 && calls && calls.saved === 0; i++) await settle(200);
};

test('editar reserva: adultos solo admite dígitos y exige mínimo 1', async () => {
  await renderEditModal({ adults: 2 });
  assert.equal(editField('edit-adults').props.type, 'text');
  assert.equal(editField('edit-adults').props.inputMode, 'numeric');
  assert.equal(editField('edit-adults').props.value, '2');
  for (const rejected of ['-9', '1.5', 'abc', '2e1', ' 2']) {
    editType('edit-adults', rejected);
    assert.equal(editField('edit-adults').props.value, '2', `"${rejected}" no se guarda`);
  }
  editType('edit-adults', '');
  await editSave();
  assert.ok(fieldErrors().includes('Ingresa la cantidad de adultos.'));
  editType('edit-adults', '0');
  await editSave();
  assert.ok(fieldErrors().includes('Mínimo 1 adulto.'), 'no convierte 0 en 1');
  assert.equal(editField('edit-adults').props.value, '0');
  assert.equal(putCalls().length, 0, 'no guarda cantidades inválidas');
});

test('editar reserva: la salida debe ser posterior a la entrada', async () => {
  await renderEditModal();
  editType('edit-check-out', '2026-12-10');
  await editSave();
  assert.deepEqual(fieldErrors(), ['La salida debe ser posterior a la entrada.']);
  editType('edit-check-out', '2026-12-09');
  await editSave();
  assert.deepEqual(fieldErrors(), ['La salida debe ser posterior a la entrada.']);
  editType('edit-check-in', '');
  await editSave();
  assert.ok(fieldErrors().includes('Ingresa la fecha de entrada.'));
  assert.equal(putCalls().length, 0);
});

test('editar reserva: fechas modificadas no superan 90 noches', async () => {
  await renderEditModal();
  // 91 noches desde el 10-12-2026.
  editType('edit-check-out', '2027-03-11');
  await editSave();
  assert.deepEqual(fieldErrors(), ['Máximo 90 noches.']);
  assert.equal(putCalls().length, 0);
  // 90 noches: el error se limpia al corregir.
  editType('edit-check-out', '2027-03-10');
  assert.deepEqual(fieldErrors(), []);
});

test('editar reserva: una reserva histórica permite editar sus observaciones', async () => {
  // Entrada ya pasada y 151 noches: datos históricos que no se tocan.
  const calls = await renderEditModal({ checkIn: '2026-01-01', checkOut: '2026-06-01' });
  const notes = `Solicita factura.
Llega tarde.`;
  editType('edit-notes', notes);
  await editSave(calls);
  assert.deepEqual(fieldErrors(), [], 'no se bloquea por las fechas históricas');
  assert.equal(putCalls().length, 1);
  const body = putCalls()[0].body;
  assert.equal(body.checkIn, '2026-01-01', 'no modifica las fechas existentes');
  assert.equal(body.checkOut, '2026-06-01');
  assert.equal(body.notes, notes, 'conserva los saltos de línea');
  assert.equal(calls.saved, 1);
});

test('editar reserva: observaciones nuevas hasta 500 caracteres con contador', async () => {
  const calls = await renderEditModal({ notes: '' });
  assert.equal(editField('edit-notes').props.maxLength, 500);
  assert.match(text(view.root), /0\/500/);
  editType('edit-notes', 'a'.repeat(501));
  await editSave();
  assert.deepEqual(fieldErrors(), ['Máximo 500 caracteres.']);
  assert.equal(putCalls().length, 0);
  editType('edit-notes', 'a'.repeat(500));
  assert.match(text(view.root), /500\/500/);
  await editSave(calls);
  assert.deepEqual(fieldErrors(), []);
  assert.equal(putCalls().length, 1, '500 caracteres se guardan');
});

test('editar reserva: conserva observaciones históricas de más de 500 caracteres', async () => {
  const longNotes = 'Nota del portal. '.repeat(50).trimEnd();
  const calls = await renderEditModal({ notes: longNotes, adults: 1 });
  assert.ok(longNotes.length > 500);
  assert.equal(editField('edit-notes').props.value, longNotes, 'no se recorta al cargar');
  assert.match(text(view.root), /superan 500 caracteres\. Se conservan sin cambios/);

  // Cambiar otro campo no se bloquea por las observaciones intactas.
  editType('edit-adults', '2');
  await editSave(calls);
  assert.deepEqual(fieldErrors(), []);
  assert.equal(putCalls().length, 1);
  assert.ok(!('notes' in putCalls()[0].body), 'no se reenvían: el backend conserva el original');
  assert.equal(recBackend.booking.notes, longNotes, 'no se pierde el texto');
});

test('editar reserva: si se modifican observaciones largas aplica el límite', async () => {
  await renderEditModal({ notes: 'x'.repeat(800) });
  editType('edit-notes', 'x'.repeat(799));
  assert.ok(!text(view.root).includes('Se conservan sin cambios'), 'ya no es el texto original');
  await editSave();
  assert.deepEqual(fieldErrors(), ['Máximo 500 caracteres.']);
  assert.equal(putCalls().length, 0);
});

test('editar reserva: menores sigue deshabilitado con el valor guardado', async () => {
  await renderEditModal();
  const children = view.root.find(
    (node) => node.type === 'input' && node.props.type === 'number' && node.props.disabled,
  );
  assert.equal(children.props.value, 0);
});

test('editar reserva: guarda datos válidos con adultos enteros', async () => {
  const calls = await renderEditModal({ adults: 1 });
  editType('edit-check-in', '2026-12-11');
  editType('edit-check-out', '2026-12-14');
  editType('edit-adults', '2');
  await editSave(calls);
  assert.deepEqual(fieldErrors(), []);
  const body = putCalls()[0].body;
  assert.equal(body.adults, 2, 'entero, no texto');
  assert.equal(body.children, 0);
  assert.equal(body.checkIn, '2026-12-11');
  assert.equal(body.checkOut, '2026-12-14');
  assert.ok(!('notes' in body), 'observaciones sin cambios no se envían');
  assert.equal(calls.saved, 1);
  assert.equal(calls.closed, 1);
});

test('editar reserva: precarga los datos de la reserva seleccionada, sin valores por defecto', async () => {
  await renderEditModal({ adults: 2, children: 1, notes: 'Cuna en la habitación', wait: false });
  // Mientras carga se ven los datos de la fila, no la suma de huéspedes ni ceros.
  assert.equal(editField('edit-adults').props.disabled, true);
  assert.equal(editField('edit-adults').props.value, '2', 'adultos, no adultos + menores');
  assert.equal(editField('edit-children').props.value, 1);
  await editLoaded();
  assert.equal(editField('edit-check-in').props.value, '2026-12-10');
  assert.equal(editField('edit-check-out').props.value, '2026-12-12');
  assert.equal(editField('edit-adults').props.value, '2');
  assert.equal(editField('edit-children').props.value, 1);
  assert.equal(editField('edit-children').props.disabled, true);
  assert.equal(editField('edit-notes').props.value, 'Cuna en la habitación');
});

test('editar reserva: al cambiar de reserva no se muestran datos de la anterior', async () => {
  await renderEditModal({ adults: 2, notes: 'Primera' });
  editType('edit-notes', 'Borrador sin guardar');
  const other = {
    ...recBackend.booking,
    id: '5b8e1c3a-2f47-4d0e-9a61-7c3d2e1f0b99',
    confirmationCode: 'BKG-200',
    checkIn: '2027-01-05',
    checkOut: '2027-01-08',
    adults: 1,
    children: 0,
    notes: 'Segunda',
  };
  act(() =>
    view.update(
      <ReservationEditModal
        reservation={editRow(other)}
        onClose={() => {}}
        onSaved={async () => {}}
      />,
    ),
  );
  assert.equal(editField('edit-check-in').props.value, '2027-01-05');
  assert.equal(editField('edit-check-out').props.value, '2027-01-08');
  assert.equal(editField('edit-adults').props.value, '1');
  assert.equal(editField('edit-notes').props.value, 'Segunda');
  assert.equal(editField('edit-adults').props.disabled, true, 'vuelve a cargar');
  // Deja terminar la carga pendiente antes de desmontar.
  await settle();
});

test('editar reserva: no permite elegir nuevas fechas anteriores a hoy', async () => {
  await renderEditModal();
  assert.equal(editField('edit-check-in').props.min, '2026-10-18', 'hoy en Guatemala');
  assert.equal(editField('edit-check-out').props.min, '2026-12-11', 'día siguiente a la entrada');
  editType('edit-check-in', '2026-10-17');
  await editSave();
  assert.deepEqual(fieldErrors(), ['No puede ser anterior a hoy.']);
  assert.equal(putCalls().length, 0, 'no guarda fechas pasadas');
  // Hoy sí se permite como nueva entrada.
  editType('edit-check-in', '2026-10-18');
  assert.equal(editField('edit-check-out').props.min, '2026-10-19');
  editType('edit-check-out', '2026-10-17');
  await editSave();
  assert.deepEqual(fieldErrors(), ['No puede ser anterior a hoy.']);
  assert.equal(putCalls().length, 0);
});

test('editar reserva: conserva fechas históricas y permite editar adultos', async () => {
  const calls = await renderEditModal({ checkIn: '2026-09-01', checkOut: '2026-09-04', adults: 1 });
  // No se reemplazan por hoy aunque ya pasaron.
  assert.equal(editField('edit-check-in').props.value, '2026-09-01');
  assert.equal(editField('edit-check-out').props.value, '2026-09-04');
  editType('edit-adults', '2');
  await editSave(calls);
  assert.deepEqual(fieldErrors(), []);
  const body = putCalls()[0].body;
  assert.deepEqual([body.checkIn, body.checkOut, body.adults], ['2026-09-01', '2026-09-04', 2]);
});

test('editar reserva: con entrada pasada solo se exige hoy a la fecha que cambia', async () => {
  // Estancia en curso: se puede extender la salida sin tocar la entrada histórica.
  const calls = await renderEditModal({ checkIn: '2026-10-15', checkOut: '2026-10-20' });
  editType('edit-check-out', '2026-10-22');
  await editSave(calls);
  assert.deepEqual(fieldErrors(), []);
  const body = putCalls()[0].body;
  assert.equal(body.checkIn, '2026-10-15');
  assert.equal(body.checkOut, '2026-10-22');
});

test('editar reserva: cambio válido a fechas futuras', async () => {
  const calls = await renderEditModal();
  editType('edit-check-in', '2027-02-01');
  editType('edit-check-out', '2027-02-05');
  await editSave(calls);
  assert.deepEqual(fieldErrors(), []);
  assert.equal(putCalls().length, 1);
  const body = putCalls()[0].body;
  assert.equal(body.checkIn, '2027-02-01');
  assert.equal(body.checkOut, '2027-02-05');
  assert.equal(body.roomId, 'room-101', 'conserva la habitación: el backend comprueba sus cruces');
  assert.equal(calls.saved, 1);
});

test('editar reserva: comunica el conflicto de disponibilidad que informa el backend', async () => {
  const calls = await renderEditModal();
  editType('edit-check-out', '2026-12-15');
  failNextUpdate(400, 'Room is not available for the requested dates');
  await editSave();
  for (let i = 0; i < 15 && fieldErrors().length === 0; i++) await settle(200);
  assert.deepEqual(fieldErrors(), ['La habitación no está disponible en esas fechas.']);
  assert.ok(!text(view.root).includes('Room is not available'), 'sin el mensaje técnico');
  assert.equal(calls.saved, 0);
  assert.equal(calls.closed, 0, 'el formulario sigue abierto para corregir');
  assert.equal(editField('edit-check-out').props.value, '2026-12-15', 'no cambia las fechas');
  assert.equal(recBackend.booking.checkOut, '2026-12-12', 'la reserva no se modificó');
  // Al corregir las fechas desaparece el aviso.
  editType('edit-check-in', '2026-12-11');
  assert.deepEqual(fieldErrors(), []);
});

test('editar reserva: la propia reserva no genera un falso conflicto', async () => {
  // Rango que se solapa con el original (10→12): el frontend no lo bloquea y el
  // backend lo comprueba excluyendo esta misma reserva (PUT a su propio id).
  const calls = await renderEditModal();
  editType('edit-check-in', '2026-12-11');
  editType('edit-check-out', '2026-12-13');
  await editSave(calls);
  assert.deepEqual(fieldErrors(), []);
  assert.equal(putCalls().length, 1);
  assert.equal(calls.saved, 1);
  assert.equal(recBackend.booking.checkIn, '2026-12-11');
});
