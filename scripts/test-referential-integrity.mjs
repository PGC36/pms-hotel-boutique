import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allCatalogs,
  bookings,
  cashMovements,
  charges,
  deposits,
  guestAccounts,
  inventoryMovements,
  orders,
  payments,
  roles,
  users,
} from './fixtures/domain-fixtures.mjs';

const idsOf = (records) => new Set(records.map((record) => record.id));

const FK_CHECKS = [
  {
    label: 'roomType.room_feature_ids -> roomFeature',
    records: allCatalogs.roomTypes,
    field: 'room_feature_ids',
    target: idsOf(allCatalogs.roomFeatures),
    multi: true,
  },
  {
    label: 'room.room_type_id -> roomType',
    records: allCatalogs.rooms,
    field: 'room_type_id',
    target: idsOf(allCatalogs.roomTypes),
  },
  {
    label: 'rate.room_type_id -> roomType',
    records: allCatalogs.rates,
    field: 'room_type_id',
    target: idsOf(allCatalogs.roomTypes),
  },
  {
    label: 'booking.guest_id -> guest',
    records: bookings,
    field: 'guest_id',
    target: idsOf(allCatalogs.guests),
  },
  {
    label: 'booking.room_id -> room',
    records: bookings,
    field: 'room_id',
    target: idsOf(allCatalogs.rooms),
    optional: true,
  },
  {
    label: 'booking.room_type_id -> roomType',
    records: bookings,
    field: 'room_type_id',
    target: idsOf(allCatalogs.roomTypes),
  },
  {
    label: 'booking.rate_id -> rate',
    records: bookings,
    field: 'rate_id',
    target: idsOf(allCatalogs.rates),
    optional: true,
  },
  {
    label: 'bookingCompanion.booking_id -> booking',
    records: allCatalogs.bookingCompanions,
    field: 'booking_id',
    target: idsOf(bookings),
  },
  {
    label: 'guestAccount.booking_id -> booking',
    records: guestAccounts,
    field: 'booking_id',
    target: idsOf(bookings),
  },
  {
    label: 'guestAccount.guest_id -> guest',
    records: guestAccounts,
    field: 'guest_id',
    target: idsOf(allCatalogs.guests),
  },
  {
    label: 'charge.booking_id -> booking',
    records: charges,
    field: 'booking_id',
    target: idsOf(bookings),
  },
  {
    label: 'charge.created_by_user_id -> user',
    records: charges,
    field: 'created_by_user_id',
    target: idsOf(users),
    optional: true,
  },
  {
    label: 'payment.booking_id -> booking',
    records: payments,
    field: 'booking_id',
    target: idsOf(bookings),
  },
  {
    label: 'payment.processed_by_user_id -> user',
    records: payments,
    field: 'processed_by_user_id',
    target: idsOf(users),
    optional: true,
  },
  {
    label: 'deposit.booking_id -> booking',
    records: deposits,
    field: 'booking_id',
    target: idsOf(bookings),
  },
  {
    label: 'deposit.guest_id -> guest',
    records: deposits,
    field: 'guest_id',
    target: idsOf(allCatalogs.guests),
  },
  {
    label: 'cashMovement.cash_session_id -> cashSession',
    records: cashMovements,
    field: 'cash_session_id',
    target: idsOf(allCatalogs.cashSessions),
  },
  {
    label: 'cashMovement.payment_id -> payment',
    records: cashMovements,
    field: 'payment_id',
    target: idsOf(payments),
    optional: true,
  },
  {
    label: 'role.permission_ids -> permission',
    records: roles,
    field: 'permission_ids',
    target: idsOf(allCatalogs.permissions),
    multi: true,
  },
  {
    label: 'user.role -> role.code',
    records: users,
    field: 'role',
    target: new Set(roles.map((role) => role.code)),
  },
  {
    label: 'inventoryMovement.inventory_item_id -> inventoryItem',
    records: inventoryMovements,
    field: 'inventory_item_id',
    target: idsOf(allCatalogs.inventoryItems),
  },
  {
    label: 'auditLog.user_id -> user',
    records: allCatalogs.auditLogs,
    field: 'user_id',
    target: idsOf(users),
  },
  {
    label: 'order.booking_id -> booking',
    records: orders,
    field: 'booking_id',
    target: idsOf(bookings),
  },
  {
    label: 'order.room_id -> room',
    records: orders,
    field: 'room_id',
    target: idsOf(allCatalogs.rooms),
  },
  {
    label: 'serviceRequest.booking_id -> booking',
    records: allCatalogs.serviceRequests,
    field: 'booking_id',
    target: idsOf(bookings),
  },
  {
    label: 'serviceRequest.room_id -> room',
    records: allCatalogs.serviceRequests,
    field: 'room_id',
    target: idsOf(allCatalogs.rooms),
  },
];

for (const check of FK_CHECKS) {
  test(`integridad referencial: ${check.label}`, () => {
    for (const record of check.records) {
      const value = record[check.field];
      if (value === undefined) {
        assert.ok(check.optional, `${record.id}: ${check.field} falta y no es opcional`);
        continue;
      }
      const values = check.multi ? value : [value];
      for (const target of values) {
        assert.ok(
          check.target.has(target),
          `${record.id}: ${check.field} -> "${target}" no existe`,
        );
      }
    }
  });
}

test('integridad referencial: order.items[].product_id -> product', () => {
  const productIds = idsOf(allCatalogs.products);
  for (const order of orders) {
    for (const item of order.items) {
      assert.ok(productIds.has(item.product_id), `${order.id}: ${item.product_id} no existe`);
    }
  }
});

for (const [label, records] of Object.entries(allCatalogs)) {
  test(`sin IDs duplicados: ${label}`, () => {
    const ids = records.map((record) => record.id);
    assert.equal(new Set(ids).size, ids.length, `${label} tiene IDs duplicados`);
  });
}
