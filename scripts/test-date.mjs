import { build } from 'esbuild';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Toda esta suite corre fijada a America/Guatemala (UTC-6, sin DST): es la
// única zona donde el desplazamiento de día por UTC (D-010) se manifiesta.
// Corriéndola en cualquier otra zona (UTC, o una de offset positivo) no
// habría atrapado el bug real de 75ccc64.
process.env.TZ = 'America/Guatemala';

await mkdir('.cache', { recursive: true });
await build({
  entryPoints: [
    'src/shared/utils/date.ts',
    'src/shared/types/common.ts',
    'src/shared/types/entities/booking/booking.mapper.ts',
    'src/shared/types/entities/rate/rate.mapper.ts',
    'src/shared/types/entities/promotion/promotion.mapper.ts',
  ],
  outdir: '.cache',
  outbase: 'src/shared',
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  tsconfig: 'tsconfig.app.json',
});

const require = createRequire(import.meta.url);
const load = (relativePath) => {
  const path = require.resolve(`../.cache/${relativePath}.cjs`);
  delete require.cache[path];
  return require(path);
};

const { formatDateGT, formatTimeGT, formatStayRange, calculateNights, isSameCalendarDay } =
  load('utils/date');
const { toDomainCalendarDate, toDtoCalendarDate } = load('types/common');
const bookingMapper = load('types/entities/booking/booking.mapper');
const rateMapper = load('types/entities/rate/rate.mapper');
const promotionMapper = load('types/entities/promotion/promotion.mapper');

// --- formatDateGT -----------------------------------------------------

test('formatDateGT: 8 septiembre 2026 -> 08-09-2026', () => {
  assert.equal(formatDateGT(new Date(2026, 8, 8)), '08-09-2026');
});

test('formatDateGT: 1 enero 2026 -> 01-01-2026', () => {
  assert.equal(formatDateGT(new Date(2026, 0, 1)), '01-01-2026');
});

test('formatDateGT: 31 diciembre 2026 -> 31-12-2026', () => {
  assert.equal(formatDateGT(new Date(2026, 11, 31)), '31-12-2026');
});

test('formatDateGT: Date inválido -> lanza error', () => {
  assert.throws(() => formatDateGT(new Date(NaN)), /inválida/);
});

// --- formatTimeGT -------------------------------------------------------

test('formatTimeGT: 00:05', () => {
  assert.equal(formatTimeGT(new Date(2026, 8, 8, 0, 5)), '00:05');
});

test('formatTimeGT: 09:07', () => {
  assert.equal(formatTimeGT(new Date(2026, 8, 8, 9, 7)), '09:07');
});

test('formatTimeGT: 15:30', () => {
  assert.equal(formatTimeGT(new Date(2026, 8, 8, 15, 30)), '15:30');
});

test('formatTimeGT: 23:59', () => {
  assert.equal(formatTimeGT(new Date(2026, 8, 8, 23, 59)), '23:59');
});

test('formatTimeGT: Date inválido -> lanza error', () => {
  assert.throws(() => formatTimeGT(new Date(NaN)), /inválida/);
});

// --- formatStayRange ------------------------------------------------------

test('formatStayRange: 10 -> 15 septiembre 2026', () => {
  const checkIn = new Date(2026, 8, 10);
  const checkOut = new Date(2026, 8, 15);
  assert.equal(formatStayRange(checkIn, checkOut), '10-09-2026 – 15-09-2026');
});

test('formatStayRange: rango invertido -> lanza error', () => {
  const checkIn = new Date(2026, 8, 15);
  const checkOut = new Date(2026, 8, 10);
  assert.throws(() => formatStayRange(checkIn, checkOut), /inválido/);
});

test('formatStayRange: Date inválido -> lanza error', () => {
  const checkIn = new Date(2026, 8, 10);
  assert.throws(() => formatStayRange(checkIn, new Date(NaN)), /inválida/);
});

// --- calculateNights --------------------------------------------------

test('calculateNights: 10 -> 15 septiembre = 5', () => {
  const checkIn = new Date(2026, 8, 10);
  const checkOut = new Date(2026, 8, 15);
  assert.equal(calculateNights(checkIn, checkOut), 5);
});

test('calculateNights: mismo día = 0', () => {
  const day = new Date(2026, 8, 10);
  assert.equal(calculateNights(day, day), 0);
});

test('calculateNights: 30 septiembre -> 2 octubre = 2 (cruce de mes)', () => {
  const checkIn = new Date(2026, 8, 30);
  const checkOut = new Date(2026, 9, 2);
  assert.equal(calculateNights(checkIn, checkOut), 2);
});

test('calculateNights: 31 diciembre 2026 -> 2 enero 2027 = 2 (cruce de año)', () => {
  const checkIn = new Date(2026, 11, 31);
  const checkOut = new Date(2027, 0, 2);
  assert.equal(calculateNights(checkIn, checkOut), 2);
});

test('calculateNights: salida anterior a la entrada lanza, no devuelve noches negativas', () => {
  // Contrato de dominio: la presentación valida antes de llamar (ReservationFormModal).
  const checkIn = new Date(2024, 8, 8);
  const checkOut = new Date(2024, 8, 2);
  assert.throws(() => calculateNights(checkIn, checkOut), /inválido/);
});

test('calculateNights: rango invertido -> lanza error, nunca negativo', () => {
  const checkIn = new Date(2026, 8, 15);
  const checkOut = new Date(2026, 8, 10);
  assert.throws(() => calculateNights(checkIn, checkOut), /inválido/);
});

test('calculateNights: Date inválido -> lanza error', () => {
  assert.throws(() => calculateNights(new Date(NaN), new Date(2026, 8, 10)), /inválida/);
});

// --- isSameCalendarDay ------------------------------------------------

test('isSameCalendarDay: mismo día, distinta hora -> true', () => {
  const morning = new Date(2026, 8, 10, 6, 0);
  const night = new Date(2026, 8, 10, 23, 45);
  assert.equal(isSameCalendarDay(morning, night), true);
});

test('isSameCalendarDay: días distintos, aunque estén a una hora de diferencia -> false', () => {
  const lateNight = new Date(2026, 8, 10, 23, 30);
  const earlyNextDay = new Date(2026, 8, 11, 0, 30);
  assert.equal(isSameCalendarDay(lateNight, earlyNextDay), false);
});

test('isSameCalendarDay: cruce de mes -> false', () => {
  assert.equal(isSameCalendarDay(new Date(2026, 8, 30), new Date(2026, 9, 1)), false);
});

test('isSameCalendarDay: Date inválido -> lanza error', () => {
  assert.throws(() => isSameCalendarDay(new Date(NaN), new Date(2026, 8, 10)), /inválida/);
});

// --- Días calendario, no diferencia cruda de milisegundos -----------------

test('calculateNights: usa días calendario, no la diferencia cruda en milisegundos', () => {
  // checkIn: 10 de septiembre, 23:30 local. checkOut: 11 de septiembre, 00:30
  // local. La diferencia real en tiempo de reloj es de apenas una hora
  // (3 600 000 ms), así que (checkOut.getTime() - checkIn.getTime()) /
  // 86 400 000 daría ~0.0417 noches: un resultado fraccionario y, para un
  // PMS, incorrecto. Como son dos días calendario distintos, el resultado
  // correcto es exactamente 1 noche.
  const checkIn = new Date(2026, 8, 10, 23, 30);
  const checkOut = new Date(2026, 8, 11, 0, 30);

  const rawMsDiffInDays = (checkOut.getTime() - checkIn.getTime()) / (24 * 60 * 60 * 1000);
  assert.notEqual(rawMsDiffInDays, 1, 'la diferencia cruda en ms no debería dar ya 1 por sí sola');

  assert.equal(calculateNights(checkIn, checkOut), 1);
});

test('calculateNights: siempre devuelve un entero exacto, sin importar la hora de cada fecha', () => {
  const checkIn = new Date(2026, 8, 10, 6, 45);
  const checkOut = new Date(2026, 8, 15, 19, 10);
  const nights = calculateNights(checkIn, checkOut);
  assert.equal(nights, 5);
  assert.ok(Number.isInteger(nights));
});

// --- toDomainCalendarDate / toDtoCalendarDate ------------------------------
//
// These check the civil-day components survive intact, not the machine's
// timezone. They must pass the same way regardless of which timezone runs
// them.

test('toDomainCalendarDate: "2026-09-10" conserva año/mes/día locales', () => {
  const date = toDomainCalendarDate('2026-09-10');
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 8);
  assert.equal(date.getDate(), 10);
});

test('toDtoCalendarDate: 10 de septiembre de 2026 -> "2026-09-10"', () => {
  assert.equal(toDtoCalendarDate(new Date(2026, 8, 10)), '2026-09-10');
});

test('round trip: "YYYY-MM-DD" -> Date -> "YYYY-MM-DD"', () => {
  const original = '2026-09-10';
  assert.equal(toDtoCalendarDate(toDomainCalendarDate(original)), original);
});

test('toDomainCalendarDate: rechaza "10-09-2026" (formato de presentación, no de transporte)', () => {
  assert.throws(() => toDomainCalendarDate('10-09-2026'), /YYYY-MM-DD/);
});

test('toDomainCalendarDate: rechaza "2026/09/10"', () => {
  assert.throws(() => toDomainCalendarDate('2026/09/10'), /YYYY-MM-DD/);
});

test('toDomainCalendarDate: rechaza cadena vacía', () => {
  assert.throws(() => toDomainCalendarDate(''), /YYYY-MM-DD/);
});

test('toDomainCalendarDate: rechaza "2026-02-30" (30 de febrero no existe)', () => {
  assert.throws(() => toDomainCalendarDate('2026-02-30'), /no existe/);
});

test('toDomainCalendarDate: rechaza "2026-13-01" (mes 13 no existe)', () => {
  assert.throws(() => toDomainCalendarDate('2026-13-01'), /no existe/);
});

test('toDomainCalendarDate: rechaza "2026-00-10" (mes 0 no existe)', () => {
  assert.throws(() => toDomainCalendarDate('2026-00-10'), /no existe/);
});

test('toDomainCalendarDate: rechaza "2026-04-31" (abril tiene 30 días)', () => {
  assert.throws(() => toDomainCalendarDate('2026-04-31'), /no existe/);
});

test('toDomainCalendarDate: rechaza años de dos dígitos ("0026") en vez de desplazarlos a 1926', () => {
  // El constructor de Date interpreta new Date(26, ...) como el año 1926
  // (regla heredada para años 0-99). La verificación de ida y vuelta de
  // toDomainCalendarDate detecta ese desajuste (1926 !== 26) y lanza en vez
  // de aceptar un año silenciosamente incorrecto.
  assert.throws(() => toDomainCalendarDate('0026-09-10'), /no existe/);
});

test('toDtoCalendarDate: Date inválido -> lanza error', () => {
  assert.throws(() => toDtoCalendarDate(new Date(NaN)), /válido/);
});

// --- Mappers: los campos civiles usan el contrato de calendario ------------

test('booking.mapper: check_in/check_out en YYYY-MM-DD llegan al Model conservando el día civil', () => {
  const dto = {
    id: 'booking-1',
    confirmation_code: 'AUR-1',
    guest_id: 'guest-1',
    room_id: 'room-1',
    room_type_id: 'rt-1',
    rate_id: 'rate-1',
    check_in: '2026-09-10',
    check_out: '2026-09-15',
    status: 'confirmed',
    adults: 2,
    children: 0,
    total_amount_cents: 100000,
    currency: 'GTQ',
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
  };

  const model = bookingMapper.toDomain(dto);
  assert.equal(model.checkIn.getFullYear(), 2026);
  assert.equal(model.checkIn.getMonth(), 8);
  assert.equal(model.checkIn.getDate(), 10);
  assert.equal(model.checkOut.getDate(), 15);

  const roundTrip = bookingMapper.toDTO(model);
  assert.equal(roundTrip.check_in, '2026-09-10');
  assert.equal(roundTrip.check_out, '2026-09-15');
});

test('rate.mapper: valid_from/valid_to en YYYY-MM-DD llegan al Model conservando el día civil', () => {
  const dto = {
    id: 'rate-1',
    room_type_id: 'rt-1',
    name: 'Tarifa base',
    valid_from: '2026-01-01',
    valid_to: '2026-12-31',
    price_cents: 65000,
    currency: 'GTQ',
    minimum_nights: 1,
    refundable: true,
    active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };

  const model = rateMapper.toDomain(dto);
  assert.equal(model.validFrom.getDate(), 1);
  assert.equal(model.validFrom.getMonth(), 0);
  assert.equal(model.validTo.getDate(), 31);
  assert.equal(model.validTo.getMonth(), 11);

  const roundTrip = rateMapper.toDTO(model);
  assert.equal(roundTrip.valid_from, '2026-01-01');
  assert.equal(roundTrip.valid_to, '2026-12-31');
});

test('promotion.mapper: valid_from/valid_to en YYYY-MM-DD llegan al Model conservando el día civil', () => {
  const dto = {
    id: 'promo-1',
    code: 'AURORA10',
    name: 'Escapada Aurora',
    description: '10% de descuento',
    discount_percent: 10,
    valid_from: '2026-09-01',
    valid_to: '2026-11-30',
    active: true,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  };

  const model = promotionMapper.toDomain(dto);
  assert.equal(model.validFrom.getDate(), 1);
  assert.equal(model.validFrom.getMonth(), 8);
  assert.equal(model.validTo.getDate(), 30);
  assert.equal(model.validTo.getMonth(), 10);

  const roundTrip = promotionMapper.toDTO(model);
  assert.equal(roundTrip.valid_from, '2026-09-01');
  assert.equal(roundTrip.valid_to, '2026-11-30');
});

// --- D-010: zona fija America/Guatemala (UTC-6, sin DST) -------------------

test('TZ America/Guatemala: "2026-09-17" sobrevive DTO -> Model -> display sin desplazarse', () => {
  const model = toDomainCalendarDate('2026-09-17');
  assert.equal(formatDateGT(model), '17-09-2026');
  assert.equal(toDtoCalendarDate(model), '2026-09-17');
});

test('TZ America/Guatemala: un instante de las 20:00 locales cae en el día correcto', () => {
  // 2026-09-17T20:00 en UTC-6 es 2026-09-18T02:00Z: si algo formateara este
  // instante por UTC en vez de por hora local, mostraría el 18, no el 17.
  const instant = new Date(2026, 8, 17, 20, 0, 0);
  assert.equal(instant.toISOString(), '2026-09-18T02:00:00.000Z');
  assert.equal(formatDateGT(instant), '17-09-2026');
});

test('TZ America/Guatemala: calculateNights entre dos fechas de calendario no se ve afectado por la hora', () => {
  const checkIn = toDomainCalendarDate('2026-09-17');
  const checkOut = toDomainCalendarDate('2026-09-20');
  assert.equal(calculateNights(checkIn, checkOut), 3);
});

// --- D-010: barrido estático, respaldo de lo que el linter no puede decidir
// sin información de tipos (D-010, ver eslint.config.js) ---------------------
//
// src/shared/types/common.ts y src/shared/utils/date.ts son los únicos
// lugares permitidos de conversión Date<->string del contrato. Los 3
// archivos de front-desk están temporalmente exceptuados (ver
// docs/DECISIONES.md D-010): tienen trabajo en vuelo hoy y no se tocan en
// esta rama para no generar conflictos, pero ya llevan el patrón prohibido.

const DATE_SAFETY_EXEMPT = new Set([
  path.normalize('src/shared/types/common.ts'),
  path.normalize('src/shared/utils/date.ts'),
  path.normalize('src/modules/front-desk/components/workspace/ReceptionContent.tsx'),
  path.normalize('src/modules/front-desk/components/workspace/ReceptionModals.tsx'),
  path.normalize('src/modules/front-desk/components/workspace/ReservationDetail.tsx'),
]);

async function collectSourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(full)));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

test('D-010: ningún archivo fuera de los helpers de fecha usa .toISOString().slice(...)', async () => {
  const files = (await collectSourceFiles('src')).filter((file) => !DATE_SAFETY_EXEMPT.has(file));
  const offenders = [];
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    if (/\.toISOString\(\)\s*\.slice\(/.test(content)) offenders.push(file);
  }
  assert.deepEqual(offenders, [], `usan .toISOString().slice(...): ${offenders.join(', ')}`);
});

test('D-010: ningún archivo fuera de los helpers de fecha cuenta noches restando milisegundos crudos (/86400000)', async () => {
  const files = (await collectSourceFiles('src')).filter((file) => !DATE_SAFETY_EXEMPT.has(file));
  const offenders = [];
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    if (/86400000/.test(content)) offenders.push(file);
  }
  assert.deepEqual(
    offenders,
    [],
    `usan /86400000 en vez de calculateNights: ${offenders.join(', ')}`,
  );
});
