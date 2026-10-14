import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

await mkdir('.cache', { recursive: true });
await build({
  entryPoints: ['src/shared/utils/currency.ts'],
  outfile: '.cache/currency.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  tsconfig: 'tsconfig.app.json',
});

const require = createRequire(import.meta.url);
delete require.cache[require.resolve('../.cache/currency.cjs')];
const { formatCurrency } = require('../.cache/currency.cjs');

test('GTQ: 0 centavos -> Q0.00', () => {
  assert.equal(formatCurrency(0), 'Q0.00');
});

test('GTQ: 1 centavo -> Q0.01', () => {
  assert.equal(formatCurrency(1), 'Q0.01');
});

test('GTQ: 125000 centavos -> Q1,250.00', () => {
  assert.equal(formatCurrency(125000), 'Q1,250.00');
});

test('GTQ: 1000000 centavos -> Q10,000.00', () => {
  assert.equal(formatCurrency(1000000), 'Q10,000.00');
});

test('GTQ: monto negativo -> signo antes del símbolo, sin espacio', () => {
  assert.equal(formatCurrency(-125000), '-Q1,250.00');
});

test('GTQ: nunca inserta espacio entre el símbolo y el monto', () => {
  assert.doesNotMatch(formatCurrency(125000), /\s/);
  assert.doesNotMatch(formatCurrency(-125000), /\s/);
});

test('GTQ es la moneda por defecto cuando no se indica currency', () => {
  assert.equal(formatCurrency(125000), formatCurrency(125000, 'GTQ'));
});

test('rechaza centavos no enteros (1.5)', () => {
  assert.throws(() => formatCurrency(1.5), /entero/);
});

test('rechaza NaN', () => {
  assert.throws(() => formatCurrency(NaN), /entero/);
});

test('rechaza Infinity', () => {
  assert.throws(() => formatCurrency(Infinity), /entero/);
});

test('rechaza -Infinity', () => {
  assert.throws(() => formatCurrency(-Infinity), /entero/);
});
