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
import { ReceptionContent } from '@/modules/front-desk/components/workspace/ReceptionContent';
import { PrivateWorkspace } from '@/private/workspace/PrivateWorkspace';
import { calculateNights } from '@/shared/utils/date';
import { toDomainCalendarDate, toDtoCalendarDate } from '@/shared/types/common';
import {
  BlockModal,
  ChargeModal,
  CheckinModal,
  PaymentModal,
  ReasonModal,
} from '@/modules/front-desk/components/workspace/ReceptionModals';
import {
  CashModal,
  CashSessionModal,
  MovementModal,
  PromoModal,
  RoleModal,
  RoomModal,
  RoomTypeModal,
  SeasonRateModal,
  UserModal,
} from '@/modules/administration/components/AdminContent';
import { validateGuestBooking } from '@/modules/guest-portal/components/GuestModals';
import {
  MAX_WHOLE_NUMBER,
  MONEY_INVALID,
  MONEY_POSITIVE,
  MONEY_REQUIRED,
  MONEY_TOO_LARGE,
  NUMBER_TOO_LARGE,
  WHOLE_NUMBER_INVALID as FORM_WHOLE_NUMBER_INVALID,
  fieldErrorProps,
  isMoneyInput,
  isWholeNumberInput,
  moneyInputToCents,
  validateDateRange,
  validateMoneyAmount,
  validateOptionalText,
  validateRequiredText,
  validateWholeNumber,
  PERSON_NAME_CHARACTERS,
  normalizePersonNamePart,
  validatePersonNamePart,
} from '@/shared/utils/formValidation';
import { companionCompositionError } from '@/modules/front-desk/utils/checkinComposition';

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
      let [from, to, field] = turnover[room[2]];
      if (room[2] === 'complete' && state.rooms[index].housekeepingStatus === 'inspected') {
        from = 'inspected';
      }
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

test('P8/P10 · limpieza: menú con nombre accesible, checklist expone su estado y sin tipo inventado', async () => {
  await mountHousekeeping();
  const hamburger = view.root.find((node) => node.type === 'button' && hasClass(node, 'hamburger'));
  assert.equal(hamburger.props['aria-label'], 'Abrir menú');
  const close = view.root.find((node) => node.type === 'button' && hasClass(node, 'sidebar-close'));
  assert.equal(close.props['aria-label'], 'Cerrar menú');
  await act(async () => navItem('Habitaciones').props.onClick());
  const detail = view.root.findAll(
    (node) => node.type === 'button' && text(node) === 'Ver detalle',
  )[0];
  await act(async () => detail.props.onClick());
  const items = view.root.findAll(
    (node) => node.type === 'button' && hasClass(node, 'hk-check-item'),
  );
  assert.ok(items.length > 0);
  assert.ok(items.every((item) => typeof item.props['aria-pressed'] === 'boolean'));
  assert.ok(!text(view.root).includes('· Estándar'), 'sin catálogo no muestra un tipo inventado');
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

test('limpieza: una inspección se puede revertir a completada y oculta saltos inválidos', async () => {
  await mountHousekeeping();
  await goTo('Habitaciones');
  const room = cardFor('202');
  await act(async () => buttons('Inspeccionar', room.card)[0].props.onClick());
  await settle();

  await act(async () => buttons('Ver detalle', cardFor('202').card)[0].props.onClick());
  await settle();
  await act(async () => buttons('Cambiar estado', view.root)[0].props.onClick());

  assert.deepEqual(
    view.root
      .findAll((node) => node.type === 'button' && hasClass(node, 'hk-status-option'))
      .map(text),
    ['CompletadaRevertir inspección'],
  );
  const completeOption = view.root.find(
    (node) => node.type === 'button' && hasClass(node, 'hk-status-option'),
  );
  await act(async () => completeOption.props.onClick());
  await settle();

  assert.equal(hkBackend.rooms[3].housekeepingStatus, 'clean');
  assert.equal(cardFor('202').status, 'Completada');
  assert.ok(hkBackend.requests.includes('POST /housekeeping/rooms/room-202/complete'));
});

// --- Limpieza: checklist de salida persistente con las reglas del backend (#110) ---

const TURNOVER_ITEMS = ['Cama preparada', 'Baño limpio', 'Toallas completas'];

/**
 * Aplica sobre el backend simulado de Limpieza las reglas reales del checklist de
 * salida (HousekeepingServiceImpl): iniciar crea o reutiliza el activo, completar lo
 * cierra y exige todos los puntos, un checklist terminal no se edita, solo hay uno
 * activo por habitación, inspeccionar o revertir exige uno completado, y
 * `GET /housekeeping/checklists` filtra por `roomId`.
 */
function installTurnoverRules(state) {
  const inner = globalThis.fetch;
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  let seq = 0;
  state.calls = [];
  const turnovers = (roomId) =>
    state.checklists.filter((item) => !item.serviceRequestId && item.roomId === roomId);
  const active = (roomId) =>
    turnovers(roomId).find((item) => ['pending', 'in_progress'].includes(item.status));
  const addChecklist = (roomId, items) => {
    seq += 1;
    const stamp = `2026-10-03T11:0${seq}:00Z`;
    const checklist = {
      id: `turn-${seq}`,
      serviceRequestId: null,
      roomId,
      roomNumber: null,
      status: 'pending',
      observations: null,
      responsibleUserEmail: 'limpieza@hotelboutique.test',
      completedByUserEmail: null,
      startedAt: null,
      completedAt: null,
      createdAt: stamp,
      updatedAt: stamp,
      items: items.map((item, index) => ({
        id: `turn-${seq}-item-${index + 1}`,
        label: item.label,
        checked: Boolean(item.checked),
        position: index,
        notes: null,
        checkedByUserEmail: null,
        checkedAt: null,
        createdAt: stamp,
        updatedAt: stamp,
      })),
    };
    state.checklists.push(checklist);
    return checklist;
  };
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : {};
    state.calls.push({ method, path, search: url.search, body });
    if (method === 'GET' && path === '/housekeeping/checklists') {
      const roomId = url.searchParams.get('roomId');
      return json(
        roomId ? state.checklists.filter((item) => item.roomId === roomId) : state.checklists,
      );
    }
    if (method === 'POST' && path === '/housekeeping/checklists' && body.roomId) {
      if (active(body.roomId)) {
        return json(
          { message: `Active turnover checklist already exists for room: ${body.roomId}` },
          409,
        );
      }
      return json(addChecklist(body.roomId, body.items), 201);
    }
    const put = path.match(/^\/housekeeping\/checklists\/([^/]+)$/);
    if (method === 'PUT' && put) {
      const current = state.checklists.find((item) => item.id === put[1]);
      if (current && ['completed', 'cancelled'].includes(current.status)) {
        return json(
          { message: `Cannot update checklist in terminal status: ${current.status}` },
          409,
        );
      }
    }
    const room = path.match(/^\/housekeeping\/rooms\/([^/]+)\/(start|complete|inspect)$/);
    if (method === 'POST' && room) {
      const [, roomId, action] = room;
      const status = state.rooms.find((item) => item.id === roomId)?.housekeepingStatus;
      if (action === 'start' && status === 'dirty') {
        const checklist =
          active(roomId) ??
          addChecklist(
            roomId,
            TURNOVER_ITEMS.map((label) => ({ label })),
          );
        checklist.status = 'in_progress';
      }
      if (action === 'complete' && status === 'cleaning') {
        const checklist = active(roomId);
        if (!checklist) {
          return json({ message: 'Cannot complete room without active turnover checklist' }, 409);
        }
        if (checklist.items.some((item) => !item.checked)) {
          return json({ message: 'Cannot complete checklist with unchecked items' }, 409);
        }
        checklist.status = 'completed';
      }
      const needsCompleted =
        (action === 'inspect' && status === 'clean') ||
        (action === 'complete' && status === 'inspected');
      if (needsCompleted && !turnovers(roomId).some((item) => item.status === 'completed')) {
        return json({ message: 'Cannot inspect room without completed turnover checklist' }, 409);
      }
    }
    return inner(input, init);
  };
  return { addChecklist, turnovers };
}

const hkContent = () =>
  view.root.find(
    (node) =>
      typeof node.props?.onToggleChecklist === 'function' && Array.isArray(node.props.rooms),
  );
const hkRoomById = (roomId) => hkContent().props.rooms.find((room) => room.roomId === roomId);
const hkCalls = (method, pattern) =>
  hkBackend.calls.filter((call) => call.method === method && pattern.test(call.path));

test('limpieza: el checklist de salida se guarda en el backend, no se duplica y sobrevive a recargar', async () => {
  await mountHousekeeping();
  const rules = installTurnoverRules(hkBackend);
  await goTo('Habitaciones');

  await act(async () => hkContent().props.onStartCleaning(hkRoomById('room-101').id));
  await settle();
  assert.equal(
    hkRoomById('room-101').checklistId,
    'turn-1',
    'usa el checklist que creó el backend',
  );
  assert.deepEqual(
    hkRoomById('room-101').checklist.map((item) => item.label),
    TURNOVER_ITEMS,
  );
  assert.ok(
    hkBackend.calls.some((call) => call.search === '?roomId=room-101'),
    'la consulta del checklist se filtra por habitación',
  );

  let finished;
  await act(async () => {
    finished = await hkContent().props.onFinishCleaning(hkRoomById('room-101').id);
  });
  assert.equal(finished, false, 'no se completa con puntos sin marcar');
  assert.equal(hkCalls('POST', /\/rooms\/room-101\/complete$/).length, 0);

  // Marcar y desmarcar se guarda en el backend sobre el mismo checklist.
  await act(async () => hkContent().props.onToggleChecklist(hkRoomById('room-101').id, 0));
  await settle();
  await act(async () => hkContent().props.onToggleChecklist(hkRoomById('room-101').id, 0));
  await settle();
  assert.equal(
    rules.turnovers('room-101')[0].items[0].checked,
    false,
    'desmarcar también se guarda',
  );
  for (let index = 0; index < TURNOVER_ITEMS.length; index++) {
    await act(async () => hkContent().props.onToggleChecklist(hkRoomById('room-101').id, index));
    await settle();
  }
  assert.ok(rules.turnovers('room-101')[0].items.every((item) => item.checked));
  assert.equal(hkCalls('POST', /^\/housekeeping\/checklists$/).length, 0, 'no crea otro checklist');
  const putsBeforeFinish = hkCalls('PUT', /^\/housekeeping\/checklists\//).length;
  assert.equal(putsBeforeFinish, TURNOVER_ITEMS.length + 2);

  await act(async () => {
    finished = await hkContent().props.onFinishCleaning(hkRoomById('room-101').id);
  });
  await settle();
  assert.equal(finished, true);
  assert.equal(hkBackend.rooms[0].housekeepingStatus, 'clean');
  assert.equal(rules.turnovers('room-101')[0].status, 'completed', 'el backend cerró el checklist');
  assert.equal(
    hkCalls('PUT', /^\/housekeeping\/checklists\//).length,
    putsBeforeFinish,
    'no se vuelve a guardar un checklist terminal',
  );
  assert.ok(!toasts().some((toast) => /terminal/i.test(toast)), toasts().join());
  assert.equal(hkRoomById('room-101').status, 'Completada');

  // Inspeccionar y revertir la inspección reutilizan el checklist completado.
  await act(async () => hkContent().props.onInspect(hkRoomById('room-101').id));
  await settle();
  assert.equal(hkRoomById('room-101').status, 'Inspeccionada');
  await act(async () => {
    finished = await hkContent().props.onFinishCleaning(hkRoomById('room-101').id);
  });
  await settle();
  assert.equal(finished, true, 'desde inspected se vuelve a completada');
  assert.equal(hkBackend.rooms[0].housekeepingStatus, 'clean');
  assert.equal(rules.turnovers('room-101').length, 1, 'el historial no se duplica');

  // Recargar: el checklist completado se lee del backend con sus respuestas.
  await act(async () => view.unmount());
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
  await goTo('Habitaciones');
  assert.equal(hkRoomById('room-101').checklistId, 'turn-1');
  assert.ok(hkRoomById('room-101').checklist.every((item) => item.done));
  await act(async () => hkContent().props.onToggleChecklist(hkRoomById('room-101').id, 0));
  await settle();
  assert.ok(
    rules.turnovers('room-101')[0].items[0].checked,
    'un checklist completado (historial) no se modifica',
  );
});

test('limpieza: marcar antes de iniciar crea un solo checklist y al iniciar se reutiliza', async () => {
  await mountHousekeeping();
  const rules = installTurnoverRules(hkBackend);
  await goTo('Habitaciones');

  await act(async () => hkContent().props.onToggleChecklist(hkRoomById('room-102').id, 0));
  await settle();
  const created = rules.turnovers('room-102');
  assert.equal(created.length, 1);
  assert.equal(hkRoomById('room-102').checklistId, created[0].id);
  assert.equal(created[0].items[0].checked, true);

  await act(async () => hkContent().props.onStartCleaning(hkRoomById('room-102').id));
  await settle();
  assert.equal(rules.turnovers('room-102').length, 1, 'iniciar reutiliza el checklist existente');
  assert.equal(hkRoomById('room-102').checklistId, created[0].id);
  assert.equal(hkRoomById('room-102').checklist[0].done, true, 'se conserva lo ya marcado');
});

test('limpieza: si el backend ya tiene un checklist activo se carga en vez de crear otro', async () => {
  await mountHousekeeping();
  const rules = installTurnoverRules(hkBackend);
  await goTo('Habitaciones');
  // Otro dispositivo creó el checklist después de cargar esta vista.
  const existing = rules.addChecklist('room-102', [{ label: 'Ventanas limpias' }]);

  await act(async () => hkContent().props.onToggleChecklist(hkRoomById('room-102').id, 0));
  await settle();
  assert.equal(hkCalls('POST', /^\/housekeeping\/checklists$/).length, 0, 'no intenta duplicarlo');
  assert.equal(rules.turnovers('room-102').length, 1);
  assert.equal(hkRoomById('room-102').checklistId, existing.id);
  assert.deepEqual(
    hkRoomById('room-102').checklist.map((item) => item.label),
    ['Ventanas limpias'],
  );
  assert.equal(existing.items[0].checked, false, 'no marca a ciegas un punto distinto');
  assert.ok(toasts().some((toast) => toast.includes('Cargamos el checklist guardado')));
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
  catalogForbidden = false,
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
    companions: [],
    // Folio, cargos, pagos y depósitos persistidos (mismas reglas que el backend).
    account: null,
    charges: [],
    payments: [...payments],
    deposits: [],
  };
  const guest = {
    id: state.booking.guestId,
    firstName: 'Elena',
    lastName: 'Castro',
    email: 'elena@example.com',
    phone: '+502 5555-1010',
    documentType: 'national_id',
    documentNumber: '1000 20000 0101',
    createdAt: now,
    updatedAt: now,
  };
  state.guest = guest;
  const sum = (items) => items.reduce((total, item) => total + item.amountCents, 0);
  const balance = () =>
    sum(state.charges.filter((c) => c.status === 'posted')) -
    sum(state.payments.filter((pay) => pay.status === 'completed')) -
    sum(state.deposits.filter((d) => d.status === 'applied'));
  const folio = () => ({
    accountId: 'acc-126',
    bookingId: REC_BOOKING_ID,
    guestId: guest.id,
    status: state.account,
    balanceCents: balance(),
    currency: 'GTQ',
    openedAt: now,
    closedAt: null,
    activeChargesCents: 0,
    voidedChargesCents: 0,
    completedPaymentsCents: 0,
    charges: state.charges,
  });
  const notFoundAccount = { message: `Guest account not found for booking: ${REC_BOOKING_ID}` };
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
      (path.startsWith('/room-service/') ||
        (catalogForbidden && (path === '/room-types' || path === '/room-features')))
    ) {
      return json({ message: 'Forbidden' }, 403);
    }
    if (method === 'GET' && path === '/room-features') {
      return json([
        {
          id: 'feature-balcony',
          name: 'Balcón',
          description: null,
          createdAt: now,
          updatedAt: now,
        },
      ]);
    }
    if (method === 'GET' && path === '/bookings') return json([state.booking]);
    if (method === 'GET' && path === `/bookings/${REC_BOOKING_ID}`) return json(state.booking);
    if (method === 'GET' && path === '/guests') return json([guest]);
    if (method === 'GET' && path === `/guests/${guest.id}`) return json(guest);
    if (method === 'PUT' && path === `/guests/${guest.id}`) {
      // PUT reemplaza todo: el frontend debe reenviar nombre, email y teléfono.
      if (!body.firstName || !body.lastName) {
        return json({ message: 'First name is required' }, 400);
      }
      Object.assign(guest, body);
      return json(guest);
    }
    const bookingBase = `/bookings/${REC_BOOKING_ID}`;
    if (method === 'GET' && path === `${bookingBase}/companions`) return json(state.companions);
    if (method === 'POST' && path === `${bookingBase}/companions`) {
      const companion = {
        id: `00000000-0000-4000-8000-1000000000${String(state.companions.length + 1).padStart(2, '0')}`,
        bookingId: REC_BOOKING_ID,
        ...body,
        createdAt: now,
        updatedAt: now,
      };
      state.companions.push(companion);
      return json(companion, 201);
    }
    if (method === 'POST' && path === `${bookingBase}/folio/open`) {
      if (state.account === null) state.account = 'open';
      return json(folio());
    }
    if (method === 'GET' && path === `${bookingBase}/folio`) {
      return state.account ? json(folio()) : json(notFoundAccount, 404);
    }
    if (method === 'GET' && path === '/charges') return json(state.charges);
    if (method === 'GET' && path === '/deposits') return json(state.deposits);
    if (method === 'POST' && path === `${bookingBase}/charges`) {
      if (state.account !== 'open') return json(notFoundAccount, 404);
      const charge = {
        id: `00000000-0000-4000-8000-2000000000${String(state.charges.length + 1).padStart(2, '0')}`,
        bookingId: REC_BOOKING_ID,
        guestAccountId: 'acc-126',
        description: body.description,
        quantity: body.quantity,
        unitPriceCents: body.unitPriceCents,
        amountCents: body.quantity * body.unitPriceCents,
        currency: 'GTQ',
        category: body.category,
        status: 'posted',
        chargedAt: now,
        createdByUserId: null,
        voidReason: null,
        createdAt: now,
      };
      state.charges.push(charge);
      return json(charge, 201);
    }
    const voidMatch = /^\/bookings\/[^/]+\/charges\/([^/]+)\/void$/.exec(path);
    if (method === 'POST' && voidMatch) {
      const charge = state.charges.find((c) => c.id === voidMatch[1]);
      if (!charge) return json({ message: 'Charge not found' }, 404);
      if (charge.status === 'voided') return json({ message: 'Charge is already voided' }, 400);
      Object.assign(charge, { status: 'voided', voidReason: body.reason });
      return json(charge);
    }
    if (method === 'POST' && path === `${bookingBase}/payments`) {
      if (state.account !== 'open') return json(notFoundAccount, 404);
      if (body.amountCents > balance()) {
        return json({ message: 'Payment amount exceeds guest account balance' }, 409);
      }
      const payment = {
        id: `00000000-0000-4000-8000-3000000000${String(state.payments.length + 1).padStart(2, '0')}`,
        bookingId: REC_BOOKING_ID,
        amountCents: body.amountCents,
        currency: 'GTQ',
        method: body.method,
        status: 'completed',
        transactionReference: body.transactionReference ?? null,
        paidAt: now,
        createdAt: now,
      };
      state.payments.push(payment);
      return json(payment, 201);
    }
    if (method === 'POST' && path === `${bookingBase}/deposits`) {
      const deposit = {
        id: `00000000-0000-4000-8000-4000000000${String(state.deposits.length + 1).padStart(2, '0')}`,
        bookingId: REC_BOOKING_ID,
        amountCents: body.amountCents,
        currency: 'GTQ',
        method: body.method,
        status: 'held',
        notes: body.notes ?? null,
        collectedAt: now,
        refundedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      state.deposits.push(deposit);
      return json(deposit, 201);
    }
    const depositActionMatch = path.match(/\/deposits\/([^/]+)\/(apply|refund)$/);
    if (method === 'POST' && depositActionMatch) {
      // Mismas reglas que DepositServiceImpl: solo depósitos retenidos, una vez.
      const deposit = state.deposits.find((d) => d.id === depositActionMatch[1]);
      if (!deposit) return json({ message: 'Deposit not found' }, 404);
      const action = depositActionMatch[2];
      if (deposit.status !== 'held') {
        return json(
          { message: `Only held deposits can be ${action === 'apply' ? 'applied' : 'refunded'}` },
          400,
        );
      }
      if (action === 'apply') {
        if (state.account !== 'open') return json(notFoundAccount, 404);
        deposit.status = 'applied';
      } else {
        if (!body?.reason?.trim()) return json({ message: 'Refund reason is required' }, 400);
        deposit.status = 'refunded';
        deposit.refundedAt = now;
      }
      return json(deposit);
    }
    if (method === 'POST' && path === `${bookingBase}/check-out`) {
      if (state.account !== 'open') return json(notFoundAccount, 404);
      if (balance() !== 0) {
        return json({ message: 'Guest account balance must be zero before checkout' }, 409);
      }
      state.account = 'closed';
      state.booking.status = 'checked_out';
      return json(state.booking);
    }
    if (method === 'GET' && path === '/rooms') return json(rooms);
    if (method === 'GET' && path === '/payments') {
      return paymentsForbidden ? json({ message: 'Forbidden' }, 403) : json(state.payments);
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
        {
          id: 'type-deluxe',
          name: 'Deluxe',
          description: 'Habitación deluxe',
          capacity: 4,
          basePriceCents: 90000,
          currency: 'GTQ',
          roomFeatureIds: ['feature-balcony'],
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
      // Misma regla que el backend: titular + acompañantes = adultos y menores declarados.
      const adults = 1 + state.companions.filter((c) => c.guestType === 'adult').length;
      const children = state.companions.filter((c) => c.guestType === 'child').length;
      if (adults !== state.booking.adults || children !== state.booking.children) {
        return json(
          { message: 'Booking companions do not match declared adult and child composition' },
          400,
        );
      }
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

test('recepción: consulta finanzas con sus permisos y no consulta solicitudes internas', async () => {
  await mountReception();
  // Recepción tiene folios/charges/payments/deposits.read en el backend.
  for (const path of ['/charges', '/payments', '/deposits']) {
    assert.ok(
      recBackend.requests.some(({ call }) => call === `GET ${path}`),
      `recepción consulta ${path}`,
    );
  }
  for (const path of [
    '/service-requests',
    '/room-service/products',
    '/room-service/orders',
    '/concierge/requests',
    '/admin/audit-logs',
  ]) {
    assert.ok(
      !recBackend.requests.some(({ call }) => call.startsWith(`GET ${path}`)),
      `recepción no consulta ${path}`,
    );
  }
});

test('recepción: muestra tipo, capacidad y características reales del catálogo', async () => {
  await mountReception({
    rooms: [hkRoom('room-101', '101', 'clean', { roomTypeId: 'type-deluxe' })],
  });
  for (const path of ['/room-types', '/room-features']) {
    assert.ok(
      recBackend.requests.some(({ call }) => call === `GET ${path}`),
      `recepción consulta ${path} (room-types.read / room-features.read)`,
    );
  }
  const room = view.root
    .find((node) => Array.isArray(node.props?.rooms) && node.props.rooms[0]?.backendRoomId)
    .props.rooms.find((item) => item.number === '101');
  assert.equal(room.type, 'Deluxe');
  assert.equal(room.capacity, 4);
  assert.deepEqual(room.features, ['Balcón']);
});

test('recepción: sin permiso de catálogo el panel carga igual', async () => {
  await mountReception({ catalogForbidden: true });
  assert.ok(view.root.findAll((node) => hasClass(node, 'side-nav')).length);
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

const recAriaButtons = (label) =>
  view.root.findAll((node) => node.type === 'button' && node.props['aria-label'] === label);

test('Fase 4: el detalle ya no ofrece "Anular" y la cancelación exige motivo', async () => {
  await mountReception();
  act(() => receptionContent().props.onSelectRes(recReservation().id));
  assert.equal(recAriaButtons('Anular').length, 0, '"Anular" solo cambiaba la pantalla');

  await act(async () => recAriaButtons('Cancelar')[0].props.onClick());
  const textarea = view.root.find(
    (node) => node.type === 'textarea' && node.props.placeholder === 'Indica el motivo...',
  );
  const confirmButton = () =>
    view.root.find(
      (node) =>
        node.type === 'button' &&
        typeof node.props.onClick === 'function' &&
        text(node).includes('Confirmar'),
    );
  await act(async () => textarea.props.onChange({ target: { value: '   ' } }));
  assert.equal(confirmButton().props.disabled, true, 'un motivo vacío no se envía');

  await act(async () => textarea.props.onChange({ target: { value: 'Cambio de fechas' } }));
  // Doble clic: una sola solicitud al backend.
  await act(async () => {
    confirmButton().props.onClick();
    confirmButton().props.onClick();
    await settle();
  });
  await settle();
  assert.deepEqual(recCalls(`/bookings/${REC_BOOKING_ID}/cancel`), [
    { reason: 'Cambio de fechas' },
  ]);
  // Tras recargar desde el backend la reserva queda cancelada y sin acción de cancelar.
  assert.equal(recBackend.booking.status, 'cancelled');
  assert.equal(recReservation().status, 'Cancelada');
  act(() => receptionContent().props.onSelectRes(recReservation().id));
  assert.equal(
    recAriaButtons('Cancelar').length,
    0,
    'una reserva cancelada no se cancela otra vez',
  );
});

test('Fase 4: una reserva con check-in no ofrece cancelar', async () => {
  await mountReception({ bookingStatus: 'checked_in' });
  act(() => receptionContent().props.onSelectRes(recReservation().id));
  assert.equal(recReservation().status, 'Check-in');
  assert.equal(recAriaButtons('Cancelar').length, 0);
});

test('Fase 4: la ruta antigua de anulación usa la cancelación persistente', async () => {
  await mountReception();
  await act(async () => receptionContent().props.onVoid(recReservation().id, 'Duplicada'));
  await settle();
  assert.deepEqual(recCalls(`/bookings/${REC_BOOKING_ID}/cancel`), [{ reason: 'Duplicada' }]);
  assert.equal(recReservation().status, 'Cancelada');
  assert.ok(!toasts().some((toast) => toast.includes('anulada')));
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
  // La reserva declara 2 adultos: titular + un acompañante adulto (regla del check-in).
  await act(async () => {
    buttons('Confirmar check-in')[0].props.onClick();
    await settle(300);
  });
  assert.equal(recBackend.requests.filter(({ call }) => call.endsWith('/check-in')).length, 0);
  assert.match(text(view.root), /registra 1 acompañante adulto/);
  fillCheckinCompanion({ firstName: 'Mario', lastName: 'Castro', documentNumber: 'A-123' });
  // Huésped, acompañantes, check-in y folio: cada servicio simula 300–600 ms.
  await act(async () => {
    buttons('Confirmar check-in')[0].props.onClick();
    await settle(4500);
  });

  const calls = recBackend.requests.map(({ call }) => call);
  const assignmentIndex = calls.indexOf(`PUT /bookings/${REC_BOOKING_ID}`);
  const companionIndex = calls.indexOf(`POST /bookings/${REC_BOOKING_ID}/companions`);
  const checkInIndex = calls.indexOf(`POST /bookings/${REC_BOOKING_ID}/check-in`);
  const folioIndex = calls.indexOf(`POST /bookings/${REC_BOOKING_ID}/folio/open`);
  assert.ok(assignmentIndex >= 0, 'asigna la habitación antes del check-in');
  assert.ok(companionIndex > assignmentIndex, 'guarda el acompañante antes del check-in');
  assert.ok(checkInIndex > companionIndex, 'confirma el check-in después de asignar');
  assert.ok(folioIndex > checkInIndex, 'abre el folio después del check-in');
  assert.deepEqual(
    (({ firstName, lastName, guestType, documentType }) => ({
      firstName,
      lastName,
      guestType,
      documentType,
    }))(recBackend.companions[0]),
    { firstName: 'Mario', lastName: 'Castro', guestType: 'adult', documentType: 'passport' },
  );
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

// --- P1: desactivar usuarios pide confirmación y no ofrece la propia cuenta -----------

async function mountAdminUsers() {
  const now = '2026-10-05T10:00:00Z';
  const adminRole = {
    id: 'role-admin',
    code: 'admin',
    name: 'Administración',
    active: true,
    permissions: [],
  };
  const state = {
    calls: [],
    users: [
      {
        id: 'user-self',
        firstName: 'Admin',
        lastName: 'Sesión',
        email: 'admin@aurora.test',
        roleId: 'role-admin',
        roleCode: 'admin',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'user-other',
        firstName: 'Ana',
        lastName: 'Prueba',
        email: 'ana@aurora.test',
        roleId: 'role-admin',
        roleCode: 'admin',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
  originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const path = new URL(String(input)).pathname.replace(/^\/api\/v1/, '');
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    state.calls.push({ call: `${method} ${path}`, body });
    const reply = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    if (path === '/cash-sessions/current') return reply({ message: 'No open cash session' }, 404);
    if (method === 'GET' && path === '/admin/users') return reply(state.users);
    if (method === 'GET' && path === '/admin/roles') return reply([adminRole]);
    const userPath = /^\/admin\/users\/([\w-]+)$/.exec(path);
    if (userPath) {
      const user = state.users.find((item) => item.id === userPath[1]);
      if (method === 'GET') return reply(user);
      if (method === 'PUT') {
        Object.assign(user, { status: body.status ?? user.status });
        return reply(user);
      }
    }
    return reply([]);
  };
  await act(async () => {
    view = create(
      <MemoryRouter>
        <PrivateWorkspace
          role="admin"
          sessionName="Admin Sesión"
          sessionEmail="admin@aurora.test"
        />
      </MemoryRouter>,
    );
  });
  const usersNav = () =>
    view.root.findAll(
      (node) => node.type === 'button' && text(node).trim() === 'Gestión de usuarios',
    )[0];
  for (let i = 0; i < 20 && !usersNav(); i++) await settle(300);
  assert.ok(
    usersNav(),
    `navegación: ${view.root
      .findAll((node) => node.type === 'button' && /nav-/.test(node.props?.className ?? ''))
      .map((node) => `${node.props.className}=${text(node)}`)
      .join(' | ')}`,
  );
  await act(async () => usersNav().props.onClick());
  for (let i = 0; i < 20 && !userSwitch('ana@aurora.test'); i++) await settle(300);
  assert.ok(userSwitch('ana@aurora.test'), 'tabla de usuarios cargada');
  return state;
}
const userSwitch = (email) => {
  const row = view.root.findAll((node) => node.type === 'tr' && text(node).includes(email))[0];
  return row?.findAll((node) => node.type === 'button' && hasClass(node, 'adm-status-switch'))[0];
};

test('P1 · usuarios: desactivar pide confirmación antes de llamar al backend', async (t) => {
  // Modal (ConfirmDialog) toca document al abrir; el arnés no tiene DOM.
  const previousDocument = globalThis.document;
  globalThis.document = {
    activeElement: null,
    body: { style: {} },
    contains: () => false,
    addEventListener() {},
    removeEventListener() {},
  };
  t.after(() => {
    globalThis.document = previousDocument;
  });
  const state = await mountAdminUsers();
  const puts = () => state.calls.filter(({ call }) => call.startsWith('PUT /admin/users/'));
  await act(async () => userSwitch('ana@aurora.test').props.onClick());
  assert.ok(
    text(view.root).includes('¿Seguro que quieres desactivar a Ana Prueba'),
    'muestra ConfirmDialog',
  );
  assert.equal(puts().length, 0, 'no desactiva antes de confirmar');

  const cancel = view.root
    .findAll((node) => node.type === 'button' && text(node) === 'Cancelar')
    .at(-1);
  await act(async () => cancel.props.onClick());
  assert.equal(puts().length, 0, 'cancelar no envía nada');

  await act(async () => userSwitch('ana@aurora.test').props.onClick());
  const confirm = view.root.findAll(
    (node) => node.type === 'button' && text(node) === 'Desactivar',
  )[0];
  await act(async () => confirm.props.onClick());
  for (let i = 0; i < 10 && puts().length === 0; i++) await settle(200);
  assert.equal(puts().length, 1);
  assert.deepEqual(
    { roleId: puts()[0].body.roleId, status: puts()[0].body.status },
    { roleId: 'role-admin', status: 'inactive' },
    'envía el rol real por código y el nuevo estado',
  );
  assert.ok(
    toasts().some((toast) => toast.includes('Usuario desactivado')),
    `avisos: ${toasts().join(' | ')}`,
  );
});

test('P1 · usuarios: la propia cuenta no se puede desactivar desde la tabla', async () => {
  await mountAdminUsers();
  const own = userSwitch('admin@aurora.test');
  assert.equal(own.props.disabled, true);
  assert.equal(own.props.title, 'No puedes desactivar tu propia cuenta');
  assert.equal(userSwitch('ana@aurora.test').props.disabled, false);
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

// --- Recepción: Disponibilidad (formulario 3) ----------------------------------

// 12:00 del 18-10-2026 en Guatemala (UTC−6).
const AVAIL_NOW = Date.parse('2026-10-18T18:00:00Z');
const availRoom = (id, number, type, capacity) => ({
  id,
  backendRoomId: `room-${number}`,
  roomTypeId: `type-${type}`,
  number,
  floor: 'Piso 1',
  type,
  capacity,
  rate: 500,
  status: 'Disponible',
  features: [],
});
const availRooms = [
  availRoom(1, '101', 'Estándar', 2),
  availRoom(2, '102', 'Estándar', 2),
  availRoom(3, '201', 'Deluxe', 4),
];
// Props reales del workspace de Recepción (se toman una vez), con Disponibilidad abierta.
let availBaseProps;
async function renderAvailability({
  roomList = availRooms,
  now = AVAIL_NOW,
  conflicts = [],
  blocked = [],
} = {}) {
  if (!availBaseProps) {
    await mountReception();
    availBaseProps = { ...receptionContent().props };
    act(() => view.unmount());
    view = undefined;
  }
  mock.timers.enable({ apis: ['Date'], now });
  const actions = [];
  const element = (list) => (
    <MemoryRouter>
      <ReceptionContent
        {...availBaseProps}
        nav="Disponibilidad"
        rooms={list}
        showNewRes={false}
        hasConflict={(room) => conflicts.includes(room)}
        isRoomBlocked={(room) => blocked.includes(room)}
        onAction={(message) => actions.push(message)}
      />
    </MemoryRouter>
  );
  act(() => {
    view = create(element(roomList));
  });
  return { actions, setRooms: (list) => act(() => view.update(element(list))) };
}
const availInput = (name) =>
  view.root.find((node) => ['input', 'select'].includes(node.type) && node.props.name === name);
const availSet = (name, value) => act(() => availInput(name).props.onChange({ target: { value } }));
const availCount = () =>
  view.root.findAll((node) => hasClass(node, 'rc-avail-count')).map(text)[0] ?? null;
const availCards = () =>
  view.root
    .findAll((node) => hasClass(node, 'rc-avail-card'))
    .map((card) => text(card.findAll((node) => node.type === 'strong')[0]));
const availStatus = () =>
  view.root.findAll((node) => node.props?.role === 'status').map((node) => text(node));
const availSearch = () => buttons('Buscar')[0];
const availTypeOptions = () =>
  availInput('avail-type')
    .findAll((node) => node.type === 'option')
    .map((node) => text(node));
const AVAIL_FIX = 'Corrige los campos marcados para ver la disponibilidad.';

test('disponibilidad: parte de hoy y mañana en Guatemala, sin fechas fijas', async () => {
  await renderAvailability();
  assert.equal(availInput('avail-check-in').props.value, '2026-10-18');
  assert.equal(availInput('avail-check-out').props.value, '2026-10-19');
  assert.equal(availInput('avail-check-in').props.min, '2026-10-18');
  assert.equal(availInput('avail-check-out').props.min, '2026-10-19');
  assert.equal(availInput('avail-guests').props.value, '2');
  assert.deepEqual(fieldErrors(), []);
  assert.equal(availCount(), '3 habitaciones disponibles');
});

test('disponibilidad: cerca de medianoche usa el día de Guatemala y revalida al buscar', async () => {
  // 23:50 del 18-10-2026 en Guatemala = 05:50 UTC del 19: sigue siendo el 18.
  const { actions } = await renderAvailability({ now: Date.parse('2026-10-19T05:50:00Z') });
  assert.equal(availInput('avail-check-in').props.value, '2026-10-18');
  assert.equal(availInput('avail-check-out').props.value, '2026-10-19');
  // Pasa la medianoche: al buscar, la entrada del 18 ya es pasada.
  mock.timers.setTime(Date.parse('2026-10-19T06:10:00Z'));
  act(() => availSearch().props.onClick());
  assert.deepEqual(fieldErrors(), ['No puede ser anterior a hoy.']);
  assert.deepEqual(actions, [], 'no informa una consulta inválida');
  assert.deepEqual(availCards(), []);
});

test('disponibilidad: entrada anterior a hoy no muestra resultados', async () => {
  await renderAvailability();
  availSet('avail-check-in', '2026-10-17');
  assert.deepEqual(fieldErrors(), ['No puede ser anterior a hoy.']);
  assert.equal(availInput('avail-check-out').props.value, '2026-10-19', 'la salida sigue válida');
  assert.deepEqual(availCards(), []);
  assert.equal(availCount(), null);
  assert.ok(availStatus().includes(AVAIL_FIX));
  assert.equal(availSearch().props.disabled, true);
});

test('disponibilidad: fechas vacías se informan sin rellenarlas', async () => {
  await renderAvailability();
  availSet('avail-check-in', '');
  assert.equal(availInput('avail-check-out').props.value, '2026-10-19', 'no cambia la salida');
  availSet('avail-check-out', '');
  assert.equal(availInput('avail-check-in').props.value, '');
  assert.equal(availInput('avail-check-out').props.value, '');
  assert.deepEqual(fieldErrors(), ['Ingresa la fecha de entrada.', 'Ingresa la fecha de salida.']);
  assert.deepEqual(availCards(), [], 'sin resultados falsos');
});

test('disponibilidad: salida igual o anterior a la entrada', async () => {
  await renderAvailability();
  availSet('avail-check-out', '2026-10-18');
  assert.deepEqual(fieldErrors(), ['La salida debe ser posterior a la entrada.']);
  assert.deepEqual(availCards(), []);
  availSet('avail-check-in', '2026-11-10');
  availSet('avail-check-out', '2026-11-05');
  assert.deepEqual(fieldErrors(), ['La salida debe ser posterior a la entrada.']);
  assert.deepEqual(availCards(), []);
  assert.equal(availSearch().props.disabled, true);
});

test('disponibilidad: al cambiar la entrada ajusta solo una salida que deja de ser válida', async () => {
  await renderAvailability();
  availSet('avail-check-in', '2026-11-10');
  assert.equal(availInput('avail-check-out').props.value, '2026-11-11', 'entrada + 1 día');
  assert.equal(availInput('avail-check-out').props.min, '2026-11-11');
  availSet('avail-check-out', '2026-11-20');
  availSet('avail-check-in', '2026-11-12');
  assert.equal(availInput('avail-check-out').props.value, '2026-11-20', 'se conserva');
  assert.deepEqual(fieldErrors(), []);
});

test('disponibilidad: acepta 90 noches y rechaza 91', async () => {
  await renderAvailability();
  availSet('avail-check-in', '2026-11-01');
  availSet('avail-check-out', '2027-01-30');
  assert.deepEqual(fieldErrors(), [], '90 noches');
  assert.equal(availCount(), '3 habitaciones disponibles');
  availSet('avail-check-out', '2027-01-31');
  assert.deepEqual(fieldErrors(), ['Máximo 90 noches.']);
  assert.deepEqual(availCards(), []);
});

test('disponibilidad: huéspedes solo admite dígitos, también al pegar', async () => {
  await renderAvailability();
  const guests = availInput('avail-guests');
  assert.equal(guests.props.type, 'text');
  assert.equal(guests.props.inputMode, 'numeric');
  for (const rejected of ['-1', '1.5', '1,5', 'abc', '2e1', '+3', '#', ' 2', '3 ', 'abc123']) {
    availSet('avail-guests', rejected);
    assert.equal(availInput('avail-guests').props.value, '2', `"${rejected}" no se guarda`);
  }
  assert.deepEqual(fieldErrors(), []);
});

test('disponibilidad: huéspedes vacío o cero se informan sin convertirse en 1', async () => {
  await renderAvailability();
  availSet('avail-guests', '');
  assert.deepEqual(fieldErrors(), ['Ingresa la cantidad de huéspedes.']);
  assert.deepEqual(availCards(), []);
  for (const zero of ['0', '00']) {
    availSet('avail-guests', zero);
    assert.equal(availInput('avail-guests').props.value, zero);
    assert.deepEqual(fieldErrors(), ['Mínimo 1 huésped.']);
    assert.deepEqual(availCards(), []);
  }
  availSet('avail-guests', '3');
  assert.deepEqual(fieldErrors(), []);
  assert.deepEqual(availCards(), ['Hab. 201'], 'solo la de capacidad 4');
});

test('disponibilidad: avisa cuando ninguna habitación admite tantos huéspedes', async () => {
  await renderAvailability();
  availSet('avail-guests', '5');
  assert.deepEqual(fieldErrors(), [], 'no es un error del campo');
  assert.ok(availStatus().includes('Ninguna habitación admite 5 huéspedes (máximo 4).'));
  assert.equal(availCount(), '0 habitaciones disponibles');
  availSet('avail-guests', '005');
  assert.ok(availStatus().includes('Ninguna habitación admite 5 huéspedes (máximo 4).'));
  // Valor enorme: sin notación exponencial ni resultados por pérdida de precisión.
  const huge = '9'.repeat(40);
  availSet('avail-guests', huge);
  assert.ok(availStatus().includes(`Ninguna habitación admite ${huge} huéspedes (máximo 4).`));
  assert.deepEqual(availCards(), []);
});

test('disponibilidad: los tipos salen de las habitaciones cargadas, sin duplicados', async () => {
  await renderAvailability();
  assert.deepEqual(availTypeOptions(), ['Todos', 'Estándar', 'Deluxe'], 'sin Suite');
  availSet('avail-type', 'Deluxe');
  assert.deepEqual(availCards(), ['Hab. 201']);
  availSet('avail-type', 'Estándar');
  assert.deepEqual(availCards(), ['Hab. 101', 'Hab. 102']);
});

test('disponibilidad: si desaparece el tipo elegido vuelve a Todos', async () => {
  const { setRooms } = await renderAvailability();
  availSet('avail-type', 'Deluxe');
  setRooms(availRooms.filter((room) => room.type !== 'Deluxe'));
  assert.equal(availInput('avail-type').props.value, 'Todos');
  assert.deepEqual(availTypeOptions(), ['Todos', 'Estándar']);
  assert.deepEqual(availCards(), ['Hab. 101', 'Hab. 102']);
});

test('disponibilidad: resultados en vivo con el mismo filtro de conflictos y bloqueos', async () => {
  await renderAvailability({ conflicts: ['101'], blocked: ['102'] });
  assert.deepEqual(availCards(), ['Hab. 201']);
  assert.equal(availCount(), '1 habitación disponible');
  availSet('avail-guests', '1');
  assert.deepEqual(availCards(), ['Hab. 201'], 'conflictos y bloqueos se siguen respetando');
});

test('disponibilidad: Buscar revalida e informa el rango con formato de Guatemala', async () => {
  const { actions } = await renderAvailability();
  assert.equal(availSearch().props.disabled, false);
  act(() => availSearch().props.onClick());
  assert.deepEqual(actions, ['Disponibilidad 18-10-2026 – 19-10-2026: 3 habitaciones disponibles']);
  availSet('avail-guests', '');
  assert.equal(availSearch().props.disabled, true);
  availSet('avail-guests', '4');
  assert.equal(availSearch().props.disabled, false);
  act(() => availSearch().props.onClick());
  assert.equal(actions.at(-1), 'Disponibilidad 18-10-2026 – 19-10-2026: 1 habitación disponible');
  assert.equal(actions.length, 2, 'una sola notificación por búsqueda');
});

test('disponibilidad: errores accesibles que desaparecen al corregir', async () => {
  await renderAvailability();
  availSet('avail-guests', '0');
  const guests = availInput('avail-guests');
  assert.equal(guests.props['aria-invalid'], true);
  assert.ok(guests.props.className.includes('error'));
  const message = view.root.find((node) => node.props?.id === guests.props['aria-describedby']);
  assert.equal(text(message), 'Mínimo 1 huésped.');
  assert.equal(availInput('avail-check-in').props['aria-invalid'], false);
  assert.equal(availInput('avail-check-in').props['aria-describedby'], undefined);
  availSet('avail-guests', '2');
  assert.equal(availInput('avail-guests').props['aria-invalid'], false);
  assert.deepEqual(fieldErrors(), []);
  assert.equal(availCount(), '3 habitaciones disponibles', 'los resultados vuelven solos');
});

test('disponibilidad: en el workspace real respeta las reservas existentes', async () => {
  mock.timers.enable({ apis: ['Date'], now: AVAIL_NOW });
  // Reserva confirmada en la 101 del 10 al 12-12-2026.
  await mountReception();
  await goTo('Disponibilidad');
  assert.equal(availInput('avail-check-in').props.value, '2026-10-18');
  assert.deepEqual(availCards(), ['Hab. 101']);
  availSet('avail-check-in', '2026-12-10');
  assert.equal(availInput('avail-check-out').props.value, '2026-12-11');
  assert.deepEqual(availCards(), [], 'ocupada por la reserva');
  availSet('avail-check-in', '2026-12-12');
  assert.deepEqual(availCards(), ['Hab. 101'], 'libre desde la salida de la reserva');
});

// --- Revisión integral de inputs y formularios ------------------------------
//
// Utilidades genéricas (shared/utils/formValidation) y formularios fuera de los
// ya aprobados (Nueva reserva, Editar reserva, Disponibilidad).

const formControl = (label) => {
  const node = view.root.find(
    (candidate) => candidate.type === 'label' && text(candidate).trim().startsWith(label),
  );
  return node.findAll((candidate) => ['input', 'select', 'textarea'].includes(candidate.type))[0];
};
const shownErrors = () =>
  view.root
    .findAll((node) => hasClass(node, 'rc-field-error') || hasClass(node, 'hk-form-error'))
    .map((node) => text(node));
const typeIn = (input, value) => act(() => input.props.onChange({ target: { value } }));
const previousCalendarDay = (day) => {
  const date = toDomainCalendarDate(day);
  date.setDate(date.getDate() - 1);
  return toDtoCalendarDate(date);
};

test('B9 · caja: el cierre excepcional exige conteo y motivo; el propio no pide motivo', async () => {
  const saved = [];
  act(() => {
    view = create(
      <CashSessionModal
        mode="close"
        expectedCents={100000}
        ownerLabel="Ana López"
        onClose={() => {}}
        onSave={(...args) => {
          saved.push(args);
        }}
      />,
    );
  });
  assert.match(text(view.root), /Cierre excepcional · Ana López/);
  typeIn(formControl('Efectivo contado'), '990');
  await act(async () => buttons('Cerrar caja')[0].props.onClick());
  assert.deepEqual(shownErrors(), ['Indica el motivo del cierre excepcional.']);
  assert.equal(saved.length, 0);
  typeIn(formControl('Motivo del cierre excepcional'), ' Turno terminado ');
  await act(async () => {
    buttons('Cerrar caja')[0].props.onClick();
    await settle(50);
  });
  assert.deepEqual(saved, [[99000, undefined, 'Turno terminado']]);

  saved.length = 0;
  act(() => {
    view = create(
      <CashSessionModal
        mode="close"
        expectedCents={100000}
        onClose={() => {}}
        onSave={(...args) => {
          saved.push(args);
        }}
      />,
    );
  });
  assert.ok(!text(view.root).includes('Motivo del cierre excepcional'));
  typeIn(formControl('Efectivo contado'), '1000');
  await act(async () => {
    buttons('Cerrar caja')[0].props.onClick();
    await settle(50);
  });
  assert.deepEqual(saved, [[100000, undefined, undefined]]);
});

test('formularios · montos: solo dígitos y hasta 2 decimales, sin notación científica', () => {
  for (const value of ['', '0', '12', '12.', '12.5', '12.50', '.5']) {
    assert.equal(isMoneyInput(value), true, value);
  }
  for (const value of ['-1', '1e3', '12.345', '1,000', 'Q100', ' 1', 'abc', '+5']) {
    assert.equal(isMoneyInput(value), false, value);
  }
  assert.equal(validateMoneyAmount(''), MONEY_REQUIRED);
  assert.equal(validateMoneyAmount('   '), MONEY_REQUIRED);
  assert.equal(validateMoneyAmount('0'), MONEY_POSITIVE);
  assert.equal(validateMoneyAmount('0.00'), MONEY_POSITIVE);
  assert.equal(validateMoneyAmount('0', { allowZero: true }), null);
  assert.equal(validateMoneyAmount('.'), MONEY_INVALID);
  assert.equal(validateMoneyAmount('12.'), MONEY_INVALID);
  assert.equal(validateMoneyAmount('1e3'), MONEY_INVALID);
  assert.equal(validateMoneyAmount('-5'), MONEY_INVALID);
  assert.equal(validateMoneyAmount('9'.repeat(20)), MONEY_TOO_LARGE);
  assert.equal(validateMoneyAmount('1250.50'), null);
  // Centavos exactos, sin errores de coma flotante.
  assert.equal(moneyInputToCents('19.99'), 1999);
  assert.equal(moneyInputToCents('0.1'), 10);
  assert.equal(moneyInputToCents('1250.5'), 125050);
  assert.equal(moneyInputToCents('.5'), 50);
  assert.equal(moneyInputToCents('abc'), null);
});

test('formularios · enteros: vacío, signos, decimales y valores enormes', () => {
  assert.equal(isWholeNumberInput('12'), true);
  assert.equal(isWholeNumberInput(''), true);
  for (const value of ['-1', '1.5', '1e2', ' 1', 'uno', '+1']) {
    assert.equal(isWholeNumberInput(value), false, value);
  }
  assert.equal(validateWholeNumber('', { requiredMessage: 'Falta.' }), 'Falta.');
  assert.equal(validateWholeNumber('0', { min: 1, minMessage: 'Mínimo 1.' }), 'Mínimo 1.');
  assert.equal(validateWholeNumber('0', { min: 0 }), null, 'cero cuando tiene sentido');
  assert.equal(validateWholeNumber('101', { max: 100, maxMessage: 'Máx.' }), 'Máx.');
  assert.equal(validateWholeNumber('1.5'), FORM_WHOLE_NUMBER_INVALID);
  assert.equal(validateWholeNumber('-3'), FORM_WHOLE_NUMBER_INVALID);
  assert.equal(validateWholeNumber(String(MAX_WHOLE_NUMBER)), null);
  assert.equal(validateWholeNumber(String(MAX_WHOLE_NUMBER + 1)), NUMBER_TOO_LARGE);
  assert.equal(validateWholeNumber('9'.repeat(400)), NUMBER_TOO_LARGE);
});

test('formularios · textos, rangos de fechas y atributos de accesibilidad', () => {
  assert.equal(validateRequiredText('   ', 'Requerido.'), 'Requerido.');
  assert.equal(validateRequiredText('  Ñandú, café.  ', 'Requerido.', 12), null, 'conserva tildes');
  assert.equal(validateRequiredText('abcd', 'Requerido.', 3), 'Máximo 3 caracteres.');
  assert.equal(validateOptionalText('', 5), null);
  assert.equal(validateOptionalText('123456', 5), 'Máximo 5 caracteres.');
  assert.deepEqual(validateDateRange('2026-10-20', '2026-10-20'), {});
  assert.deepEqual(validateDateRange('2026-10-20', '2026-10-19'), {
    end: 'La fecha final no puede ser anterior a la inicial.',
  });
  assert.deepEqual(validateDateRange('2026-10-20', '2026-10-20', { allowSameDay: false }), {
    end: 'La fecha final debe ser posterior a la inicial.',
  });
  assert.deepEqual(validateDateRange('', 'x'), {
    start: 'Ingresa la fecha.',
    end: 'Fecha no válida.',
  });
  assert.deepEqual(fieldErrorProps('a-error', 'Mal'), {
    'aria-invalid': true,
    'aria-describedby': 'a-error',
  });
  assert.deepEqual(fieldErrorProps('a-error', null), {
    'aria-invalid': undefined,
    'aria-describedby': undefined,
  });
});

test('cargo (recepción): concepto obligatorio, monto monetario y errores accesibles', () => {
  const added = [];
  act(() => {
    view = create(<ChargeModal onClose={() => {}} onAdd={(...args) => added.push(args)} />);
  });
  const amount = () => formControl('Monto');
  for (const value of ['abc', '1e3', '-5', '12.345']) {
    typeIn(amount(), value);
    assert.equal(amount().props.value, '', `rechaza ${value}`);
  }
  act(() => buttons('Agregar cargo')[0].props.onClick());
  assert.deepEqual(shownErrors(), ['El concepto es obligatorio.', MONEY_REQUIRED]);
  assert.equal(formControl('Concepto').props['aria-invalid'], true);
  assert.equal(amount().props['aria-describedby'], 'charge-amount-error');

  typeIn(formControl('Concepto'), '   ');
  typeIn(amount(), '0');
  act(() => buttons('Agregar cargo')[0].props.onClick());
  assert.deepEqual(shownErrors(), ['El concepto es obligatorio.', MONEY_POSITIVE]);
  assert.equal(added.length, 0);

  typeIn(formControl('Concepto'), '  Minibar  ');
  typeIn(amount(), ' 125.50 ');
  assert.deepEqual(shownErrors(), [], 'los errores desaparecen al corregir');
  act(() => buttons('Agregar cargo')[0].props.onClick());
  assert.deepEqual(added, [['Minibar', 'Servicios', 125.5, '']]);
});

test('pago y depósito (recepción): cero no se registra; método real del backend y referencia normalizada', () => {
  const paid = [];
  act(() => {
    view = create(
      <PaymentModal title="PAGO" onClose={() => {}} onSubmit={(...args) => paid.push(args)} />,
    );
  });
  typeIn(formControl('Monto'), '0.00');
  act(() => buttons('Confirmar')[0].props.onClick());
  assert.deepEqual(shownErrors(), [MONEY_POSITIVE]);
  assert.equal(paid.length, 0);
  // "Tarjeta" se distingue en crédito o débito, como en el backend.
  const methods = formControl('Método')
    .findAllByType('option')
    .map((option) => option.props.value);
  assert.deepEqual(methods, ['cash', 'credit_card', 'debit_card', 'bank_transfer']);
  assert.match(text(view.root), /El efectivo requiere tu caja abierta/);
  typeIn(formControl('Monto'), '300');
  typeIn(formControl('Método'), 'debit_card');
  typeIn(formControl('Referencia'), '  TXN-1  ');
  act(() => buttons('Confirmar')[0].props.onClick());
  assert.deepEqual(paid, [[300, 'debit_card', 'TXN-1']]);
});

test('bloqueo (recepción): parte de hoy y mañana en Guatemala y valida habitación y fechas', () => {
  const blocks = [];
  act(() => {
    view = create(
      <BlockModal rooms={rooms} onClose={() => {}} onAdd={(...args) => blocks.push(args)} />,
    );
  });
  const click = () => act(() => buttons('Bloquear habitación')[0].props.onClick());
  assert.equal(dateInputs()[0].props.value, hotelToday(), 'ya no usa fechas fijas de 2024');
  assert.equal(dateInputs()[1].props.value, nextCalendarDay(hotelToday()));
  click();
  assert.deepEqual(shownErrors(), ['Selecciona una habitación.']);
  typeIn(formControl('Habitación'), '101');
  typeIn(dateInputs()[0], previousCalendarDay(hotelToday()));
  click();
  assert.deepEqual(shownErrors(), ['La fecha inicial no puede ser anterior a hoy.']);
  typeIn(dateInputs()[0], IN_5);
  typeIn(dateInputs()[1], IN_5);
  click();
  assert.deepEqual(shownErrors(), ['La fecha final debe ser posterior a la inicial.']);
  assert.equal(dateInputs()[1].props['aria-invalid'], true);
  typeIn(dateInputs()[1], IN_7);
  click();
  assert.deepEqual(blocks, [['101', IN_5, IN_7, 'Mantenimiento', '']]);
});

test('motivo (recepción): solo espacios no confirma y un segundo clic no repite la operación', async () => {
  let calls = 0;
  let release;
  act(() => {
    view = create(
      <ReasonModal
        title="CANCELAR"
        label="Cancelar reserva"
        tone="warning"
        onClose={() => {}}
        onConfirm={() => {
          calls += 1;
          return new Promise((resolve) => {
            release = resolve;
          });
        }}
      />,
    );
  });
  const confirm = () => buttons('Confirmar')[0];
  typeIn(view.root.findByType('textarea'), '   ');
  assert.equal(confirm().props.disabled, true);
  typeIn(view.root.findByType('textarea'), 'El huésped no llegó');
  await act(async () => confirm().props.onClick());
  await act(async () => confirm().props.onClick());
  assert.equal(calls, 1);
  assert.equal(confirm().props.disabled, true, 'deshabilitado mientras se procesa');
  await act(async () => release());
  assert.equal(confirm().props.disabled, false);
});

/** Controles de los `<label>` cuyo texto empieza con `label` (en orden del DOM). */
function labelledControls(label) {
  return view.root
    .findAll((node) => node.type === 'label' && text(node).trim().startsWith(label))
    .map(
      (node) => node.findAll((child) => ['input', 'select', 'textarea'].includes(child.type))[0],
    );
}

/** Completa y agrega un acompañante en el modal de check-in del workspace. */
function fillCheckinCompanion({
  firstName,
  lastName,
  documentNumber,
  documentType = 'passport',
  age = '30',
  guestType = 'adult',
}) {
  const set = (control, value) => act(() => control.props.onChange({ target: { value } }));
  set(labelledControls('Nombre *')[0], firstName);
  set(labelledControls('Apellido *')[0], lastName);
  set(labelledControls('Tipo de documento *')[1], documentType);
  set(labelledControls('Número de documento *')[1], documentNumber);
  set(labelledControls('Edad *')[0], age);
  set(labelledControls('Tipo *')[0], guestType);
  act(() => buttons('Agregar acompañante')[0].props.onClick());
}

const checkinReservation = (overrides = {}) => ({
  id: 1,
  bookingId: undefined,
  code: 'AUR-1',
  roomNumber: '101',
  roomType: 'Estándar',
  status: 'Confirmada',
  checkIn: hotelToday(),
  checkOut: nextCalendarDay(hotelToday()),
  adults: 2,
  children: 1,
  guest: {
    name: 'Ana',
    lastName: 'López',
    phone: '',
    email: '',
    docType: 'nationalId',
    docNumber: '',
    birthDate: '',
    nationality: '',
  },
  companions: [],
  folio: [],
  ...overrides,
});

test('check-in (recepción): documento, acompañantes con campos separados, composición y sin doble envío', async () => {
  const checkins = [];
  let release;
  // Sin bookingId no se consultan acompañantes guardados; el envío se valida antes.
  const reservation = checkinReservation({ bookingId: '33333333-3333-4333-8333-333333333333' });
  const originalFetchForTest = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  act(() => {
    view = create(
      <CheckinModal
        reservation={reservation}
        rooms={[{ ...rooms[0], capacity: 3 }]}
        hasConflict={() => false}
        isRoomBlocked={() => false}
        onClose={() => {}}
        onCheckin={(...args) => {
          checkins.push(args);
          return new Promise((resolve) => {
            release = resolve;
          });
        }}
      />,
    );
  });
  await settle(700);
  try {
    const confirm = () => buttons('check-in')[0];
    // Sin nacionalidad por defecto (antes se proponía "Mexicana").
    assert.equal(labelledControls('Nacionalidad')[0].props.value, '');
    assert.equal(labelledControls('Tipo de documento *')[0].props.value, 'national_id');

    await act(async () => confirm().props.onClick());
    assert.deepEqual(shownErrors(), ['El número de documento es obligatorio.']);
    assert.equal(labelledControls('Número de documento *')[0].props['aria-invalid'], true);

    // Acompañante: nombre y apellido separados con caracteres de nombres reales.
    act(() => labelledControls('Edad *')[0].props.onChange({ target: { value: 'diez' } }));
    assert.equal(labelledControls('Edad *')[0].props.value, '', 'la edad solo admite dígitos');
    fillCheckinCompanion({ firstName: 'Juan💻', lastName: '', documentNumber: '', age: '' });
    assert.deepEqual(shownErrors(), [
      'El número de documento es obligatorio.',
      'Solo se permiten letras, con espacios, guiones o apóstrofos entre ellas.',
      'Ingresa el apellido.',
      'Ingresa el número de documento.',
      'Ingresa la edad.',
    ]);

    fillCheckinCompanion({ firstName: 'María-José', lastName: "O'Connor", documentNumber: 'P-1' });
    // Bebé: la edad 0 es válida y no se confunde con un campo vacío.
    fillCheckinCompanion({
      firstName: 'Li',
      lastName: 'Núñez',
      documentNumber: 'P-2',
      age: '0',
      guestType: 'child',
    });
    assert.match(text(view.root), /María-José O'Connor · Adulto · P-1 · 30 años/);
    assert.match(text(view.root), /Li Núñez · Menor · P-2 · 0 años/);

    typeIn(labelledControls('Fecha de nacimiento')[0], nextCalendarDay(hotelToday()));
    typeIn(labelledControls('Número de documento *')[0], '  1234567890101 ');
    await act(async () => confirm().props.onClick());
    assert.deepEqual(shownErrors(), ['La fecha de nacimiento no puede ser futura.']);

    typeIn(labelledControls('Fecha de nacimiento')[0], '1990-05-04');
    await act(async () => confirm().props.onClick());
    await act(async () => buttons('Procesando')[0].props.onClick());
    assert.equal(checkins.length, 1, 'un solo envío mientras se procesa');
    assert.equal(checkins[0][1].docNumber, '1234567890101');
    assert.equal(checkins[0][1].docType, 'national_id');
    assert.deepEqual(
      checkins[0][2].map(({ name, lastName, guestType, documentType, age }) => ({
        name,
        lastName,
        guestType,
        documentType,
        age,
      })),
      [
        {
          name: 'María-José',
          lastName: "O'Connor",
          guestType: 'adult',
          documentType: 'passport',
          age: 30,
        },
        { name: 'Li', lastName: 'Núñez', guestType: 'child', documentType: 'passport', age: 0 },
      ],
    );
    await act(async () => release());
  } finally {
    globalThis.fetch = originalFetchForTest;
  }
});

test('check-in (recepción): la composición debe coincidir con adultos y menores declarados', async () => {
  const checkins = [];
  const originalFetchForTest = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    act(() => {
      view = create(
        <CheckinModal
          reservation={checkinReservation({
            bookingId: '33333333-3333-4333-8333-333333333333',
            adults: 2,
            children: 0,
            guest: { ...checkinReservation().guest, docNumber: 'DPI-1' },
          })}
          rooms={rooms}
          hasConflict={() => false}
          isRoomBlocked={() => false}
          onClose={() => {}}
          onCheckin={(...args) => checkins.push(args)}
        />,
      );
    });
    await settle(700);
    // Antes se enviaba y el backend respondía 400 sin explicación clara (A3).
    await act(async () => buttons('check-in')[0].props.onClick());
    assert.match(
      text(view.root),
      /La reserva declara 2 adultos y 0 menores: registra 1 acompañante adulto y 0 menores \(ahora hay 0 y 0\)/,
    );
    assert.equal(checkins.length, 0);
    fillCheckinCompanion({ firstName: 'Mario', lastName: 'López', documentNumber: 'P-9' });
    await act(async () => buttons('check-in')[0].props.onClick());
    assert.equal(checkins.length, 1, 'con la composición correcta sí se envía');
  } finally {
    globalThis.fetch = originalFetchForTest;
  }
});

const adminRoles = [
  {
    id: 1,
    dbId: 'r1',
    code: 'reception',
    name: 'Recepción',
    description: '',
    permissions: {},
    permissionKeys: [],
    userCount: 0,
  },
];
const adminRoomTypes = [
  {
    id: 1,
    dbId: 'rt1',
    name: 'Deluxe',
    capacity: 2,
    description: '',
    roomFeatureIds: [],
    features: [],
    basePrice: 100,
    status: 'Activo',
    images: [],
  },
];

test('usuarios (administración): nombre y apellido separados, correo, contraseña y un solo envío', async () => {
  const saved = [];
  let release;
  act(() => {
    view = create(
      <UserModal
        user={null}
        roles={adminRoles}
        onClose={() => {}}
        onSave={(user) => {
          saved.push(user);
          return new Promise((resolve) => {
            release = resolve;
          });
        }}
      />,
    );
  });
  const submit = () => act(() => buttons('Crear usuario')[0].props.onClick());
  submit();
  assert.deepEqual(shownErrors(), [
    'Ingresa el nombre.',
    'Ingresa el apellido.',
    'Ingresa el correo electrónico.',
    'Ingresa una contraseña temporal.',
  ]);
  typeIn(formControl('Nombre'), 'J4ne');
  typeIn(formControl('Apellido'), 'Doe@');
  typeIn(formControl('Correo electrónico'), 'ana@');
  typeIn(formControl('Contraseña temporal'), '1234567');
  submit();
  const [firstNameError, lastNameError, emailError, passwordError] = shownErrors();
  assert.match(firstNameError, /Solo se permiten letras/);
  assert.match(lastNameError, /Solo se permiten letras/);
  assert.match(emailError, /formato válido/);
  assert.equal(passwordError, 'Mínimo 8 caracteres.');
  assert.equal(formControl('Correo electrónico').props['aria-describedby'], 'user-email-error');

  // Nombre compuesto y apellido compuesto, sin adivinar la división por palabras.
  typeIn(formControl('Nombre'), '  María   José ');
  typeIn(formControl('Apellido'), ' Pérez López ');
  typeIn(formControl('Correo electrónico'), ' ana@aurora.test ');
  typeIn(formControl('Contraseña temporal'), '12345678');
  await act(async () => buttons('Crear usuario')[0].props.onClick());
  await act(async () => buttons('Guardando')[0].props.onClick());
  assert.equal(saved.length, 1, 'un segundo clic no crea otro usuario');
  assert.equal(saved[0].firstName, 'María José');
  assert.equal(saved[0].lastName, 'Pérez López');
  assert.equal(saved[0].email, 'ana@aurora.test');
  assert.equal(saved[0].role, 'Recepción');
  await act(async () => release());
});

test('usuarios (administración): un nombre guardado que no cumple las reglas no bloquea otros cambios', async () => {
  const saved = [];
  const user = {
    id: 2,
    dbId: 'u2',
    name: 'Wu 2 Li',
    firstName: 'Wu 2',
    lastName: 'Li',
    email: 'li@aurora.test',
    role: 'Recepción',
    status: 'Activo',
    lastAccess: '',
  };
  act(() => {
    view = create(
      <UserModal
        user={user}
        roles={adminRoles}
        onClose={() => {}}
        onSave={async (next) => {
          saved.push(next);
        }}
      />,
    );
  });
  typeIn(formControl('Estado'), 'Inactivo');
  await act(async () => buttons('Guardar cambios')[0].props.onClick());
  assert.equal(saved.length, 1);
  assert.equal(saved[0].firstName, 'Wu 2', 'el dato histórico se conserva sin tocarlo');
  assert.equal(saved[0].status, 'Inactivo');

  typeIn(formControl('Nombre'), 'Wu 3');
  await act(async () => buttons('Guardar cambios')[0].props.onClick());
  assert.equal(shownErrors().length, 1, 'un nombre editado sí se valida');
  assert.match(shownErrors()[0], /Solo se permiten letras/);
  assert.equal(saved.length, 1);
});

test('usuarios (administración): al editar la contraseña es opcional y solo se envía si se escribe', async () => {
  const saved = [];
  const user = {
    id: 3,
    dbId: 'u3',
    name: 'Ana Pérez',
    firstName: 'Ana',
    lastName: 'Pérez',
    email: 'ana@aurora.test',
    role: 'Recepción',
    status: 'Activo',
    lastAccess: '',
  };
  act(() => {
    view = create(
      <UserModal
        user={user}
        roles={adminRoles}
        onClose={() => {}}
        onSave={async (next) => {
          saved.push(next);
        }}
      />,
    );
  });
  await act(async () => buttons('Guardar cambios')[0].props.onClick());
  assert.equal(saved.length, 1);
  assert.equal(saved[0].password, undefined, 'vacía conserva la contraseña actual');

  typeIn(formControl('Nueva contraseña'), '1234');
  await act(async () => buttons('Guardar cambios')[0].props.onClick());
  assert.deepEqual(shownErrors(), ['Mínimo 8 caracteres.']);
  assert.equal(saved.length, 1);

  typeIn(formControl('Nueva contraseña'), 'Segura2026');
  await act(async () => buttons('Guardar cambios')[0].props.onClick());
  assert.equal(saved.length, 2);
  assert.equal(saved[1].password, 'Segura2026');
});

test('tipos de habitación (administración): guarda las características elegidas del catálogo', async () => {
  const saved = [];
  const roomType = {
    id: 1,
    dbId: 'rt-1',
    name: 'Deluxe',
    capacity: 2,
    description: '',
    roomFeatureIds: ['f-wifi'],
    features: ['Wi-Fi'],
    basePrice: 900,
    status: 'Activo',
    images: [],
  };
  const roomFeatures = [
    { id: 'f-wifi', name: 'Wi-Fi' },
    { id: 'f-view', name: 'Vista al mar' },
  ];
  act(() => {
    view = create(
      <RoomTypeModal
        roomType={roomType}
        roomFeatures={roomFeatures}
        onClose={() => {}}
        onSave={async (next) => {
          saved.push(next);
        }}
      />,
    );
  });
  const checkbox = (name) =>
    view.root
      .findAll((node) => node.type === 'label' && text(node) === name)[0]
      .find((node) => node.type === 'input');
  act(() => checkbox('Vista al mar').props.onChange({ target: { checked: true } }));
  act(() => checkbox('Wi-Fi').props.onChange({ target: { checked: false } }));
  await act(async () => buttons('Guardar cambios')[0].props.onClick());
  await settle();
  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0].roomFeatureIds, ['f-view']);
  assert.deepEqual(saved[0].features, ['Vista al mar']);
  assert.ok(!('bedConfiguration' in saved[0]), 'las características no tocan las camas');
});

test('roles (administración): nombre obligatorio y código de un rol nuevo dentro del límite', async () => {
  const saved = [];
  act(() => {
    view = create(
      <RoleModal role={null} onClose={() => {}} onSave={async (role) => saved.push(role)} />,
    );
  });
  typeIn(formControl('Nombre del rol'), '    ');
  await act(async () => buttons('Crear rol')[0].props.onClick());
  assert.deepEqual(shownErrors(), ['Ingresa el nombre del rol.']);
  typeIn(formControl('Nombre del rol'), 'a '.repeat(41));
  await act(async () => buttons('Crear rol')[0].props.onClick());
  assert.deepEqual(shownErrors(), ['Máximo 80 caracteres para un rol nuevo.']);
  typeIn(formControl('Nombre del rol'), '  Jefe   de turno ');
  await act(async () => buttons('Crear rol')[0].props.onClick());
  assert.equal(saved.length, 1);
  assert.equal(saved[0].name, 'Jefe de turno');
  assert.equal(saved[0].code, 'jefe_de_turno');
});

test('habitaciones (administración): número, piso con número, capacidad entera y tarifa', async () => {
  const saved = [];
  act(() => {
    view = create(
      <RoomModal
        room={null}
        roomTypes={adminRoomTypes}
        onClose={() => {}}
        onSave={async (room) => saved.push(room)}
      />,
    );
  });
  typeIn(formControl('Piso'), 'Planta baja');
  typeIn(formControl('Capacidad'), '0');
  typeIn(formControl('Tarifa'), '1e3');
  assert.equal(formControl('Tarifa').props.value, '1850', 'rechaza notación científica');
  await act(async () => buttons('Crear habitación')[0].props.onClick());
  assert.deepEqual(shownErrors(), [
    'Ingresa el número de habitación.',
    'Ingresa el piso (ej. 2 o Piso 2).',
    'Mínimo 1 huésped.',
  ]);
  typeIn(formControl('Número'), '  204 ');
  typeIn(formControl('Piso'), 'Piso 2');
  typeIn(formControl('Capacidad'), '3');
  typeIn(formControl('Tarifa'), '1250.5');
  await act(async () => buttons('Crear habitación')[0].props.onClick());
  assert.equal(saved.length, 1);
  const { number, floor, capacity, rate, roomTypeId } = saved[0];
  assert.deepEqual(
    { number, floor, capacity, rate, roomTypeId },
    { number: '204', floor: 'Piso 2', capacity: 3, rate: 1250.5, roomTypeId: 'rt1' },
  );
});

test('habitaciones y promociones (administración): conservan las reglas de formato del equipo', async () => {
  const savedRooms = [];
  act(() => {
    view = create(
      <RoomModal
        room={null}
        roomTypes={adminRoomTypes}
        onClose={() => {}}
        onSave={async (room) => savedRooms.push(room)}
      />,
    );
  });
  typeIn(formControl('Número'), '20 4');
  typeIn(formControl('Capacidad'), '21');
  await act(async () => buttons('Crear habitación')[0].props.onClick());
  assert.deepEqual(shownErrors(), ['Usa solo letras, números y guiones.', 'Máximo 20 huéspedes.']);
  typeIn(formControl('Número'), '204-A');
  typeIn(formControl('Capacidad'), '20');
  await act(async () => buttons('Crear habitación')[0].props.onClick());
  assert.equal(savedRooms.length, 1);

  const savedPromos = [];
  act(() => {
    view = create(
      <PromoModal
        promo={null}
        onClose={() => {}}
        onSave={async (promo) => savedPromos.push(promo)}
      />,
    );
  });
  typeIn(formControl('Nombre'), '-Oferta');
  typeIn(formControl('Código'), 'A');
  await act(async () => buttons('Crear promoción')[0].props.onClick());
  const [nameError, codeError] = shownErrors();
  assert.match(nameError, /letras, números/);
  assert.equal(codeError, 'Mínimo 2 caracteres.');
  assert.equal(savedPromos.length, 0);
});

test('habitaciones (administración): sin tipos de habitación no se puede guardar', async () => {
  const saved = [];
  act(() => {
    view = create(
      <RoomModal
        room={null}
        roomTypes={[]}
        onClose={() => {}}
        onSave={async (room) => saved.push(room)}
      />,
    );
  });
  assert.equal(formControl('Tipo').props.disabled, true);
  typeIn(formControl('Número'), '301');
  await act(async () => buttons('Crear habitación')[0].props.onClick());
  assert.deepEqual(shownErrors(), ['Selecciona un tipo de habitación.']);
  assert.equal(saved.length, 0);
});

test('promociones (administración): porcentaje de 1 a 100 y fin no anterior al inicio', async () => {
  const saved = [];
  act(() => {
    view = create(
      <PromoModal promo={null} onClose={() => {}} onSave={async (promo) => saved.push(promo)} />,
    );
  });
  typeIn(formControl('Porcentaje'), '1e2');
  assert.equal(formControl('Porcentaje').props.value, '10');
  typeIn(formControl('Porcentaje'), '0');
  await act(async () => buttons('Crear promoción')[0].props.onClick());
  assert.deepEqual(shownErrors(), [
    'Ingresa el nombre de la promoción.',
    'Ingresa el código.',
    'Entre 1 y 100.',
    'Ingresa la fecha de inicio.',
  ]);
  typeIn(formControl('Nombre'), 'Estancia larga');
  typeIn(formControl('Código'), ' AURORA15 ');
  typeIn(formControl('Porcentaje'), '101');
  typeIn(formControl('Fecha inicio'), '2026-12-10');
  typeIn(formControl('Fecha fin'), '2026-12-01');
  await act(async () => buttons('Crear promoción')[0].props.onClick());
  assert.deepEqual(shownErrors(), [
    'Entre 1 y 100.',
    'La fecha final no puede ser anterior a la inicial.',
  ]);
  typeIn(formControl('Porcentaje'), '15');
  typeIn(formControl('Fecha fin'), '2026-12-10');
  await act(async () => buttons('Crear promoción')[0].props.onClick());
  assert.equal(saved.length, 1);
  assert.equal(saved[0].code, 'AURORA15');
  assert.equal(saved[0].percentage, 15);
});

test('tarifas de temporada (administración): fechas, nombre y tarifa especial obligatoria', async () => {
  const saved = [];
  act(() => {
    view = create(
      <SeasonRateModal
        roomTypes={adminRoomTypes}
        onClose={() => {}}
        onSave={async (rate) => saved.push(rate)}
      />,
    );
  });
  typeIn(formControl('Fecha inicio'), '2027-04-05');
  typeIn(formControl('Fecha fin'), '2027-04-01');
  await act(async () => buttons('Crear tarifa')[0].props.onClick());
  assert.deepEqual(shownErrors(), [
    'Ingresa el nombre de la temporada.',
    'La fecha final no puede ser anterior a la inicial.',
    'Ingresa la tarifa especial.',
  ]);
  typeIn(formControl('Temporada'), 'Semana Santa');
  typeIn(formControl('Fecha fin'), '2027-04-12');
  typeIn(formControl('Tarifa especial'), '2100.75');
  await act(async () => buttons('Crear tarifa')[0].props.onClick());
  assert.equal(saved.length, 1);
  assert.equal(saved[0].seasonalRate, 2100.75);
});

test('caja (administración): concepto y monto obligatorios; un rechazo del backend se muestra en el modal', async () => {
  act(() => {
    view = create(
      <CashModal
        onClose={() => {}}
        onSave={async () => {
          throw new Error('La caja está cerrada.');
        }}
      />,
    );
  });
  typeIn(formControl('Concepto'), '   ');
  await act(async () => buttons('Registrar')[0].props.onClick());
  assert.deepEqual(shownErrors(), ['Ingresa el concepto.', MONEY_REQUIRED]);
  assert.equal(formControl('Concepto').props.maxLength, 255);
  typeIn(formControl('Concepto'), 'Compra de insumos');
  typeIn(formControl('Monto'), '45.90');
  await act(async () => buttons('Registrar')[0].props.onClick());
  assert.ok(text(view.root).includes('La caja está cerrada.'), 'error dentro del modal');
  assert.equal(buttons('Registrar')[0].props.disabled, false, 'se puede reintentar');
});

test('inventario (administración): producto existente y cantidad entera mayor a 0', async () => {
  const saved = [];
  act(() => {
    view = create(
      <MovementModal products={[]} onClose={() => {}} onSave={async (m) => saved.push(m)} />,
    );
  });
  typeIn(formControl('Cantidad'), '0');
  typeIn(formControl('Cantidad'), '2.5');
  assert.equal(formControl('Cantidad').props.value, '0');
  await act(async () => buttons('Registrar')[0].props.onClick());
  assert.deepEqual(shownErrors(), ['Selecciona un producto.', 'La cantidad debe ser mayor a 0.']);
  assert.equal(saved.length, 0);
});

test('portal del huésped · nueva reserva: mismas reglas de fechas y huéspedes que Recepción', () => {
  const today = '2026-10-19';
  const base = {
    roomTypeId: 'rt',
    checkIn: '2026-10-20',
    checkOut: '2026-10-22',
    adults: '2',
    children: '0',
    notes: '',
  };
  assert.deepEqual(validateGuestBooking(base, 2, today), {});
  assert.deepEqual(validateGuestBooking({ ...base, checkIn: '2026-10-18' }, 2, today), {
    checkIn: 'No puede ser anterior a hoy.',
  });
  assert.deepEqual(validateGuestBooking({ ...base, checkOut: '2026-10-20' }, 2, today), {
    checkOut: 'La salida debe ser posterior a la entrada.',
  });
  assert.deepEqual(validateGuestBooking({ ...base, checkOut: '2027-01-18' }, 2, today), {});
  assert.deepEqual(validateGuestBooking({ ...base, checkOut: '2027-01-19' }, 2, today), {
    checkOut: 'Máximo 90 noches.',
  });
  assert.deepEqual(validateGuestBooking({ ...base, checkIn: '', checkOut: '' }, 2, today), {
    checkIn: 'Ingresa la fecha de entrada.',
    checkOut: 'Ingresa la fecha de salida.',
  });
  assert.deepEqual(validateGuestBooking({ ...base, adults: '0' }, 2, today), {
    adults: 'Mínimo 1 adulto.',
  });
  assert.deepEqual(validateGuestBooking({ ...base, adults: '' }, 2, today), {
    adults: 'Ingresa la cantidad de adultos.',
  });
  assert.match(
    validateGuestBooking({ ...base, children: '1' }, 2, today).adults,
    /admite 2 huéspedes como máximo/,
  );
  assert.deepEqual(validateGuestBooking({ ...base, notes: 'x'.repeat(1001) }, 2, today), {
    notes: 'Máximo 1000 caracteres.',
  });
  assert.deepEqual(validateGuestBooking({ ...base, roomTypeId: '' }, undefined, today), {
    roomType: 'Selecciona un tipo de habitación.',
  });
});

// --- Auditoría A2/A1/A7/B10/B11: acciones financieras de Recepción ----------
//
// Antes: cargos, anulaciones, pagos, depósitos y check-out solo cambiaban el
// estado de React y se perdían al recargar. Ahora pasan por el backend
// (simulado con sus reglas: folio obligatorio, sin sobrepagos, check-out con
// saldo exactamente 0) y la lista se recarga desde él.

const openFolioTab = async () => {
  const reservation = recReservation();
  act(() => receptionContent().props.onSelectRes(reservation.id));
  await act(async () => {
    buttons('Cuenta / Folio')[0].props.onClick();
    await settle(50);
  });
};
const clickAria = async (label, ms = 2500) => {
  const button = view.root.findAll(
    (node) => node.type === 'button' && node.props['aria-label']?.startsWith(label),
  )[0];
  assert.ok(button, `botón ${label}`);
  await act(async () => {
    button.props.onClick();
    await settle(ms);
  });
};
const clickText = async (label, ms = 2500) => {
  await act(async () => {
    buttons(label)[0].props.onClick();
    await settle(ms);
  });
};
const toastText = () => text(view.root);

test('A2 · cargo: se guarda en el backend con folio abierto y sobrevive a la recarga', async () => {
  await mountReception({ bookingStatus: 'checked_in' });
  await openFolioTab();
  await clickAria('Agregar cargo', 50);
  typeIn(formControl('Concepto'), '  Minibar QA ');
  typeIn(formControl('Monto'), '10.50');
  await clickText('Agregar cargo', 3000);

  // A1: el folio se abre (idempotente) antes del primer movimiento.
  assert.equal(recCalls(`/bookings/${REC_BOOKING_ID}/folio/open`).length, 1);
  assert.deepEqual(recCalls(`/bookings/${REC_BOOKING_ID}/charges`), [
    {
      description: 'Minibar QA · (Servicios)',
      quantity: 1,
      unitPriceCents: 1050,
      category: 'consumption',
    },
  ]);
  // La lista del workspace viene del backend: el cargo tiene su id real y el
  // monto exacto (antes Q10.50 se redondeaba a Q11).
  const entry = recReservation().folio.find((item) => item.type === 'Cargo');
  assert.equal(entry.backendId, '00000000-0000-4000-8000-200000000001');
  assert.equal(entry.amount, 10.5);
});

test('A2 · anular cargo: llama al backend y el estado anulado persiste', async () => {
  await mountReception({ bookingStatus: 'checked_in' });
  await openFolioTab();
  await clickAria('Agregar cargo', 50);
  typeIn(formControl('Concepto'), 'Lavandería');
  typeIn(formControl('Monto'), '10');
  await clickText('Agregar cargo', 3000);

  await openFolioTab();
  await clickAria('Anular cargo', 50);
  typeIn(view.root.findByType('textarea'), 'Cargo duplicado');
  await clickText('Confirmar', 3000);

  assert.deepEqual(recCalls(`/charges/00000000-0000-4000-8000-200000000001/void`), [
    { reason: 'Cargo duplicado' },
  ]);
  assert.equal(recBackend.charges[0].status, 'voided');
  const entry = recReservation().folio.find(
    (item) => item.backendId === '00000000-0000-4000-8000-200000000001',
  );
  assert.equal(entry.status, 'Anulado');
  assert.equal(entry.voidReason, 'Cargo duplicado');
});

test('A7/B10 · pago: método real del backend, sin sobrepago y mensaje en español', async () => {
  await mountReception({ bookingStatus: 'checked_in' });
  await openFolioTab();
  await clickAria('Agregar cargo', 50);
  typeIn(formControl('Concepto'), 'Cena');
  typeIn(formControl('Monto'), '100');
  await clickText('Agregar cargo', 3000);

  // Sobrepago: el backend responde 409 y no queda saldo negativo.
  await openFolioTab();
  await clickAria('Registrar pago', 50);
  typeIn(formControl('Monto'), '150');
  typeIn(formControl('Método'), 'credit_card');
  await clickText('Confirmar', 1200);
  assert.equal(recBackend.payments.length, 0);
  assert.match(toastText(), /El pago supera el saldo pendiente/);

  // Pago exacto con tarjeta de crédito: llega con el método real y persiste.
  typeIn(formControl('Monto'), '100');
  await clickText('Confirmar', 3000);
  assert.equal(recBackend.payments.length, 1);
  assert.equal(recBackend.payments[0].method, 'credit_card');
  assert.equal(recBackend.payments[0].amountCents, 10000);
  const payment = recReservation().folio.find((item) => item.type === 'Pago');
  assert.equal(payment.backendId, '00000000-0000-4000-8000-300000000001');
  assert.equal(payment.method, 'Tarjeta');
});

test('B11 · depósito: queda retenido en el backend y no reduce el saldo', async () => {
  await mountReception({ bookingStatus: 'checked_in' });
  await openFolioTab();
  await clickAria('Agregar cargo', 50);
  typeIn(formControl('Concepto'), 'Spa');
  typeIn(formControl('Monto'), '50');
  await clickText('Agregar cargo', 3000);

  await openFolioTab();
  await clickAria('Depósito', 50);
  typeIn(formControl('Monto'), '20');
  typeIn(formControl('Método'), 'bank_transfer');
  await clickText('Confirmar', 3000);

  assert.equal(recBackend.deposits.length, 1);
  assert.equal(recBackend.deposits[0].method, 'bank_transfer');
  assert.equal(recBackend.deposits[0].status, 'held');
  const deposit = recReservation().folio.find((item) => item.type === 'Depósito');
  assert.equal(deposit.depositStatus, 'held');
  assert.match(deposit.concept, /retenido/);
  // Igual que el backend: el saldo sigue en Q50.00 hasta aplicar el depósito.
  const totals = receptionContent().props.folioTotals(recReservation().folio);
  assert.equal(totals.balance, 50);
});

const addHeldDeposit = async () => {
  await mountReception({ bookingStatus: 'checked_in' });
  await openFolioTab();
  await clickAria('Agregar cargo', 50);
  typeIn(formControl('Concepto'), 'Spa');
  typeIn(formControl('Monto'), '50');
  await clickText('Agregar cargo', 3000);
  await openFolioTab();
  await clickAria('Depósito', 50);
  typeIn(formControl('Monto'), '20');
  typeIn(formControl('Método'), 'cash');
  await clickText('Confirmar', 3000);
  assert.equal(recBackend.deposits[0].status, 'held');
  await openFolioTab();
};
const depositCalls = (action) =>
  recBackend.requests.filter(({ call }) => call.startsWith('POST') && call.endsWith(`/${action}`));

test('B11 · aplicar depósito: confirma, persiste una vez y reduce el saldo tras el backend', async () => {
  await addHeldDeposit();
  await clickAria('Aplicar depósito', 50);
  // Sin confirmar no se envía nada.
  assert.equal(depositCalls('apply').length, 0);
  await act(async () => {
    buttons('Aplicar')[0].props.onClick();
    buttons('Aplicar')[0].props.onClick();
    await settle(3000);
  });
  assert.equal(depositCalls('apply').length, 1, 'un doble clic no aplica dos veces');
  assert.equal(recBackend.deposits[0].status, 'applied');
  const deposit = recReservation().folio.find((item) => item.type === 'Depósito');
  assert.equal(deposit.depositStatus, 'applied');
  assert.equal(receptionContent().props.folioTotals(recReservation().folio).balance, 30);
  assert.ok(toastText().includes('Depósito aplicado'));
  // Ya aplicado: no se ofrece aplicar ni devolver otra vez.
  await openFolioTab();
  assert.equal(recAriaButtons('Aplicar depósito Q20.00').length, 0);
  assert.equal(recAriaButtons('Devolver depósito Q20.00').length, 0);
});

test('B11 · devolver depósito: exige motivo, no cambia el saldo y muestra errores del backend', async () => {
  await addHeldDeposit();
  await clickAria('Devolver depósito', 50);
  const textarea = () =>
    view.root.find(
      (node) => node.type === 'textarea' && node.props.placeholder === 'Indica el motivo...',
    );
  const confirmButton = () => buttons('Confirmar').at(-1);
  await act(async () => textarea().props.onChange({ target: { value: '  ' } }));
  assert.equal(confirmButton().props.disabled, true, 'sin motivo no se devuelve');

  // Si el backend rechaza (p. ej. ya aplicado en otra pestaña) la UI no cambia.
  recBackend.deposits[0].status = 'applied';
  await act(async () => textarea().props.onChange({ target: { value: 'Salida sin daños' } }));
  await act(async () => {
    confirmButton().props.onClick();
    await settle(3000);
  });
  assert.match(toastText(), /Only held deposits can be refunded|retenid/);
  assert.equal(
    recReservation().folio.find((item) => item.type === 'Depósito').depositStatus,
    'held',
    'sin éxito del backend no se marca devuelto',
  );

  recBackend.deposits[0].status = 'held';
  await act(async () => {
    confirmButton().props.onClick();
    await settle(3000);
  });
  assert.deepEqual(depositCalls('refund').at(-1).body, { reason: 'Salida sin daños' });
  assert.equal(recBackend.deposits[0].status, 'refunded');
  assert.equal(receptionContent().props.folioTotals(recReservation().folio).balance, 50);
});

test('A2 · check-out: con saldo se informa en español; con saldo 0 se guarda en el backend', async () => {
  await mountReception({ bookingStatus: 'checked_in' });
  await openFolioTab();
  await clickAria('Agregar cargo', 50);
  typeIn(formControl('Concepto'), 'Desayuno');
  typeIn(formControl('Monto'), '25');
  await clickText('Agregar cargo', 3000);

  act(() => receptionContent().props.onSelectRes(recReservation().id));
  await clickText('Información', 50);
  await clickAria('Check-out', 50);
  await clickText('Finalizar check-out', 1200);
  assert.equal(recBackend.booking.status, 'checked_in', 'no sale con saldo pendiente');
  assert.match(toastText(), /El saldo de la cuenta debe ser Q0\.00/);

  await openFolioTab();
  await clickAria('Registrar pago', 50);
  typeIn(formControl('Monto'), '25');
  typeIn(formControl('Método'), 'debit_card');
  await clickText('Confirmar', 3000);

  act(() => receptionContent().props.onSelectRes(recReservation().id));
  await clickText('Información', 50);
  await clickAria('Check-out', 50);
  await clickText('Finalizar check-out', 3000);
  assert.equal(recBackend.booking.status, 'checked_out');
  assert.equal(recBackend.account, 'closed');
  assert.equal(recReservation().status, 'Check-out', 'el estado viene del backend tras recargar');
});

// --- Fase 1-A: nombres de empleados y acompañantes -------------------------

test('nombres de personas: acepta los ejemplos válidos y rechaza los inválidos sin eliminar caracteres', () => {
  for (const name of [
    'José',
    'María Fernanda',
    'María José',
    'José Luis',
    'Muñoz',
    'Núñez',
    'María-José',
    "O'Connor",
    'Pérez López',
    'Li',
    'José',
  ]) {
    assert.equal(validatePersonNamePart(name, 'nombre'), null, name);
  }
  for (const name of [
    'Juan123',
    'M4ría',
    'Pedro@',
    'Ana#',
    '12345',
    '@@@',
    'Juan💻',
    'María--José',
    '-Ana',
    'Ana-',
    "O''Connor",
    'Ana\u0000',
    'Ana‍Lu',
  ]) {
    assert.equal(
      validatePersonNamePart(name, 'nombre'),
      PERSON_NAME_CHARACTERS,
      JSON.stringify(name),
    );
  }
  assert.equal(validatePersonNamePart('   ', 'apellido'), 'Ingresa el apellido.');
  assert.equal(normalizePersonNamePart('  María   José '), 'María José');
});

test('check-in: la composición exige titular + acompañantes = adultos y menores declarados', () => {
  assert.equal(companionCompositionError([], 1, 0), null);
  assert.equal(
    companionCompositionError([{ guestType: 'adult' }, { guestType: 'child' }], 2, 1),
    null,
  );
  assert.match(companionCompositionError([], 2, 0), /registra 1 acompañante adulto y 0 menores/);
  assert.match(
    companionCompositionError([{ guestType: 'adult' }, { guestType: 'adult' }], 2, 0),
    /ahora hay 2 y 0/,
  );
});
