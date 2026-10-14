import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { act, create } from 'react-test-renderer';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BookingConfirmationScreen } from '@/modules/booking-engine/screens/BookingConfirmationScreen';
import { BookingFormScreen } from '@/modules/booking-engine/screens/BookingFormScreen';
import { RoomDetailScreen } from '@/modules/booking-engine/screens/RoomDetailScreen';
import { httpClient } from '@/services/http-client';
import {
  PublicBookingError,
  isOpenEndedRate,
  publicBookingCatalogService,
} from '@/services/publicBookingCatalogService';
import { formatCurrency } from '@/shared/utils/currency';

// Flujo público (#127): contratos reales /public/* del backend, sin JWT de
// personal y sin fallback local. fetch se simula; nada toca la red.

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

const API = 'http://localhost:8080/api/v1';
const ROOM_TYPE_ID = '11111111-1111-4111-8111-111111111111';
const RATE_ID = '22222222-2222-4222-8222-222222222222';

function dateKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
function daysFromToday(days) {
  const today = new Date();
  return dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + days));
}
const CHECK_IN = daysFromToday(30);
const CHECK_OUT = daysFromToday(33);

const apiRoomType = {
  id: ROOM_TYPE_ID,
  code: 'DBL',
  name: 'Doble Deluxe',
  description: 'Vista al volcán',
  capacity: 3,
  bedConfiguration: '1 king bed',
  features: [{ id: 'f1', name: 'Balcón', description: null }],
};
const openEndedRate = {
  id: RATE_ID,
  roomTypeId: ROOM_TYPE_ID,
  name: 'Flexible',
  validFrom: daysFromToday(-10),
  validTo: null,
  priceCents: 50000,
  currency: 'GTQ',
  minimumNights: 1,
  refundable: true,
};
const availabilityResult = (overrides = {}) => ({
  roomTypeId: ROOM_TYPE_ID,
  code: 'DBL',
  name: 'Doble Deluxe',
  capacity: 3,
  bedConfiguration: '1 king bed',
  availableRooms: 3,
  rate: openEndedRate,
  totalAmountCents: 150000,
  currency: 'GTQ',
  ...overrides,
});
const availabilityResponse = (results) => ({
  checkIn: CHECK_IN,
  checkOut: CHECK_OUT,
  nights: 3,
  adults: 2,
  children: 0,
  results,
});

// --- fetch simulado ----------------------------------------------------

let requests;
let handler;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  requests = [];
  handler = () => json({ message: 'Not found' }, 404);
  globalThis.fetch = async (url, init = {}) => {
    const request = {
      url: String(url),
      method: init.method ?? 'GET',
      authorization: new Headers(init.headers).get('Authorization'),
      body: init.body ? JSON.parse(init.body) : undefined,
    };
    requests.push(request);
    return handler(request);
  };
  // Sesión de personal activa: la web pública igual no debe enviar el token.
  httpClient.setToken('staff-access-token');
});

let view;
afterEach(() => {
  if (view) act(() => view.unmount());
  view = undefined;
  httpClient.clearToken();
});

const text = (node) =>
  typeof node === 'string' ? node : (node?.children ?? []).map(text).join('');
const settle = (ms = 800) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
const pathOf = (request) => request.url.slice(API.length).split('?')[0];

function assertPublicRequests() {
  assert.ok(requests.length > 0, 'se esperaba al menos una petición');
  for (const request of requests) {
    assert.ok(request.url.startsWith(`${API}/public/`), `URL fuera de /public: ${request.url}`);
    assert.ok(!request.url.includes('/api/v1/api/v1'), `/api/v1 duplicado: ${request.url}`);
    assert.equal(request.authorization, null, `Authorization enviado a ${request.url}`);
  }
}

// --- Servicio ------------------------------------------------------------

test('catálogo: room-types y rates usan /api/v1/public sin Authorization ni /api/v1 duplicado', async () => {
  handler = (request) =>
    pathOf(request) === '/public/room-types' ? json([apiRoomType]) : json([openEndedRate]);

  const [roomTypes, rates, catalog] = await Promise.all([
    publicBookingCatalogService.getRoomTypes(),
    publicBookingCatalogService.getRates(),
    publicBookingCatalogService.getRoomTypeCatalog(),
  ]);

  assert.deepEqual(requests.map((request) => `${request.method} ${request.url}`).sort(), [
    `GET ${API}/public/rates`,
    `GET ${API}/public/room-types`,
    `GET ${API}/public/room-types`,
  ]);
  assertPublicRequests();
  assert.equal(roomTypes[0].id, ROOM_TYPE_ID);
  assert.deepEqual(roomTypes[0].roomFeatureIds, ['f1']);
  assert.equal(catalog.features[0].name, 'Balcón');
  assert.equal(rates[0].priceCents, 50000);
});

test('tarifa con validTo = null no rompe el catálogo y sigue significando "sin fecha de fin"', async () => {
  const datedRate = { ...openEndedRate, id: 'dated', validTo: daysFromToday(60) };
  handler = () => json([openEndedRate, datedRate]);

  const rates = await publicBookingCatalogService.getRates();

  assert.equal(rates.length, 2);
  assert.equal(isOpenEndedRate(rates[0]), true);
  assert.equal(isOpenEndedRate(rates[1]), false);
});

test('availability: query exacta y resultado con tarifa, total y disponibilidad del backend', async () => {
  handler = () => json(availabilityResponse([availabilityResult()]));

  const results = await publicBookingCatalogService.getAvailability({
    checkIn: CHECK_IN,
    checkOut: CHECK_OUT,
    adults: 2,
    children: 1,
    roomTypeId: ROOM_TYPE_ID,
  });

  assertPublicRequests();
  const url = new URL(requests[0].url);
  assert.equal(url.pathname, '/api/v1/public/availability');
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    checkIn: CHECK_IN,
    checkOut: CHECK_OUT,
    adults: '2',
    children: '1',
    roomTypeId: ROOM_TYPE_ID,
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].roomType.id, ROOM_TYPE_ID);
  assert.equal(results[0].availableRooms, 3);
  assert.equal(results[0].totalAmountCents, 150000);
  assert.equal(results[0].rate.id, RATE_ID);
  assert.equal(isOpenEndedRate(results[0].rate), true);
});

test('POST /public/bookings no envía campos que decide el backend', async () => {
  handler = (request) =>
    json(
      {
        confirmationCode: 'BKG-TEST0001',
        status: 'pending',
        roomTypeId: ROOM_TYPE_ID,
        roomTypeName: 'Doble Deluxe',
        checkIn: request.body.checkIn,
        checkOut: request.body.checkOut,
        nights: 3,
        adults: 2,
        children: 0,
        rateName: 'Flexible',
        totalAmountCents: 150000,
        currency: 'GTQ',
        guestFirstName: 'Ana',
        guestLastName: 'Lopez',
        guestEmail: 'ana@aurora.test',
        createdAt: '2026-10-05T12:00:00Z',
      },
      201,
    );

  // Aunque el llamador agregue campos de más, el body sale por lista blanca.
  const confirmation = await publicBookingCatalogService.createBooking({
    roomTypeId: ROOM_TYPE_ID,
    checkIn: CHECK_IN,
    checkOut: CHECK_OUT,
    adults: 2,
    children: 0,
    notes: 'Llegada tarde',
    rateId: RATE_ID,
    roomId: 'room-1',
    status: 'confirmed',
    totalAmountCents: 1,
    guestId: 'guest-1',
    guest: {
      id: 'guest-1',
      firstName: 'Ana',
      lastName: 'Lopez',
      email: 'ana@aurora.test',
      documentType: 'passport',
      documentNumber: 'P-1',
    },
  });

  assertPublicRequests();
  assert.equal(requests[0].method, 'POST');
  assert.equal(requests[0].url, `${API}/public/bookings`);
  const body = requests[0].body;
  assert.deepEqual(Object.keys(body).sort(), [
    'adults',
    'checkIn',
    'checkOut',
    'children',
    'guest',
    'notes',
    'roomTypeId',
  ]);
  for (const forbidden of ['rateId', 'roomId', 'status', 'totalAmountCents', 'guestId']) {
    assert.equal(forbidden in body, false, `${forbidden} no debe enviarse`);
  }
  assert.equal('id' in body.guest, false);
  assert.equal(confirmation.confirmationCode, 'BKG-TEST0001');
  assert.equal(confirmation.status, 'pending');
});

const errorCases = [
  {
    name: '400 conocido',
    status: 400,
    body: { message: 'Check-in date cannot be in the past' },
    kind: 'invalid_request',
    message: 'La fecha de entrada no puede ser anterior a hoy.',
  },
  {
    name: '400 validación de huésped',
    status: 400,
    body: { message: 'Validation failed', errors: { 'guest.email': 'Email is required' } },
    kind: 'invalid_request',
    message: 'Revisa los datos del huésped.',
  },
  {
    name: '400 desconocido',
    status: 400,
    body: { message: 'Something internal' },
    kind: 'invalid_request',
    message: 'Revisa los datos de la reserva.',
  },
  {
    name: '401',
    status: 401,
    body: { message: 'Unauthorized' },
    kind: 'service_unavailable',
    message:
      'El servicio de reservas no está disponible en este momento. Intenta nuevamente más tarde.',
  },
  {
    name: '403',
    status: 403,
    body: { message: 'Forbidden' },
    kind: 'service_unavailable',
    message:
      'El servicio de reservas no está disponible en este momento. Intenta nuevamente más tarde.',
  },
  {
    name: '404',
    status: 404,
    body: { message: 'Not Found' },
    kind: 'not_found',
    message: 'El servicio público de reservas no está disponible.',
  },
  {
    name: '409 sin disponibilidad',
    status: 409,
    body: { message: 'No availability for the requested room type and dates' },
    kind: 'no_availability',
    message:
      'Ya no hay habitaciones disponibles para esas fechas. Elige otras fechas u otro tipo de habitación.',
  },
  {
    name: '409 conflicto de huésped',
    status: 409,
    body: {
      message:
        'Guest details conflict with an existing guest record. Please contact the hotel to complete the booking',
    },
    kind: 'guest_conflict',
    message:
      'No pudimos registrar la reserva con esos datos de huésped. Contacta al hotel para completarla.',
  },
  {
    name: '500',
    status: 500,
    body: { message: 'An unexpected error occurred' },
    kind: 'service_unavailable',
    message:
      'El servicio de reservas no está disponible en este momento. Intenta nuevamente más tarde.',
  },
];

for (const errorCase of errorCases) {
  test(`errores controlados: ${errorCase.name} → ${errorCase.kind}`, async () => {
    handler = () => json(errorCase.body, errorCase.status);

    await assert.rejects(
      publicBookingCatalogService.createBooking({
        roomTypeId: ROOM_TYPE_ID,
        checkIn: CHECK_IN,
        checkOut: CHECK_OUT,
        adults: 1,
        children: 0,
        guest: { firstName: 'Ana', lastName: 'Lopez', email: 'ana@aurora.test' },
      }),
      (error) => {
        assert.ok(error instanceof PublicBookingError);
        assert.equal(error.kind, errorCase.kind);
        assert.equal(error.message, errorCase.message);
        // El texto interno del backend nunca llega a la pantalla.
        assert.ok(!error.message.includes(errorCase.body.message));
        return true;
      },
    );
    // Un 401 no dispara refresh ni reintentos: una sola petición, sin token.
    assert.equal(requests.length, 1);
    assertPublicRequests();
  });
}

test('error de red: sin fallback local, mensaje genérico controlado', async () => {
  globalThis.fetch = async (url) => {
    requests.push({ url: String(url), method: 'GET', authorization: null });
    throw new TypeError('fetch failed');
  };

  await assert.rejects(publicBookingCatalogService.getRoomTypes(), (error) => {
    assert.ok(error instanceof PublicBookingError);
    assert.equal(error.kind, 'service_unavailable');
    assert.ok(!error.message.includes('fetch failed'));
    return true;
  });
  await assert.rejects(
    publicBookingCatalogService.getAvailability({
      checkIn: CHECK_IN,
      checkOut: CHECK_OUT,
      adults: 1,
    }),
    PublicBookingError,
  );
  assert.equal(requests.length, 2, 'no hay reintentos ni otra fuente de datos');
});

// --- Pantallas -------------------------------------------------------------

function renderAt(path, routePath, element, state) {
  act(() => {
    view = create(
      <MemoryRouter initialEntries={[state ? { pathname: path, state } : path]}>
        <Routes>
          <Route path={routePath} element={element} />
        </Routes>
      </MemoryRouter>,
    );
  });
}

const fieldInput = (label) =>
  view.root
    .find((node) => node.props?.label === label && typeof node.type !== 'string')
    .findByType('input');

test('BookingFormScreen: tarifa, total y disponibilidad vienen de /public/availability', async () => {
  handler = (request) =>
    pathOf(request) === '/public/room-types'
      ? json([apiRoomType])
      : json(availabilityResponse([availabilityResult({ availableRooms: 3 })]));

  renderAt(
    `/booking/new?roomTypeId=${ROOM_TYPE_ID}&checkIn=${CHECK_IN}&checkOut=${CHECK_OUT}&adults=2&children=0`,
    '/booking/new',
    <BookingFormScreen />,
  );
  await settle(1600);

  assertPublicRequests();
  const paths = requests.map(pathOf);
  assert.ok(
    !paths.includes('/public/rates'),
    'el formulario ya no calcula tarifa con /public/rates',
  );
  const availability = requests.find((request) => pathOf(request) === '/public/availability');
  assert.ok(availability, 'el formulario consulta disponibilidad real');
  assert.equal(new URL(availability.url).searchParams.get('roomTypeId'), ROOM_TYPE_ID);
  assert.equal(new URL(availability.url).searchParams.get('adults'), '2');

  const content = text(view.toJSON());
  assert.ok(content.includes(formatCurrency(150000, 'GTQ')), 'total del backend');
  assert.ok(content.includes(formatCurrency(50000, 'GTQ')), 'tarifa del backend');
  assert.ok(content.includes('3 disponibles'));
});

test('BookingFormScreen: sin disponibilidad muestra mensaje y no deja continuar', async () => {
  handler = (request) =>
    pathOf(request) === '/public/room-types' ? json([apiRoomType]) : json(availabilityResponse([]));

  renderAt(
    `/booking/new?roomTypeId=${ROOM_TYPE_ID}&checkIn=${CHECK_IN}&checkOut=${CHECK_OUT}&adults=2&children=0`,
    '/booking/new',
    <BookingFormScreen />,
  );
  await settle(1600);

  assert.ok(text(view.toJSON()).includes('No hay disponibilidad para ese tipo de habitacion'));

  act(() => {
    fieldInput('Nombre').props.onChange({ target: { value: 'Ana' } });
    fieldInput('Apellido').props.onChange({ target: { value: 'Lopez' } });
    fieldInput('Correo').props.onChange({ target: { value: 'ana@aurora.test' } });
    fieldInput('Telefono').props.onChange({ target: { value: '+502 5555 0000' } });
    fieldInput('Numero de documento').props.onChange({ target: { value: 'P-1' } });
  });
  await act(async () => {
    view.root.findByType('form').props.onSubmit({ preventDefault() {} });
  });

  // Los datos del huésped son válidos: el único error es la falta de disponibilidad.
  const fieldErrors = view.root
    .findAll((node) => node.type === 'p' && node.props.className === 'field-error')
    .map(text);
  assert.equal(fieldErrors.length, 1, `errores visibles: ${fieldErrors.join(' | ')}`);
  assert.ok(fieldErrors[0].includes('No hay disponibilidad para ese tipo de habitacion'));
  // Sigue en el paso de detalles: el botón principal no avanzó a "Ir a pago".
  const buttons = view.root.findAll((node) => node.type === 'button').map(text);
  assert.ok(buttons.some((label) => label.includes('Continuar')));
  assert.ok(!buttons.some((label) => label.includes('Ir a pago')));
  assert.ok(!requests.some((request) => request.method === 'POST'));
});

test('BookingFormScreen: una respuesta vieja de disponibilidad no pisa la más reciente', async () => {
  handler = async (request) => {
    if (pathOf(request) === '/public/room-types') return json([apiRoomType]);
    const adults = new URL(request.url).searchParams.get('adults');
    if (adults === '2') {
      // La primera consulta (2 adultos) responde tarde.
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return json(availabilityResponse([availabilityResult({ availableRooms: 1 })]));
    }
    return json(availabilityResponse([availabilityResult({ availableRooms: 5 })]));
  };

  renderAt(
    `/booking/new?roomTypeId=${ROOM_TYPE_ID}&checkIn=${CHECK_IN}&checkOut=${CHECK_OUT}&adults=2&children=0`,
    '/booking/new',
    <BookingFormScreen />,
  );
  await settle(900);
  act(() => {
    fieldInput('Adultos').props.onChange({ target: { value: '1' } });
  });
  await settle(2500);

  const content = text(view.toJSON());
  assert.ok(content.includes('5 disponibles'), 'gana la consulta más reciente (1 adulto)');
  assert.ok(!content.includes('1 disponible'), 'la respuesta vieja se descarta');
});

test('RoomDetailScreen: con fechas y huéspedes usa /public/availability', async () => {
  handler = (request) => {
    const path = pathOf(request);
    if (path === '/public/room-types') return json([apiRoomType]);
    if (path === '/public/rates') return json([openEndedRate]);
    return json(availabilityResponse([availabilityResult({ availableRooms: 2 })]));
  };

  renderAt(
    `/rooms/${ROOM_TYPE_ID}?checkIn=${CHECK_IN}&checkOut=${CHECK_OUT}&adults=2&children=1`,
    '/rooms/:roomTypeId',
    <RoomDetailScreen />,
  );
  await settle(1600);

  assertPublicRequests();
  const availability = requests.find((request) => pathOf(request) === '/public/availability');
  assert.ok(availability);
  const params = new URL(availability.url).searchParams;
  assert.equal(params.get('roomTypeId'), ROOM_TYPE_ID);
  assert.equal(params.get('children'), '1');
  const content = text(view.toJSON());
  assert.ok(content.includes('2 disponibles para tus fechas'));
  assert.ok(content.includes(formatCurrency(150000, 'GTQ')), 'total del backend');
  assert.ok(!content.includes('9999'), 'la fecha abierta interna no se muestra');
});

test('RoomDetailScreen: sin huéspedes no consulta ni inventa disponibilidad', async () => {
  handler = (request) =>
    pathOf(request) === '/public/room-types' ? json([apiRoomType]) : json([openEndedRate]);

  renderAt(
    `/rooms/${ROOM_TYPE_ID}?checkIn=${CHECK_IN}&checkOut=${CHECK_OUT}`,
    '/rooms/:roomTypeId',
    <RoomDetailScreen />,
  );
  await settle(1200);

  assert.ok(!requests.some((request) => pathOf(request) === '/public/availability'));
  const content = text(view.toJSON());
  assert.ok(!content.includes('disponibles'));
  assert.ok(content.includes('Por definir'), 'el total queda neutro');
});

test('RoomDetailScreen: sin disponibilidad deshabilita "Reservar"', async () => {
  handler = (request) => {
    const path = pathOf(request);
    if (path === '/public/room-types') return json([apiRoomType]);
    if (path === '/public/rates') return json([openEndedRate]);
    return json(availabilityResponse([]));
  };

  renderAt(
    `/rooms/${ROOM_TYPE_ID}?checkIn=${CHECK_IN}&checkOut=${CHECK_OUT}&adults=2&children=0`,
    '/rooms/:roomTypeId',
    <RoomDetailScreen />,
  );
  await settle(1600);

  assert.ok(text(view.toJSON()).includes('No hay disponibilidad para estas fechas y huéspedes.'));
  const reserve = view.root.find((node) => node.type === 'button' && text(node) === 'Reservar');
  assert.equal(reserve.props.disabled, true);
});

test('BookingConfirmationScreen: muestra "Reserva registrada" y pendiente de confirmación', () => {
  const confirmation = {
    confirmationCode: 'BKG-TEST0001',
    status: 'pending',
    roomTypeId: ROOM_TYPE_ID,
    roomTypeName: 'Doble Deluxe',
    checkIn: CHECK_IN,
    checkOut: CHECK_OUT,
    nights: 3,
    adults: 2,
    children: 0,
    rateName: 'Flexible',
    totalAmountCents: 150000,
    currency: 'GTQ',
    guestFirstName: 'Ana',
    guestLastName: 'Lopez',
    guestEmail: 'ana@aurora.test',
    createdAt: '2026-10-05T12:00:00Z',
  };

  renderAt(
    '/booking/BKG-TEST0001/done',
    '/booking/:bookingId/done',
    <BookingConfirmationScreen />,
    {
      publicBookingConfirmation: confirmation,
    },
  );

  const content = text(view.toJSON());
  assert.ok(content.includes('Reserva registrada'));
  assert.ok(content.includes('Pendiente de confirmación por el hotel'));
  assert.ok(!content.includes('Reserva confirmada'));
  const roomLink = view.root.find((node) => node.type === 'a' && text(node) === 'Ver habitación');
  const roomUrl = new URL(roomLink.props.href, 'http://localhost');
  assert.equal(roomUrl.pathname, `/rooms/${ROOM_TYPE_ID}`);
  assert.equal(roomUrl.searchParams.get('checkIn'), CHECK_IN);
  assert.equal(roomUrl.searchParams.get('checkOut'), CHECK_OUT);
  assert.equal(roomUrl.searchParams.get('adults'), '2');
  assert.equal(roomUrl.searchParams.get('children'), '0');
  assert.equal(requests.length, 0, 'la confirmación no consulta endpoints privados');
});
