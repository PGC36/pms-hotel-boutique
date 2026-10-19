import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import {
  getControlledBackendMessage,
  getUserFacingErrorMessage,
  HttpClient,
  HttpError,
  resolveApiBaseUrl,
} from '@/services/http-client';

const originalFetch = globalThis.fetch;

function setOrigin(origin) {
  globalThis.window = { location: { origin } };
}

afterEach(() => {
  delete globalThis.window;
  globalThis.fetch = originalFetch;
});

for (const base of ['/api/v1', '/api/v1/']) {
  test(`base relativa "${base}" se resuelve contra el origen de la página`, () => {
    setOrigin('https://hotel.example');
    const resolved = resolveApiBaseUrl(base);
    assert.equal(resolved, 'https://hotel.example/api/v1/');
    assert.equal(new URL('auth/login', resolved).href, 'https://hotel.example/api/v1/auth/login');
  });

  test(`base relativa "${base}" sin window usa http://localhost`, () => {
    const resolved = resolveApiBaseUrl(base);
    assert.equal(resolved, 'http://localhost/api/v1/');
    assert.equal(new URL('auth/login', resolved).href, 'http://localhost/api/v1/auth/login');
  });
}

test('base absoluta queda igual aunque haya window', () => {
  setOrigin('https://hotel.example');
  for (const base of ['http://localhost:8080/api/v1', 'http://localhost:8080/api/v1/']) {
    const resolved = resolveApiBaseUrl(base);
    assert.equal(resolved, 'http://localhost:8080/api/v1/');
    assert.equal(new URL('auth/login', resolved).href, 'http://localhost:8080/api/v1/auth/login');
  }
});

test('window sin location.origin cae en http://localhost', () => {
  globalThis.window = { location: { search: '' } };
  assert.equal(resolveApiBaseUrl('/api/v1'), 'http://localhost/api/v1/');
});

test('HttpClient con VITE_API_BASE_URL relativa llama a la URL absoluta', async () => {
  setOrigin('https://hotel.example');
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const client = new HttpClient();
  assert.deepEqual(await client.post('/auth/login', { email: 'a', password: 'b' }), { ok: true });
  await client.get('guest/stay');

  assert.deepEqual(calls, [
    'https://hotel.example/api/v1/auth/login',
    'https://hotel.example/api/v1/guest/stay',
  ]);
});

test('el error 500 expone el motivo controlado del backend sin prefijo técnico', () => {
  const error = new HttpError(500, 'Internal Server Error', {
    timestamp: '2026-10-19T10:00:00Z',
    status: 500,
    error: 'Internal Server Error',
    message: 'No hay una jornada de caja abierta para este hotel.',
    path: '/api/v1/cash-sessions/current',
  });

  assert.equal(error.message, 'No hay una jornada de caja abierta para este hotel.');
});

test('ignora excepciones y respuestas genéricas, pero conserva el detalle útil anidado', () => {
  assert.equal(
    getControlledBackendMessage({
      message: 'An unexpected error occurred',
      error: { detail: 'El producto está inactivo en el inventario.' },
    }),
    'El producto está inactivo en el inventario.',
  );

  const error = new HttpError(500, 'Internal Server Error', {
    message: 'java.lang.IllegalStateException: database transaction failed',
    trace: ' at org.springframework.Service.run(Service.java:10)',
  });
  assert.equal(error.message, 'No pudimos completar la operación. Intenta nuevamente.');
  assert.doesNotMatch(
    getUserFacingErrorMessage(error, 'No se pudo guardar.'),
    /HTTP 500|Exception|trace/i,
  );
});

test('los errores de red no filtran el mensaje técnico de fetch', async () => {
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };
  const client = new HttpClient();

  await assert.rejects(
    client.get('/rooms'),
    /No pudimos conectar con el servicio\. Intenta nuevamente\./,
  );
});
