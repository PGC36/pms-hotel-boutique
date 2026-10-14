import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { create, act } from 'react-test-renderer';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { DataTable } from '@/shared/components/DataTable';
import { Pagination } from '@/shared/components/Pagination';
import { ErrorState } from '@/shared/components/ErrorState';
import { LoadingState } from '@/shared/components/LoadingState';
import { Card } from '@/shared/components/Card';
import { Badge } from '@/shared/components/Badge';
import { router as configuredRouter } from '@/app/router';

let view;
let router;
afterEach(() => {
  if (view) act(() => view.unmount());
  router?.dispose();
});
const render = (node) =>
  act(() => {
    view = create(node);
  });
const button = (label) =>
  view.root.findAllByType('button').find((item) => item.children.includes(label));
const cells = () =>
  view.root
    .findByType('tbody')
    .findAllByType('tr')
    .map((row) => row.findAllByType('td')[0].children.join(''));
const columns = [
  { id: 'value', header: 'Valor', cell: (row) => String(row.value), sortValue: (row) => row.value },
];
const data = [10, 2, 30, 4, 50, 6].map((value, id) => ({ id, value }));
const table = (rows = data) => (
  <DataTable columns={columns} data={rows} getRowId={(row) => row.id} pageSize={2} />
);

test('table sorts numbers over all data, resets pagination and does not mutate input', () => {
  const original = JSON.stringify(data);
  render(table());
  assert.deepEqual(cells(), ['10', '2']);
  act(() => button('Siguiente').props.onClick());
  assert.deepEqual(cells(), ['30', '4']);
  act(() => view.root.findByProps({ 'aria-label': 'Ordenar por Valor' }).props.onClick());
  assert.deepEqual(cells(), ['2', '4']);
  assert.equal(view.root.findByType('th').props['aria-sort'], 'ascending');
  act(() => view.root.findByProps({ 'aria-label': 'Ordenar por Valor' }).props.onClick());
  assert.deepEqual(cells(), ['50', '30']);
  assert.equal(view.root.findByType('th').props['aria-sort'], 'descending');
  assert.equal(JSON.stringify(data), original);
});

test('shrinking data clamps the page, empty data shows a state and restored rows render', () => {
  render(table());
  act(() => button('Siguiente').props.onClick());
  act(() => button('Siguiente').props.onClick());
  act(() => view.update(table(data.slice(0, 1))));
  assert.deepEqual(cells(), ['10']);
  act(() => view.update(table([])));
  assert.equal(view.root.findAllByType('table').length, 0);
  assert.ok(JSON.stringify(view.toJSON()).includes('No hay registros'));
  act(() => view.update(table()));
  assert.deepEqual(cells(), ['10', '2']);
});

test('pagination clamps invalid pages and prevents out-of-range callbacks', () => {
  const calls = [];
  render(<Pagination currentPage={-3} totalPages={3} onPageChange={(page) => calls.push(page)} />);
  assert.equal(button('Anterior').props.disabled, true);
  act(() => button('Anterior').props.onClick());
  act(() => button('Siguiente').props.onClick());
  assert.deepEqual(calls, [2]);
  act(() =>
    view.update(
      <Pagination currentPage={99} totalPages={3} onPageChange={(page) => calls.push(page)} />,
    ),
  );
  assert.equal(button('Siguiente').props.disabled, true);
  act(() => button('Siguiente').props.onClick());
  assert.deepEqual(calls, [2]);
  act(() => view.update(<Pagination currentPage={1} totalPages={1} onPageChange={() => {}} />));
  assert.equal(view.toJSON(), null);
});

test('error retry waits, suppresses duplicates and exposes failure for another attempt', async () => {
  let reject;
  let calls = 0;
  render(
    <ErrorState
      onRetry={() => {
        calls++;
        return new Promise((_, fail) => {
          reject = fail;
        });
      }}
    />,
  );
  let pending;
  act(() => {
    pending = button('Reintentar').props.onClick();
  });
  assert.equal(button('Reintentando…').props.disabled, true);
  await act(async () => {
    await button('Reintentando…').props.onClick();
  });
  assert.equal(calls, 1);
  await act(async () => {
    reject(new Error('failure'));
    await pending;
  });
  assert.ok(JSON.stringify(view.toJSON()).includes('El reintento falló'));
  assert.equal(button('Reintentar').props.disabled, false);
});

test('loading is announced and card supports header, footer and readable badges', () => {
  render(
    <Card title="Resumen" footer={<Badge tone="success">Disponible</Badge>}>
      <LoadingState label="Cargando habitaciones" />
    </Card>,
  );
  assert.equal(view.root.findByProps({ role: 'status' }).props['aria-live'], 'polite');
  assert.ok(JSON.stringify(view.toJSON()).includes('Disponible'));
  assert.equal(view.root.findByType('h3').children[0], 'Resumen');
});

test('catalog route renders variants and retry actually recovers service data', async () => {
  router = createMemoryRouter(configuredRouter.routes, { initialEntries: ['/components'] });
  await act(async () => {
    view = create(<RouterProvider router={router} />);
    await new Promise((resolve) => setTimeout(resolve, 450));
  });
  assert.equal(router.state.errors, null);
  assert.equal(view.root.findAllByType('table').length, 1);
  assert.ok(JSON.stringify(view.toJSON()).includes('Componentes de formulario'));
  assert.ok(JSON.stringify(view.toJSON()).includes('DatePickerRange'));
  await act(async () => {
    await button('Reintentar').props.onClick();
  });
  assert.ok(JSON.stringify(view.toJSON()).includes('13'));
  assert.ok(JSON.stringify(view.toJSON()).includes('Solicitud completada'));
  await act(async () => {
    await button('Reproducir error').props.onClick();
  });
  assert.ok(button('Reintentar'));
  act(() => button('Mostrar tabla vacía').props.onClick());
  assert.equal(view.root.findAllByType('table').length, 0);
});
