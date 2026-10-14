import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { HttpClient, resolveApiBaseUrl } from '@/services/http-client';

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
