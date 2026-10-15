import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FILTERED, scrubBreadcrumb, scrubEvent, scrubText } from '@/app/observability/scrub';

const JWT =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhYmMiLCJ0eXBlIjoiZ3Vlc3QifQ.c2lnbmF0dXJhLWRlLXBydWViYQ';
const LINK_CODE = 'GL-AB23CD45';

/** Ningún secreto de la prueba aparece en ninguna parte del evento serializado. */
function assertClean(value) {
  const json = JSON.stringify(value);
  for (const secret of [JWT, LINK_CODE, 'gl-ab23cd45', 'huesped@correo.com', 'S3cret!', 'rt-123']) {
    assert.ok(!json.includes(secret), `"${secret}" sigue en ${json}`);
  }
}

test('quita JWT, Bearer, correos y códigos de vinculación de un texto', () => {
  const text = `Fallo con Bearer ${JWT} para huesped@correo.com y código ${LINK_CODE} / gl-ab23cd45`;
  const scrubbed = scrubText(text);
  assertClean(scrubbed);
  assert.match(scrubbed, /^Fallo con Bearer \[Filtered\] para \[Filtered\]/);
});

test('filtra parámetros de query sensibles y deja los demás', () => {
  const url =
    'https://hotel.example/reserva?checkIn=2026-10-20&token=rt-123&code=GL-AB23CD45&adults=2&email=huesped%40correo.com';
  assert.equal(
    scrubText(url),
    `https://hotel.example/reserva?checkIn=2026-10-20&token=${FILTERED}&code=${FILTERED}&adults=2&email=${FILTERED}`,
  );
});

test('scrubEvent quita Authorization, cookies, cuerpo, usuario y secretos en todo el evento', () => {
  const event = {
    type: undefined,
    message: `Error con ${JWT}`,
    user: { ip_address: '203.0.113.7', email: 'huesped@correo.com' },
    request: {
      url: 'https://hotel.example/api/v1/guest/auth/link?code=GL-AB23CD45',
      headers: {
        Authorization: `Bearer ${JWT}`,
        Cookie: 'refresh=rt-123',
        'User-Agent': 'Firefox',
      },
      cookies: { refresh: 'rt-123' },
      data: { code: LINK_CODE, password: 'S3cret!' },
      query_string: 'code=GL-AB23CD45&page=2',
    },
    exception: { values: [{ type: 'Error', value: `Código ${LINK_CODE} inválido` }] },
    breadcrumbs: [
      {
        category: 'fetch',
        data: { url: '/api/v1/auth/refresh?token=rt-123', method: 'POST', status_code: 401 },
      },
      { category: 'console', message: `login de huesped@correo.com con ${JWT}` },
    ],
    extra: {
      body: { password: 'S3cret!' },
      nested: { accessToken: JWT, refreshToken: 'rt-123', ok: 'sí' },
    },
    contexts: { state: { linkCode: LINK_CODE } },
    tags: { route: '/reserva' },
  };
  const scrubbed = scrubEvent(event);
  assertClean(scrubbed);
  assert.equal(scrubbed.user, undefined);
  assert.equal(scrubbed.request.headers.Authorization, FILTERED);
  assert.equal(scrubbed.request.headers.Cookie, FILTERED);
  assert.equal(scrubbed.request.headers['User-Agent'], 'Firefox');
  assert.equal(scrubbed.request.data, undefined);
  assert.equal(scrubbed.request.cookies, undefined);
  assert.equal(scrubbed.breadcrumbs[0].data.status_code, 401);
  assert.equal(scrubbed.extra.nested.ok, 'sí');
  assert.equal(scrubbed.tags.route, '/reserva');
  // No muta el evento original.
  assert.equal(event.request.headers.Authorization, `Bearer ${JWT}`);
});

test('scrubBreadcrumb limpia mensaje y datos', () => {
  const breadcrumb = scrubBreadcrumb({
    category: 'navigation',
    message: `ir a /portal?code=${LINK_CODE}`,
    data: { from: '/login', to: `/portal?token=${JWT}` },
  });
  assertClean(breadcrumb);
  assert.equal(breadcrumb.data.from, '/login');
});
