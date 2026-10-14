import { build } from 'esbuild';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const sourceRoot = 'src';
const sourceExtensions = new Set(['.ts', '.tsx']);
const importPattern = /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;

async function collectFiles(dir, predicate) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(full, predicate)));
    } else if (!predicate || predicate(full)) {
      files.push(full);
    }
  }
  return files;
}

function toPosix(value) {
  return value.replace(/\\/g, '/');
}

function resolveImportTarget(file, specifier) {
  if (specifier.startsWith('@/')) return `src/${specifier.slice(2)}`;
  if (!specifier.startsWith('.')) return specifier;
  return toPosix(path.normalize(path.join(path.dirname(file), specifier)));
}

async function collectSourceImports() {
  const files = await collectFiles(sourceRoot, (file) => sourceExtensions.has(path.extname(file)));
  const imports = [];
  for (const file of files) {
    const normalizedFile = toPosix(file);
    const content = await readFile(file, 'utf8');
    for (const match of content.matchAll(importPattern)) {
      imports.push({
        file: normalizedFile,
        specifier: match[1],
        target: resolveImportTarget(normalizedFile, match[1]),
      });
    }
  }
  return imports;
}

test('INT-FINAL: nadie depende de src/data/db y el archivo productivo ya no existe', async () => {
  assert.equal(existsSync('src/data/db.ts'), false, 'src/data/db.ts debe estar eliminado');
  const offenders = (await collectSourceImports())
    .filter(({ target }) => target.startsWith('src/data/db'))
    .map(({ file }) => file);

  assert.deepEqual(
    offenders,
    [],
    `Flujos que dependen accidentalmente de src/data/db: ${offenders.join(', ')}`,
  );
});

test('INT-13: servicios integrados no hacen fallback silencioso a mocks', async () => {
  const integratedFiles = [
    'src/services/bookingService.ts',
    'src/services/guestService.ts',
    'src/services/roomService.ts',
    'src/services/publicBookingCatalogService.ts',
  ];
  const offenders = [];

  for (const file of integratedFiles) {
    const content = await readFile(file, 'utf8');
    if (/\bisOfflineError\b/.test(content)) offenders.push(`${file}: isOfflineError`);
  }

  assert.deepEqual(
    offenders,
    [],
    `Los servicios integrados deben propagar errores del backend y no volver a mocks: ${offenders.join(', ')}`,
  );
});

test('#127: la web pública solo usa los contratos /public del backend', async () => {
  const service = await readFile('src/services/publicBookingCatalogService.ts', 'utf8');
  const paths = [...service.matchAll(/httpClient\.\w+<[^>]*>\(\s*[`'"]([^`'"?]+)/g)].map(
    (match) => match[1],
  );
  assert.ok(paths.length > 0, 'publicBookingCatalogService debe llamar al backend');
  assert.deepEqual(
    paths.filter((target) => !target.startsWith('/public/')),
    [],
    'publicBookingCatalogService solo puede llamar rutas /public/*',
  );
  assert.equal(
    /mockPersistence|shared\/mocks|@\/data\//.test(service),
    false,
    'publicBookingCatalogService no puede leer datos locales',
  );

  const screens = await collectFiles('src/modules/booking-engine', (file) =>
    sourceExtensions.has(path.extname(file)),
  );
  const offenders = [];
  for (const file of screens) {
    const content = await readFile(file, 'utf8');
    if (/services\/(bookingService|guestService|roomService)['"]/.test(content)) {
      offenders.push(toPosix(file));
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `El motor público no debe usar servicios privados de reservas/huéspedes/habitaciones: ${offenders.join(', ')}`,
  );
});

test('INT-13: no hay clientes HTTP alternativos ni llamadas fetch fuera del cliente central', async () => {
  const files = await collectFiles(sourceRoot, (file) => sourceExtensions.has(path.extname(file)));
  const offenders = [];
  for (const file of files) {
    const normalizedFile = toPosix(file);
    const content = await readFile(file, 'utf8');
    const usesAlternateClient = /\baxios\b|XMLHttpRequest|new\s+Request\s*\(|\bfetch\s*\(/.test(
      content,
    );
    if (usesAlternateClient && normalizedFile !== 'src/services/http-client.ts') {
      offenders.push(normalizedFile);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `Usar httpClient en vez de fetch/axios/XMLHttpRequest fuera de src/services/http-client.ts: ${offenders.join(', ')}`,
  );
});

test('INT-13: variables de entorno documentadas para backend real', async () => {
  const envExample = await readFile('.env.example', 'utf8');
  const readme = await readFile('README.md', 'utf8');

  assert.match(envExample, /^VITE_API_BASE_URL=http:\/\/localhost:8080\/api\/v1$/m);
  assert.match(readme, /VITE_API_BASE_URL=http:\/\/localhost:8080\/api\/v1/);
  assert.match(readme, /backend/i);
  assert.match(readme, /PostgreSQL/i);
});

await mkdir('.cache', { recursive: true });
await build({
  stdin: {
    contents: "export { HttpClient, HttpError } from './src/services/http-client';",
    resolveDir: '.',
    loader: 'ts',
  },
  outfile: '.cache/http-client-harness.cjs',
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
const { HttpClient, HttpError } = require(require.resolve('../.cache/http-client-harness.cjs'));

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 409 ? 'Conflict' : status === 404 ? 'Not Found' : 'Forbidden',
    headers: { 'content-type': 'application/json' },
  });
}

test('INT-13: 403, 404 y 409 se propagan como HttpError con payload backend', async () => {
  const client = new HttpClient();
  const statuses = [403, 404, 409];

  for (const status of statuses) {
    globalThis.fetch = async () => jsonResponse(status, { message: `error-${status}` });
    await assert.rejects(
      () => client.get('/admin/protected'),
      (error) => {
        assert.ok(error instanceof HttpError);
        assert.equal(error.status, status);
        assert.deepEqual(error.data, { message: `error-${status}` });
        return true;
      },
    );
  }
});

test('INT-13: 401 protegido refresca una vez y reintenta con el token nuevo', async () => {
  const client = new HttpClient();
  const calls = [];
  client.setToken('expired-token');
  client.setRefreshHandler(async () => 'fresh-token');
  globalThis.fetch = async (_url, init) => {
    calls.push(init?.headers?.get('Authorization'));
    if (calls.length === 1) return jsonResponse(401, { message: 'expired' });
    return jsonResponse(200, { ok: true });
  };

  assert.deepEqual(await client.get('/admin/protected'), { ok: true });
  assert.deepEqual(calls, ['Bearer expired-token', 'Bearer fresh-token']);
});
