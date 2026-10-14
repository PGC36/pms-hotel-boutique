import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookings, payments, products, rates } from './fixtures/domain-fixtures.mjs';

await mkdir('.cache', { recursive: true });
await build({
  entryPoints: ['src/shared/utils/currency.ts'],
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
const { formatCurrency } = require(require.resolve('../.cache/shared/utils/currency.cjs'));

const moneyCatalogs = [
  { label: 'payments', records: payments, field: 'amount_cents' },
  { label: 'rates', records: rates, field: 'price_cents' },
  { label: 'bookings', records: bookings, field: 'total_amount_cents' },
  { label: 'products', records: products, field: 'price_cents' },
];

for (const catalog of moneyCatalogs) {
  test(`${catalog.label}: montos en centavos enteros y moneda GTQ`, () => {
    assert.ok(catalog.records.length > 0);
    for (const record of catalog.records) {
      assert.ok(
        Number.isInteger(record[catalog.field]),
        `${record.id}: ${catalog.field} no es entero`,
      );
      assert.equal(record.currency, 'GTQ', `${record.id}: currency no es GTQ`);
    }
  });
}

test('formatCurrency: 125000 centavos -> Q1,250.00', () => {
  assert.equal(formatCurrency(125000), 'Q1,250.00');
});

test('formatCurrency: formatea un monto real sin lanzar', () => {
  const [payment] = payments;
  assert.match(formatCurrency(payment.amount_cents, payment.currency), /^Q[\d,]+\.\d{2}$/);
});

test('formatCurrency: rechaza centavos no enteros', () => {
  assert.throws(() => formatCurrency(1.5));
});

test('contrato: campos monetarios usan sufijo _cents, no nombres legacy', () => {
  const [payment] = payments;
  const [rate] = rates;
  const [booking] = bookings;
  const [product] = products;

  assert.ok('amount_cents' in payment);
  assert.ok(!('amount' in payment));
  assert.ok(!('amountCents' in payment));
  assert.ok('price_cents' in rate);
  assert.ok(!('price' in rate));
  assert.ok('total_amount_cents' in booking);
  assert.ok(!('totalAmount' in booking));
  assert.ok(!('totalAmountCents' in booking));
  assert.ok('price_cents' in product);
  assert.ok(!('price' in product));
});
