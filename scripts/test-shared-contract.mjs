import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allRecords,
  amenities,
  auditLogs,
  bookingCompanions,
  bookings,
  cashMovements,
  cashSessions,
  charges,
  deposits,
  guestAccounts,
  guests,
  inventoryItems,
  inventoryMovements,
  mediaImages,
  orders,
  payments,
  permissions,
  products,
  promotions,
  rates,
  roles,
  roomFeatures,
  roomTypes,
  rooms,
  serviceRequests,
  users,
} from './fixtures/domain-fixtures.mjs';

await mkdir('.cache', { recursive: true });
await build({
  entryPoints: [
    'src/shared/constants/statuses.ts',
    'src/shared/types/entities/amenity/index.ts',
    'src/shared/types/entities/audit-log/index.ts',
    'src/shared/types/entities/booking/index.ts',
    'src/shared/types/entities/booking-companion/index.ts',
    'src/shared/types/entities/cash-movement/index.ts',
    'src/shared/types/entities/cash-session/index.ts',
    'src/shared/types/entities/charge/index.ts',
    'src/shared/types/entities/deposit/index.ts',
    'src/shared/types/entities/guest/index.ts',
    'src/shared/types/entities/guest-account/index.ts',
    'src/shared/types/entities/inventory-item/index.ts',
    'src/shared/types/entities/inventory-movement/index.ts',
    'src/shared/types/entities/media-image/index.ts',
    'src/shared/types/entities/order/index.ts',
    'src/shared/types/entities/payment/index.ts',
    'src/shared/types/entities/permission/index.ts',
    'src/shared/types/entities/product/index.ts',
    'src/shared/types/entities/promotion/index.ts',
    'src/shared/types/entities/rate/index.ts',
    'src/shared/types/entities/role/index.ts',
    'src/shared/types/entities/room/index.ts',
    'src/shared/types/entities/room-feature/index.ts',
    'src/shared/types/entities/room-type/index.ts',
    'src/shared/types/entities/service-request/index.ts',
    'src/shared/types/entities/user/index.ts',
  ],
  outdir: '.cache',
  outbase: 'src',
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  tsconfig: 'tsconfig.app.json',
});

const require = createRequire(import.meta.url);
const load = (relativePath) => require(require.resolve(`../.cache/${relativePath}.cjs`));

const { ROOM_STATUSES, BOOKING_STATUSES, ORDER_STATUSES, SERVICE_REQUEST_STATUSES } = load(
  'shared/constants/statuses',
);

const mapperCases = [
  ['amenity', amenities, load('shared/types/entities/amenity/index')],
  ['audit-log', auditLogs, load('shared/types/entities/audit-log/index')],
  ['booking', bookings, load('shared/types/entities/booking/index')],
  ['booking-companion', bookingCompanions, load('shared/types/entities/booking-companion/index')],
  ['cash-movement', cashMovements, load('shared/types/entities/cash-movement/index')],
  ['cash-session', cashSessions, load('shared/types/entities/cash-session/index')],
  ['charge', charges, load('shared/types/entities/charge/index')],
  ['deposit', deposits, load('shared/types/entities/deposit/index')],
  ['guest', guests, load('shared/types/entities/guest/index')],
  ['guest-account', guestAccounts, load('shared/types/entities/guest-account/index')],
  ['inventory-item', inventoryItems, load('shared/types/entities/inventory-item/index')],
  [
    'inventory-movement',
    inventoryMovements,
    load('shared/types/entities/inventory-movement/index'),
  ],
  ['media-image', mediaImages, load('shared/types/entities/media-image/index')],
  ['order', orders, load('shared/types/entities/order/index')],
  ['payment', payments, load('shared/types/entities/payment/index')],
  ['permission', permissions, load('shared/types/entities/permission/index')],
  ['product', products, load('shared/types/entities/product/index')],
  ['promotion', promotions, load('shared/types/entities/promotion/index')],
  ['rate', rates, load('shared/types/entities/rate/index')],
  ['role', roles, load('shared/types/entities/role/index')],
  ['room', rooms, load('shared/types/entities/room/index')],
  ['room-feature', roomFeatures, load('shared/types/entities/room-feature/index')],
  ['room-type', roomTypes, load('shared/types/entities/room-type/index')],
  ['service-request', serviceRequests, load('shared/types/entities/service-request/index')],
  ['user', users, load('shared/types/entities/user/index')],
];

const stripUndefined = (value) =>
  Object.fromEntries(Object.entries(value).filter(([, val]) => val !== undefined));

const assertRoundTrip = (label, dto, mapper) => {
  const model = mapper.toDomain(dto);
  const roundTripped = mapper.toDTO(model);
  assert.deepStrictEqual(
    stripUndefined(roundTripped),
    stripUndefined(dto),
    `${label}: el mapper perdió o alteró campos`,
  );
};

test('DTO: timestamps ISO, fechas civiles YYYY-MM-DD y montos enteros', () => {
  const timestampFields = [
    'created_at',
    'updated_at',
    'charged_at',
    'paid_at',
    'requested_at',
    'opened_at',
    'closed_at',
    'collected_at',
    'refunded_at',
    'occurred_at',
  ];
  const calendarFields = ['check_in', 'check_out', 'valid_from', 'valid_to'];
  for (const record of allRecords) {
    for (const field of timestampFields) {
      if (record[field] === undefined) continue;
      assert.ok(!Number.isNaN(new Date(record[field]).getTime()), `${record.id}: ${field}`);
    }
    for (const field of calendarFields) {
      if (record[field] === undefined) continue;
      assert.match(record[field], /^\d{4}-\d{2}-\d{2}$/, `${record.id}: ${field}`);
    }
    for (const [key, value] of Object.entries(record)) {
      if (key.endsWith('_cents')) assert.ok(Number.isInteger(value), `${record.id}: ${key}`);
    }
  }
});

test('status compartidos: literales siguen alineados con el contrato', () => {
  const roomMapper = load('shared/types/entities/room/index');
  const bookingMapper = load('shared/types/entities/booking/index');
  const orderMapper = load('shared/types/entities/order/index');
  const serviceRequestMapper = load('shared/types/entities/service-request/index');

  assert.ok(ROOM_STATUSES.includes(roomMapper.toDomain(rooms[0]).status));
  assert.ok(BOOKING_STATUSES.includes(bookingMapper.toDomain(bookings[0]).status));
  assert.deepStrictEqual(ORDER_STATUSES, [
    'pending',
    'accepted',
    'preparing',
    'ready',
    'onTheWay',
    'delivered',
    'rejected',
    'cancelled',
  ]);
  assert.ok(ORDER_STATUSES.includes(orderMapper.toDomain(orders[0]).status));
  assert.deepStrictEqual(SERVICE_REQUEST_STATUSES, [
    'pending',
    'accepted',
    'inProgress',
    'completed',
    'rejected',
    'cancelled',
  ]);
  assert.ok(
    SERVICE_REQUEST_STATUSES.includes(serviceRequestMapper.toDomain(serviceRequests[0]).status),
  );
});

test('booking: guest_link_code existe y es único en fixtures de contrato', () => {
  const codes = bookings.map((booking) => booking.guest_link_code);
  assert.ok(codes.every(Boolean));
  assert.equal(new Set(codes).size, codes.length);
});

for (const [label, records, mapper] of mapperCases) {
  test(`mapper ${label}: round-trip sin pérdida`, () => {
    for (const dto of records) assertRoundTrip(`${label} ${dto.id}`, dto, mapper);
  });
}
