import { existsSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

// --- A. Una sola definición por entidad ------------------------------------
//
// Antes de la FASE 3+4 del cierre de la Fase 0, booking/guest/payment/room/
// user (y catalog.ts, que duplicaba product y amenity) existían dos veces:
// un archivo plano en shared/types/entities/<x>.ts y la carpeta oficial
// shared/types/entities/<x>/. Esta prueba es la guarda de regresión: si
// alguien vuelve a crear un archivo plano junto a la carpeta, falla.

const ENTITIES_DIR = 'src/shared/types/entities';
const ENTITIES_WITH_FOLDER = [
  'amenity',
  'audit-log',
  'booking',
  'booking-companion',
  'cash-movement',
  'cash-session',
  'charge',
  'deposit',
  'guest',
  'guest-account',
  'inventory-item',
  'inventory-movement',
  'media-image',
  'order',
  'payment',
  'permission',
  'product',
  'promotion',
  'rate',
  'role',
  'room',
  'room-feature',
  'room-type',
  'service-request',
  'session',
  'user',
];

for (const entity of ENTITIES_WITH_FOLDER) {
  test(`contrato: ${entity} solo existe como carpeta (dto/model/mapper), no como archivo plano`, () => {
    assert.ok(
      existsSync(`${ENTITIES_DIR}/${entity}/${entity}.dto.ts`),
      `Falta ${ENTITIES_DIR}/${entity}/${entity}.dto.ts`,
    );
    assert.ok(
      !existsSync(`${ENTITIES_DIR}/${entity}.ts`),
      `${ENTITIES_DIR}/${entity}.ts no debería existir junto a la carpeta ${entity}/`,
    );
  });
}

test('contrato: no sobrevive el archivo plano catalog.ts (duplicaba product y amenity)', () => {
  assert.ok(!existsSync(`${ENTITIES_DIR}/catalog.ts`));
});

test('contrato: session/ y user/ existen por separado (sesión de PMS vs. rol de puesto)', () => {
  assert.ok(existsSync(`${ENTITIES_DIR}/session/session.dto.ts`));
  assert.ok(existsSync(`${ENTITIES_DIR}/user/user.dto.ts`));
});

// Los campos monetarios se cubren en test-money-contract.mjs con fixtures de
// contrato. La app productiva ya no compila ni lee src/data/db.ts.
