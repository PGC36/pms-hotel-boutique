import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { create, act } from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';
import { ReservationFormModal } from '@/modules/front-desk/components/workspace/ReceptionModals';
import { PrivateWorkspace } from '@/private/workspace/PrivateWorkspace';
import { calculateNights } from '@/shared/utils/date';
import { toDomainCalendarDate } from '@/shared/types/common';

// Entorno mínimo para los servicios mock (mismo patrón que tests/auth.test.jsx).
const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};
globalThis.window = Object.assign(new EventTarget(), {
  setTimeout: (callback, delay) => setTimeout(callback, delay).unref(),
  clearTimeout,
  scrollY: 0,
  location: { search: '' },
});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let view;
afterEach(() => {
  if (view) act(() => view.unmount());
  view = undefined;
});

const text = (node) =>
  typeof node === 'string' ? node : (node?.children ?? []).map(text).join('');
const hasClass = (node, name) =>
  typeof node.props?.className === 'string' && node.props.className.split(/\s+/).includes(name);
const buttons = (label, root = view.root) =>
  root.findAll((node) => node.type === 'button' && text(node).includes(label));
const settle = (ms = 700) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

// --- Recepción: ReservationFormModal ------------------------------------

const INVALID_RANGE =
  'Rango de fechas no válido. La fecha de salida debe ser posterior a la fecha de entrada.';
const rooms = [
  {
    id: 1,
    number: '101',
    floor: 'Piso 1',
    type: 'Estándar',
    capacity: 2,
    rate: 500,
    status: 'Disponible',
    features: [],
  },
];
// Igual que recNights en PrivateWorkspace: pasa por calculateNights, que lanza ante un rango inválido.
const nights = (checkIn, checkOut) =>
  Math.max(1, calculateNights(toDomainCalendarDate(checkIn), toDomainCalendarDate(checkOut)));

function renderReservationForm() {
  const saved = [];
  act(() => {
    view = create(
      <ReservationFormModal
        nextCode="AUR-TEST"
        rooms={rooms}
        hasConflict={() => false}
        isRoomBlocked={() => false}
        onSave={(reservation) => saved.push(reservation)}
        onClose={() => {}}
        nights={nights}
        folioTotals={() => ({ charges: 0, deposits: 0, payments: 0, balance: 0 })}
      />,
    );
  });
  return saved;
}
const dateInputs = () =>
  view.root.findAll((node) => node.type === 'input' && node.props.type === 'date');
const setDates = (checkIn, checkOut) => {
  const [checkInInput, checkOutInput] = dateInputs();
  act(() => checkInInput.props.onChange({ target: { value: checkIn } }));
  act(() => checkOutInput.props.onChange({ target: { value: checkOut } }));
};
const dateAlert = () =>
  view.root.findAll((node) => node.props.role === 'alert').map((node) => text(node));
const formIsOpen = () => text(view.root).includes('Crear reserva manual');
const ratePreview = () => view.root.findAll((node) => hasClass(node, 'rc-rate-preview'));
const fillGuestAndRoom = () => {
  const [name, lastName, phone] = view.root.findAll(
    (node) => node.type === 'input' && hasClass(node, 'rc-input') && node.props.type !== 'date',
  );
  act(() => name.props.onChange({ target: { value: 'Ana' } }));
  act(() => lastName.props.onChange({ target: { value: 'López' } }));
  act(() => phone.props.onChange({ target: { value: '5555-0000' } }));
  act(() => buttons('Hab. 101')[0].props.onClick());
};

for (const [label, checkIn, checkOut, message] of [
  ['salida anterior a la entrada', '2024-09-08', '2024-09-02', INVALID_RANGE],
  ['misma fecha de entrada y salida', '2024-09-08', '2024-09-08', INVALID_RANGE],
  ['fecha de salida vacía', '2024-09-08', '', 'Fechas obligatorias'],
  ['fecha de entrada vacía', '', '2024-09-08', 'Fechas obligatorias'],
]) {
  test(`reserva manual: ${label} muestra error inline sin tumbar la app ni guardar`, () => {
    const saved = renderReservationForm();
    fillGuestAndRoom();
    assert.doesNotThrow(() => setDates(checkIn, checkOut));
    assert.ok(formIsOpen(), 'el modal sigue abierto');
    assert.deepEqual(dateAlert(), [message]);
    assert.equal(ratePreview().length, 0, 'no calcula tarifa con noches inválidas');
    const summary = buttons('Ver resumen')[0];
    assert.equal(summary.props.disabled, true);
    act(() => summary.props.onClick());
    assert.ok(formIsOpen(), 'no avanza al resumen');
    assert.equal(saved.length, 0);
  });
}

test('reserva manual: al corregir las fechas se recupera el flujo y guarda 2 noches', () => {
  const saved = renderReservationForm();
  fillGuestAndRoom();
  setDates('2024-09-08', '2024-09-02');
  assert.deepEqual(dateAlert(), [INVALID_RANGE]);

  setDates('2024-08-31', '2024-09-02');
  assert.deepEqual(dateAlert(), []);
  assert.match(text(ratePreview()[0]), /× 2 noches/);
  const summary = buttons('Ver resumen')[0];
  assert.equal(summary.props.disabled, false);
  act(() => summary.props.onClick());
  assert.match(text(view.root), /2024-08-31 → 2024-09-02 · 2 noches/);

  act(() => buttons('Confirmar reserva')[0].props.onClick());
  assert.equal(saved.length, 1);
  assert.equal(saved[0].checkIn, '2024-08-31');
  assert.equal(saved[0].checkOut, '2024-09-02');
  assert.equal(saved[0].folio[0].concept, 'Alojamiento 2 noches');
  assert.equal(saved[0].folio[0].amount, 1000);
});

// --- Limpieza: backend falso de HousekeepingController (INT-09) -----------
//
// Replica la regla del backend: cada acción exige un estado de origen exacto y
// responde 400 si no se cumple. La UI nunca debe cambiar sin esa confirmación.

const hkRoom = (id, roomNumber, housekeepingStatus, extra = {}) => ({
  id,
  roomNumber,
  roomTypeId: 'type-standard',
  floor: Number(roomNumber[0]),
  status: 'available',
  housekeepingStatus,
  notes: null,
  updatedAt: '2026-10-03T08:00:00Z',
  ...extra,
});
const hkStayover = (id, roomId, status, description) => ({
  id,
  bookingId: 'booking-1',
  roomId,
  roomNumber: null,
  status,
  description,
  requestedAt: '2026-10-03T09:00:00Z',
  startedAt: status === 'pending' ? null : '2026-10-03T09:10:00Z',
  completedAt: status === 'completed' ? '2026-10-03T09:40:00Z' : null,
  createdAt: '2026-10-03T09:00:00Z',
  updatedAt: '2026-10-03T09:00:00Z',
});

let hkBackend;
let originalFetch;
afterEach(() => {
  if (originalFetch) globalThis.fetch = originalFetch;
  originalFetch = undefined;
});

function installHousekeepingBackend() {
  const state = {
    rooms: [
      hkRoom('room-101', '101', 'dirty'),
      hkRoom('room-102', '102', 'dirty'),
      hkRoom('room-201', '201', 'cleaning', { cleaningStartedAt: '2026-10-03T08:30:00Z' }),
      hkRoom('room-202', '202', 'clean', {
        status: 'occupied',
        cleaningStartedAt: '2026-10-03T07:00:00Z',
        cleaningCompletedAt: '2026-10-03T07:40:00Z',
      }),
    ],
    stayovers: [
      hkStayover('stay-1', 'room-202', 'pending', 'Cambio de toallas'),
      hkStayover('stay-2', 'room-202', 'in_progress', 'Repaso de baño'),
      hkStayover('stay-3', 'room-101', 'completed', 'Tendido de cama'),
      hkStayover('stay-4', 'room-102', 'cancelled', 'Cancelada por el huésped'),
    ],
    checklists: [
      {
        id: 'check-stay-2',
        serviceRequestId: 'stay-2',
        roomId: 'room-202',
        roomNumber: '202',
        status: 'in_progress',
        observations: 'Checklist real de stayover',
        responsibleUserEmail: 'limpieza@hotelboutique.test',
        completedByUserEmail: null,
        startedAt: '2026-10-03T09:00:00Z',
        completedAt: null,
        createdAt: '2026-10-03T09:00:00Z',
        updatedAt: '2026-10-03T09:00:00Z',
        items: [
          {
            id: 'stayover-item-1',
            label: 'Checklist stayover: no usar en turnover',
            checked: false,
            position: 0,
            notes: null,
            checkedByUserEmail: null,
            checkedAt: null,
            createdAt: '2026-10-03T09:00:00Z',
            updatedAt: '2026-10-03T09:00:00Z',
          },
        ],
      },
    ],
    maintenance: [
      {
        id: 'maint-1',
        bookingId: null,
        roomId: 'room-102',
        roomNumber: '102',
        type: 'maintenance',
        description: 'Plomería: fuga en lavamanos',
        status: 'pending',
        notes: 'Alta',
        requestedAt: '2026-10-03T08:00:00Z',
        createdAt: '2026-10-03T08:00:00Z',
        updatedAt: '2026-10-03T08:00:00Z',
      },
    ],
    requests: [],
    denyMaintenanceRead: false,
  };
  const turnover = {
    start: ['dirty', 'cleaning', 'cleaningStartedAt'],
    complete: ['cleaning', 'clean', 'cleaningCompletedAt'],
    inspect: ['clean', 'inspected', 'inspectedAt'],
  };
  const stayoverFlow = {
    start: ['pending', 'in_progress', 'startedAt'],
    complete: ['in_progress', 'completed', 'completedAt'],
  };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const path = new URL(String(input)).pathname.replace(/^\/api\/v1/, '');
    const method = init.method ?? 'GET';
    state.requests.push(`${method} ${path}`);
    if (method === 'GET' && path === '/admin/audit-logs') return json([]);
    if (method === 'GET' && path === '/rooms') return json(state.rooms);
    if (path === '/room-types' || path === '/room-features') return json({ status: 403 }, 403);
    // El rol housekeeping no tiene `room-service.read`: el backend real responde 403.
    if (path.startsWith('/room-service/')) return json({ status: 403 }, 403);
    if (method === 'GET' && path === '/housekeeping/rooms') return json(state.rooms);
    if (method === 'GET' && path === '/housekeeping/rooms/stayover-cleanings') {
      return json(state.stayovers);
    }
    if (method === 'GET' && path === '/housekeeping/checklists') return json(state.checklists);
    if (method === 'GET' && path === '/housekeeping/checklist-template') {
      return json({
        code: 'guest-cleaning',
        name: 'Limpieza solicitada por huésped',
        items: ['Cama preparada', 'Baño limpio'],
      });
    }
    // ServiceRequestController: Limpieza lee housekeeping/maintenance y solo crea maintenance.
    if (method === 'GET' && path === '/service-requests') {
      return state.denyMaintenanceRead ? json({ status: 403 }, 403) : json(state.maintenance);
    }
    if (method === 'POST' && path === '/service-requests') {
      const body = JSON.parse(String(init.body ?? '{}'));
      if (body.type !== 'maintenance') return json({ status: 403 }, 403);
      const room = state.rooms.find((item) => item.id === body.roomId);
      const request = {
        id: `maint-${state.maintenance.length + 1}`,
        bookingId: null,
        roomId: body.roomId,
        roomNumber: room?.roomNumber ?? null,
        type: body.type,
        description: body.description,
        status: 'pending',
        notes: body.notes ?? null,
        requestedAt: '2026-10-03T10:00:00Z',
        createdAt: '2026-10-03T10:00:00Z',
        updatedAt: '2026-10-03T10:00:00Z',
      };
      state.maintenance.push(request);
      return json(request, 201);
    }
    if (['/charges', '/payments', '/deposits', '/guest-accounts'].includes(path)) {
      return json({ status: 403 }, 403);
    }
    if (method === 'POST' && path === '/housekeeping/checklists') {
      const body = JSON.parse(String(init.body ?? '{}'));
      const stayover = state.stayovers.find((item) => item.id === body.serviceRequestId);
      if (['completed', 'cancelled', 'rejected'].includes(stayover?.status)) {
        return json({ message: 'Cannot create checklist for terminal service request' }, 409);
      }
      const checklist = {
        id: `check-${state.checklists.length + 1}`,
        serviceRequestId: body.serviceRequestId,
        roomId: stayover?.roomId ?? 'room-101',
        roomNumber: stayover?.roomNumber ?? '101',
        status: 'pending',
        observations: body.observations ?? null,
        responsibleUserEmail: 'limpieza@hotelboutique.test',
        completedByUserEmail: null,
        startedAt: '2026-10-03T09:00:00Z',
        completedAt: null,
        createdAt: '2026-10-03T10:00:00Z',
        updatedAt: '2026-10-03T10:00:00Z',
        items: body.items.map((item, index) => ({
          id: `check-item-${index + 1}`,
          label: item.label,
          checked: item.checked,
          position: item.position ?? index,
          notes: item.notes ?? null,
          checkedByUserEmail: item.checked ? 'limpieza@hotelboutique.test' : null,
          checkedAt: item.checked ? '2026-10-03T10:00:00Z' : null,
          createdAt: '2026-10-03T10:00:00Z',
          updatedAt: '2026-10-03T10:00:00Z',
        })),
      };
      state.checklists.push(checklist);
      return json(checklist, 201);
    }
    const checklist = path.match(/^\/housekeeping\/checklists\/([^/]+)$/);
    if (method === 'PUT' && checklist) {
      const index = state.checklists.findIndex((item) => item.id === checklist[1]);
      if (index < 0) return json({ status: 404 }, 404);
      const body = JSON.parse(String(init.body ?? '{}'));
      state.checklists[index] = {
        ...state.checklists[index],
        status: body.status ?? state.checklists[index].status,
        observations: body.observations ?? state.checklists[index].observations,
        items: body.items.map((item, itemIndex) => ({
          id: item.id ?? `check-item-${itemIndex + 1}`,
          label: item.label,
          checked: item.checked,
          position: item.position ?? itemIndex,
          notes: item.notes ?? null,
          checkedByUserEmail: item.checked ? 'limpieza@hotelboutique.test' : null,
          checkedAt: item.checked ? '2026-10-03T10:00:00Z' : null,
          createdAt: '2026-10-03T10:00:00Z',
          updatedAt: '2026-10-03T10:05:00Z',
        })),
        updatedAt: '2026-10-03T10:05:00Z',
      };
      return json(state.checklists[index]);
    }
    const stayover = path.match(/^\/housekeeping\/rooms\/stayover-cleanings\/([^/]+)\/(\w+)$/);
    if (method === 'POST' && stayover) {
      const index = state.stayovers.findIndex((item) => item.id === stayover[1]);
      const [from, to, field] = stayoverFlow[stayover[2]];
      if (state.stayovers[index].status !== from) return json({ status: 400 }, 400);
      state.stayovers[index] = {
        ...state.stayovers[index],
        status: to,
        [field]: '2026-10-03T10:00:00Z',
      };
      return json(state.stayovers[index]);
    }
    const room = path.match(/^\/housekeeping\/rooms\/([^/]+)\/(start|complete|inspect)$/);
    if (method === 'POST' && room) {
      const index = state.rooms.findIndex((item) => item.id === room[1]);
      const [from, to, field] = turnover[room[2]];
      if (state.rooms[index].housekeepingStatus !== from) return json({ status: 400 }, 400);
      state.rooms[index] = {
        ...state.rooms[index],
        housekeepingStatus: to,
        [field]: '2026-10-03T10:00:00Z',
      };
      return json(state.rooms[index]);
    }
    return json({ message: `Ruta no mockeada: ${method} ${path}` }, 404);
  };
  return state;
}

async function mountHousekeeping({ denyMaintenanceRead = false } = {}) {
  hkBackend = installHousekeepingBackend();
  hkBackend.denyMaintenanceRead = denyMaintenanceRead;
  await act(async () => {
    view = create(
      <MemoryRouter>
        <PrivateWorkspace role="housekeeping" sessionName="Limpieza Test" />
      </MemoryRouter>,
    );
  });
  for (let i = 0; i < 20 && !view.root.findAll((node) => hasClass(node, 'side-nav')).length; i++) {
    await settle(300);
  }
  assert.ok(view.root.findAll((node) => hasClass(node, 'side-nav')).length, 'workspace cargado');
}
const navItem = (label) =>
  view.root.find(
    (node) => node.type === 'button' && hasClass(node, 'nav-item') && text(node).startsWith(label),
  );
const navBadge = (label) =>
  navItem(label)
    .findAll((node) => node.type === 'b')
    .map(text)[0];
const goTo = async (label) => {
  await act(async () => navItem(label).props.onClick());
  await settle(100);
};
const headerHasDefectButton = () =>
  buttons(
    'Reportar desperfecto',
    view.root.find((node) => hasClass(node, 'welcome-row')),
  ).length > 0;
const requestRows = () =>
  view.root
    .findAll((node) => node.type === 'div' && hasClass(node, 'hk-req-row'))
    .map((row) => ({
      row,
      status: text(row.findAll((node) => hasClass(node, 'status-pill')).at(-1)),
      actions: row.findAll((node) => node.type === 'button').map(text),
    }));
const roomCards = () =>
  view.root
    .findAll((node) => node.type === 'div' && hasClass(node, 'hk-room-card'))
    .map((card) => ({
      card,
      number: text(card.find((node) => node.type === 'strong')),
      status: text(card.find((node) => hasClass(node, 'status-pill'))),
    }));
const cardFor = (number) => roomCards().find((card) => card.number === `Habitación ${number}`);
const toasts = () => view.root.findAll((node) => hasClass(node, 'toast')).map(text);
const expectedOpenRequests = () =>
  hkBackend.stayovers.filter((request) => ['pending', 'in_progress'].includes(request.status))
    .length;

test('limpieza: el panel carga sin pedir datos para los que el rol no tiene permiso', async () => {
  await mountHousekeeping();
  assert.ok(!hkBackend.requests.includes('GET /rooms'));
  assert.ok(hkBackend.requests.includes('GET /housekeeping/rooms'));
  assert.ok(hkBackend.requests.includes('GET /housekeeping/rooms/stayover-cleanings'));
  assert.deepEqual(
    hkBackend.requests.filter((request) => request.includes('/room-service/')),
    [],
    'el catálogo de Room Service exige room-service.read',
  );
  assert.deepEqual(
    hkBackend.requests.filter(
      (request) => request.includes('/room-types') || request.includes('/room-features'),
    ),
    [],
    'el catálogo de habitaciones exige room-types.read/room-features.read',
  );
});

test('limpieza: un 403 en solicitudes secundarias no bloquea el panel', async () => {
  await mountHousekeeping({ denyMaintenanceRead: true });
  assert.ok(hkBackend.requests.includes('GET /service-requests'));
  assert.ok(hkBackend.requests.includes('GET /housekeeping/rooms'));
});

test('limpieza: "Reportar desperfecto" solo aparece en Inicio', async () => {
  await mountHousekeeping();
  assert.equal(headerHasDefectButton(), true, 'Inicio');
  for (const nav of ['Habitaciones', 'Solicitudes', 'Historial']) {
    await goTo(nav);
    assert.equal(headerHasDefectButton(), false, nav);
  }
  await goTo('Inicio');
  assert.equal(headerHasDefectButton(), true, 'vuelve a Inicio');
});

test('limpieza: cada solicitud ofrece solo la acción que su estado permite', async () => {
  await mountHousekeeping();
  await goTo('Solicitudes');
  const rows = requestRows();
  assert.equal(rows.length, hkBackend.stayovers.length, 'las solicitudes salen del backend');
  assert.equal(
    rows.filter((row) => row.status === 'Rechazada').length,
    1,
    'una tarea cancelled del backend se muestra como Rechazada',
  );
  const allowed = {
    Pendiente: ['Atender solicitud'],
    'En proceso': ['Completar checklist', 'Completar solicitud'],
    Completada: [],
    Rechazada: [],
  };
  for (const { status, actions } of rows) {
    assert.ok(status in allowed, `estado conocido: ${status}`);
    assert.deepEqual(actions, allowed[status], `acciones para ${status}`);
  }
});

test('limpieza: atender y completar una solicitud avanza sin transición inválida y actualiza el badge', async () => {
  await mountHousekeeping();
  const openBefore = expectedOpenRequests();
  assert.equal(navBadge('Solicitudes'), openBefore ? String(openBefore) : undefined);

  await goTo('Solicitudes');
  const pending = requestRows().find((row) => row.status === 'Pendiente');
  assert.ok(pending, 'hay una solicitud pendiente para atender');
  const requestInfo = (row) => text(row.find((node) => hasClass(node, 'hk-req-info')));
  const description = requestInfo(pending.row);
  const rowFor = () => requestRows().find((row) => requestInfo(row.row) === description);

  await act(async () => buttons('Atender solicitud', pending.row)[0].props.onClick());
  await settle();
  assert.equal(rowFor().status, 'En proceso');
  assert.ok(!toasts().some((toast) => /rechaz/i.test(toast)), toasts().join());
  assert.equal(navBadge('Solicitudes'), String(openBefore), 'sigue abierta: el badge no cambia');

  const checklist = () =>
    rowFor().row.findAll((node) => hasClass(node, 'hk-request-checklist-items'))[0];
  assert.ok(checklist(), 'muestra el checklist al iniciar la atención');
  assert.deepEqual(
    checklist()
      .findAll((node) => node.type === 'input')
      .map((input) => input.props.checked),
    [false, false],
    'las tareas empiezan sin marcar',
  );
  for (const input of checklist().findAll((node) => node.type === 'input')) {
    await act(async () => input.props.onChange());
    await settle();
  }
  await act(async () => buttons('Completar checklist', rowFor().row)[0].props.onClick());
  await settle();

  await act(async () => buttons('Completar solicitud', rowFor().row)[0].props.onClick());
  await settle();
  assert.equal(rowFor().status, 'Completada');
  assert.ok(!toasts().some((toast) => /rechaz/i.test(toast)), toasts().join());
  assert.deepEqual(
    hkBackend.requests.filter((request) => request.includes('/housekeeping/checklists')),
    [
      'GET /housekeeping/checklists',
      'POST /housekeeping/checklists',
      'PUT /housekeeping/checklists/check-2',
      'PUT /housekeeping/checklists/check-2',
      'PUT /housekeeping/checklists/check-2',
    ],
    'el checklist se crea antes de cerrar la solicitud y se marca completed después',
  );
  assert.ok(hkBackend.requests.includes('GET /housekeeping/checklist-template'));
  const openAfter = expectedOpenRequests();
  assert.equal(openAfter, openBefore - 1);
  assert.equal(navBadge('Solicitudes'), openAfter ? String(openAfter) : undefined);
  assert.equal(
    hkBackend.rooms.find((room) => room.id === 'room-202').status,
    'occupied',
    'stayover no libera la habitación',
  );
});

test('limpieza: el badge de Habitaciones cuenta las pendientes y baja al iniciar una limpieza', async () => {
  await mountHousekeeping();
  await goTo('Habitaciones');
  const pendingRooms = () => roomCards().filter((card) => card.status === 'Pendiente').length;
  const before = pendingRooms();
  assert.equal(before, 2, 'las dos habitaciones dirty del backend');
  assert.equal(navBadge('Habitaciones'), String(before));

  await act(async () => buttons('Iniciar limpieza')[0].props.onClick());
  await settle();
  assert.equal(pendingRooms(), before - 1);
  assert.equal(navBadge('Habitaciones'), before - 1 ? String(before - 1) : undefined);
  assert.equal(hkBackend.rooms[0].housekeepingStatus, 'cleaning', 'la transición pasó por la API');
});

test('limpieza: el turnover no reutiliza ni modifica checklists stayover por roomId', async () => {
  await mountHousekeeping();
  await goTo('Habitaciones');

  const room202 = cardFor('202');
  assert.ok(room202, 'la habitación 202 existe');
  await act(async () => buttons('Ver detalle', room202.card)[0].props.onClick());
  await settle();

  const checklistItems = view.root.findAll((node) => hasClass(node, 'hk-check-item'));
  assert.match(text(checklistItems[0]), /Cama preparada/);
  assert.equal(
    checklistItems.some((item) => /Checklist stayover/.test(text(item))),
    false,
    'el checklist real de stayover no aparece como checklist de turnover',
  );

  await act(async () => checklistItems[0].props.onClick());
  await settle();

  assert.equal(
    hkBackend.requests.some((request) => request === 'PUT /housekeeping/checklists/check-stay-2'),
    false,
    'marcar un item visual de turnover no modifica el checklist real del stayover',
  );
});

test('limpieza: una habitación limpia se inspecciona contra el backend', async () => {
  await mountHousekeeping();
  await goTo('Habitaciones');
  assert.equal(cardFor('202').status, 'Completada');

  await act(async () => buttons('Inspeccionar', cardFor('202').card)[0].props.onClick());
  await settle();
  assert.equal(cardFor('202').status, 'Inspeccionada');
  assert.equal(hkBackend.rooms[3].housekeepingStatus, 'inspected');
  assert.equal(hkBackend.rooms[3].status, 'occupied', 'el turnover no toca Room.status');
});

test('limpieza: si el backend rechaza la transición se muestra el estado real', async () => {
  await mountHousekeeping();
  await goTo('Habitaciones');
  assert.equal(cardFor('101').status, 'Pendiente');

  // Otra persona inició la limpieza desde la app móvil; esta pantalla aún no lo sabe.
  hkBackend.rooms[0] = { ...hkBackend.rooms[0], housekeepingStatus: 'cleaning' };
  await act(async () => buttons('Iniciar limpieza', cardFor('101').card)[0].props.onClick());
  await settle();

  assert.ok(
    toasts().some((toast) => /rechazó la transición/.test(toast)),
    toasts().join(),
  );
  assert.equal(cardFor('101').status, 'En proceso', 'se recargó el estado real del backend');
});

// --- Limpieza: desperfectos contra ServiceRequestController (#126) --------

const defectsReported = () =>
  text(
    view.root
      .find((node) => hasClass(node, 'hk-summary-item') && text(node).includes('Desperfectos'))
      .find((node) => node.type === 'strong'),
  );
const openDefectModal = async () => {
  await act(async () =>
    buttons(
      'Reportar desperfecto',
      view.root.find((node) => hasClass(node, 'welcome-row')),
    )[0].props.onClick(),
  );
  return view.root.find(
    (node) => typeof node.props?.onSubmit === 'function' && Array.isArray(node.props.rooms),
  );
};
const defectReport = {
  room: '101',
  category: 'Eléctrico',
  description: 'Lámpara sin funcionar',
  priority: 'Media',
  observation: 'Revisar balastro',
  photo: '',
};

test('limpieza: los desperfectos salen de /service-requests y no pide finanzas', async () => {
  await mountHousekeeping();
  assert.ok(hkBackend.requests.includes('GET /service-requests'));
  assert.deepEqual(
    hkBackend.requests.filter((request) =>
      ['/charges', '/payments', '/deposits', '/guest-accounts'].some((path) =>
        request.endsWith(path),
      ),
    ),
    [],
    'Limpieza no tiene permisos financieros: no debe pedirlos',
  );
  assert.equal(defectsReported(), '1', 'cuenta el desperfecto que devuelve el backend');
});

test('limpieza: reportar un desperfecto lo crea como maintenance en el backend', async () => {
  await mountHousekeeping();
  const modal = await openDefectModal();
  await act(async () => modal.props.onSubmit(defectReport));
  await settle();

  const created = hkBackend.maintenance.at(-1);
  assert.equal(created.type, 'maintenance');
  assert.equal(created.roomId, 'room-101');
  assert.equal(created.description, 'Eléctrico: Lámpara sin funcionar');
  assert.equal(created.notes, 'Media - Revisar balastro');
  assert.equal(defectsReported(), '2');
  assert.ok(toasts().some((toast) => toast.includes('Reporte enviado correctamente')));
});

test('limpieza: si el backend rechaza el reporte no se agrega un desperfecto local', async () => {
  await mountHousekeeping();
  const fetchWithRules = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) =>
    (init.method ?? 'GET') === 'POST' && String(input).endsWith('/service-requests')
      ? new Response(JSON.stringify({ message: 'Room not found: room-101' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        })
      : fetchWithRules(input, init);

  const modal = await openDefectModal();
  await act(async () => modal.props.onSubmit(defectReport));
  await settle();

  assert.equal(defectsReported(), '1', 'sin confirmación del backend no cambia el contador');
  assert.ok(toasts().some((toast) => toast.includes('Room not found: room-101')));
});

// --- Room Service: backend falso de RoomServiceController (INT-10) --------
//
// Mismas reglas que RoomServiceOrderServiceImpl: transiciones exactas o 400 y
// `notes` opcional junto con el cambio de estado.

const rsOrder = (id, status, extra = {}) => ({
  id,
  bookingId: 'booking-rs',
  roomId: 'room-305',
  roomNumber: '305',
  guestId: 'guest-1',
  guestName: 'Ana López',
  status,
  notes: null,
  currency: 'GTQ',
  totalCents: 4500,
  items: [
    {
      id: `${id}-item`,
      productId: 'product-1',
      productName: 'Club sándwich',
      quantity: 1,
      unitPriceCents: 4500,
      lineTotalCents: 4500,
    },
  ],
  chargeId: null,
  requestedAt: '2026-10-03T12:00:00Z',
  createdAt: '2026-10-03T12:00:00Z',
  updatedAt: '2026-10-03T12:00:00Z',
  ...extra,
});

function installRoomServiceBackend() {
  const state = { orders: [rsOrder('order-1', 'pending')], requests: [] };
  const allowed = {
    pending: ['accepted', 'rejected', 'cancelled'],
    accepted: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['on_the_way', 'cancelled'],
    on_the_way: ['delivered'],
  };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const path = new URL(String(input)).pathname.replace(/^\/api\/v1/, '');
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    state.requests.push({ call: `${method} ${path}`, body });
    if (method === 'GET' && path === '/admin/audit-logs') return json([]);
    if (method === 'GET' && path === '/rooms') return json({ status: 403 }, 403);
    if (method === 'GET' && path === '/room-service/products') return json([]);
    if (method === 'GET' && path === '/room-service/orders') return json(state.orders);
    const status = path.match(/^\/room-service\/orders\/([^/]+)\/status$/);
    if (method === 'POST' && status) {
      const order = state.orders.find((item) => item.id === status[1]);
      if (!(allowed[order.status] ?? []).includes(body.status)) return json({ status: 400 }, 400);
      order.status = body.status;
      if (body.notes !== undefined) order.notes = body.notes;
      return json(order);
    }
    return json({ message: `Ruta no mockeada: ${method} ${path}` }, 404);
  };
  return state;
}

let rsBackend;
async function mountRoomService() {
  rsBackend = installRoomServiceBackend();
  await act(async () => {
    view = create(
      <MemoryRouter>
        <PrivateWorkspace role="room-service" sessionName="Room Service Test" />
      </MemoryRouter>,
    );
  });
  for (let i = 0; i < 20 && !view.root.findAll((node) => hasClass(node, 'side-nav')).length; i++) {
    await settle(300);
  }
  assert.ok(view.root.findAll((node) => hasClass(node, 'side-nav')).length, 'workspace cargado');
}
const orderCards = () =>
  view.root.findAll((node) => node.type === 'article' && hasClass(node, 'rs-order-card'));
const orderStatus = (card) => text(card.find((node) => hasClass(node, 'status-pill')));
const statusCalls = () =>
  rsBackend.requests.filter(({ call }) => call.endsWith('/status')).map(({ body }) => body);

test('room service: los pedidos salen del backend con habitación, huésped y producto', async () => {
  await mountRoomService();
  assert.deepEqual(
    rsBackend.requests.filter(({ call }) => call === 'GET /rooms'),
    [],
    'Room Service no debe depender de rooms.read para cargar pedidos',
  );
  const [card] = orderCards();
  assert.ok(card, 'el pedido del backend aparece en Pedidos activos');
  assert.match(text(card), /Habitación 305 · Ana López/);
  assert.match(text(card), /Club sándwich/);
  assert.equal(orderStatus(card), 'Pendiente');
});

test('room service: aceptar envía el estado al backend sin notas', async () => {
  await mountRoomService();
  await act(async () => buttons('Aceptar pedido', orderCards()[0])[0].props.onClick());
  await settle();
  assert.deepEqual(statusCalls(), [{ status: 'accepted' }]);
  assert.equal(rsBackend.orders[0].status, 'accepted');
  assert.equal(orderStatus(orderCards()[0]), 'Aceptado');
});

test('room service: rechazar envía el motivo junto con el cambio de estado', async () => {
  await mountRoomService();
  await act(async () => buttons('Rechazar', orderCards()[0])[0].props.onClick());
  const textarea = view.root.find(
    (node) => node.type === 'textarea' && hasClass(node, 'rs-rejection-textarea'),
  );
  await act(async () => textarea.props.onChange({ target: { value: 'Cocina cerrada' } }));
  await act(async () => buttons('Confirmar rechazo')[0].props.onClick());
  await settle();
  assert.deepEqual(statusCalls(), [{ status: 'rejected', notes: 'Cocina cerrada' }]);
  assert.equal(rsBackend.orders[0].status, 'rejected');
  assert.equal(rsBackend.orders[0].notes, 'Cocina cerrada');
});

test('room service: si el backend rechaza la transición se recargan los pedidos reales', async () => {
  await mountRoomService();
  // El huésped canceló el pedido desde su portal; esta pantalla aún no lo sabe.
  rsBackend.orders[0].status = 'cancelled';
  await act(async () => buttons('Aceptar pedido', orderCards()[0])[0].props.onClick());
  await settle();
  assert.ok(
    view.root
      .findAll((node) => hasClass(node, 'toast'))
      .some((node) => /rechazó la operación/.test(text(node))),
    'se informa el rechazo del backend',
  );
  assert.equal(orderCards().length, 0, 'el pedido cancelado sale de Pedidos activos');
});

// --- Conserjería: backend falso de ConciergeRequestController (INT-11) -----
//
// Mismas reglas que ConciergeRequestServiceImpl: transiciones exactas o 400,
// notas del cambio de estado agregadas y responsable asignado al tomar la solicitud.

const cgRequest = (id, status, extra = {}) => ({
  id,
  bookingId: 'booking-cg',
  roomId: 'room-402',
  roomNumber: '402',
  guestId: 'guest-cg',
  guestName: 'Luis Pérez',
  responsibleUserId: null,
  responsibleUserName: null,
  responsibleUserEmail: null,
  type: 'concierge',
  description: 'Reservar cena para dos',
  status,
  notes: null,
  chargeId: null,
  requestedAt: '2026-10-04T10:00:00Z',
  createdAt: '2026-10-04T10:00:00Z',
  updatedAt: '2026-10-04T10:00:00Z',
  ...extra,
});

function installConciergeBackend(initialStatus) {
  const state = { requests: [cgRequest('cg-1', initialStatus)], calls: [] };
  const allowed = {
    pending: ['accepted', 'rejected', 'cancelled'],
    accepted: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
  };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const path = new URL(String(input)).pathname.replace(/^\/api\/v1/, '');
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    state.calls.push({ call: `${method} ${path}`, body });
    if (method === 'GET' && path === '/admin/audit-logs') return json([]);
    if (method === 'GET' && path === '/concierge/requests') return json(state.requests);
    const match = path.match(/^\/concierge\/requests\/([^/]+)(\/status)?$/);
    const item = match && state.requests.find((request) => request.id === match[1]);
    if (method === 'GET' && item && !match[2]) return json(item);
    if (method === 'POST' && item && match[2]) {
      if (!(allowed[item.status] ?? []).includes(body.status)) return json({ status: 400 }, 400);
      item.status = body.status;
      if (body.notes) item.notes = body.notes;
      if (!item.responsibleUserId && body.status === 'accepted') {
        item.responsibleUserId = 'user-1';
        item.responsibleUserName = 'Douglas Gómez';
      }
      return json(item);
    }
    return json({ message: `Ruta no mockeada: ${method} ${path}` }, 404);
  };
  return state;
}

let cgBackend;
async function mountConcierge(initialStatus = 'pending') {
  cgBackend = installConciergeBackend(initialStatus);
  await act(async () => {
    view = create(
      <MemoryRouter>
        <PrivateWorkspace role="concierge" sessionName="Conserjería Test" />
      </MemoryRouter>,
    );
  });
  for (let i = 0; i < 20 && !view.root.findAll((node) => hasClass(node, 'side-nav')).length; i++) {
    await settle(300);
  }
  assert.ok(view.root.findAll((node) => hasClass(node, 'side-nav')).length, 'workspace cargado');
}
const requestCards = () =>
  view.root.findAll((node) => node.type === 'article' && hasClass(node, 'cg-request-card'));
const requestStatus = (card) => text(card.findAll((node) => hasClass(node, 'status-pill')).at(-1));
const conciergeStatusCalls = () =>
  cgBackend.calls.filter(({ call }) => call.endsWith('/status')).map(({ body }) => body);
const confirmReason = async (actionLabel, reason, confirmLabel) => {
  await act(async () => buttons(actionLabel, requestCards()[0])[0].props.onClick());
  const textarea = view.root.find(
    (node) => node.type === 'textarea' && hasClass(node, 'cg-rejection-textarea'),
  );
  await act(async () => textarea.props.onChange({ target: { value: reason } }));
  await act(async () => buttons(confirmLabel)[0].props.onClick());
  await settle();
};

test('conserjería: las solicitudes salen del backend con habitación y huésped', async () => {
  await mountConcierge();
  const [card] = requestCards();
  assert.ok(card, 'la solicitud del backend aparece en Solicitudes');
  assert.match(text(card), /Habitación 402 · Luis Pérez/);
  assert.equal(requestStatus(card), 'Pendiente');
});

test('conserjería: aceptar envía solo el estado y muestra el responsable del backend', async () => {
  await mountConcierge();
  await act(async () => buttons('Aceptar solicitud', requestCards()[0])[0].props.onClick());
  await settle();
  assert.deepEqual(conciergeStatusCalls(), [{ status: 'accepted' }]);
  assert.equal(
    requestStatus(requestCards()[0]),
    'Aceptada',
    'accepted ya no se muestra como En proceso',
  );

  await act(async () => buttons('Ver detalle', requestCards()[0])[0].props.onClick());
  await settle();
  assert.ok(
    cgBackend.calls.some(({ call }) => call === 'GET /concierge/requests/cg-1'),
    'el detalle se pide al backend',
  );
  assert.match(text(view.root.find((node) => hasClass(node, 'cg-detail-modal'))), /Douglas Gómez/);
});

test('conserjería: rechazar envía el motivo junto con el cambio de estado', async () => {
  await mountConcierge();
  await confirmReason('Rechazar', 'Sin disponibilidad', 'Confirmar rechazo');
  assert.deepEqual(conciergeStatusCalls(), [{ status: 'rejected', notes: 'Sin disponibilidad' }]);
  assert.equal(cgBackend.requests[0].status, 'rejected');
});

test('conserjería: cancelar una solicitud aceptada envía el motivo y la cierra', async () => {
  await mountConcierge('accepted');
  await confirmReason('Cancelar', 'Ya no lo necesita', 'Confirmar cancelación');
  assert.deepEqual(conciergeStatusCalls(), [{ status: 'cancelled', notes: 'Ya no lo necesita' }]);
  assert.equal(cgBackend.requests[0].status, 'cancelled');
  assert.equal(requestCards().length, 0, 'la solicitud cancelada sale de las activas');
});

test('conserjería: si el backend rechaza la transición se recargan las solicitudes reales', async () => {
  await mountConcierge();
  // El huésped canceló desde su portal; esta pantalla aún no lo sabe.
  cgBackend.requests[0].status = 'cancelled';
  await act(async () => buttons('Aceptar solicitud', requestCards()[0])[0].props.onClick());
  await settle();
  assert.ok(
    view.root
      .findAll((node) => hasClass(node, 'toast'))
      .some((node) => /rechazó la operación/.test(text(node))),
    'se informa el rechazo del backend',
  );
  assert.equal(requestCards().length, 0, 'la solicitud cancelada sale de las activas');
});

// --- Portal del huésped: backend falso de GuestAccessController (INT-12) ----

function installGuestPortalBackend({ failBookings = false } = {}) {
  const state = {
    calls: [],
    notifications: [
      {
        id: 'n-1',
        type: 'room_service_accepted',
        title: 'Room Service',
        message: 'Pedido aceptado',
        read: false,
        createdAt: '2026-10-04T09:00:00Z',
      },
      {
        id: 'n-2',
        type: 'concierge_accepted',
        title: 'Concierge',
        message: 'Solicitud aceptada',
        read: false,
        createdAt: '2026-10-04T09:30:00Z',
      },
    ],
    orders: [],
  };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const path = new URL(String(input)).pathname.replace(/^\/api\/v1/, '');
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    state.calls.push({ call: `${method} ${path}`, body });
    if (path === '/guest/stay') {
      return json({
        bookingId: 'booking-guest',
        guestId: 'guest-1',
        guestFirstName: 'Ana',
        guestLastName: 'López',
        roomId: 'room-305',
        roomNumber: '305',
        roomTypeName: 'Suite Jardín',
        checkIn: '2026-10-03',
        checkOut: '2026-10-06',
        status: 'checked_in',
        balanceCents: 45000,
        currency: 'GTQ',
      });
    }
    if (path === '/guest/bookings') {
      if (failBookings) return json({ message: 'Service unavailable' }, 503);
      return json([
        {
          id: 'booking-guest',
          confirmationCode: 'CURRENT-BOOKING',
          guestId: 'guest-1',
          roomId: 'room-305',
          roomTypeId: 'type-suite',
          checkIn: '2026-10-03',
          checkOut: '2026-10-06',
          status: 'checked_in',
          adults: 2,
          children: 0,
          totalAmountCents: 135000,
          currency: 'GTQ',
          createdAt: '2026-10-01T10:00:00Z',
          updatedAt: '2026-10-01T10:00:00Z',
        },
        {
          id: 'booking-upcoming',
          confirmationCode: 'UPCOMING-BOOKING',
          guestId: 'guest-1',
          roomTypeId: 'type-standard',
          checkIn: '2026-11-03',
          checkOut: '2026-11-06',
          status: 'confirmed',
          adults: 1,
          children: 1,
          totalAmountCents: 90000,
          currency: 'GTQ',
          createdAt: '2026-10-01T10:00:00Z',
          updatedAt: '2026-10-01T10:00:00Z',
        },
      ]);
    }
    if (path === '/guest/room-service/products') {
      return json([
        {
          id: 'product-1',
          sku: 'FB-001',
          name: 'Club sándwich',
          category: 'food_and_beverage',
          priceCents: 4500,
          currency: 'GTQ',
          active: true,
        },
      ]);
    }
    if (path === '/guest/room-service/orders' && method === 'POST') {
      const order = {
        id: 'order-1',
        bookingId: 'booking-guest',
        roomId: 'room-305',
        roomNumber: '305',
        status: 'pending',
        notes: body.notes ?? null,
        currency: 'GTQ',
        items: body.items.map((item) => ({
          id: 'i-1',
          productId: item.productId,
          productName: 'Club sándwich',
          quantity: item.quantity,
          unitPriceCents: 4500,
        })),
        requestedAt: '2026-10-04T10:00:00Z',
        createdAt: '2026-10-04T10:00:00Z',
        updatedAt: '2026-10-04T10:00:00Z',
      };
      state.orders.push(order);
      return json(order, 201);
    }
    if (path === '/guest/notifications') return json(state.notifications);
    if (path === '/guest/notifications/unread-count') {
      return json({ unreadCount: state.notifications.filter((item) => !item.read).length });
    }
    if (path === '/guest/notifications/read-all' && method === 'POST') {
      state.notifications.forEach((item) => (item.read = true));
      return json(state.notifications);
    }
    if (path.startsWith('/guest/')) return json([]);
    return json({ message: `Ruta no mockeada: ${method} ${path}` }, 404);
  };
  return state;
}

let guestBackend;
async function mountGuestPortal() {
  guestBackend = installGuestPortalBackend();
  await act(async () => {
    view = create(
      <MemoryRouter>
        <PrivateWorkspace role="guest" sessionName="Ana López" />
      </MemoryRouter>,
    );
  });
  for (let i = 0; i < 20 && !text(view.root).includes('Habitacion 305'); i++) {
    await settle(300);
  }
  assert.ok(text(view.root).includes('Habitacion 305'), 'la estancia sale de /guest/stay');
}

test('portal del huésped: carga solo desde /guest, sin endpoints del personal', async () => {
  await mountGuestPortal();
  const paths = guestBackend.calls.map(({ call }) => call.split(' ')[1]);
  assert.ok(paths.includes('/guest/stay'));
  assert.ok(paths.includes('/guest/bookings'));
  assert.ok(paths.includes('/guest/notifications/unread-count'));
  assert.ok(
    paths.every((path) => path.startsWith('/guest/')),
    `solo rutas de huésped: ${paths.join(', ')}`,
  );
});

test('portal del huésped: muestra el error si falla la lista de reservas, sin fallback a la estancia', async () => {
  guestBackend = installGuestPortalBackend({ failBookings: true });
  await act(async () => {
    view = create(
      <MemoryRouter>
        <PrivateWorkspace role="guest" sessionName="Ana López" />
      </MemoryRouter>,
    );
  });
  for (
    let i = 0;
    i < 20 && !text(view.root).includes('No pudimos cargar tu portal de huésped');
    i++
  ) {
    await settle(300);
  }
  assert.ok(text(view.root).includes('No pudimos cargar tu portal de huésped'));
  assert.ok(!text(view.root).includes('Habitacion 305'));
});

test('portal del huésped: marcar todas usa read-all y el contador del backend', async () => {
  await mountGuestPortal();
  await act(async () => {
    view.root.findByProps({ className: 'icon-btn notification' }).props.onClick();
    await settle();
  });
  assert.ok(text(view.root).includes('2 notificaciones sin leer'), text(view.root));

  await act(async () => buttons('Marcar todas como leídas')[0].props.onClick());
  await settle();
  assert.ok(guestBackend.calls.some(({ call }) => call === 'POST /guest/notifications/read-all'));
  assert.ok(!text(view.root).includes('notificaciones sin leer'), 'el contador quedó en cero');
});

test('portal del huésped: el pedido de Room Service no elige la reserva', async () => {
  await mountGuestPortal();
  await goTo('Room service');
  await act(async () => buttons('Agregar')[0].props.onClick());
  await act(async () => buttons('Enviar pedido')[0].props.onClick());
  await settle();
  const post = guestBackend.calls.find(({ call }) => call === 'POST /guest/room-service/orders');
  assert.ok(post, 'el pedido va a /guest/room-service/orders');
  assert.ok(!('bookingId' in post.body), 'la reserva la toma el backend del JWT');
  assert.deepEqual(post.body.items, [{ productId: 'product-1', quantity: 1 }]);
});

// --- Recepción: cancelación formal contra BookingController (#126) --------

const REC_BOOKING_ID = '1f24bc67-4a9d-4c1d-9210-d661f60e1260';

function installReceptionBackend() {
  const now = '2026-10-05T10:00:00Z';
  const state = {
    booking: {
      id: REC_BOOKING_ID,
      confirmationCode: 'BKG-126',
      guestLinkCode: 'LNK-126',
      guestId: '7d2f8f2a-0b48-47a4-9bc3-3b1b0874d126',
      roomId: 'room-101',
      roomTypeId: 'type-standard',
      rateId: null,
      checkIn: '2026-12-10',
      checkOut: '2026-12-12',
      status: 'confirmed',
      adults: 2,
      children: 0,
      totalAmountCents: 100000,
      currency: 'GTQ',
      notes: 'Llega tarde',
      cancellationReason: null,
      cancelledAt: null,
      createdAt: now,
      updatedAt: now,
    },
    requests: [],
  };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const path = new URL(String(input)).pathname.replace(/^\/api\/v1/, '');
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    state.requests.push({ call: `${method} ${path}`, body });
    if (
      method === 'GET' &&
      (path.startsWith('/room-service/') || path === '/room-types' || path === '/room-features')
    ) {
      return json({ message: 'Forbidden' }, 403);
    }
    if (method === 'GET' && path === '/bookings') return json([state.booking]);
    if (method === 'GET' && path === '/guests') {
      return json([
        {
          id: state.booking.guestId,
          firstName: 'Elena',
          lastName: 'Castro',
          email: 'elena@example.com',
          phone: '+502 5555-1010',
          documentType: 'national_id',
          documentNumber: '1000 20000 0101',
          createdAt: now,
          updatedAt: now,
        },
      ]);
    }
    if (method === 'GET' && path === '/rooms') return json([hkRoom('room-101', '101', 'clean')]);
    if (method === 'GET' && path === '/room-types') {
      return json([
        {
          id: 'type-standard',
          name: 'Estándar',
          description: 'Habitación estándar',
          capacity: 2,
          basePriceCents: 50000,
          currency: 'GTQ',
          roomFeatureIds: [],
          createdAt: now,
          updatedAt: now,
        },
      ]);
    }
    if (method === 'POST' && path === `/bookings/${REC_BOOKING_ID}/cancel`) {
      if (!['pending', 'confirmed'].includes(state.booking.status)) {
        return json({ message: 'Only pending or confirmed bookings can be cancelled' }, 400);
      }
      Object.assign(state.booking, {
        status: 'cancelled',
        cancellationReason: body.reason,
        cancelledAt: now,
      });
      return json(state.booking);
    }
    if (method === 'GET') return json([]);
    return json({ message: `Ruta no mockeada: ${method} ${path}` }, 404);
  };
  return state;
}

let recBackend;
async function mountReception() {
  recBackend = installReceptionBackend();
  await act(async () => {
    view = create(
      <MemoryRouter>
        <PrivateWorkspace role="reception" sessionName="Recepción Test" />
      </MemoryRouter>,
    );
  });
  for (let i = 0; i < 20 && !view.root.findAll((node) => hasClass(node, 'side-nav')).length; i++) {
    await settle(300);
  }
  assert.ok(view.root.findAll((node) => hasClass(node, 'side-nav')).length, 'workspace cargado');
}
const receptionContent = () =>
  view.root.find(
    (node) => typeof node.props?.onCancel === 'function' && Array.isArray(node.props.reservations),
  );
const recReservation = () =>
  receptionContent().props.reservations.find((item) => item.bookingId === REC_BOOKING_ID);
const recCalls = (suffix) =>
  recBackend.requests.filter(({ call }) => call.endsWith(suffix)).map(({ body }) => body);

test('recepción: carga solicitudes y finanzas globales desde el backend', async () => {
  await mountReception();
  for (const path of ['/service-requests', '/charges', '/payments', '/deposits']) {
    assert.ok(
      recBackend.requests.some(({ call }) => call === `GET ${path}`),
      `recepción consulta ${path}`,
    );
  }
});

test('recepción: los endpoints sin permiso no bloquean el inicio del panel', async () => {
  await mountReception();
  assert.ok(view.root.findAll((node) => hasClass(node, 'side-nav')).length);
  assert.ok(!text(view.root).includes('No tienes permisos para operar Room Service.'));
  assert.ok(!text(view.root).includes('Forbidden'));
});

test('recepción: cancelar una reserva envía el motivo al backend y muestra la reserva real', async () => {
  await mountReception();
  assert.equal(recReservation().status, 'Confirmada');

  await act(async () =>
    receptionContent().props.onCancel(recReservation().id, 'Cambio de planes del huésped'),
  );
  await settle();

  assert.deepEqual(recCalls(`/bookings/${REC_BOOKING_ID}/cancel`), [
    { reason: 'Cambio de planes del huésped' },
  ]);
  assert.equal(recReservation().status, 'Cancelada');
  assert.equal(
    recReservation().cancelReason,
    'Cambio de planes del huésped',
    'el motivo sale de cancellationReason, no de las notas',
  );
  assert.ok(toasts().some((toast) => toast.includes('Reserva cancelada correctamente')));
});

test('recepción: si el backend rechaza la cancelación la reserva no cambia', async () => {
  await mountReception();
  recBackend.booking.status = 'checked_in';

  await act(async () => receptionContent().props.onCancel(recReservation().id, 'Ya no viene'));
  await settle();

  assert.equal(recCalls(`/bookings/${REC_BOOKING_ID}/cancel`).length, 1);
  assert.equal(recReservation().status, 'Confirmada', 'no se marca cancelada sin el backend');
  assert.ok(
    toasts().some((toast) => toast.includes('Only pending or confirmed bookings can be cancelled')),
  );
});
