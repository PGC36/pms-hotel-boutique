import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rooms } from './fixtures/domain-fixtures.mjs';

// Verifica la separación de room.status (ocupación, dueña la web) y
// room.housekeeping_status (limpieza, dueña la app móvil) — decisión D-002
// en docs/DECISIONES.md. Sin ella, ambos conceptos se mezclaban en un solo
// campo y no había forma de expresar "libre pero sucia todavía" (el caso
// que no se puede vender aunque la ocupación diga "available").

await mkdir('.cache', { recursive: true });
await build({
  entryPoints: ['src/shared/constants/statuses.ts', 'src/shared/types/entities/room/index.ts'],
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
const load = (relativePath) => {
  const p = require.resolve(`../.cache/${relativePath}.cjs`);
  delete require.cache[p];
  return require(p);
};

const {
  ROOM_STATUSES,
  ROOM_STATUS_TRANSITIONS,
  ROOM_HOUSEKEEPING_STATUSES,
  ROOM_HOUSEKEEPING_STATUS_TRANSITIONS,
  isRoomAssignable,
} = load('shared/constants/statuses');
const roomMapper = load('shared/types/entities/room/index');

const ALL_ROOMS = rooms;

// --- A. Todo registro tiene ambos campos, sin estados sueltos -------------

test('room: todo registro tiene status y housekeeping_status válidos', () => {
  assert.ok(ALL_ROOMS.length > 0);
  for (const room of ALL_ROOMS) {
    // room.status es snake_case de DTO ('out_of_service'); ROOM_STATUSES es
    // el Model camelCase ('outOfService') — se compara vía el mapper, igual
    // que el resto del contrato.
    const { status } = roomMapper.toDomain(room);
    assert.ok(
      ROOM_STATUSES.includes(status),
      `room ${room.id}: status "${room.status}" no está en ROOM_STATUSES`,
    );
    assert.ok(
      typeof room.housekeeping_status === 'string' && room.housekeeping_status.length > 0,
      `room ${room.id}: falta housekeeping_status`,
    );
    assert.ok(
      ROOM_HOUSEKEEPING_STATUSES.includes(room.housekeeping_status),
      `room ${room.id}: housekeeping_status "${room.housekeeping_status}" no está en ROOM_HOUSEKEEPING_STATUSES`,
    );
  }
});

test('room: ya no existe el literal "cleaning" en el campo de ocupación de ningún registro', () => {
  for (const room of ALL_ROOMS) {
    assert.notEqual(
      room.status,
      'cleaning',
      `room ${room.id}: "cleaning" pertenece ahora a housekeeping_status, no a status`,
    );
  }
});

// --- B. isRoomAssignable en las 16 combinaciones posibles ------------------

test('isRoomAssignable: las 6 combinaciones de la FASE 3 dan el resultado esperado', () => {
  const cases = [
    { status: 'available', housekeepingStatus: 'clean', expected: true, label: 'libre y limpia' },
    {
      status: 'available',
      housekeepingStatus: 'dirty',
      expected: false,
      label: 'libre y sucia — el caso crítico que motiva la separación',
    },
    {
      status: 'occupied',
      housekeepingStatus: 'dirty',
      expected: false,
      label: 'ocupada y sucia',
    },
    {
      status: 'occupied',
      housekeepingStatus: 'clean',
      expected: false,
      label: 'ocupada y limpia — igual no asignable: no está libre',
    },
    {
      status: 'maintenance',
      housekeepingStatus: 'clean',
      expected: false,
      label: 'bloqueada por mantenimiento',
    },
    {
      status: 'available',
      housekeepingStatus: 'cleaning',
      expected: false,
      label: 'en proceso de limpieza',
    },
  ];
  for (const { status, housekeepingStatus, expected, label } of cases) {
    assert.equal(
      isRoomAssignable({ status, housekeepingStatus }),
      expected,
      `${label}: status=${status} housekeepingStatus=${housekeepingStatus} debería dar ${expected}`,
    );
  }
});

test('isRoomAssignable: exhaustivo sobre las 16 combinaciones de ambas máquinas', () => {
  for (const status of ROOM_STATUSES) {
    for (const housekeepingStatus of ROOM_HOUSEKEEPING_STATUSES) {
      const expected =
        status === 'available' &&
        (housekeepingStatus === 'clean' || housekeepingStatus === 'inspected');
      assert.equal(
        isRoomAssignable({ status, housekeepingStatus }),
        expected,
        `status=${status} housekeepingStatus=${housekeepingStatus} debería dar ${expected}`,
      );
    }
  }
});

test('isRoomAssignable: coincide con cada registro real del dataset', () => {
  for (const room of ALL_ROOMS) {
    const expected =
      room.status === 'available' &&
      (room.housekeeping_status === 'clean' || room.housekeeping_status === 'inspected');
    const model = roomMapper.toDomain(room);
    assert.equal(
      model.isAssignable,
      expected,
      `room ${room.id}: isAssignable calculado no coincide con la regla`,
    );
  }
});

// --- C. Transiciones inválidas se rechazan en ambas máquinas ---------------

const isValidTransition = (transitions, from, to) => (transitions[from] ?? []).includes(to);

test('ocupación: transiciones válidas e inválidas', () => {
  assert.ok(isValidTransition(ROOM_STATUS_TRANSITIONS, 'available', 'occupied'));
  assert.ok(isValidTransition(ROOM_STATUS_TRANSITIONS, 'occupied', 'available'));
  assert.ok(isValidTransition(ROOM_STATUS_TRANSITIONS, 'available', 'maintenance'));
  assert.ok(isValidTransition(ROOM_STATUS_TRANSITIONS, 'maintenance', 'available'));
  assert.ok(isValidTransition(ROOM_STATUS_TRANSITIONS, 'available', 'outOfService'));
  assert.ok(isValidTransition(ROOM_STATUS_TRANSITIONS, 'outOfService', 'available'));

  assert.ok(
    !isValidTransition(ROOM_STATUS_TRANSITIONS, 'maintenance', 'occupied'),
    'una habitación en mantenimiento no puede pasar directo a ocupada',
  );
  assert.ok(
    !isValidTransition(ROOM_STATUS_TRANSITIONS, 'outOfService', 'occupied'),
    'una habitación fuera de servicio no puede pasar directo a ocupada',
  );
});

test('limpieza: transiciones válidas e inválidas', () => {
  assert.ok(isValidTransition(ROOM_HOUSEKEEPING_STATUS_TRANSITIONS, 'dirty', 'cleaning'));
  assert.ok(isValidTransition(ROOM_HOUSEKEEPING_STATUS_TRANSITIONS, 'cleaning', 'clean'));
  assert.ok(isValidTransition(ROOM_HOUSEKEEPING_STATUS_TRANSITIONS, 'clean', 'inspected'));
  assert.ok(isValidTransition(ROOM_HOUSEKEEPING_STATUS_TRANSITIONS, 'clean', 'dirty'));
  assert.ok(isValidTransition(ROOM_HOUSEKEEPING_STATUS_TRANSITIONS, 'inspected', 'dirty'));

  assert.ok(
    !isValidTransition(ROOM_HOUSEKEEPING_STATUS_TRANSITIONS, 'dirty', 'clean'),
    'no se puede saltar el paso de limpieza en curso',
  );
  assert.ok(
    !isValidTransition(ROOM_HOUSEKEEPING_STATUS_TRANSITIONS, 'cleaning', 'dirty'),
    'una limpieza en curso no vuelve directo a sucia',
  );
  assert.ok(
    !isValidTransition(ROOM_HOUSEKEEPING_STATUS_TRANSITIONS, 'inspected', 'clean'),
    'inspeccionada solo puede volver a sucia (el huésped vuelve a usarla), no a limpia',
  );
});

// --- D. El mapper no pierde campos -----------------------------------------

test('mapper room: toDTO(toDomain(dto)) conserva status y housekeeping_status', () => {
  for (const room of ALL_ROOMS) {
    const model = roomMapper.toDomain(room);
    const roundTripped = roomMapper.toDTO(model);
    assert.equal(
      roundTripped.status,
      room.status,
      `room ${room.id}: status se perdió en el round-trip`,
    );
    assert.equal(
      roundTripped.housekeeping_status,
      room.housekeeping_status,
      `room ${room.id}: housekeeping_status se perdió en el round-trip`,
    );
  }
});

// --- E. Ninguna pantalla reimplementa la regla de asignabilidad -----------
//
// Escaneo estático de todo src/**/*.{ts,tsx}: busca una COMPARACIÓN real
// (`status === 'available'`) que además mencione la limpieza en el mismo
// archivo — no la mera presencia de los literales, que aparece
// legítimamente en los tipos (`room.dto.ts`/`room.model.ts`) y en los
// fixtures de contrato. Si alguien reescribe la regla con un condicional
// suelto en vez de importar `isRoomAssignable`, esa comparación
// aparecerá fuera de `statuses.ts` y esta prueba la atrapa.

async function collectSourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(fullPath)));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

const AVAILABLE_COMPARISON = /status\s*===\s*['"]available['"]/;

test('verificación estática: ninguna pantalla reimplementa la regla de asignabilidad', async () => {
  const ALLOWED = [
    path.normalize('src/shared/constants/statuses.ts'),
    // Documenta en prosa lo que hace isRoomAssignable en su comentario del
    // campo derivado `isAssignable` — no reimplementa la comparación.
    path.normalize('src/shared/types/entities/room/room.model.ts'),
  ];
  const files = await collectSourceFiles('src');
  const offenders = [];
  for (const file of files) {
    if (ALLOWED.includes(path.normalize(file))) continue;
    const content = await readFile(file, 'utf8');
    const comparesAvailable = AVAILABLE_COMPARISON.test(content);
    const mentionsHousekeeping =
      content.includes('housekeepingStatus') || content.includes('housekeeping_status');
    if (comparesAvailable && mentionsHousekeeping) offenders.push(file);
  }
  assert.deepStrictEqual(
    offenders,
    [],
    `estos archivos reimplementan la comparación de asignabilidad fuera de statuses.ts: ${offenders.join(', ')}`,
  );
});
