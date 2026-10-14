import { build } from 'esbuild';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

// --- A. Regla de oro, verificacion estatica --------------------------------
//
// Ningun archivo fuera de src/services/ debe importar de src/data/: todo
// acceso a datos simulados pasa por un servicio.

async function collectSourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'services') continue; // los servicios sí pueden importar src/data/
      files.push(...(await collectSourceFiles(full)));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

test('regla de oro: ningún archivo fuera de services/ importa de src/data/', async () => {
  const files = await collectSourceFiles('src');
  const offenders = [];
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    if (/from ['"][^'"]*\bdata\/db\b/.test(content)) {
      offenders.push(file);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `Archivos fuera de services/ que importan src/data/: ${offenders.join(', ')}`,
  );
});

// --- B. Contrato de servicio: async, latencia simulada, Model no DTO -------
//
// Se prueban los diez servicios CRUD de WEB-05/WEB-11/WEB-12 (booking/room/
// guest/payment/catalog/guestAccount/cash/personnel/inventory/audit).
// authService no se repite aquí: sus 14 pruebas en test-auth.mjs ya cubren
// async, latencia, forma de Model y forzado de error a fondo.

await mkdir('.cache', { recursive: true });
await build({
  stdin: {
    contents: `
      export { bookingService } from './src/services/bookingService';
      export { bookingCompanionService } from './src/services/bookingCompanionService';
      export { roomService } from './src/services/roomService';
      export { guestService } from './src/services/guestService';
      export { paymentService } from './src/services/paymentService';
      export { catalogService } from './src/services/catalogService';
      export { guestAccountService } from './src/services/guestAccountService';
      export { cashService } from './src/services/cashService';
      export { personnelService } from './src/services/personnelService';
      export { inventoryService } from './src/services/inventoryService';
      export { auditService } from './src/services/auditService';
      export { reportingService } from './src/services/reportingService';
      export { promotionService } from './src/services/promotionService';
      export { housekeepingService } from './src/services/housekeepingService';
      export { orderService } from './src/services/orderService';
      export { serviceRequestService } from './src/services/serviceRequestService';
      export { notificationService } from './src/services/notificationService';
      export { guestPortalService } from './src/services/guestPortalService';
      export { mockUtils } from './src/services/mockUtils';
    `,
    resolveDir: '.',
    loader: 'ts',
  },
  outfile: '.cache/services-harness.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  tsconfig: 'tsconfig.app.json',
  define: {
    'import.meta.env': JSON.stringify({ VITE_API_BASE_URL: 'http://localhost:8080/api/v1' }),
  },
});

const require = createRequire(import.meta.url);

const storageValues = new Map();
globalThis.localStorage = {
  getItem(key) {
    return storageValues.has(key) ? storageValues.get(key) : null;
  },
  setItem(key, value) {
    storageValues.set(key, String(value));
  },
  removeItem(key) {
    storageValues.delete(key);
  },
  clear() {
    storageValues.clear();
  },
};

const {
  bookingService,
  bookingCompanionService,
  roomService,
  guestService,
  paymentService,
  catalogService,
  guestAccountService,
  cashService,
  personnelService,
  inventoryService,
  auditService,
  reportingService,
  promotionService,
  housekeepingService,
  orderService,
  serviceRequestService,
  notificationService,
  guestPortalService,
  mockUtils,
} = require(require.resolve('../.cache/services-harness.cjs'));

const reportingNow = '2026-10-02T12:00:00.000-06:00';
const reportingBookingId = '11111111-1111-4111-8111-111111111111';
const reportingGuestId = '22222222-2222-4222-8222-222222222222';
const reportingAuditLogs = [
  {
    id: '33333333-3333-4333-8333-333333333333',
    userId: 'USR-001',
    userEmail: 'admin@aurora.local',
    module: 'bookings',
    action: 'update',
    entityType: 'booking',
    entityId: reportingBookingId,
    occurredAt: reportingNow,
    details: 'Cambio de estado',
  },
  {
    id: '33333333-3333-4333-8333-444444444444',
    userId: 'USR-001',
    userEmail: 'admin@aurora.local',
    module: 'rates',
    action: 'approve',
    entityType: 'rate',
    entityId: 'RATE-001',
    occurredAt: reportingNow,
    details: 'Accion futura del backend',
  },
];
let lastReportingRequest = null;
const apiNow = '2026-10-02T12:00:00.000Z';
const apiProducts = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    sku: 'RS-COFFEE',
    name: 'Cafe americano',
    description: 'Cafe de la casa',
    category: 'food_and_beverage',
    priceCents: 1500,
    currency: 'GTQ',
    active: true,
    createdAt: apiNow,
    updatedAt: apiNow,
  },
  {
    id: '11111111-1111-4111-8111-222222222222',
    sku: 'RS-CAKE',
    name: 'Pastel de chocolate',
    description: 'Postre de la casa',
    category: 'food_and_beverage',
    priceCents: 2800,
    currency: 'GTQ',
    active: false,
    createdAt: apiNow,
    updatedAt: apiNow,
  },
];
const apiAmenities = [
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Piscina',
    description: 'Piscina principal',
    category: 'hotel',
    location: 'Terraza',
    opensAt: '08:00',
    closesAt: '20:00',
    active: true,
    createdAt: apiNow,
    updatedAt: apiNow,
  },
  {
    id: '22222222-2222-4222-8222-333333333333',
    name: 'Spa',
    description: 'Tratamientos con reserva',
    category: 'service',
    location: 'Nivel 2',
    opensAt: '10:00',
    closesAt: '18:00',
    active: false,
    createdAt: apiNow,
    updatedAt: apiNow,
  },
];
const apiUsers = [
  {
    id: '33333333-3333-4333-8333-333333333333',
    firstName: 'Jose',
    lastName: 'Perez',
    email: 'jose@example.com',
    roleCode: 'ADMIN',
    status: 'active',
    createdAt: apiNow,
    updatedAt: apiNow,
  },
];
const apiRoles = [
  {
    id: '44444444-4444-4444-8444-444444444444',
    code: 'ADMIN',
    name: 'Administrador',
    active: true,
    permissions: ['admin.dashboard.view'],
  },
];
const apiPermissions = [
  {
    key: 'admin.dashboard.view',
    name: 'Dashboard',
    module: 'Administracion',
    description: 'Acceso al tablero administrativo',
  },
];
const apiPromotions = [
  {
    id: '55555555-5555-4555-8555-555555555555',
    code: 'EARLY',
    name: 'Reserva anticipada',
    description: 'Descuento base',
    discountPercent: 10,
    validFrom: '2026-12-01',
    validTo: '2026-12-31',
    active: true,
    createdAt: apiNow,
    updatedAt: apiNow,
  },
];
const apiInventoryItems = [
  {
    id: '66666666-6666-4666-8666-666666666666',
    sku: 'HK-TOWEL',
    name: 'Toalla blanca',
    description: 'Toalla de habitacion',
    category: 'housekeeping',
    unit: 'unit',
    currentQuantity: 10,
    minimumQuantity: 4,
    lowStock: false,
    active: true,
    createdAt: apiNow,
    updatedAt: apiNow,
  },
];
const apiInventoryMovements = [];
const apiRoomFeatures = [
  {
    id: 'aaaa1111-1111-4111-8111-111111111111',
    name: 'Aire acondicionado',
    description: 'Climatizacion individual',
    createdAt: apiNow,
    updatedAt: apiNow,
  },
  {
    id: 'aaaa1111-1111-4111-8111-222222222222',
    name: 'Balcon privado',
    description: 'Salida a balcon',
    createdAt: apiNow,
    updatedAt: apiNow,
  },
];
const apiRoomTypes = [
  {
    id: 'bbbb2222-2222-4222-8222-111111111111',
    code: 'EST',
    name: 'Estandar',
    description: 'Habitacion base',
    capacity: 2,
    bedConfiguration: '1 cama matrimonial',
    roomFeatureIds: apiRoomFeatures.map((item) => item.id),
    active: true,
    createdAt: apiNow,
    updatedAt: apiNow,
  },
];
const apiRooms = [
  {
    id: 'cccc3333-3333-4333-8333-111111111111',
    roomNumber: '101',
    roomTypeId: apiRoomTypes[0].id,
    floor: 1,
    status: 'available',
    housekeepingStatus: 'clean',
    createdAt: apiNow,
    updatedAt: apiNow,
  },
  {
    id: 'RM-101',
    roomNumber: '102',
    roomTypeId: apiRoomTypes[0].id,
    floor: 1,
    status: 'available',
    housekeepingStatus: 'dirty',
    createdAt: apiNow,
    updatedAt: apiNow,
  },
  {
    id: 'RM-301',
    roomNumber: '301',
    roomTypeId: apiRoomTypes[0].id,
    floor: 3,
    status: 'occupied',
    housekeepingStatus: 'clean',
    createdAt: apiNow,
    updatedAt: apiNow,
  },
  {
    id: 'RM-203',
    roomNumber: '203',
    roomTypeId: apiRoomTypes[0].id,
    floor: 2,
    status: 'available',
    housekeepingStatus: 'inspected',
    createdAt: apiNow,
    updatedAt: apiNow,
  },
];
const apiRates = [
  {
    id: 'dddd4444-4444-4444-8444-111111111111',
    roomTypeId: apiRoomTypes[0].id,
    name: 'Tarifa base Estandar',
    validFrom: '2026-01-01',
    validTo: '2026-12-31',
    priceCents: 65000,
    currency: 'GTQ',
    minimumNights: 1,
    refundable: true,
    active: true,
    createdAt: apiNow,
    updatedAt: apiNow,
  },
];
const apiGuests = [
  {
    id: 'eeee5555-5555-4555-8555-111111111111',
    firstName: 'Elena',
    lastName: 'Castro',
    email: 'elena@example.com',
    phone: '+502 5555-1010',
    nationality: 'Guatemalteca',
    documentType: 'national_id',
    documentNumber: '1000 20000 0101',
    createdAt: apiNow,
    updatedAt: apiNow,
  },
];
const apiBookings = [
  {
    id: 'ffff6666-6666-4666-8666-111111111111',
    confirmationCode: 'PMS-INT-0001',
    guestLinkCode: 'LNK-INT-0001',
    guestId: apiGuests[0].id,
    roomTypeId: apiRoomTypes[0].id,
    rateId: apiRates[0].id,
    checkIn: '2026-12-10',
    checkOut: '2026-12-12',
    status: 'pending',
    adults: 2,
    children: 0,
    totalAmountCents: 130000,
    currency: 'GTQ',
    notes: 'Reserva integrada inicial.',
    createdAt: apiNow,
    updatedAt: apiNow,
  },
];
const apiServiceRequests = [];

function roleCodeById(roleId) {
  const role = apiRoles.find((item) => item.id === roleId);
  if (!role) return undefined;
  return role.code;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const adminFetchMock = async (input, init = {}) => {
  const url = new URL(String(input));
  const method = init.method ?? 'GET';
  const path = url.pathname.replace('/api/v1', '');
  const body = init.body ? JSON.parse(String(init.body)) : undefined;
  lastReportingRequest = { path, search: url.searchParams };

  if (method === 'GET' && path === '/admin/audit-logs') {
    return jsonResponse(reportingAuditLogs);
  }

  if (method === 'GET' && path === '/admin/reports/operations') {
    return jsonResponse({
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
      bookings: 3,
      cancellations: 1,
      revenueCents: 250000,
      occupancyNights: 5,
      bookingsByStatus: { checked_in: 1, checked_out: 1, cancelled: 1 },
      roomServiceOrders: 4,
    });
  }

  if (method === 'GET' && path === `/admin/bookings/${reportingBookingId}/receipt`) {
    return jsonResponse({
      stay: {
        bookingId: reportingBookingId,
        guestId: reportingGuestId,
        guestFirstName: 'Ana',
        guestLastName: 'Lopez',
        roomId: '44444444-4444-4444-8444-444444444444',
        roomNumber: '101',
        roomTypeId: '55555555-5555-4555-8555-555555555555',
        roomTypeName: 'Suite',
        checkIn: '2026-10-01',
        checkOut: '2026-10-03',
        status: 'checked_out',
        balanceCents: 0,
        currency: 'GTQ',
      },
      charges: [
        {
          id: '66666666-6666-4666-8666-666666666666',
          bookingId: reportingBookingId,
          description: 'Estancia',
          quantity: 1,
          unitPriceCents: 250000,
          amountCents: 250000,
          currency: 'GTQ',
          category: 'stay',
          status: 'posted',
          chargedAt: reportingNow,
          createdAt: reportingNow,
        },
      ],
      payments: [
        {
          id: '77777777-7777-4777-8777-777777777777',
          bookingId: reportingBookingId,
          amountCents: 250000,
          currency: 'GTQ',
          method: 'cash',
          status: 'completed',
          paidAt: reportingNow,
          createdAt: reportingNow,
        },
      ],
      deposits: [],
      finalBalanceCents: 0,
      currency: 'GTQ',
    });
  }

  if (method === 'GET' && path === '/rooms') return jsonResponse(apiRooms);
  if (method === 'GET' && path.startsWith('/rooms/')) {
    const id = path.split('/').at(-1);
    const room = apiRooms.find((item) => item.id === id);
    return room ? jsonResponse(room) : jsonResponse({ message: 'Not found' }, 404);
  }
  if (method === 'POST' && path === '/rooms') {
    if (!body.roomNumber || !body.roomTypeId || !Number.isInteger(body.floor)) {
      return jsonResponse({ message: 'roomNumber, roomTypeId and floor are required' }, 400);
    }
    if (!apiRoomTypes.some((item) => item.id === body.roomTypeId)) {
      return jsonResponse({ message: 'Room type not found' }, 400);
    }
    const room = {
      id: `cccc3333-3333-4333-8333-${String(apiRooms.length + 2).padStart(12, '0')}`,
      roomNumber: body.roomNumber,
      roomTypeId: body.roomTypeId,
      floor: body.floor,
      status: body.status ?? 'available',
      housekeepingStatus: body.housekeepingStatus ?? 'dirty',
      notes: body.notes,
      createdAt: apiNow,
      updatedAt: apiNow,
    };
    apiRooms.push(room);
    return jsonResponse(room, 201);
  }
  if (method === 'PUT' && path.startsWith('/rooms/')) {
    const id = path.split('/').at(-1);
    const room = apiRooms.find((item) => item.id === id);
    if (!room) return jsonResponse({ message: 'Not found' }, 404);
    Object.assign(room, {
      roomNumber: body.roomNumber ?? room.roomNumber,
      roomTypeId: body.roomTypeId ?? room.roomTypeId,
      floor: body.floor ?? room.floor,
      status: body.status ?? room.status,
      housekeepingStatus: body.housekeepingStatus ?? room.housekeepingStatus,
      notes: body.notes ?? room.notes,
      updatedAt: apiNow,
    });
    return jsonResponse(room);
  }
  if (method === 'GET' && path === '/room-types') return jsonResponse(apiRoomTypes);
  if (method === 'GET' && path.startsWith('/room-types/')) {
    const id = path.split('/').at(-1);
    const roomType = apiRoomTypes.find((item) => item.id === id);
    return roomType ? jsonResponse(roomType) : jsonResponse({ message: 'Not found' }, 404);
  }
  if (method === 'POST' && path === '/room-types') {
    const roomType = {
      id: `bbbb2222-2222-4222-8222-${String(apiRoomTypes.length + 2).padStart(12, '0')}`,
      code: body.code,
      name: body.name,
      description: body.description,
      capacity: body.capacity,
      bedConfiguration: body.bedConfiguration,
      roomFeatureIds: body.roomFeatureIds ?? [],
      active: body.active ?? true,
      createdAt: apiNow,
      updatedAt: apiNow,
    };
    apiRoomTypes.push(roomType);
    return jsonResponse(roomType, 201);
  }
  if (method === 'PUT' && path.startsWith('/room-types/')) {
    const id = path.split('/').at(-1);
    const roomType = apiRoomTypes.find((item) => item.id === id);
    if (!roomType) return jsonResponse({ message: 'Not found' }, 404);
    Object.assign(roomType, {
      code: body.code ?? roomType.code,
      name: body.name ?? roomType.name,
      description: body.description ?? roomType.description,
      capacity: body.capacity ?? roomType.capacity,
      bedConfiguration: body.bedConfiguration ?? roomType.bedConfiguration,
      roomFeatureIds: body.roomFeatureIds ?? roomType.roomFeatureIds,
      active: body.active ?? roomType.active,
      updatedAt: apiNow,
    });
    return jsonResponse(roomType);
  }
  if (method === 'GET' && path === '/room-features') return jsonResponse(apiRoomFeatures);
  if (method === 'GET' && path === '/rates') return jsonResponse(apiRates);
  if (method === 'POST' && path === '/rates') {
    if (!Number.isInteger(body.priceCents) || body.priceCents < 1) {
      return jsonResponse({ message: 'priceCents must be greater than or equal to 1' }, 400);
    }
    const rate = {
      id: `dddd4444-4444-4444-8444-${String(apiRates.length + 2).padStart(12, '0')}`,
      roomTypeId: body.roomTypeId,
      name: body.name,
      validFrom: body.validFrom,
      validTo: body.validTo,
      priceCents: body.priceCents,
      currency: body.currency ?? 'GTQ',
      minimumNights: body.minimumNights ?? 1,
      refundable: body.refundable ?? true,
      active: body.active ?? true,
      createdAt: apiNow,
      updatedAt: apiNow,
    };
    apiRates.push(rate);
    return jsonResponse(rate, 201);
  }
  if (method === 'PUT' && path.startsWith('/rates/')) {
    const id = path.split('/').at(-1);
    const rate = apiRates.find((item) => item.id === id);
    if (!rate) return jsonResponse({ message: 'Not found' }, 404);
    Object.assign(rate, {
      roomTypeId: body.roomTypeId ?? rate.roomTypeId,
      name: body.name ?? rate.name,
      validFrom: body.validFrom ?? rate.validFrom,
      validTo: body.validTo ?? rate.validTo,
      priceCents: body.priceCents ?? rate.priceCents,
      currency: body.currency ?? rate.currency,
      minimumNights: body.minimumNights ?? rate.minimumNights,
      refundable: body.refundable ?? rate.refundable,
      active: body.active ?? rate.active,
      updatedAt: apiNow,
    });
    return jsonResponse(rate);
  }

  if (method === 'GET' && path === '/guests') return jsonResponse(apiGuests);
  if (method === 'GET' && path.startsWith('/guests/')) {
    const id = path.split('/').at(-1);
    const guest = apiGuests.find((item) => item.id === id);
    return guest ? jsonResponse(guest) : jsonResponse({ message: 'Not found' }, 404);
  }
  if (method === 'POST' && path === '/guests') {
    const guest = {
      id: `eeee5555-5555-4555-8555-${String(apiGuests.length + 2).padStart(12, '0')}`,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
      nationality: body.nationality,
      documentType: body.documentType,
      documentNumber: body.documentNumber,
      notes: body.notes,
      createdAt: apiNow,
      updatedAt: apiNow,
    };
    apiGuests.push(guest);
    return jsonResponse(guest, 201);
  }
  if (method === 'PUT' && path.startsWith('/guests/')) {
    const id = path.split('/').at(-1);
    const guest = apiGuests.find((item) => item.id === id);
    if (!guest) return jsonResponse({ message: 'Not found' }, 404);
    Object.assign(guest, body, { updatedAt: apiNow });
    return jsonResponse(guest);
  }

  if (method === 'GET' && path === '/bookings') return jsonResponse(apiBookings);
  if (method === 'GET' && path.startsWith('/bookings/')) {
    const id = path.split('/').at(-1);
    const booking = apiBookings.find((item) => item.id === id);
    return booking ? jsonResponse(booking) : jsonResponse({ message: 'Not found' }, 404);
  }
  if (method === 'POST' && path === '/bookings') {
    const booking = {
      id: `ffff6666-6666-4666-8666-${String(apiBookings.length + 2).padStart(12, '0')}`,
      confirmationCode: `PMS-INT-${String(apiBookings.length + 2).padStart(4, '0')}`,
      guestLinkCode: `LNK-INT-${String(apiBookings.length + 2).padStart(4, '0')}`,
      guestId: body.guestId,
      roomId: body.roomId,
      roomTypeId: body.roomTypeId,
      rateId: body.rateId,
      checkIn: body.checkIn,
      checkOut: body.checkOut,
      status: 'pending',
      adults: body.adults,
      children: body.children,
      totalAmountCents: 130000,
      currency: 'GTQ',
      notes: body.notes,
      createdAt: apiNow,
      updatedAt: apiNow,
    };
    apiBookings.push(booking);
    return jsonResponse(booking, 201);
  }
  if (method === 'PUT' && path.startsWith('/bookings/')) {
    const id = path.split('/').at(-1);
    const booking = apiBookings.find((item) => item.id === id);
    if (!booking) return jsonResponse({ message: 'Not found' }, 404);
    Object.assign(booking, body, { updatedAt: apiNow });
    return jsonResponse(booking);
  }

  if (method === 'GET' && path === '/service-requests') return jsonResponse(apiServiceRequests);
  if (method === 'POST' && path === '/service-requests') {
    const request = {
      id: `aaaa9999-9999-4999-8999-${String(apiServiceRequests.length + 1).padStart(12, '0')}`,
      bookingId: body.bookingId ?? null,
      roomId: body.roomId,
      roomNumber: apiRooms.find((room) => room.id === body.roomId)?.roomNumber ?? null,
      guestId: null,
      guestName: null,
      responsibleUserId: null,
      responsibleUserName: null,
      responsibleUserEmail: null,
      type: body.type,
      description: body.description,
      status: 'pending',
      notes: body.notes ?? null,
      requestedAt: apiNow,
      startedAt: null,
      completedAt: null,
      createdAt: apiNow,
      updatedAt: apiNow,
    };
    apiServiceRequests.unshift(request);
    return jsonResponse(request, 201);
  }

  if (method === 'GET' && path === '/room-service/products') {
    return jsonResponse(apiProducts.filter((item) => item.active));
  }
  if (method === 'GET' && path === '/admin/room-service/products') {
    return jsonResponse(apiProducts);
  }
  if (method === 'POST' && path === '/admin/room-service/products') {
    if (!Number.isInteger(body.priceCents) || body.priceCents < 1) {
      return jsonResponse({ message: 'priceCents must be greater than or equal to 1' }, 400);
    }
    const product = {
      id: `11111111-1111-4111-8111-${String(apiProducts.length + 3).padStart(12, '0')}`,
      sku: body.sku,
      name: body.name,
      description: body.description,
      category: body.category,
      priceCents: body.priceCents,
      currency: body.currency,
      active: body.active,
      createdAt: apiNow,
      updatedAt: apiNow,
    };
    apiProducts.push(product);
    return jsonResponse(product, 201);
  }
  if (method === 'PUT' && path.startsWith('/admin/room-service/products/')) {
    const id = path.split('/').at(-1);
    const product = apiProducts.find((item) => item.id === id);
    if (!product) return jsonResponse({ message: 'Not found' }, 404);
    if (!Number.isInteger(body.priceCents) || body.priceCents < 1) {
      return jsonResponse({ message: 'priceCents must be greater than or equal to 1' }, 400);
    }
    Object.assign(product, {
      sku: body.sku,
      name: body.name,
      description: body.description,
      category: body.category,
      priceCents: body.priceCents,
      currency: body.currency,
      active: body.active,
      updatedAt: apiNow,
    });
    return jsonResponse(product);
  }
  if (method === 'GET' && path === '/admin/amenities') return jsonResponse(apiAmenities);
  if (method === 'POST' && path === '/admin/amenities') {
    const amenity = {
      id: `22222222-2222-4222-8222-${String(apiAmenities.length + 4).padStart(12, '0')}`,
      name: body.name,
      description: body.description,
      category: body.category,
      location: body.location,
      opensAt: body.opensAt,
      closesAt: body.closesAt,
      active: body.active,
      createdAt: apiNow,
      updatedAt: apiNow,
    };
    apiAmenities.push(amenity);
    return jsonResponse(amenity, 201);
  }
  if (method === 'PUT' && path.startsWith('/admin/amenities/')) {
    const id = path.split('/').at(-1);
    const amenity = apiAmenities.find((item) => item.id === id);
    if (!amenity) return jsonResponse({ message: 'Not found' }, 404);
    Object.assign(amenity, {
      name: body.name,
      description: body.description,
      category: body.category,
      location: body.location,
      opensAt: body.opensAt,
      closesAt: body.closesAt,
      active: body.active,
      updatedAt: apiNow,
    });
    return jsonResponse(amenity);
  }
  if (method === 'GET' && path === '/admin/users') return jsonResponse(apiUsers);
  if (method === 'POST' && path === '/admin/users') {
    if ('roleCode' in body || 'status' in body) {
      return jsonResponse({ message: 'CreateUserRequest does not accept roleCode/status' }, 400);
    }
    if (!body.password || !body.roleId) {
      return jsonResponse({ message: 'password and roleId are required' }, 400);
    }
    const roleCode = roleCodeById(body.roleId);
    if (!roleCode) return jsonResponse({ message: 'Role not found' }, 400);
    const user = {
      id: `33333333-3333-4333-8333-${String(apiUsers.length + 4).padStart(12, '0')}`,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      roleCode,
      status: 'active',
      createdAt: apiNow,
      updatedAt: apiNow,
    };
    apiUsers.push(user);
    return jsonResponse(user, 201);
  }
  if (method === 'GET' && path.startsWith('/admin/users/')) {
    const user = apiUsers.find((item) => path.endsWith(item.id));
    return user ? jsonResponse(user) : jsonResponse({ message: 'Not found' }, 404);
  }
  if (method === 'PUT' && path.startsWith('/admin/users/')) {
    const id = path.split('/').at(-1);
    const user = apiUsers.find((item) => item.id === id);
    if (!user) return jsonResponse({ message: 'Not found' }, 404);
    if ('roleCode' in body || 'password' in body) {
      return jsonResponse({ message: 'UpdateUserRequest does not accept roleCode/password' }, 400);
    }
    const roleCode = roleCodeById(body.roleId);
    if (!roleCode) return jsonResponse({ message: 'Role not found' }, 400);
    Object.assign(user, {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      roleCode,
      status: body.status,
      updatedAt: apiNow,
    });
    return jsonResponse(user);
  }
  if (method === 'GET' && path === '/admin/roles') return jsonResponse(apiRoles);
  if (method === 'GET' && path === '/admin/permissions') return jsonResponse(apiPermissions);
  if (method === 'GET' && path === '/admin/promotions') return jsonResponse(apiPromotions);
  if (method === 'POST' && path === '/admin/promotions') {
    const promotion = {
      id: '77777777-7777-4777-8777-777777777777',
      code: body.code,
      name: body.name,
      description: body.description,
      discountPercent: body.discountPercent,
      validFrom: body.validFrom,
      validTo: body.validTo,
      active: body.active,
      createdAt: apiNow,
      updatedAt: apiNow,
    };
    apiPromotions.push(promotion);
    return jsonResponse(promotion, 201);
  }
  if (method === 'PUT' && path.startsWith('/admin/promotions/')) {
    const id = path.split('/').at(-1);
    const promotion = apiPromotions.find((item) => item.id === id);
    if (!promotion) return jsonResponse({ message: 'Not found' }, 404);
    Object.assign(promotion, {
      code: body.code,
      name: body.name,
      description: body.description,
      discountPercent: body.discountPercent,
      validFrom: body.validFrom,
      validTo: body.validTo,
      active: body.active,
      updatedAt: apiNow,
    });
    return jsonResponse(promotion);
  }
  if (method === 'GET' && path === '/inventory/items') return jsonResponse(apiInventoryItems);
  if (method === 'GET' && path.startsWith('/inventory/items/') && path.endsWith('/movements')) {
    const itemId = path.split('/').at(-2);
    return jsonResponse(apiInventoryMovements.filter((item) => item.inventoryItemId === itemId));
  }
  if (method === 'GET' && path.startsWith('/inventory/items/')) {
    const id = path.split('/').at(-1);
    const item = apiInventoryItems.find((entry) => entry.id === id);
    return item ? jsonResponse(item) : jsonResponse({ message: 'Not found' }, 404);
  }
  if (method === 'PUT' && path.startsWith('/admin/inventory/items/')) {
    const id = path.split('/').at(-1);
    const item = apiInventoryItems.find((entry) => entry.id === id);
    if (!item) return jsonResponse({ message: 'Not found' }, 404);
    Object.assign(item, {
      sku: body.sku,
      name: body.name,
      description: body.description,
      category: body.category,
      unit: body.unit,
      minimumQuantity: body.minimumQuantity,
      productId: body.productId,
      active: body.active,
      updatedAt: apiNow,
    });
    return jsonResponse(item);
  }
  if (method === 'POST' && path.startsWith('/inventory/items/') && path.endsWith('/movements')) {
    const itemId = path.split('/').at(-2);
    const item = apiInventoryItems.find((entry) => entry.id === itemId);
    if (!item) return jsonResponse({ message: 'Not found' }, 404);
    const nextQuantity =
      body.type === 'in'
        ? item.currentQuantity + body.quantity
        : item.currentQuantity - body.quantity;
    if (nextQuantity < 0) return jsonResponse({ message: 'Stock cannot go negative' }, 400);
    item.currentQuantity = nextQuantity;
    item.updatedAt = apiNow;
    const movement = {
      id: `${88888888 + apiInventoryMovements.length}-8888-4888-8888-888888888888`,
      inventoryItemId: itemId,
      type: body.type,
      reason: body.reason,
      quantity: body.quantity,
      occurredAt: apiNow,
      notes: body.notes,
      createdAt: apiNow,
    };
    apiInventoryMovements.unshift(movement);
    return jsonResponse(movement, 201);
  }

  return jsonResponse({ message: `Unhandled ${method} ${path}` }, 404);
};

globalThis.fetch = adminFetchMock;
const MIN_LATENCY_MS = 250; // 300ms nominal, con margen por scheduling
const MAX_LATENCY_MS = 900; // 600ms nominal, con margen para CI lento

async function assertServiceCall(label, call) {
  const started = Date.now();
  const result = call();
  assert.ok(result instanceof Promise, `${label}: debe devolver una Promise (ser async)`);
  const value = await result;
  const elapsed = Date.now() - started;
  assert.ok(
    elapsed >= MIN_LATENCY_MS && elapsed <= MAX_LATENCY_MS,
    `${label}: la latencia simulada fue ${elapsed}ms, se esperaba entre ${MIN_LATENCY_MS} y ${MAX_LATENCY_MS}ms`,
  );
  return value;
}

function installFinancialFetchMock() {
  const bookingId = '8f3d5bb0-9c0a-4c24-8e56-5e3fd5406c4a';
  const guestId = '81f20327-2f16-4b6d-9dc5-caa25c822d31';
  const accountId = '64d6cfcc-22f4-4c2e-b01d-c00f737dc6e1';
  const chargeId = 'a8082035-e41a-40b8-b08f-a3856346f3c2';
  const paymentId = 'ca458699-01eb-4576-a0e9-925b81a4d83e';
  const depositId = '9a3b8b2b-604f-47d4-a8db-c72ce367508f';
  const now = '2026-10-02T10:00:00Z';
  const charges = [
    {
      id: chargeId,
      bookingId,
      productId: null,
      description: 'Estadia base',
      quantity: 1,
      unitPriceCents: 50000,
      amountCents: 50000,
      currency: 'GTQ',
      category: 'stay',
      status: 'posted',
      chargedAt: now,
      createdByUserId: null,
      voidReason: null,
      createdAt: now,
    },
  ];
  const payments = [];
  const deposits = [];
  const folio = () => ({
    accountId,
    bookingId,
    guestId,
    status: 'open',
    balanceCents:
      charges
        .filter((charge) => charge.status === 'posted')
        .reduce((sum, charge) => sum + charge.amountCents, 0) -
      payments
        .filter((payment) => payment.status === 'completed')
        .reduce((sum, payment) => sum + payment.amountCents, 0) -
      deposits
        .filter((deposit) => deposit.status === 'held' || deposit.status === 'applied')
        .reduce((sum, deposit) => sum + deposit.amountCents, 0),
    currency: 'GTQ',
    openedAt: now,
    closedAt: null,
    activeChargesCents: charges
      .filter((charge) => charge.status === 'posted')
      .reduce((sum, charge) => sum + charge.amountCents, 0),
    voidedChargesCents: charges
      .filter((charge) => charge.status === 'voided')
      .reduce((sum, charge) => sum + charge.amountCents, 0),
    completedPaymentsCents: payments
      .filter((payment) => payment.status === 'completed')
      .reduce((sum, payment) => sum + payment.amountCents, 0),
    charges,
  });

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = init.method ?? 'GET';
    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });

    if (method === 'GET' && path === `/bookings/${bookingId}/folio`) return json(folio());
    if (method === 'POST' && path === `/bookings/${bookingId}/folio/open`) return json(folio());
    if (method === 'GET' && path === '/guest-accounts') return json([folio()]);
    if (method === 'GET' && path === '/charges') return json(charges);
    if (method === 'GET' && path === '/payments') return json(payments);
    if (method === 'GET' && path === '/deposits') return json(deposits);
    if (method === 'GET' && path === `/bookings/${bookingId}/charges`) return json(charges);
    if (method === 'POST' && path === `/bookings/${bookingId}/charges`) {
      const request = JSON.parse(String(init.body ?? '{}'));
      const charge = {
        id: 'b8082035-e41a-40b8-b08f-a3856346f3c2',
        bookingId,
        productId: request.productId ?? null,
        description: request.description,
        quantity: request.quantity,
        unitPriceCents: request.unitPriceCents,
        amountCents: request.quantity * request.unitPriceCents,
        currency: 'GTQ',
        category: request.category,
        status: 'posted',
        chargedAt: now,
        createdByUserId: null,
        voidReason: null,
        createdAt: now,
      };
      charges.push(charge);
      return json(charge, 201);
    }
    if (method === 'POST' && path === `/bookings/${bookingId}/charges/${chargeId}/void`) {
      const request = JSON.parse(String(init.body ?? '{}'));
      charges[0] = { ...charges[0], status: 'voided', voidReason: request.reason };
      return json(charges[0]);
    }
    if (method === 'GET' && path === `/bookings/${bookingId}/payments`) return json(payments);
    if (method === 'POST' && path === `/bookings/${bookingId}/payments`) {
      const request = JSON.parse(String(init.body ?? '{}'));
      const payment = {
        id: paymentId,
        bookingId,
        amountCents: request.amountCents,
        currency: 'GTQ',
        method: request.method,
        status: 'completed',
        transactionReference: request.transactionReference ?? null,
        paidAt: now,
        processedByUserId: null,
        createdAt: now,
      };
      payments.push(payment);
      return json(payment, 201);
    }
    if (method === 'GET' && path === `/bookings/${bookingId}/deposits`) return json(deposits);
    if (method === 'POST' && path === `/bookings/${bookingId}/deposits`) {
      const request = JSON.parse(String(init.body ?? '{}'));
      const deposit = {
        id: depositId,
        bookingId,
        guestId,
        amountCents: request.amountCents,
        currency: 'GTQ',
        method: request.method,
        status: 'held',
        collectedAt: now,
        refundedAt: null,
        notes: request.notes ?? null,
        createdAt: now,
        updatedAt: now,
      };
      deposits.push(deposit);
      return json(deposit, 201);
    }
    if (method === 'POST' && path === `/bookings/${bookingId}/deposits/${depositId}/apply`) {
      deposits[0] = { ...deposits[0], status: 'applied', updatedAt: now };
      return json(deposits[0]);
    }
    if (method === 'POST' && path === `/bookings/${bookingId}/deposits/${depositId}/refund`) {
      deposits[0] = { ...deposits[0], status: 'refunded', refundedAt: now, updatedAt: now };
      return json(deposits[0]);
    }
    return json({ message: `Ruta financiera no mockeada en test: ${method} ${path}` }, 404);
  };

  return { bookingId, chargeId, depositId };
}

function installGuestBookingFetchMock() {
  const previousFetch = globalThis.fetch;
  const calls = [];
  const now = '2026-10-04T12:00:00.000Z';
  const guests = [
    {
      id: '7d2f8f2a-0b48-47a4-9bc3-3b1b0874d111',
      firstName: 'Elena',
      lastName: 'Castro',
      email: 'elena@example.com',
      phone: '+502 5555-1010',
      nationality: 'Guatemalteca',
      documentType: 'national_id',
      documentNumber: '1000 20000 0101',
      createdAt: now,
      updatedAt: now,
    },
  ];
  const bookings = [
    {
      id: '1f24bc67-4a9d-4c1d-9210-d661f60e1111',
      confirmationCode: 'PMS-INT-0301',
      guestLinkCode: 'LNK-INT-0301',
      guestId: guests[0].id,
      roomTypeId: apiRoomTypes[0].id,
      rateId: apiRates[0].id,
      checkIn: '2026-12-10',
      checkOut: '2026-12-12',
      status: 'pending',
      adults: 2,
      children: 0,
      totalAmountCents: 130000,
      currency: 'GTQ',
      notes: 'Reserva integrada inicial.',
      createdAt: now,
      updatedAt: now,
    },
  ];
  const companions = [];
  let folioBalanceCents = 75000;
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  const findBooking = (id) => bookings.find((item) => item.id === id);
  const findRoom = (id) => apiRooms.find((item) => item.id === id);
  const folio = (booking) => ({
    accountId: '2f24bc67-4a9d-4c1d-9210-d661f60e9999',
    bookingId: booking.id,
    guestId: booking.guestId,
    status: booking.status === 'checked_out' ? 'closed' : 'open',
    balanceCents: folioBalanceCents,
    currency: 'GTQ',
    openedAt: now,
    closedAt: booking.status === 'checked_out' ? now : null,
    charges: [],
  });

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ call: `${method} ${path}`, body });

    if (method === 'GET' && path === '/guests') return json(guests);
    if (method === 'GET' && path.startsWith('/guests/')) {
      const id = path.split('/').at(-1);
      const guest = guests.find((item) => item.id === id);
      return guest ? json(guest) : json({ message: 'Not found' }, 404);
    }
    if (method === 'POST' && path === '/guests') {
      const guest = {
        id: '7d2f8f2a-0b48-47a4-9bc3-3b1b0874d222',
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        nationality: body.nationality,
        documentType: body.documentType,
        documentNumber: body.documentNumber,
        notes: body.notes,
        createdAt: now,
        updatedAt: now,
      };
      guests.push(guest);
      return json(guest, 201);
    }
    if (method === 'PUT' && path.startsWith('/guests/')) {
      const id = path.split('/').at(-1);
      const guest = guests.find((item) => item.id === id);
      if (!guest) return json({ message: 'Not found' }, 404);
      Object.assign(guest, body, { updatedAt: now });
      return json(guest);
    }

    if (method === 'GET' && path === '/bookings') return json(bookings);
    const companionPathMatch = path.match(/^\/bookings\/([^/]+)\/companions(?:\/([^/]+))?$/);
    if (companionPathMatch) {
      const booking = findBooking(companionPathMatch[1]);
      if (!booking) return json({ message: 'Booking not found' }, 404);
      const companionId = companionPathMatch[2];
      if (method === 'GET' && !companionId)
        return json(companions.filter((item) => item.bookingId === booking.id));
      if (method === 'POST' && !companionId) {
        const companion = {
          id: `3f24bc67-4a9d-4c1d-9210-${String(companions.length + 1).padStart(12, '0')}`,
          bookingId: booking.id,
          firstName: body.firstName,
          lastName: body.lastName,
          documentType: body.documentType,
          documentNumber: body.documentNumber,
          guestType: body.guestType,
          createdAt: now,
          updatedAt: now,
        };
        companions.push(companion);
        return json(companion, 201);
      }
      if (method === 'PUT' && companionId) {
        const companion = companions.find((item) => item.id === companionId);
        if (!companion) return json({ message: 'Companion not found' }, 404);
        Object.assign(companion, {
          firstName: body.firstName,
          lastName: body.lastName,
          documentType: body.documentType,
          documentNumber: body.documentNumber,
          guestType: body.guestType,
          updatedAt: now,
        });
        return json(companion);
      }
      if (method === 'DELETE' && companionId) {
        const index = companions.findIndex((item) => item.id === companionId);
        if (index === -1) return json({ message: 'Companion not found' }, 404);
        companions.splice(index, 1);
        return new Response(null, { status: 204 });
      }
    }
    const bookingPathMatch = path.match(/^\/bookings\/([^/]+)(?:\/([^/]+))?$/);
    if (bookingPathMatch?.[2] === 'check-in' && method === 'POST') {
      const booking = findBooking(bookingPathMatch[1]);
      if (!booking) return json({ message: 'Booking not found' }, 404);
      booking.status = 'checked_in';
      booking.updatedAt = now;
      const room = findRoom(booking.roomId);
      if (room) room.status = 'occupied';
      return json({
        bookingId: booking.id,
        status: booking.status,
        guestId: booking.guestId,
        guestFirstName: 'Elena',
        guestLastName: 'Castro',
        roomId: booking.roomId,
        roomNumber: room?.roomNumber ?? '101',
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        adults: booking.adults,
        children: booking.children,
        companionCount: companions.filter((item) => item.bookingId === booking.id).length,
        totalOccupants: 1 + companions.filter((item) => item.bookingId === booking.id).length,
        operationTimestamp: now,
      });
    }
    if (bookingPathMatch?.[2] === 'check-out' && method === 'POST') {
      const booking = findBooking(bookingPathMatch[1]);
      if (!booking) return json({ message: 'Booking not found' }, 404);
      if (folioBalanceCents !== 0)
        return json({ message: 'Saldo pendiente en folio abierto' }, 409);
      booking.status = 'checked_out';
      booking.updatedAt = now;
      const room = findRoom(booking.roomId);
      if (room) {
        room.status = 'available';
        room.housekeepingStatus = 'dirty';
      }
      return json(booking);
    }
    // Mismas reglas que BookingServiceImpl.confirm/cancel: 400 fuera de estado.
    if (bookingPathMatch?.[2] === 'confirm' && method === 'POST') {
      const booking = findBooking(bookingPathMatch[1]);
      if (!booking) return json({ message: 'Booking not found' }, 404);
      if (booking.status !== 'pending')
        return json({ message: 'Only pending bookings can be confirmed' }, 400);
      booking.status = 'confirmed';
      booking.updatedAt = now;
      return json(booking);
    }
    if (bookingPathMatch?.[2] === 'cancel' && method === 'POST') {
      const booking = findBooking(bookingPathMatch[1]);
      if (!booking) return json({ message: 'Booking not found' }, 404);
      if (!body?.reason?.trim()) return json({ message: 'Cancellation reason is required' }, 400);
      if (!['pending', 'confirmed'].includes(booking.status))
        return json({ message: 'Only pending or confirmed bookings can be cancelled' }, 400);
      Object.assign(booking, {
        status: 'cancelled',
        cancellationReason: body.reason.trim(),
        cancelledAt: now,
        updatedAt: now,
      });
      return json(booking);
    }
    if (bookingPathMatch?.[2] === 'folio' && method === 'GET') {
      const booking = findBooking(bookingPathMatch[1]);
      return booking ? json(folio(booking)) : json({ message: 'Booking not found' }, 404);
    }
    if (method === 'GET' && path.startsWith('/bookings/')) {
      const id = path.split('/').at(-1);
      const booking = bookings.find((item) => item.id === id);
      return booking ? json(booking) : json({ message: 'Not found' }, 404);
    }
    if (method === 'POST' && path === '/bookings') {
      const booking = {
        id: '1f24bc67-4a9d-4c1d-9210-d661f60e2222',
        confirmationCode: 'PMS-INT-0302',
        guestLinkCode: 'LNK-INT-0302',
        guestId: body.guestId,
        roomTypeId: body.roomTypeId,
        rateId: body.rateId,
        checkIn: body.checkIn,
        checkOut: body.checkOut,
        status: 'pending',
        adults: body.adults,
        children: body.children,
        totalAmountCents: 130000,
        currency: 'GTQ',
        notes: body.notes,
        createdAt: now,
        updatedAt: now,
      };
      bookings.push(booking);
      return json(booking, 201);
    }
    if (method === 'PUT' && path.startsWith('/bookings/')) {
      const id = path.split('/').at(-1);
      const booking = bookings.find((item) => item.id === id);
      if (!booking) return json({ message: 'Not found' }, 404);
      Object.assign(booking, body, { updatedAt: now });
      return json(booking);
    }

    return json({ message: `Ruta INT-03 no mockeada en test: ${method} ${path}` }, 404);
  };

  return {
    calls,
    guests,
    bookings,
    companions,
    settleFolio: () => {
      folioBalanceCents = 0;
    },
    restore: () => (globalThis.fetch = previousFetch),
  };
}

function installCashFetchMock() {
  let session = {
    id: '7a4db6cf-d72a-4fc7-b7ec-0d07fbef5104',
    openedByUserId: '6f1f5a3c-51f1-4c1e-9f66-d89d62eced0c',
    openedAt: '2026-10-02T08:00:00Z',
    openingBalanceCents: 100000,
    currency: 'GTQ',
    status: 'open',
    totalIncomeCents: 0,
    totalExpenseCents: 0,
    expectedBalanceCents: 100000,
    closedByUserId: null,
    closedAt: null,
    countedBalanceCents: null,
    differenceCents: null,
    notes: 'Caja de prueba',
    createdAt: '2026-10-02T08:00:00Z',
    updatedAt: '2026-10-02T08:00:00Z',
  };
  const movements = [];

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = init.method ?? 'GET';
    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });

    if (method === 'GET' && path === '/cash-sessions/current') return json(session);

    if (method === 'POST' && path === '/cash-sessions/open') {
      const request = JSON.parse(String(init.body ?? '{}'));
      session = {
        ...session,
        id: 'e1c5846d-bdc9-4f0a-8dcf-ef9dd5670720',
        openingBalanceCents: request.openingBalanceCents,
        totalIncomeCents: 0,
        totalExpenseCents: 0,
        expectedBalanceCents: request.openingBalanceCents,
        status: 'open',
        notes: request.notes,
      };
      movements.length = 0;
      return json(session, 201);
    }

    if (method === 'POST' && path === `/cash-sessions/${session.id}/close`) {
      const request = JSON.parse(String(init.body ?? '{}'));
      session = {
        ...session,
        status: 'closed',
        closedAt: '2026-10-02T16:00:00Z',
        countedBalanceCents: request.countedBalanceCents,
        differenceCents: request.countedBalanceCents - session.expectedBalanceCents,
        notes: request.notes ?? session.notes,
      };
      return json(session);
    }

    if (method === 'GET' && path === `/cash-sessions/${session.id}/movements`) {
      return json(movements);
    }

    if (method === 'POST' && path === `/cash-sessions/${session.id}/movements`) {
      const request = JSON.parse(String(init.body ?? '{}'));
      const movement = {
        id: `4e6e9400-879b-4b7e-8e8c-${String(movements.length + 1).padStart(12, '0')}`,
        cashSessionId: session.id,
        type: request.type,
        concept: request.concept,
        amountCents: request.amountCents,
        currency: 'GTQ',
        responsibleUserId: null,
        occurredAt: '2026-10-02T09:00:00Z',
        paymentId: null,
        createdAt: '2026-10-02T09:00:00Z',
      };
      movements.unshift(movement);
      session = {
        ...session,
        totalIncomeCents:
          session.totalIncomeCents + (movement.type === 'income' ? movement.amountCents : 0),
        totalExpenseCents:
          session.totalExpenseCents + (movement.type === 'expense' ? movement.amountCents : 0),
        expectedBalanceCents:
          session.expectedBalanceCents +
          (movement.type === 'income' ? movement.amountCents : -movement.amountCents),
      };
      return json(movement, 201);
    }

    return json({ message: `Ruta no mockeada en test: ${method} ${path}` }, 404);
  };
}

test('bookingService.getBookings: async, con latencia simulada, devuelve Models (no DTOs)', async () => {
  const bookings = await assertServiceCall('bookingService.getBookings', () =>
    bookingService.getBookings(),
  );
  assert.ok(Array.isArray(bookings) && bookings.length > 0);
  const [booking] = bookings;
  assert.ok('roomTypeId' in booking, 'el Model de Booking debe tener roomTypeId (camelCase)');
  assert.ok(!('room_type_id' in booking), 'un Model no debe traer campos snake_case del DTO');
  assert.ok(booking.checkIn instanceof Date, 'checkIn debe ser un Date de dominio, no un string');
});

test('roomService.getRooms: async, con latencia simulada, devuelve Models (no DTOs)', async () => {
  const rooms = await assertServiceCall('roomService.getRooms', () => roomService.getRooms());
  assert.ok(Array.isArray(rooms) && rooms.length > 0);
  const [room] = rooms;
  assert.ok('roomNumber' in room, 'el Model de Room debe tener roomNumber (camelCase)');
  assert.ok(!('room_number' in room), 'un Model no debe traer campos snake_case del DTO');
});

test('guestService.getGuests: async, con latencia simulada, devuelve Models (no DTOs)', async () => {
  const guests = await assertServiceCall('guestService.getGuests', () => guestService.getGuests());
  assert.ok(Array.isArray(guests) && guests.length > 0);
  const [guest] = guests;
  assert.ok('firstName' in guest, 'el Model de Guest debe tener firstName (camelCase)');
  assert.ok(!('first_name' in guest), 'un Model no debe traer campos snake_case del DTO');
});

test('paymentService.getPaymentsByBookingId: async, con latencia simulada, devuelve Models', async () => {
  const { bookingId } = installFinancialFetchMock();
  const payments = await assertServiceCall('paymentService.getPaymentsByBookingId', () =>
    paymentService.getPaymentsByBookingId(bookingId),
  );
  assert.ok(Array.isArray(payments));
  await paymentService.addCharge({
    booking_id: bookingId,
    amount_cents: 1500,
    currency: 'GTQ',
    method: 'cash',
  });
  const nextPayments = await paymentService.getPaymentsByBookingId(bookingId);
  assert.ok(nextPayments.length > 0);
  assert.ok('amountCents' in nextPayments[0], 'el Model de Payment debe tener amountCents');
  assert.ok(
    !('amount_cents' in nextPayments[0]),
    'un Model no debe traer campos snake_case del DTO',
  );
});

test('catalogService.getProducts/getAmenities: async, con latencia simulada, devuelven Models', async () => {
  globalThis.fetch = adminFetchMock;
  const products = await assertServiceCall('catalogService.getProducts', () =>
    catalogService.getProducts(),
  );
  assert.ok(Array.isArray(products) && products.length > 0);
  assert.ok('priceCents' in products[0], 'el Model de Product debe tener priceCents');
  assert.ok(!('price_cents' in products[0]), 'un Model no debe traer campos snake_case del DTO');
  assert.ok(
    products.every((product) => product.active),
    'el catalogo operativo solo lista activos',
  );

  const adminProducts = await assertServiceCall('catalogService.getAdminProducts', () =>
    catalogService.getAdminProducts(),
  );
  assert.ok(
    adminProducts.some((product) => !product.active),
    'el catalogo administrativo incluye productos inactivos',
  );
  const product = await catalogService.createAdminProduct({
    sku: 'RS-TEA',
    name: 'Te frio',
    description: 'Bebida fria',
    category: 'food_and_beverage',
    priceCents: 1200,
    currency: 'GTQ',
    active: true,
  });
  assert.equal(product.sku, 'RS-TEA');
  const disabledProduct = await catalogService.updateAdminProduct(product.id, { active: false });
  assert.equal(disabledProduct.active, false);

  const amenities = await assertServiceCall('catalogService.getAmenities', () =>
    catalogService.getAmenities(),
  );
  assert.ok(Array.isArray(amenities) && amenities.length > 0);

  const adminAmenities = await assertServiceCall('catalogService.getAdminAmenities', () =>
    catalogService.getAdminAmenities(),
  );
  assert.ok(
    adminAmenities.some((amenity) => !amenity.active),
    'administracion debe listar amenidades inactivas',
  );
  const amenity = await catalogService.createAmenity({
    name: 'Sauna',
    description: 'Sauna seco',
    category: 'service',
    location: 'Spa',
    opensAt: '09:00',
    closesAt: '17:00',
    active: true,
  });
  assert.equal(amenity.name, 'Sauna');
  const disabledAmenity = await catalogService.updateAmenity(amenity.id, { active: false });
  assert.equal(disabledAmenity.active, false);
});

test('catalogService amenidades (#147): HH:mm, guardar conserva datos y null quita el horario', async () => {
  const stored = {
    id: 'amn-147',
    name: 'Spa',
    description: 'Spa con sauna',
    category: 'service',
    location: 'Nivel 1',
    opensAt: '09:00:00',
    closesAt: '18:00:00',
    active: true,
    images: [],
  };
  const puts = [];
  globalThis.fetch = async (input, init = {}) => {
    const path = new URL(String(input)).pathname.replace('/api/v1', '');
    if ((init.method ?? 'GET') === 'GET' && path === '/admin/amenities')
      return jsonResponse([stored]);
    if (init.method === 'PUT' && path === `/admin/amenities/${stored.id}`) {
      const body = JSON.parse(String(init.body));
      puts.push(body);
      return jsonResponse({
        ...stored,
        ...body,
        opensAt: body.opensAt ?? null,
        closesAt: body.closesAt ?? null,
      });
    }
    return jsonResponse({ message: `Unhandled ${init.method} ${path}` }, 404);
  };

  const [amenity] = await catalogService.getAdminAmenities();
  assert.equal(amenity.opensAt, '09:00', 'el Model sigue el contrato "HH:mm"');
  assert.equal(amenity.closesAt, '18:00');

  await catalogService.updateAmenity(stored.id, { active: false });
  assert.deepEqual(
    {
      description: puts[0].description,
      category: puts[0].category,
      location: puts[0].location,
      opensAt: puts[0].opensAt,
      closesAt: puts[0].closesAt,
    },
    {
      description: 'Spa con sauna',
      category: 'service',
      location: 'Nivel 1',
      opensAt: '09:00',
      closesAt: '18:00',
    },
    'cambiar solo el estado conserva descripción, categoría, ubicación y horario',
  );

  const cleared = await catalogService.updateAmenity(stored.id, { opensAt: null, closesAt: null });
  assert.ok(!('opensAt' in puts[1]) && !('closesAt' in puts[1]), 'null quita el horario');
  assert.equal(cleared.opensAt, undefined);
  globalThis.fetch = adminFetchMock;
});

test('catalogService productos (#148): editar conserva categoría y envía la descripción real', async () => {
  const stored = {
    id: 'prd-148',
    sku: 'RS-AGUA',
    name: 'Agua mineral',
    description: 'Agua de manantial 500 ml',
    category: 'minibar',
    priceCents: 1200,
    currency: 'GTQ',
    active: true,
    images: [],
  };
  const puts = [];
  globalThis.fetch = async (input, init = {}) => {
    const path = new URL(String(input)).pathname.replace('/api/v1', '');
    if ((init.method ?? 'GET') === 'GET' && path === '/admin/room-service/products') {
      return jsonResponse([stored]);
    }
    if (init.method === 'PUT' && path === `/admin/room-service/products/${stored.id}`) {
      const body = JSON.parse(String(init.body));
      puts.push(body);
      return jsonResponse({ ...stored, ...body });
    }
    return jsonResponse({ message: `Unhandled ${init.method} ${path}` }, 404);
  };

  await catalogService.updateAdminProduct(stored.id, { active: false });
  assert.equal(
    puts[0].description,
    'Agua de manantial 500 ml',
    'cambiar el estado conserva la descripción',
  );
  assert.equal(puts[0].category, 'minibar', 'y la categoría guardada');

  const edited = await catalogService.updateAdminProduct(stored.id, {
    name: 'Agua mineral',
    description: 'Agua con gas 355 ml',
    priceCents: 1500,
  });
  assert.equal(puts[1].description, 'Agua con gas 355 ml');
  assert.equal(puts[1].category, 'minibar', 'sin categoría en el formulario no se fuerza otra');
  assert.equal(edited.description, 'Agua con gas 355 ml');
  globalThis.fetch = adminFetchMock;
});

test('guestAccountService.getAccounts: async, con latencia simulada, devuelve Models', async () => {
  installFinancialFetchMock();
  const accounts = await assertServiceCall('guestAccountService.getAccounts', () =>
    guestAccountService.getAccounts(),
  );
  assert.ok(Array.isArray(accounts) && accounts.length > 0);
  assert.ok('balanceCents' in accounts[0], 'el Model de GuestAccount debe tener balanceCents');
  assert.ok(!('balance_cents' in accounts[0]), 'un Model no debe traer campos snake_case del DTO');
});

test('guestAccountService: usa backend para folio financiero integrado', async () => {
  const { bookingId, chargeId, depositId } = installFinancialFetchMock();
  const account = await guestAccountService.getAccountByBookingId(bookingId);
  assert.ok(account);
  assert.equal(account.bookingId, bookingId);
  assert.equal(account.balanceCents, 50000);

  const charge = await guestAccountService.createCharge({
    booking_id: bookingId,
    description: 'Consumo minibar',
    quantity: 2,
    unit_price_cents: 1500,
    currency: 'GTQ',
    category: 'consumption',
  });
  assert.equal(charge.amountCents, 3000);
  assert.equal(charge.status, 'posted');
  assert.ok(!('amount_cents' in charge), 'createCharge integrado debe devolver Model');

  const voided = await guestAccountService.voidCharge(chargeId, 'Correccion de cargo', bookingId);
  assert.equal(voided.status, 'voided');
  assert.equal(voided.voidReason, 'Correccion de cargo');

  assert.throws(
    () => guestAccountService.calculateBalanceCents(bookingId),
    /saldo oficial/,
    'el saldo oficial de una reserva UUID no debe calcularse localmente',
  );
  await assert.rejects(
    () => guestAccountService.voidCharge(chargeId, 'Sin booking'),
    /requiere bookingId/,
    'un cargo UUID sin bookingId no debe caer al mock legacy',
  );

  const payment = await guestAccountService.createPayment({
    booking_id: bookingId,
    amount_cents: 20000,
    currency: 'GTQ',
    method: 'cash',
    transaction_reference: 'REC-001',
  });
  assert.equal(payment.amountCents, 20000);
  assert.equal(payment.status, 'completed');

  const deposit = await guestAccountService.createDeposit({
    bookingId,
    amountCents: 10000,
    method: 'cash',
    notes: 'Garantia',
  });
  assert.equal(deposit.status, 'held');

  const applied = await guestAccountService.applyDeposit(bookingId, depositId);
  assert.equal(applied.status, 'applied');

  const refunded = await guestAccountService.refundDeposit(bookingId, depositId, 'Devolucion');
  assert.equal(refunded.status, 'refunded');
});

test('cashService.getSessions: usa backend y devuelve Models', async () => {
  installCashFetchMock();
  const sessions = await cashService.getSessions();
  assert.ok(Array.isArray(sessions) && sessions.length > 0);
  assert.ok(
    'openingBalanceCents' in sessions[0],
    'el Model de CashSession debe tener openingBalanceCents',
  );
  assert.ok(!('openingBalanceCents' in sessions[0] && 'opening_balance_cents' in sessions[0]));
  assert.equal(sessions[0].expectedBalanceCents, 100000);
});

test('personnelService.getUsers/getRoles/getPermissions: async, con latencia simulada, devuelven Models', async () => {
  globalThis.fetch = adminFetchMock;
  const users = await assertServiceCall('personnelService.getUsers', () =>
    personnelService.getUsers(),
  );
  assert.ok(Array.isArray(users) && users.length > 0);
  assert.ok('firstName' in users[0], 'el Model de User debe tener firstName (camelCase)');

  const roles = await assertServiceCall('personnelService.getRoles', () =>
    personnelService.getRoles(),
  );
  assert.ok(Array.isArray(roles) && roles.length > 0);

  const permissions = await assertServiceCall('personnelService.getPermissions', () =>
    personnelService.getPermissions(),
  );
  assert.ok(Array.isArray(permissions) && permissions.length > 0);

  const created = await personnelService.createUser({
    firstName: 'Ana',
    lastName: 'Lopez',
    email: 'ana@example.com',
    password: 'Temporal123!',
    roleId: apiRoles[0].id,
  });
  assert.equal(created.email, 'ana@example.com');
  const disabled = await personnelService.updateUser(created.id, {
    roleId: apiRoles[0].id,
    status: 'inactive',
  });
  assert.equal(disabled.status, 'inactive');
});

test('inventoryService.getItems: async, con latencia simulada, devuelve Models', async () => {
  const items = await assertServiceCall('inventoryService.getItems', () =>
    inventoryService.getItems(),
  );
  assert.ok(Array.isArray(items) && items.length > 0);
  assert.ok(
    'currentQuantity' in items[0],
    'el Model de InventoryItem debe tener currentQuantity (camelCase)',
  );
});

test('auditService.getLogs: async, con latencia simulada, devuelve Models', async () => {
  const logs = await assertServiceCall('auditService.getLogs', () => auditService.getLogs());
  assert.ok(Array.isArray(logs) && logs.length > 0);
  assert.ok('occurredAt' in logs[0], 'el Model de AuditLog debe tener occurredAt (camelCase)');
  const futureLog = logs.find((log) => log.entityId === 'RATE-001');
  assert.equal(futureLog?.module, 'rates', 'modulos nuevos de auditoria deben preservarse');
  assert.equal(futureLog?.action, 'approve', 'acciones nuevas de auditoria deben preservarse');
  assert.equal(lastReportingRequest.path, '/admin/audit-logs');
  assert.ok(lastReportingRequest.search.has('from'), 'audit logs debe enviar from real');
  assert.ok(lastReportingRequest.search.has('to'), 'audit logs debe enviar to real');
});

test('reportingService: usa ReportingController para reporte operativo y recibo', async () => {
  const report = await assertServiceCall('reportingService.getOperationalReport', () =>
    reportingService.getOperationalReport({ from: '2026-10-01', to: '2026-10-02' }),
  );
  assert.equal(lastReportingRequest.path, '/admin/reports/operations');
  assert.equal(lastReportingRequest.search.get('from'), '2026-10-01');
  assert.equal(lastReportingRequest.search.get('to'), '2026-10-02');
  assert.equal(report.revenueCents, 250000);
  assert.equal(report.cancellations, 1);

  const receipt = await assertServiceCall('reportingService.getStayReceipt', () =>
    reportingService.getStayReceipt(reportingBookingId),
  );
  assert.equal(lastReportingRequest.path, `/admin/bookings/${reportingBookingId}/receipt`);
  assert.equal(receipt.finalBalanceCents, 0);
  assert.equal(receipt.charges[0].amountCents, 250000);
  assert.ok(!('amount_cents' in receipt.charges[0]), 'Charge de recibo debe ser Model');
  assert.equal(receipt.payments[0].amountCents, 250000);
});

// --- C. Mecanismo de error forzado ------------------------------------------

test('mockUtils.setForceError: hace que los servicios rechacen, y se puede desactivar', async () => {
  mockUtils.setForceError(true);
  await assert.rejects(() => bookingService.getBookings());
  await assert.rejects(() => roomService.getRooms());
  mockUtils.setForceError(false);
  await assert.doesNotReject(() => bookingService.getBookings());
});

// --- D. WEB-14: servicios faltantes para la vertical Ronda 1 ---------------

test('roomService.createRoom/updateRoom/getRoomTypes: usan API real y devuelven Models', async () => {
  const roomTypes = await assertServiceCall('roomService.getRoomTypes', () =>
    roomService.getRoomTypes(),
  );
  assert.ok(Array.isArray(roomTypes) && roomTypes.length > 0);
  assert.ok('bedConfiguration' in roomTypes[0], 'RoomType debe ser Model camelCase');
  assert.ok(!('bed_configuration' in roomTypes[0]), 'RoomType no debe traer campos DTO');

  const room = await assertServiceCall('roomService.createRoom', () =>
    roomService.createRoom({
      room_number: '909',
      room_type_id: roomTypes[0].id,
      floor: 9,
      notes: 'Habitación creada por prueba WEB-14.',
    }),
  );
  assert.equal(room.roomNumber, '909');
  assert.equal(room.status, 'available');
  assert.equal(room.housekeepingStatus, 'dirty');
  assert.ok(!('room_number' in room), 'createRoom debe devolver Model, no DTO');

  const updated = await assertServiceCall('roomService.updateRoom', () =>
    roomService.updateRoom(room.id, {
      status: 'maintenance',
      notes: 'Mantenimiento preventivo.',
    }),
  );
  assert.equal(updated.status, 'maintenance');
  assert.equal(updated.notes, 'Mantenimiento preventivo.');

  const reloaded = await assertServiceCall('roomService.getRoomById', () =>
    roomService.getRoomById(room.id),
  );
  assert.equal(reloaded.roomNumber, '909');

  assert.equal(
    await roomService.getRoomById('RM-NO-EXISTE'),
    undefined,
    'un 404 real de /rooms/{id} no debe caer al mock local',
  );
  assert.equal(
    await roomService.getRoomTypeById('RT-01'),
    undefined,
    'un 404 real de /room-types/{id} no debe resolver desde roomTypesDB',
  );
});

test('INT-03: guestService y bookingService integran huespedes y reservas con backend', async (t) => {
  const { calls, restore } = installGuestBookingFetchMock();
  t.after(restore);

  const guests = await assertServiceCall('guestService.getGuests integrado', () =>
    guestService.getGuests(),
  );
  assert.equal(guests[0].firstName, 'Elena');
  assert.ok(!('first_name' in guests[0]), 'guestService debe devolver Model, no DTO');

  const createdGuest = await assertServiceCall('guestService.createGuest integrado', () =>
    guestService.createGuest({
      first_name: 'Mateo',
      last_name: 'Rivas',
      email: ' mateo@example.com ',
      phone: '+502 5555-2020',
      nationality: 'Guatemalteca',
      document_type: 'passport',
      document_number: ' GT0999999 ',
    }),
  );
  assert.equal(createdGuest.email, 'mateo@example.com');
  assert.equal(calls.at(-1).body.firstName, 'Mateo');
  assert.equal(calls.at(-1).body.documentNumber, 'GT0999999');
  assert.ok(!('first_name' in calls.at(-1).body), 'el backend recibe camelCase');

  const updatedGuest = await assertServiceCall('guestService.updateGuest integrado', () =>
    guestService.updateGuest(createdGuest.id, { phone: '+502 5555-3030' }),
  );
  assert.equal(updatedGuest.phone, '+502 5555-3030');

  const bookings = await assertServiceCall('bookingService.getBookings integrado', () =>
    bookingService.getBookings(),
  );
  assert.equal(bookings[0].guestId, guests[0].id);
  assert.equal(bookings[0].roomTypeId, apiRoomTypes[0].id);
  assert.ok(!('room_type_id' in bookings[0]), 'bookingService debe devolver Model, no DTO');

  const createdBooking = await assertServiceCall('bookingService.createBooking integrado', () =>
    bookingService.createBooking({
      guest_id: createdGuest.id,
      room_type_id: apiRoomTypes[0].id,
      rate_id: apiRates[0].id,
      check_in: '2026-12-15',
      check_out: '2026-12-17',
      adults: 2,
      children: 0,
      notes: '  Llegada tarde.  ',
    }),
  );
  assert.equal(createdBooking.status, 'pending');
  assert.equal(createdBooking.guestId, createdGuest.id);
  assert.equal(calls.at(-1).body.guestId, createdGuest.id);
  assert.equal(calls.at(-1).body.roomTypeId, apiRoomTypes[0].id);
  assert.equal(calls.at(-1).body.notes, 'Llegada tarde.');
  assert.ok(!('guest_id' in calls.at(-1).body), 'la reserva viaja en camelCase');

  const updatedBooking = await assertServiceCall('bookingService.updateBooking integrado', () =>
    bookingService.updateBooking(createdBooking.id, { adults: 1, children: 1 }),
  );
  assert.equal(updatedBooking.adults, 1);
  assert.equal(updatedBooking.children, 1);
});

test('INT-04: recepcion usa backend para acompanantes, asignacion, check-in y checkout', async (t) => {
  const { calls, bookings, settleFolio, restore } = installGuestBookingFetchMock();
  t.after(restore);

  const bookingId = bookings[0].id;
  const roomId = apiRooms[0].id;

  const assigned = await assertServiceCall('bookingService.assignRoom integrado', () =>
    bookingService.assignRoom(bookingId, roomId),
  );
  assert.equal(assigned.roomId, roomId);
  assert.equal(calls.at(-1).call, `PUT /bookings/${bookingId}`);
  assert.deepEqual(calls.at(-1).body, { roomId });

  const savedCompanions = await assertServiceCall(
    'bookingCompanionService.saveCompanionsForBooking integrado',
    () =>
      bookingCompanionService.saveCompanionsForBooking(bookingId, [
        {
          first_name: 'Marcos',
          last_name: 'Rodas',
          document_type: 'national_id',
          document_number: '1234 56789 0101',
          guest_type: 'adult',
        },
      ]),
  );
  assert.equal(savedCompanions[0].bookingId, bookingId);
  assert.deepEqual(
    calls.slice(-3).map(({ call }) => call),
    [
      `GET /bookings/${bookingId}/companions`,
      `POST /bookings/${bookingId}/companions`,
      `GET /bookings/${bookingId}/companions`,
    ],
  );
  assert.deepEqual(calls.at(-2).body, {
    firstName: 'Marcos',
    lastName: 'Rodas',
    documentType: 'national_id',
    documentNumber: '1234 56789 0101',
    guestType: 'adult',
  });

  const updatedCompanions = await assertServiceCall(
    'bookingCompanionService.saveCompanionsForBooking actualiza integrado',
    () =>
      bookingCompanionService.saveCompanionsForBooking(bookingId, [
        {
          id: savedCompanions[0].id,
          first_name: 'Marco',
          last_name: 'Rodas',
          document_type: 'national_id',
          document_number: '1234 56789 0101',
          guest_type: 'adult',
        },
      ]),
  );
  assert.equal(updatedCompanions[0].firstName, 'Marco');
  assert.deepEqual(
    calls.slice(-3).map(({ call }) => call),
    [
      `GET /bookings/${bookingId}/companions`,
      `PUT /bookings/${bookingId}/companions/${savedCompanions[0].id}`,
      `GET /bookings/${bookingId}/companions`,
    ],
  );
  assert.deepEqual(calls.at(-2).body, {
    firstName: 'Marco',
    lastName: 'Rodas',
    documentType: 'national_id',
    documentNumber: '1234 56789 0101',
    guestType: 'adult',
  });

  const removedCompanions = await assertServiceCall(
    'bookingCompanionService.saveCompanionsForBooking elimina integrado',
    () => bookingCompanionService.saveCompanionsForBooking(bookingId, []),
  );
  assert.equal(removedCompanions.length, 0);
  assert.deepEqual(
    calls.slice(-3).map(({ call }) => call),
    [
      `GET /bookings/${bookingId}/companions`,
      `DELETE /bookings/${bookingId}/companions/${savedCompanions[0].id}`,
      `GET /bookings/${bookingId}/companions`,
    ],
  );

  const recreatedCompanions = await assertServiceCall(
    'bookingCompanionService.saveCompanionsForBooking recrea integrado',
    () =>
      bookingCompanionService.saveCompanionsForBooking(bookingId, [
        {
          first_name: 'Marcos',
          last_name: 'Rodas',
          document_type: 'national_id',
          document_number: '1234 56789 0101',
          guest_type: 'adult',
        },
      ]),
  );
  assert.equal(recreatedCompanions.length, 1);

  await assertServiceCall(
    'bookingCompanionService.saveCompanionsForBooking reemplaza integrado',
    () =>
      bookingCompanionService.saveCompanionsForBooking(bookingId, [
        {
          first_name: 'Sofia',
          last_name: 'Rodas',
          document_type: 'passport',
          document_number: 'P-123',
          guest_type: 'adult',
        },
      ]),
  );
  assert.deepEqual(
    calls.slice(-4).map(({ call }) => call),
    [
      `GET /bookings/${bookingId}/companions`,
      `DELETE /bookings/${bookingId}/companions/${recreatedCompanions[0].id}`,
      `POST /bookings/${bookingId}/companions`,
      `GET /bookings/${bookingId}/companions`,
    ],
  );

  const companions = await assertServiceCall(
    'bookingCompanionService.getCompanionsByBookingId integrado',
    () => bookingCompanionService.getCompanionsByBookingId(bookingId),
  );
  assert.equal(companions.length, 1);
  assert.equal(calls.at(-1).call, `GET /bookings/${bookingId}/companions`);

  const checkedIn = await assertServiceCall('bookingService.checkIn integrado', () =>
    bookingService.checkIn(bookingId),
  );
  assert.equal(checkedIn.status, 'checkedIn');
  assert.deepEqual(
    calls.slice(-2).map(({ call }) => call),
    [`POST /bookings/${bookingId}/check-in`, `GET /bookings/${bookingId}`],
  );
  assert.equal(apiRooms[0].status, 'occupied');

  await assert.rejects(
    () => bookingService.checkOut(bookingId),
    /Saldo pendiente en folio abierto/,
    'un 409 del backend por saldo pendiente debe presentarse sin checkout local',
  );
  assert.equal(calls.at(-1).call, `POST /bookings/${bookingId}/check-out`);
  assert.equal(bookings[0].status, 'checked_in');

  settleFolio();
  const checkedOut = await assertServiceCall('bookingService.checkOut integrado', () =>
    bookingService.checkOut(bookingId),
  );
  assert.equal(checkedOut.status, 'checkedOut');
  assert.equal(bookings[0].status, 'checked_out');
  assert.equal(apiRooms[0].status, 'available');
  assert.equal(apiRooms[0].housekeepingStatus, 'dirty');
});

test.skip('legacy mock: bookingService.checkIn/checkOut validaban transiciones locales', async () => {
  const checkedIn = await assertServiceCall('bookingService.checkIn', () =>
    bookingService.checkIn('BKG-009'),
  );
  assert.equal(checkedIn.status, 'checkedIn');

  const checkedOut = await assertServiceCall('bookingService.checkOut', () =>
    bookingService.checkOut('BKG-009'),
  );
  assert.equal(checkedOut.status, 'checkedOut');

  await assert.rejects(
    () => bookingService.checkIn('BKG-009'),
    /Transicion invalida de reserva/,
    'no debe permitir salir de checkedOut hacia checkedIn',
  );
});

test.skip('legacy mock: ciclo local de reserva nueva abria folio simulado', async () => {
  const booking = await assertServiceCall('bookingService.createBooking', () =>
    bookingService.createBooking({
      guest_id: 'GST-001',
      room_type_id: 'RT-01',
      check_in: '2026-11-01',
      check_out: '2026-11-03',
      adults: 1,
      children: 0,
    }),
  );
  assert.equal(booking.status, 'pending');

  const noAccountYet = await guestAccountService.getAccountByBookingId(booking.id);
  assert.equal(noAccountYet, undefined, 'una reserva pending todavía no debe tener cuenta');

  const confirmed = await assertServiceCall('bookingService.confirmBooking', () =>
    bookingService.confirmBooking(booking.id),
  );
  assert.equal(confirmed.status, 'confirmed');

  const checkedIn = await assertServiceCall('bookingService.checkIn', () =>
    bookingService.checkIn(booking.id),
  );
  assert.equal(checkedIn.status, 'checkedIn');

  const account = await guestAccountService.getAccountByBookingId(booking.id);
  assert.ok(account, 'el check-in debe crear la cuenta del huésped si no existía');
  assert.equal(account.status, 'open');
  assert.equal(
    account.balanceCents,
    booking.totalAmountCents,
    'la cuenta nueva nace con el cargo base de estancia',
  );

  await assert.rejects(
    () => bookingService.checkIn(booking.id),
    /Transicion invalida de reserva/,
    'un segundo check-in sobre una reserva ya checkedIn debe rechazar, no duplicar la cuenta',
  );

  const accountsForBooking = (await guestAccountService.getAccounts()).filter(
    (item) => item.bookingId === booking.id,
  );
  assert.equal(
    accountsForBooking.length,
    1,
    'no debe crear una segunda cuenta para la misma reserva',
  );
  const stayCharges = (await guestAccountService.getChargesByBookingId(booking.id)).filter(
    (charge) => charge.category === 'stay' && charge.status !== 'voided',
  );
  assert.equal(
    stayCharges.length,
    booking.totalAmountCents > 0 ? 1 : 0,
    'el cargo de estancia no debe duplicarse',
  );
});

test.skip('legacy mock: bookingService validaba capacidad local con roomTypesDB', async () => {
  await assert.rejects(
    () =>
      bookingService.createBooking({
        guest_id: 'GST-001',
        room_type_id: 'RT-01',
        check_in: '2026-12-01',
        check_out: '2026-12-03',
        adults: 2,
        children: 1,
      }),
    /permite maximo 2 huesped/,
    'RT-01 tiene capacidad 2 y no debe aceptar 3 huespedes',
  );

  const exactCapacity = await assertServiceCall('bookingService.createBooking exact capacity', () =>
    bookingService.createBooking({
      guest_id: 'GST-001',
      room_type_id: 'RT-01',
      check_in: '2026-12-04',
      check_out: '2026-12-06',
      adults: 1,
      children: 1,
    }),
  );
  assert.equal(exactCapacity.adults + exactCapacity.children, 2);

  await assert.rejects(
    () =>
      bookingService.updateBooking(exactCapacity.id, {
        room_type_id: 'RT-03',
        adults: 3,
        children: 1,
      }),
    /permite maximo 3 huesped/,
    'al editar debe revalidar la capacidad del nuevo tipo seleccionado',
  );

  const stillValid = await bookingService.getBookingById(exactCapacity.id);
  assert.equal(stillValid.adults, 1, 'una edicion invalida no debe mutar adultos');
  assert.equal(stillValid.children, 1, 'una edicion invalida no debe mutar menores');
  assert.equal(stillValid.roomTypeId, 'RT-01', 'una edicion invalida no debe mutar habitacion');
});

test.skip('legacy mock: check-in local persistia acompanantes y ocupacion', async () => {
  await assert.rejects(
    () =>
      bookingCompanionService.saveCompanionsForBooking('BKG-007', [
        {
          first_name: 'Acompanante',
          last_name: 'Incorrecto',
          document_type: 'national_id',
          document_number: '1111 22222 0101',
          guest_type: 'child',
        },
      ]),
    /composicion/,
    'BKG-007 espera un acompanante adulto, no un menor',
  );

  const companions = await assertServiceCall(
    'bookingCompanionService.saveCompanionsForBooking',
    () =>
      bookingCompanionService.saveCompanionsForBooking('BKG-007', [
        {
          first_name: 'Marcos',
          last_name: 'Rodas',
          document_type: 'national_id',
          document_number: '1234 56789 0101',
          guest_type: 'adult',
        },
      ]),
  );
  assert.equal(companions.length, 1);
  assert.equal(companions[0].bookingId, 'BKG-007');
  assert.equal(companions[0].guestType, 'adult');

  const updatedGuest = await assertServiceCall('guestService.updateGuest', () =>
    guestService.updateGuest('GST-007', {
      document_type: 'driver_license',
      document_number: 'LIC-777',
    }),
  );
  assert.equal(updatedGuest.documentType, 'driverLicense');
  assert.equal(updatedGuest.documentNumber, 'LIC-777');

  const checkedIn = await assertServiceCall('bookingService.checkIn BKG-007', () =>
    bookingService.checkIn('BKG-007'),
  );
  assert.equal(checkedIn.status, 'checkedIn');

  const room = apiRooms.find((item) => item.id === 'RM-203');
  assert.equal(room.status, 'occupied', 'el check-in debe marcar la habitacion como ocupada');

  const persisted = await bookingCompanionService.getCompanionsByBookingId('BKG-007');
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].documentNumber, '1234 56789 0101');
});

test.skip('legacy mock: assignRoom local validaba isRoomAssignable', async () => {
  const booking = await assertServiceCall('bookingService.assignRoom', () =>
    bookingService.assignRoom('BKG-008', 'RM-403'),
  );
  assert.equal(booking.roomId, 'RM-403');

  await assert.rejects(
    () => bookingService.assignRoom('BKG-010', 'RM-502'),
    /no esta disponible para asignacion/,
    'available + dirty no es asignable',
  );
});

const HK_ROOM_ID = '0b6f4c2e-1d7a-4c5e-9f3b-2a1d0e9c8b70';
const HK_BOOKING_ID = '5c2d8e1f-3b4a-4f6e-8d7c-1a2b3c4d5e6f';

function installHousekeepingFetchMock() {
  const previousFetch = globalThis.fetch;
  const calls = [];
  let room = {
    id: HK_ROOM_ID,
    roomNumber: '204',
    roomTypeId: 'a1b2c3d4-0000-4000-8000-000000000001',
    floor: 2,
    status: 'occupied',
    housekeepingStatus: 'dirty',
    notes: null,
    cleaningUserEmail: null,
    cleaningStartedAt: null,
    cleaningCompletedByUserEmail: null,
    cleaningCompletedAt: null,
    inspectorUserEmail: null,
    inspectedAt: null,
    updatedAt: '2026-10-03T08:00:00Z',
  };
  const stayovers = [
    {
      id: 'f1e2d3c4-0000-4000-8000-000000000001',
      bookingId: HK_BOOKING_ID,
      roomId: HK_ROOM_ID,
      roomNumber: '204',
      status: 'pending',
      description: 'Cambio de toallas',
      notes: null,
      responsibleUserEmail: null,
      startedByUserEmail: null,
      completedByUserEmail: null,
      requestedAt: '2026-10-03T09:00:00Z',
      startedAt: null,
      completedAt: null,
      createdAt: '2026-10-03T09:00:00Z',
      updatedAt: '2026-10-03T09:00:00Z',
    },
    {
      id: 'f1e2d3c4-0000-4000-8000-000000000002',
      bookingId: HK_BOOKING_ID,
      roomId: HK_ROOM_ID,
      roomNumber: '204',
      status: 'cancelled',
      description: 'Cancelada por el huesped',
      requestedAt: '2026-10-03T07:00:00Z',
      createdAt: '2026-10-03T07:00:00Z',
      updatedAt: '2026-10-03T07:30:00Z',
    },
  ];
  // Mismo flujo que HousekeepingServiceImpl: estado de origen exacto o 400.
  const turnover = {
    start: ['dirty', 'cleaning', 'cleaningStartedAt'],
    complete: ['cleaning', 'clean', 'cleaningCompletedAt'],
    inspect: ['clean', 'inspected', 'inspectedAt'],
  };
  const stayoverFlow = {
    start: ['pending', 'in_progress', 'startedAt'],
    complete: ['in_progress', 'completed', 'completedAt'],
  };
  const checklists = [
    {
      id: 'cccccccc-0000-4000-8000-000000000001',
      serviceRequestId: 'f1e2d3c4-0000-4000-8000-000000000001',
      roomId: HK_ROOM_ID,
      roomNumber: '204',
      status: 'in_progress',
      observations: 'Cambio de toallas',
      responsibleUserEmail: 'hk@aurora.test',
      completedByUserEmail: null,
      startedAt: '2026-10-03T09:15:00Z',
      completedAt: null,
      createdAt: '2026-10-03T09:30:00Z',
      updatedAt: '2026-10-03T09:30:00Z',
      items: [
        {
          id: 'item-1',
          label: 'Cama preparada',
          checked: false,
          position: 0,
          notes: null,
          checkedByUserEmail: null,
          checkedAt: null,
          createdAt: '2026-10-03T09:30:00Z',
          updatedAt: '2026-10-03T09:30:00Z',
        },
        {
          id: 'item-2',
          label: 'Baño revisado',
          checked: false,
          position: 1,
          notes: null,
          checkedByUserEmail: null,
          checkedAt: null,
          createdAt: '2026-10-03T09:30:00Z',
          updatedAt: '2026-10-03T09:30:00Z',
        },
      ],
    },
  ];

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = init.method ?? 'GET';
    calls.push(`${method} ${path}${url.search}`);
    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });

    if (method === 'GET' && path === '/housekeeping/rooms') return json([room]);

    if (method === 'GET' && path === '/housekeeping/checklists') return json(checklists);

    if (method === 'PUT' && path === `/housekeeping/checklists/${checklists[0].id}`) {
      const request = JSON.parse(String(init.body ?? '{}'));
      checklists[0] = {
        ...checklists[0],
        status: request.status ?? checklists[0].status,
        roomId: HK_ROOM_ID,
        observations: request.observations ?? checklists[0].observations,
        items: request.items.map((item, index) => ({
          id: item.id ?? `item-${index + 1}`,
          label: item.label,
          checked: item.checked,
          position: item.position ?? index,
          notes: item.notes ?? null,
          checkedByUserEmail: item.checked ? 'hk@aurora.test' : null,
          checkedAt: item.checked ? '2026-10-03T10:10:00Z' : null,
          createdAt: '2026-10-03T09:30:00Z',
          updatedAt: '2026-10-03T10:10:00Z',
        })),
        updatedAt: '2026-10-03T10:10:00Z',
      };
      return json(checklists[0]);
    }

    const roomAction = path.match(/^\/housekeeping\/rooms\/([^/]+)\/(start|complete|inspect)$/);
    if (method === 'POST' && roomAction && roomAction[1] === HK_ROOM_ID) {
      const [from, to, timestampField] = turnover[roomAction[2]];
      if (room.housekeepingStatus !== from) {
        return json({ status: 400, message: `Cannot ${roomAction[2]} room` }, 400);
      }
      room = {
        ...room,
        housekeepingStatus: to,
        [timestampField]: '2026-10-03T10:30:00Z',
        ...(to === 'cleaning'
          ? { cleaningStartedAt: '2026-10-03T10:00:00Z', cleaningUserEmail: 'hk@aurora.test' }
          : {}),
      };
      return json(room);
    }

    if (method === 'GET' && path === '/housekeeping/rooms/stayover-cleanings') {
      const status = url.searchParams.get('status');
      const bookingId = url.searchParams.get('bookingId');
      return json(
        stayovers.filter(
          (item) =>
            (!status || item.status === status) && (!bookingId || item.bookingId === bookingId),
        ),
      );
    }

    const stayoverAction = path.match(
      /^\/housekeeping\/rooms\/stayover-cleanings\/([^/]+)\/(start|complete)$/,
    );
    if (method === 'POST' && stayoverAction) {
      const index = stayovers.findIndex((item) => item.id === stayoverAction[1]);
      if (index < 0) return json({ status: 404, message: 'Stayover cleaning not found' }, 404);
      const [from, to, timestampField] = stayoverFlow[stayoverAction[2]];
      if (stayovers[index].status !== from) return json({ status: 400, message: 'Cannot' }, 400);
      stayovers[index] = {
        ...stayovers[index],
        status: to,
        [timestampField]: '2026-10-03T11:00:00Z',
      };
      return json(stayovers[index]);
    }

    if (method === 'POST' && path === `/housekeeping/rooms/${HK_ROOM_ID}/stayover-cleanings`) {
      const request = JSON.parse(String(init.body ?? '{}'));
      const created = {
        ...stayovers[0],
        id: 'f1e2d3c4-0000-4000-8000-000000000003',
        bookingId: request.bookingId,
        status: 'pending',
        description: request.description ?? 'Stayover cleaning',
      };
      stayovers.push(created);
      return json(created, 201);
    }

    return json({ message: `Ruta no mockeada en test: ${method} ${path}` }, 404);
  };
  // Otros tests (caja) siguen usando el mock de fetch que estaba instalado.
  return { calls, restore: () => (globalThis.fetch = previousFetch) };
}

test('housekeepingService: turnover contra backend, sin transiciones locales', async (t) => {
  const { calls, restore } = installHousekeepingFetchMock();
  t.after(restore);

  const [room] = await housekeepingService.getRooms();
  assert.equal(room.roomNumber, '204');
  assert.equal(room.housekeepingStatus, 'dirty');
  assert.equal(room.status, 'occupied');
  assert.ok(!('housekeeping_status' in room), 'un Model no debe traer campos snake_case del DTO');

  const initialChecklists = await housekeepingService.getChecklists();
  assert.equal(initialChecklists[0].roomId, HK_ROOM_ID);
  assert.equal(initialChecklists[0].items[0].done, false);

  const savedChecklist = await housekeepingService.saveChecklist(initialChecklists[0].id, {
    status: 'completed',
    items: [
      { id: 'item-1', label: 'Cama preparada', done: true },
      { id: 'item-2', label: 'Baño revisado', done: false },
    ],
  });
  assert.equal(savedChecklist.items[0].done, true);
  assert.equal(savedChecklist.status, 'completed');
  assert.deepEqual(calls.slice(-2), [
    'GET /housekeeping/checklists',
    `PUT /housekeeping/checklists/${initialChecklists[0].id}`,
  ]);

  const cleaning = await housekeepingService.startCleaning(HK_ROOM_ID);
  assert.equal(cleaning.housekeepingStatus, 'cleaning');
  assert.equal(cleaning.status, 'occupied', 'el turnover no toca el estado operativo');
  assert.ok(cleaning.cleaningStartedAt instanceof Date);
  assert.equal(cleaning.cleaningUserEmail, 'hk@aurora.test');
  assert.equal((await housekeepingService.getChecklists())[0].items[0].done, true);

  await assert.rejects(
    () => housekeepingService.inspectRoom(HK_ROOM_ID),
    /rechazó la transición/,
    'el backend decide: cleaning -> inspected se rechaza',
  );

  const clean = await housekeepingService.completeCleaning(HK_ROOM_ID);
  assert.equal(clean.housekeepingStatus, 'clean');
  assert.ok(clean.cleaningCompletedAt instanceof Date);

  const inspected = await housekeepingService.inspectRoom(HK_ROOM_ID);
  assert.equal(inspected.housekeepingStatus, 'inspected');
  assert.ok(inspected.inspectedAt instanceof Date);

  assert.deepEqual(
    calls.filter((call) => call.startsWith('POST')),
    [
      `POST /housekeeping/rooms/${HK_ROOM_ID}/start`,
      `POST /housekeeping/rooms/${HK_ROOM_ID}/inspect`,
      `POST /housekeeping/rooms/${HK_ROOM_ID}/complete`,
      `POST /housekeeping/rooms/${HK_ROOM_ID}/inspect`,
    ],
    'cada transicion pasa por su endpoint de HousekeepingController',
  );
});

test('housekeepingService: stayover como flujo separado del turnover', async (t) => {
  const { calls, restore } = installHousekeepingFetchMock();
  t.after(restore);

  const all = await housekeepingService.getStayoverCleanings();
  assert.equal(all.length, 2);
  assert.equal(all[0].type, 'housekeeping');
  assert.equal(all[1].status, 'rejected', 'cancelled del backend se representa como rejected');

  const pending = await housekeepingService.getStayoverCleanings({ status: 'pending' });
  assert.equal(pending.length, 1);
  assert.ok(calls.includes('GET /housekeeping/rooms/stayover-cleanings?status=pending'));

  const started = await housekeepingService.startStayoverCleaning(pending[0].id);
  assert.equal(started.status, 'inProgress');
  assert.ok(started.startedAt instanceof Date);
  const completed = await housekeepingService.completeStayoverCleaning(pending[0].id);
  assert.equal(completed.status, 'completed');
  assert.ok(completed.completedAt instanceof Date);

  await housekeepingService.getStayoverCleanings({ status: 'inProgress' });
  assert.ok(calls.includes('GET /housekeeping/rooms/stayover-cleanings?status=in_progress'));

  const created = await housekeepingService.createStayoverCleaning(HK_ROOM_ID, {
    bookingId: HK_BOOKING_ID,
    description: '  Repaso de baño  ',
  });
  assert.equal(created.status, 'pending');
  assert.equal(created.description, 'Repaso de baño');

  const [room] = await housekeepingService.getRooms();
  assert.equal(room.housekeepingStatus, 'dirty', 'stayover no cambia housekeepingStatus');
  assert.equal(room.status, 'occupied', 'stayover no libera la habitacion');
});

test('housekeeping: sincroniza estado de habitacion, solicitudes y desperfectos', async () => {
  const roomId = apiRooms[0].id;
  const room = await assertServiceCall('roomService.updateRoom housekeeping cleaning', () =>
    roomService.updateRoom(roomId, { housekeeping_status: 'cleaning' }),
  );
  assert.equal(room.housekeepingStatus, 'cleaning');
  assert.equal(
    (await roomService.getRoomById(roomId)).housekeepingStatus,
    'cleaning',
    'el estado de limpieza debe volver desde la API de habitaciones',
  );

  const pending = await assertServiceCall('serviceRequestService.createRequest', () =>
    serviceRequestService.createRequest({
      bookingId: reportingBookingId,
      roomId,
      type: 'other',
      description: 'Toallas adicionales',
    }),
  );
  assert.equal(pending.status, 'pending');
  assert.equal(pending.type, 'other');

  const defect = await assertServiceCall('serviceRequestService.createMaintenanceReport', () =>
    serviceRequestService.createMaintenanceReport({
      roomId,
      description: 'Lampara sin funcionar',
      notes: 'Alta',
    }),
  );
  assert.equal(defect.type, 'maintenance');
  assert.equal(defect.status, 'pending');
  assert.equal(defect.bookingId, '');
  assert.ok(apiServiceRequests.some((request) => request.description === 'Lampara sin funcionar'));

  const requests = await serviceRequestService.getRequests();
  assert.ok(requests.some((request) => request.description === 'Lampara sin funcionar'));
});

test.skip('legacy mock: guestAccountService.createCharge actualizaba balance local', async () => {
  const before = await assertServiceCall('guestAccountService.getAccountByBookingId', () =>
    guestAccountService.getAccountByBookingId('BKG-002'),
  );
  assert.ok(before);

  const charge = await assertServiceCall('guestAccountService.createCharge', () =>
    guestAccountService.createCharge({
      booking_id: 'BKG-002',
      description: 'Cargo de prueba WEB-14',
      quantity: 2,
      unit_price_cents: 1250,
      currency: 'GTQ',
      created_by_user_id: 'USR-001',
    }),
  );
  assert.equal(charge.amountCents, 2500);
  assert.equal(charge.status, 'posted');
  assert.ok(!('amount_cents' in charge), 'createCharge debe devolver Model, no DTO');

  const after = await assertServiceCall('guestAccountService.getAccountByBookingId', () =>
    guestAccountService.getAccountByBookingId('BKG-002'),
  );
  assert.equal(after.balanceCents, before.balanceCents + 2500);
});

test('administracion: promociones, tarifas, inventario y caja persisten operaciones soportadas', async () => {
  globalThis.fetch = adminFetchMock;
  const roomTypes = await roomService.getRoomTypes();
  assert.ok(roomTypes.length > 0, 'debe existir al menos un tipo de habitacion para crear tarifa');

  const rate = await roomService.createRate({
    room_type_id: roomTypes[0].id,
    name: 'Prueba Administracion',
    valid_from: '2026-12-01',
    valid_to: '2026-12-15',
    price_cents: 199900,
    active: true,
  });
  assert.equal(rate.currency, 'GTQ');
  assert.equal(rate.priceCents, 199900);

  const inactiveRate = await roomService.updateRate(rate.id, { active: false });
  assert.equal(inactiveRate.active, false);

  const promotion = await promotionService.createPromotion({
    code: 'ADMIN75',
    name: 'Prueba administracion',
    description: 'Persistencia de promociones desde Administracion',
    discount_percent: 12,
    valid_from: '2026-12-01',
    valid_to: '2026-12-31',
    active: true,
  });
  assert.equal(promotion.code, 'ADMIN75');

  const disabledPromotion = await promotionService.updatePromotion(promotion.id, {
    active: false,
  });
  assert.equal(disabledPromotion.active, false);

  const user = await personnelService.createUser({
    firstName: 'Mario',
    lastName: 'Admin',
    email: 'mario.admin@example.com',
    password: 'Temporal123!',
    roleId: apiRoles[0].id,
  });
  const updatedUser = await personnelService.updateUser(user.id, {
    roleId: apiRoles[0].id,
    status: 'inactive',
  });
  assert.equal(updatedUser.status, 'inactive');

  const amenity = await catalogService.createAmenity({
    name: 'Terraza',
    description: 'Terraza panoramica',
    category: 'hotel',
    location: 'Azotea',
    active: true,
  });
  const inactiveAmenity = await catalogService.updateAmenity(amenity.id, { active: false });
  assert.equal(inactiveAmenity.active, false);

  const adminProduct = await catalogService.createAdminProduct({
    sku: 'RS-SOUP',
    name: 'Sopa del dia',
    description: 'Entrada caliente',
    category: 'food_and_beverage',
    priceCents: 3200,
    active: true,
  });
  const inactiveAdminProduct = await catalogService.updateAdminProduct(adminProduct.id, {
    active: false,
  });
  assert.equal(inactiveAdminProduct.active, false);

  const inventoryItems = await inventoryService.getItems();
  const item = inventoryItems.find((entry) => entry.active);
  assert.ok(item, 'debe existir un item activo para registrar movimiento');
  const renamed = await inventoryService.updateItem(item.id, {
    name: 'Toalla blanca premium',
    minimum_quantity: item.minimumQuantity + 1,
  });
  assert.equal(renamed.name, 'Toalla blanca premium');
  assert.equal(renamed.minimumQuantity, item.minimumQuantity + 1);
  const movement = await inventoryService.createMovement({
    inventoryItemId: item.id,
    type: 'in',
    reason: 'restock',
    quantity: 3,
  });
  assert.equal(movement.inventoryItemId, item.id);
  assert.equal(movement.quantity, 3);
  assert.equal(
    movement.responsibleUserId,
    undefined,
    'un movimiento sin usuario operativo no debe atribuirse a un fallback',
  );
  await assert.rejects(
    () =>
      inventoryService.createMovement({
        inventoryItemId: item.id,
        type: 'in',
        reason: 'restock',
        quantity: 1,
        responsibleUserId: 'USR-NO-EXISTE',
      }),
    /usuario responsable/,
  );

  const updatedItem = await inventoryService.getItemById(item.id);
  assert.equal(updatedItem.currentQuantity, renamed.currentQuantity + 3);

  const adjustedItem = await inventoryService.updateItem(item.id, {
    current_quantity: updatedItem.currentQuantity - 2,
  });
  assert.equal(adjustedItem.currentQuantity, updatedItem.currentQuantity - 2);
  assert.ok(
    (await inventoryService.getMovementsByItemId(item.id)).some(
      (entry) => entry.reason === 'shrinkage' && entry.quantity === 2,
    ),
    'los ajustes de stock deben pasar por movimientos de inventario',
  );

  installCashFetchMock();
  const beforeCashMovements = await cashService.getMovements();
  const cashMovement = await cashService.createMovement({
    type: 'income',
    concept: 'Prueba administracion',
    amountCents: 1500,
  });
  assert.equal(cashMovement.amountCents, 1500);
  assert.equal(
    cashMovement.responsibleUserId,
    undefined,
    'un movimiento de caja sin usuario operativo no debe atribuirse a un fallback',
  );
  assert.equal((await cashService.getMovements()).length, beforeCashMovements.length + 1);
});

test.skip('legacy mock: check-out local cerraba folio y ensuciaba habitacion', async () => {
  const overpaid = await assertServiceCall(
    'guestAccountService.getAccountByBookingId BKG-002',
    () => guestAccountService.getAccountByBookingId('BKG-002'),
  );
  assert.ok(overpaid);
  assert.ok(overpaid.balanceCents < 0, 'BKG-002 debe iniciar con saldo a favor');

  await assert.rejects(
    () => bookingService.checkOut('BKG-002'),
    /exactamente en 0 centavos/,
    'no debe permitir check-out con saldo negativo',
  );

  const before = await assertServiceCall('guestAccountService.getAccountByBookingId BKG-003', () =>
    guestAccountService.getAccountByBookingId('BKG-003'),
  );
  assert.ok(before);
  assert.ok(before.balanceCents > 0, 'BKG-003 debe iniciar con saldo pendiente');

  await assert.rejects(
    () => bookingService.checkOut('BKG-003'),
    /exactamente en 0 centavos/,
    'no debe permitir check-out con saldo pendiente',
  );

  const payment = await assertServiceCall('guestAccountService.createPayment', () =>
    guestAccountService.createPayment({
      booking_id: 'BKG-003',
      amount_cents: before.balanceCents,
      currency: before.currency,
      method: 'cash',
      transaction_reference: 'RCB-ISSUE-71',
    }),
  );
  assert.equal(payment.status, 'completed');

  const settled = await guestAccountService.getAccountByBookingId('BKG-003');
  assert.equal(settled.balanceCents, 0);

  const checkedOut = await assertServiceCall('bookingService.checkOut BKG-003', () =>
    bookingService.checkOut('BKG-003'),
  );
  assert.equal(checkedOut.status, 'checkedOut');

  const closed = await guestAccountService.getAccountByBookingId('BKG-003');
  assert.equal(closed.status, 'closed');
  assert.equal(closed.balanceCents, 0);

  const room = apiRooms.find((item) => item.id === 'RM-301');
  assert.equal(room.status, 'available');
  assert.equal(room.housekeepingStatus, 'dirty');

  await assert.rejects(
    () => bookingService.checkOut('BKG-003'),
    /ya esta cerrada|Transicion invalida/,
    'no debe permitir un segundo check-out de la misma estancia',
  );
});

const GUEST_STAY_BOOKING_ID = '7c6b5a49-0000-4000-8000-000000000001';
const GUEST_ROOM_ID = '6b5a4938-0000-4000-8000-000000000001';
const FOREIGN_ORDER_ID = 'ffffffff-0000-4000-8000-000000000999';

// Backend falso de GuestAccessController: la reserva sale del token, nunca del
// request. Un recurso de otra reserva responde 403, como el backend real.
function installGuestFetchMock() {
  const previousFetch = globalThis.fetch;
  const calls = [];
  const orders = [];
  const stayovers = [];
  const concierge = [];
  const notifications = [
    {
      id: 'aa000000-0000-4000-8000-000000000001',
      type: 'room_service_accepted',
      title: 'Room Service',
      message: 'Your room service order is now accepted',
      resourceType: 'room_service_order',
      resourceId: 'bb000000-0000-4000-8000-000000000001',
      read: false,
      readAt: null,
      createdAt: '2026-10-04T09:00:00Z',
    },
    {
      id: 'aa000000-0000-4000-8000-000000000002',
      type: 'concierge_accepted',
      title: 'Concierge',
      message: 'Your concierge request is now accepted',
      resourceType: 'concierge_request',
      resourceId: 'cc000000-0000-4000-8000-000000000001',
      read: false,
      readAt: null,
      createdAt: '2026-10-04T09:30:00Z',
    },
  ];
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  const nextId = (prefix, list) =>
    `${prefix}-0000-4000-8000-${String(list.length + 1).padStart(12, '0')}`;
  const request = (id, status, description) => ({
    id,
    bookingId: GUEST_STAY_BOOKING_ID,
    roomId: GUEST_ROOM_ID,
    roomNumber: '305',
    status,
    description,
    notes: null,
    requestedAt: '2026-10-04T10:00:00Z',
    createdAt: '2026-10-04T10:00:00Z',
    updatedAt: '2026-10-04T10:00:00Z',
  });

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ call: `${method} ${path}${url.search}`, body });

    if (method === 'GET' && path === '/guest/stay') {
      return json({
        bookingId: GUEST_STAY_BOOKING_ID,
        guestId: '5a493827-0000-4000-8000-000000000001',
        guestFirstName: 'Ana',
        guestLastName: 'López',
        roomId: GUEST_ROOM_ID,
        roomNumber: '305',
        roomTypeId: '49382716-0000-4000-8000-000000000001',
        roomTypeName: 'Suite Jardín',
        checkIn: '2026-10-03',
        checkOut: '2026-10-06',
        status: 'checked_in',
        balanceCents: 45000,
        currency: 'GTQ',
      });
    }
    if (method === 'GET' && path === '/guest/amenities') {
      return json([
        {
          id: 'dd000000-0000-4000-8000-000000000001',
          name: 'Spa',
          category: 'spa',
          active: true,
          opensAt: '08:00',
          closesAt: '20:00',
        },
      ]);
    }
    if (method === 'GET' && path === '/guest/room-service/products') {
      return json([
        {
          id: 'ee000000-0000-4000-8000-000000000001',
          sku: 'FB-001',
          name: 'Club sándwich',
          category: 'food_and_beverage',
          priceCents: 4500,
          currency: 'GTQ',
          active: true,
        },
      ]);
    }
    if (path === '/guest/room-service/orders') {
      if (method === 'GET') return json(orders);
      const order = {
        id: nextId('bb000000', orders),
        bookingId: GUEST_STAY_BOOKING_ID,
        roomId: GUEST_ROOM_ID,
        roomNumber: '305',
        guestId: '5a493827-0000-4000-8000-000000000001',
        guestName: 'Ana López',
        status: 'pending',
        notes: body.notes ?? null,
        currency: 'GTQ',
        totalCents: 4500 * body.items[0].quantity,
        items: body.items.map((item, index) => ({
          id: `item-${index}`,
          productId: item.productId,
          productName: 'Club sándwich',
          quantity: item.quantity,
          unitPriceCents: 4500,
          lineTotalCents: 4500 * item.quantity,
        })),
        chargeId: null,
        requestedAt: '2026-10-04T10:00:00Z',
        createdAt: '2026-10-04T10:00:00Z',
        updatedAt: '2026-10-04T10:00:00Z',
      };
      orders.unshift(order);
      return json(order, 201);
    }
    const orderCancel = path.match(/^\/guest\/room-service\/orders\/([^/]+)\/cancel$/);
    if (method === 'POST' && orderCancel) {
      const order = orders.find((item) => item.id === orderCancel[1]);
      if (!order) return json({ status: 403, message: 'Guest cannot access this resource' }, 403);
      order.status = 'cancelled';
      return json(order);
    }
    if (path === '/guest/housekeeping/requests') {
      if (method === 'GET') return json(stayovers);
      const created = request(nextId('cc100000', stayovers), 'pending', body.description);
      stayovers.unshift(created);
      return json(created, 201);
    }
    const stayoverCancel = path.match(/^\/guest\/housekeeping\/requests\/([^/]+)\/cancel$/);
    if (method === 'POST' && stayoverCancel) {
      const item = stayovers.find((stayover) => stayover.id === stayoverCancel[1]);
      item.status = 'cancelled';
      return json(item);
    }
    if (path === '/guest/concierge/requests') {
      if (method === 'GET') return json(concierge);
      const created = {
        ...request(nextId('cc200000', concierge), 'pending', body.description),
        type: 'concierge',
        guestName: 'Ana López',
      };
      concierge.unshift(created);
      return json(created, 201);
    }
    const conciergeCancel = path.match(/^\/guest\/concierge\/requests\/([^/]+)\/cancel$/);
    if (method === 'POST' && conciergeCancel) {
      const item = concierge.find((entry) => entry.id === conciergeCancel[1]);
      item.status = 'cancelled';
      return json(item);
    }
    if (method === 'GET' && path === '/guest/notifications') return json(notifications);
    if (method === 'GET' && path === '/guest/notifications/unread-count') {
      return json({ unreadCount: notifications.filter((item) => !item.read).length });
    }
    if (method === 'POST' && path === '/guest/notifications/read-all') {
      notifications.forEach((item) => {
        item.read = true;
        item.readAt = '2026-10-04T11:00:00Z';
      });
      return json(notifications);
    }
    const markRead = path.match(/^\/guest\/notifications\/([^/]+)\/read$/);
    if (method === 'POST' && markRead) {
      const item = notifications.find((entry) => entry.id === markRead[1]);
      item.read = true;
      item.readAt = '2026-10-04T11:00:00Z';
      return json(item);
    }
    return json({ message: `Ruta no mockeada en test: ${method} ${path}` }, 404);
  };
  return { calls, restore: () => (globalThis.fetch = previousFetch) };
}

test('portal del huésped: estancia, menú, pedidos y solicitudes van a /guest sin bookingId', async (t) => {
  const { calls, restore } = installGuestFetchMock();
  t.after(restore);

  const stay = await guestPortalService.getStay();
  assert.equal(stay.roomNumber, '305');
  assert.equal(stay.balanceCents, 45000);
  assert.equal(stay.checkIn.getDate(), 3, 'la fecha civil no se desplaza por zona horaria');

  const [product] = await catalogService.getGuestProducts();
  assert.equal(product.name, 'Club sándwich');
  assert.equal((await catalogService.getGuestAmenities())[0].name, 'Spa');

  const order = await orderService.createGuestOrder({
    items: [{ productId: product.id, quantity: 2 }],
    notes: ' Sin hielo ',
  });
  assert.equal(order.status, 'pending');
  assert.equal(order.items[0].productName, 'Club sándwich');
  assert.deepEqual(calls.at(-1).body, {
    notes: 'Sin hielo',
    items: [{ productId: product.id, quantity: 2 }],
  });
  assert.equal((await orderService.getGuestOrders()).length, 1);
  assert.equal((await orderService.cancelGuestOrder(order.id)).status, 'cancelled');
  await assert.rejects(
    () => orderService.cancelGuestOrder(FOREIGN_ORDER_ID),
    /no pertenece a tu estancia/,
    'un pedido de otra reserva responde 403',
  );

  const cleaning = await housekeepingService.createGuestStayoverRequest({
    description: 'Cambio de toallas',
  });
  assert.equal(cleaning.type, 'housekeeping');
  assert.equal((await housekeepingService.getGuestStayoverRequests()).length, 1);
  const cancelledCleaning = await housekeepingService.cancelGuestStayoverRequest(cleaning.id);
  assert.equal(
    cancelledCleaning.status,
    'rejected',
    'stayover cancelado se muestra como rechazado',
  );

  const conciergeRequest = await serviceRequestService.createGuestConciergeRequest({
    description: 'Reservar cena',
    notes: 'Horario preferido: 20:00',
  });
  assert.equal(conciergeRequest.type, 'concierge');
  assert.equal((await serviceRequestService.getGuestConciergeRequests()).length, 1);
  assert.equal(
    (await serviceRequestService.cancelGuestConciergeRequest(conciergeRequest.id)).status,
    'cancelled',
  );

  assert.ok(
    calls.every(({ call }) => call.split(' ')[1].startsWith('/guest/')),
    'el portal solo usa rutas /guest',
  );
  assert.ok(
    calls.every(({ call, body }) => !call.includes('bookingId') && !(body && 'bookingId' in body)),
    'ninguna llamada del huésped elige la reserva',
  );
});

test('portal del huésped: notificaciones y contador salen del backend', async (t) => {
  const { calls, restore } = installGuestFetchMock();
  t.after(restore);

  const notifications = await notificationService.getGuestNotifications();
  assert.equal(notifications.length, 2);
  assert.ok(notifications[0].createdAt instanceof Date);
  assert.equal(await notificationService.getGuestUnreadCount(), 2);

  const marked = await notificationService.markGuestNotificationRead(notifications[0].id);
  assert.equal(marked.read, true);
  assert.equal(await notificationService.getGuestUnreadCount(), 1);

  const all = await notificationService.markAllGuestNotificationsRead();
  assert.ok(all.every((item) => item.read));
  assert.equal(calls.at(-1).call, 'POST /guest/notifications/read-all');
  assert.equal(await notificationService.getGuestUnreadCount(), 0);
});

const RS_BOOKING_ID = '8a1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const RS_PRODUCT_ID = '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e';

// Mismas reglas que RoomServiceOrderServiceImpl: transiciones exactas, notas
// opcionales en el cambio de estado, PATCH de notas solo en pedidos no terminales
// y un único cargo creado por el backend al entregar.
function installRoomServiceFetchMock() {
  const previousFetch = globalThis.fetch;
  const calls = [];
  const orders = [];
  const allowed = {
    pending: ['accepted', 'rejected', 'cancelled'],
    accepted: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['on_the_way', 'cancelled'],
    on_the_way: ['delivered'],
    delivered: [],
    rejected: [],
    cancelled: [],
  };
  const terminal = ['delivered', 'rejected', 'cancelled'];
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ call: `${method} ${path}${url.search}`, body });

    if (method === 'GET' && path === '/charges') return json([]);
    if (method === 'GET' && path === '/room-service/orders') {
      const status = url.searchParams.get('status');
      return json(orders.filter((order) => !status || order.status === status));
    }
    if (method === 'POST' && path === '/room-service/orders') {
      const quantity = body.items[0].quantity;
      const order = {
        id: `9c8b7a6d-0000-4000-8000-${String(orders.length + 1).padStart(12, '0')}`,
        bookingId: body.bookingId,
        roomId: '2d3e4f5a-0000-4000-8000-000000000001',
        roomNumber: '305',
        guestId: '3e4f5a6b-0000-4000-8000-000000000001',
        guestName: 'Ana López',
        status: 'pending',
        notes: body.notes ?? null,
        currency: 'GTQ',
        totalCents: 4500 * quantity,
        items: [
          {
            id: 'item-1',
            productId: body.items[0].productId,
            productName: 'Club sándwich',
            quantity,
            unitPriceCents: 4500,
            lineTotalCents: 4500 * quantity,
          },
        ],
        chargeId: null,
        requestedAt: '2026-10-03T12:00:00Z',
        createdAt: '2026-10-03T12:00:00Z',
        updatedAt: '2026-10-03T12:00:00Z',
      };
      orders.push(order);
      return json(order, 201);
    }
    const match = path.match(/^\/room-service\/orders\/([^/]+)(?:\/(status|notes))?$/);
    const order = match && orders.find((item) => item.id === match[1]);
    if (match && !order) return json({ status: 404, message: 'Room service order not found' }, 404);
    if (method === 'GET' && match && !match[2]) return json(order);
    if (method === 'POST' && match?.[2] === 'status') {
      if (!allowed[order.status].includes(body.status)) {
        return json({ status: 400, message: 'Invalid room service order status transition' }, 400);
      }
      order.status = body.status;
      if (body.notes !== undefined) order.notes = body.notes.trim() || null;
      if (body.status === 'delivered') order.chargeId = '7f6e5d4c-0000-4000-8000-000000000001';
      return json(order);
    }
    if (method === 'PATCH' && match?.[2] === 'notes') {
      if (terminal.includes(order.status)) {
        return json({ status: 400, message: 'Room service order status is terminal' }, 400);
      }
      order.notes = body.notes.trim() || null;
      return json(order);
    }
    return json({ message: `Ruta no mockeada en test: ${method} ${path}` }, 404);
  };
  return { calls, orders, restore: () => (globalThis.fetch = previousFetch) };
}

test('orderService: el ciclo de Room Service va al backend y no crea cargos locales', async (t) => {
  const { calls, restore } = installRoomServiceFetchMock();
  t.after(restore);
  const chargesBefore = (await guestAccountService.getCharges()).length;

  const created = await orderService.createStaffOrder({
    bookingId: RS_BOOKING_ID,
    items: [{ productId: RS_PRODUCT_ID, quantity: 2 }],
    notes: '  Sin cebolla  ',
  });
  assert.equal(created.status, 'pending');
  assert.equal(created.roomNumber, '305');
  assert.equal(created.guestName, 'Ana López');
  assert.equal(created.totalCents, 9000);
  assert.equal(created.items[0].productName, 'Club sándwich');
  assert.ok(!('room_number' in created), 'un Model no debe traer campos snake_case del DTO');
  assert.deepEqual(calls.at(-1).body, {
    bookingId: RS_BOOKING_ID,
    notes: 'Sin cebolla',
    items: [{ productId: RS_PRODUCT_ID, quantity: 2 }],
  });

  for (const status of ['accepted', 'preparing', 'ready', 'onTheWay']) {
    await orderService.updateOrderStatus(created.id, status);
  }
  assert.equal(calls.at(-1).body.status, 'on_the_way', 'onTheWay viaja como on_the_way');
  assert.equal(calls.at(-1).body.notes, undefined, 'sin notas el backend conserva las actuales');

  const delivered = await orderService.updateOrderStatus(created.id, 'delivered');
  assert.equal(delivered.status, 'delivered');
  assert.ok(delivered.chargeId, 'el chargeId lo devuelve el backend');
  assert.equal(delivered.notes, 'Sin cebolla');

  await assert.rejects(
    () => orderService.updateOrderStatus(created.id, 'delivered'),
    /rechazó la operación/,
    'un pedido entregado es terminal: el backend decide',
  );
  assert.equal(
    (await guestAccountService.getCharges()).length,
    chargesBefore,
    'el frontend no crea cargos de folio por su cuenta',
  );
  assert.deepEqual(
    calls.filter(({ call }) => !call.startsWith('GET')).map(({ call }) => call.split(' ')[0]),
    ['POST', 'POST', 'POST', 'POST', 'POST', 'POST', 'POST'],
  );
  assert.ok(
    calls
      .filter(({ call }) => call !== 'GET /charges')
      .every(({ call }) => call.includes('/room-service/orders')),
    'solo se usan los endpoints de RoomServiceController',
  );
});

test('orderService: motivos y observaciones se guardan en el backend', async (t) => {
  const { calls, restore } = installRoomServiceFetchMock();
  t.after(restore);
  const order = () =>
    orderService.createStaffOrder({
      bookingId: RS_BOOKING_ID,
      items: [{ productId: RS_PRODUCT_ID, quantity: 1 }],
    });

  const toReject = await order();
  const rejected = await orderService.updateOrderStatus(
    toReject.id,
    'rejected',
    'Producto agotado.',
  );
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.notes, 'Producto agotado.');
  assert.equal(rejected.chargeId, undefined);

  const toCancel = await order();
  await orderService.updateOrderStatus(toCancel.id, 'accepted');
  await orderService.updateOrderStatus(toCancel.id, 'preparing');
  const cancelled = await orderService.updateOrderStatus(
    toCancel.id,
    'cancelled',
    'Cancelar por llamada.',
  );
  assert.equal(cancelled.status, 'cancelled', 'el backend permite cancelar desde preparing');
  assert.equal(cancelled.notes, 'Cancelar por llamada.');

  const toNote = await order();
  const noted = await orderService.updateOrderNotes(toNote.id, 'Entregar sin cubiertos.');
  assert.equal(noted.notes, 'Entregar sin cubiertos.');
  assert.equal(noted.status, 'pending', 'guardar la observación no cambia el estado');
  assert.equal(calls.at(-1).call, `PATCH /room-service/orders/${toNote.id}/notes`);

  await assert.rejects(
    () => orderService.updateOrderNotes(toReject.id, 'Otra nota'),
    /rechazó la operación/,
    'un pedido terminal conserva su motivo',
  );

  const pending = await orderService.getOrders({ status: 'pending' });
  assert.deepEqual(
    pending.map((item) => item.id),
    [toNote.id],
  );
  assert.equal(calls.at(-1).call, 'GET /room-service/orders?status=pending');
  assert.equal(await orderService.getOrderById('9c8b7a6d-0000-4000-8000-999999999999'), undefined);
});

const CG_BOOKING_ID = '6d5c4b3a-0000-4000-8000-000000000001';

// Mismas reglas que ConciergeRequestServiceImpl: transiciones exactas, notas del
// cambio de estado agregadas a las existentes, responsable automático al tomar la
// solicitud y edición de notas solo en estados no terminales.
function installConciergeFetchMock() {
  const previousFetch = globalThis.fetch;
  const calls = [];
  const requests = [];
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

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ call: `${method} ${path}${url.search}`, body });

    if (method === 'GET' && path === '/concierge/requests') {
      const status = url.searchParams.get('status');
      return json(requests.filter((item) => !status || item.status === status));
    }
    if (method === 'POST' && path === '/concierge/requests') {
      const created = {
        id: `5a4b3c2d-0000-4000-8000-${String(requests.length + 1).padStart(12, '0')}`,
        bookingId: body.bookingId,
        roomId: '4c3b2a1d-0000-4000-8000-000000000001',
        roomNumber: '402',
        guestId: '3b2a1c0d-0000-4000-8000-000000000001',
        guestName: 'Luis Pérez',
        responsibleUserId: null,
        responsibleUserName: null,
        responsibleUserEmail: null,
        type: 'concierge',
        description: body.description,
        status: 'pending',
        notes: body.notes ?? null,
        chargeId: null,
        requestedAt: '2026-10-04T10:00:00Z',
        createdAt: '2026-10-04T10:00:00Z',
        updatedAt: '2026-10-04T10:00:00Z',
      };
      requests.push(created);
      return json(created, 201);
    }
    const match = path.match(/^\/concierge\/requests\/([^/]+)(\/status)?$/);
    const item = match && requests.find((request) => request.id === match[1]);
    if (match && !item) return json({ status: 404, message: 'Concierge request not found' }, 404);
    if (method === 'GET' && match && !match[2]) return json(item);
    if (method === 'POST' && match?.[2]) {
      if (!(allowed[item.status] ?? []).includes(body.status)) {
        return json({ status: 400, message: 'Invalid status transition' }, 400);
      }
      item.status = body.status;
      if (body.notes) item.notes = item.notes ? `${item.notes}\n${body.notes}` : body.notes;
      if (
        !item.responsibleUserId &&
        ['accepted', 'in_progress', 'completed'].includes(body.status)
      ) {
        item.responsibleUserId = '2a1b0c9d-0000-4000-8000-000000000001';
        item.responsibleUserName = 'Douglas Gómez';
        item.responsibleUserEmail = 'conserjeria@hotelboutique.test';
      }
      return json(item);
    }
    if (method === 'PUT' && match && !match[2]) {
      if (['completed', 'rejected', 'cancelled'].includes(item.status)) {
        return json({ status: 400, message: `Concierge request is already ${item.status}` }, 400);
      }
      if (body.description !== undefined && item.status !== 'pending') {
        return json({ status: 400, message: 'Only pending concierge requests can be edited' }, 400);
      }
      if (body.description !== undefined) item.description = body.description;
      if (body.notes !== undefined) item.notes = body.notes.trim() || null;
      return json(item);
    }
    return json({ message: `Ruta no mockeada en test: ${method} ${path}` }, 404);
  };
  return { calls, requests, restore: () => (globalThis.fetch = previousFetch) };
}

test('serviceRequestService: Conserjería crea, lista y avanza contra el backend', async (t) => {
  const { calls, restore } = installConciergeFetchMock();
  t.after(restore);

  const created = await serviceRequestService.createConciergeRequest({
    bookingId: CG_BOOKING_ID,
    description: '  Reservar cena  ',
    notes: ' Mesa junto a ventana ',
  });
  assert.equal(created.status, 'pending');
  assert.equal(created.type, 'concierge');
  assert.equal(created.roomNumber, '402');
  assert.equal(created.guestName, 'Luis Pérez');
  assert.equal(created.responsibleUserName, undefined);
  assert.ok(!('room_number' in created), 'un Model no debe traer campos snake_case del DTO');
  assert.deepEqual(calls.at(-1).body, {
    bookingId: CG_BOOKING_ID,
    description: 'Reservar cena',
    notes: 'Mesa junto a ventana',
  });

  const accepted = await serviceRequestService.updateConciergeRequestStatus(created.id, 'accepted');
  assert.equal(accepted.status, 'accepted');
  assert.equal(
    accepted.responsibleUserName,
    'Douglas Gómez',
    'el responsable lo asigna el backend',
  );
  assert.deepEqual(calls.at(-1).body, { status: 'accepted' });

  const inProgress = await serviceRequestService.updateConciergeRequestStatus(
    created.id,
    'inProgress',
  );
  assert.equal(calls.at(-1).body.status, 'in_progress', 'inProgress viaja como in_progress');
  assert.equal(inProgress.status, 'inProgress');

  const observed = await serviceRequestService.updateConciergeRequest(created.id, {
    notes: 'Proveedor confirmado',
  });
  assert.equal(observed.notes, 'Proveedor confirmado', 'las notas se editan en in_progress');
  assert.equal(calls.at(-1).call, `PUT /concierge/requests/${created.id}`);

  const completed = await serviceRequestService.updateConciergeRequestStatus(
    created.id,
    'completed',
  );
  assert.equal(completed.status, 'completed');

  await assert.rejects(
    () => serviceRequestService.updateConciergeRequestStatus(created.id, 'cancelled'),
    /Invalid status transition/,
    'una solicitud completada es terminal: el backend decide',
  );
  const detail = await serviceRequestService.getConciergeRequestById(created.id);
  assert.equal(detail?.status, 'completed');
  assert.equal(
    await serviceRequestService.getConciergeRequestById('5a4b3c2d-0000-4000-8000-999999999999'),
    undefined,
  );
});

test('serviceRequestService: rechazo y cancelación de Conserjería guardan el motivo', async (t) => {
  const { calls, restore } = installConciergeFetchMock();
  t.after(restore);
  const create = (description) =>
    serviceRequestService.createConciergeRequest({ bookingId: CG_BOOKING_ID, description });

  const toReject = await create('Traslado privado');
  const rejected = await serviceRequestService.updateConciergeRequestStatus(
    toReject.id,
    'rejected',
    { notes: 'Proveedor no disponible.' },
  );
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.notes, 'Proveedor no disponible.');
  assert.equal(rejected.responsibleUserName, undefined, 'rechazar no asigna responsable');

  const toCancel = await create('Tour en lancha');
  await serviceRequestService.updateConciergeRequestStatus(toCancel.id, 'accepted');
  const cancelled = await serviceRequestService.updateConciergeRequestStatus(
    toCancel.id,
    'cancelled',
    { notes: 'El huésped ya no lo necesita.' },
  );
  assert.equal(cancelled.status, 'cancelled', 'cancelled ya no se confunde con rejected');
  assert.deepEqual(calls.at(-1).body, {
    status: 'cancelled',
    notes: 'El huésped ya no lo necesita.',
  });

  await assert.rejects(
    () => serviceRequestService.updateConciergeRequest(toCancel.id, { notes: 'Otra' }),
    /already cancelled/,
    'una solicitud cancelada no se edita',
  );

  const pending = await serviceRequestService.getConciergeRequests({ status: 'pending' });
  assert.deepEqual(pending, []);
  assert.equal(calls.at(-1).call, 'GET /concierge/requests?status=pending');
});

// --- #126: confirmación/cancelación, mantenimiento y finanzas globales -----

test('#126: confirmar y cancelar reserva usan el backend y conservan el motivo', async (t) => {
  const { calls, bookings, restore } = installGuestBookingFetchMock();
  t.after(restore);
  const bookingId = bookings[0].id;

  const confirmed = await assertServiceCall('bookingService.confirmBooking integrado', () =>
    bookingService.confirmBooking(bookingId),
  );
  assert.equal(confirmed.status, 'confirmed');
  assert.equal(calls.at(-1).call, `POST /bookings/${bookingId}/confirm`);

  await assert.rejects(
    () => bookingService.confirmBooking(bookingId),
    /Only pending bookings can be confirmed/,
    'el 400 del backend se propaga con su mensaje',
  );

  const callsBeforeEmptyReason = calls.length;
  await assert.rejects(
    () => bookingService.cancelBooking(bookingId, '   '),
    /Se requiere un motivo/,
  );
  assert.equal(calls.length, callsBeforeEmptyReason, 'sin motivo no llama al backend');

  const cancelled = await assertServiceCall('bookingService.cancelBooking integrado', () =>
    bookingService.cancelBooking(bookingId, '  Cambio de planes del huésped  '),
  );
  assert.equal(calls.at(-1).call, `POST /bookings/${bookingId}/cancel`);
  assert.deepEqual(calls.at(-1).body, { reason: 'Cambio de planes del huésped' });
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.cancellationReason, 'Cambio de planes del huésped');
  assert.ok(cancelled.cancelledAt instanceof Date, 'cancelledAt llega como Date de dominio');

  await assert.rejects(
    () => bookingService.cancelBooking(bookingId, 'Otra vez'),
    /Only pending or confirmed bookings can be cancelled/,
  );
  await assert.rejects(
    () => bookingService.confirmBooking('BKG-001'),
    /requiere una reserva integrada/,
    'IDs legacy no simulan la transición',
  );
});

function installGeneralServiceRequestFetchMock() {
  const previousFetch = globalThis.fetch;
  const calls = [];
  const now = '2026-10-05T10:00:00Z';
  const roomId = apiRooms[0].id;
  const requests = [];
  const transitions = {
    pending: ['accepted', 'rejected', 'cancelled'],
    accepted: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
  };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ call: `${method} ${path}${url.search}`, body });

    if (method === 'GET' && path === '/service-requests') {
      const type = url.searchParams.get('type');
      const status = url.searchParams.get('status');
      return json(
        requests.filter(
          (item) => (!type || item.type === type) && (!status || item.status === status),
        ),
      );
    }
    if (method === 'POST' && path === '/service-requests') {
      if (['housekeeping', 'concierge'].includes(body.type))
        return json({ message: `Use the dedicated endpoint for ${body.type} requests` }, 400);
      const request = {
        id: `bbbb1260-0000-4000-8000-${String(requests.length + 1).padStart(12, '0')}`,
        bookingId: body.bookingId ?? null,
        roomId: body.roomId,
        roomNumber: '101',
        guestId: null,
        guestName: null,
        responsibleUserId: null,
        responsibleUserName: null,
        responsibleUserEmail: null,
        type: body.type,
        description: body.description,
        status: 'pending',
        notes: body.notes ?? null,
        requestedAt: now,
        startedAt: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      requests.push(request);
      return json(request, 201);
    }
    const detail = path.match(/^\/service-requests\/([^/]+)(\/status)?$/);
    const request = detail && requests.find((item) => item.id === detail[1]);
    if (detail && !request)
      return json({ message: `Service request not found: ${detail[1]}` }, 404);
    if (method === 'GET' && detail && !detail[2]) return json(request);
    if (method === 'POST' && detail?.[2]) {
      if (!(transitions[request.status] ?? []).includes(body.status))
        return json(
          { message: `Invalid status transition from ${request.status} to ${body.status}` },
          400,
        );
      Object.assign(request, {
        status: body.status,
        responsibleUserName: ['accepted', 'in_progress', 'completed'].includes(body.status)
          ? 'Limpieza Demo'
          : request.responsibleUserName,
        startedAt: body.status === 'in_progress' ? now : request.startedAt,
        completedAt: body.status === 'completed' ? now : request.completedAt,
        notes: body.notes
          ? request.notes
            ? `${request.notes}\n${body.notes}`
            : body.notes
          : request.notes,
        updatedAt: now,
      });
      return json(request);
    }
    return json({ message: `Ruta #126 no mockeada en test: ${method} ${path}` }, 404);
  };

  return { calls, roomId, restore: () => (globalThis.fetch = previousFetch) };
}

test('#126: mantenimiento usa /service-requests para crear, filtrar y cambiar estado', async (t) => {
  const { calls, roomId, restore } = installGeneralServiceRequestFetchMock();
  t.after(restore);

  const report = await assertServiceCall('serviceRequestService.createMaintenanceReport', () =>
    serviceRequestService.createMaintenanceReport({
      roomId,
      description: '  Fuga en lavamanos  ',
      notes: 'Alta',
    }),
  );
  assert.equal(calls.at(-1).call, 'POST /service-requests');
  assert.deepEqual(calls.at(-1).body, {
    roomId,
    type: 'maintenance',
    description: 'Fuga en lavamanos',
    notes: 'Alta',
  });
  assert.equal(report.type, 'maintenance');
  assert.equal(report.status, 'pending');
  assert.ok(!('room_id' in report), 'devuelve Model, no DTO');

  await assert.rejects(
    () =>
      serviceRequestService.createRequest({
        roomId,
        type: 'housekeeping',
        description: 'Stayover por la ruta general',
      }),
    /Use the dedicated endpoint for housekeeping requests/,
    'el backend reserva housekeeping/concierge para sus endpoints propios',
  );

  const filtered = await assertServiceCall('serviceRequestService.getRequests filtrado', () =>
    serviceRequestService.getRequests({ type: 'maintenance', status: 'pending', roomId }),
  );
  assert.equal(filtered.length, 1);
  assert.equal(
    calls.at(-1).call,
    `GET /service-requests?type=maintenance&roomId=${roomId}&status=pending`,
  );

  const detail = await assertServiceCall('serviceRequestService.getRequestById', () =>
    serviceRequestService.getRequestById(report.id),
  );
  assert.equal(detail?.id, report.id);
  assert.equal(
    await serviceRequestService.getRequestById('bbbb1260-0000-4000-8000-999999999999'),
    undefined,
    'un 404 real del detalle se devuelve como undefined',
  );

  const accepted = await assertServiceCall('serviceRequestService.updateRequestStatus', () =>
    serviceRequestService.updateRequestStatus(report.id, 'accepted'),
  );
  assert.equal(accepted.status, 'accepted');
  assert.equal(accepted.responsibleUserName, 'Limpieza Demo', 'el responsable lo asigna backend');
  assert.equal(calls.at(-1).call, `POST /service-requests/${report.id}/status`);
  assert.deepEqual(calls.at(-1).body, { status: 'accepted' });

  const started = await serviceRequestService.updateRequestStatus(report.id, 'inProgress');
  assert.equal(started.status, 'inProgress');
  assert.deepEqual(calls.at(-1).body, { status: 'in_progress' });

  const completed = await serviceRequestService.updateRequestStatus(report.id, 'completed', {
    notes: '  Se cambió el empaque  ',
  });
  assert.equal(completed.status, 'completed');
  assert.equal(completed.notes, 'Alta\nSe cambió el empaque', 'las notas se agregan');

  await assert.rejects(
    () => serviceRequestService.updateRequestStatus(report.id, 'cancelled'),
    /Invalid status transition from completed to cancelled/,
    'la transición inválida del backend se propaga',
  );
});

test('#126: listados financieros globales propagan el error real sin fallback', async (t) => {
  const previousFetch = globalThis.fetch;
  t.after(() => (globalThis.fetch = previousFetch));
  const calls = [];
  globalThis.fetch = async (input) => {
    const path = new URL(String(input)).pathname.replace(/^\/api\/v1/, '');
    calls.push(path);
    return new Response(JSON.stringify({ message: `Access denied: ${path}` }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  };

  for (const [label, call, path] of [
    ['getAccounts', () => guestAccountService.getAccounts(), '/guest-accounts'],
    ['getCharges', () => guestAccountService.getCharges(), '/charges'],
    ['getPayments', () => guestAccountService.getPayments(), '/payments'],
    ['getDeposits', () => guestAccountService.getDeposits(), '/deposits'],
    ['getRequests', () => serviceRequestService.getRequests(), '/service-requests'],
  ]) {
    await assert.rejects(call, new RegExp(`Access denied: ${path}`), `${label} no devuelve []`);
    assert.equal(calls.at(-1), path, `${label} consulta ${path}`);
  }
});

test('#126: listados financieros globales devuelven Models desde la API', async () => {
  const { bookingId } = installFinancialFetchMock();
  const charges = await assertServiceCall('guestAccountService.getCharges', () =>
    guestAccountService.getCharges(),
  );
  assert.equal(charges[0].bookingId, bookingId);
  assert.equal(charges[0].amountCents, 50000);
  assert.ok(!('amount_cents' in charges[0]), 'devuelve Model, no DTO');
  assert.deepEqual(
    await assertServiceCall('guestAccountService.getPayments', () =>
      guestAccountService.getPayments(),
    ),
    [],
  );
  assert.deepEqual(
    await assertServiceCall('guestAccountService.getDeposits', () =>
      guestAccountService.getDeposits(),
    ),
    [],
  );
});
