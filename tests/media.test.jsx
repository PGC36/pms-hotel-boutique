import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { useState } from 'react';
import { act, create } from 'react-test-renderer';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RoomDetailScreen } from '@/modules/booking-engine/screens/RoomDetailScreen';
import { SearchScreen } from '@/modules/booking-engine/screens/SearchScreen';
import { RoomTypeFormScreen } from '@/modules/rooms/screens/RoomTypeFormScreen';
import { catalogService } from '@/services/catalogService';
import { httpClient } from '@/services/http-client';
import { inventoryService } from '@/services/inventoryService';
import { MEDIA_ERROR_MESSAGES, MEDIA_LIMITS, mediaService } from '@/services/mediaService';
import { publicBookingCatalogService } from '@/services/publicBookingCatalogService';
import { roomService } from '@/services/roomService';
import { CatalogImage } from '@/shared/components/CatalogImage';
import { ImageGalleryField } from '@/shared/components/ImageGalleryField';
import {
  galleryFromImages,
  getGallerySaveBlocker,
  makePrimaryGalleryItem,
  moveGalleryItem,
  toImageAssignments,
} from '@/shared/utils/mediaGallery';

// Imágenes de catálogo (#146) contra el contrato del backend #82. fetch se
// simula; nada toca la red ni el almacenamiento real.

globalThis.localStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};
globalThis.window = Object.assign(new EventTarget(), {
  setTimeout: (callback, delay) => setTimeout(callback, delay).unref(),
  clearTimeout,
  scrollY: 0,
  location: { search: '' },
});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const API = 'http://localhost:8080/api/v1';
const ROOM_TYPE_ID = '11111111-1111-4111-8111-111111111111';
const NOW = '2026-10-07T12:00:00Z';

const urls = (id) => ({
  thumb: `${API}/public/media/${id}/thumb`,
  medium: `${API}/public/media/${id}/medium`,
  large: `${API}/public/media/${id}/large`,
});
const apiImage = (id, position, primary = false, altText = null) => ({
  id,
  altText,
  position,
  primary,
  width: 1600,
  height: 1200,
  urls: urls(id),
});
const apiRoomType = (images = []) => ({
  id: ROOM_TYPE_ID,
  code: 'DBL',
  name: 'Doble Deluxe',
  description: 'Vista al volcán',
  capacity: 3,
  bedConfiguration: '1 king bed',
  roomFeatureIds: [],
  features: [],
  active: true,
  images,
  createdAt: NOW,
  updatedAt: NOW,
});
const uploadResponse = (id, target = 'room_type') => ({
  id,
  target,
  contentType: 'image/jpeg',
  sizeBytes: 2048,
  width: 1600,
  height: 1200,
  urls: urls(id),
  expiresAt: '2026-10-08T12:00:00Z',
});

// --- fetch simulado ----------------------------------------------------

let requests;
let handler;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  requests = [];
  handler = () => json({ message: 'Not found' }, 404);
  globalThis.fetch = async (url, init = {}) => {
    const headers = new Headers(init.headers);
    const request = {
      url: String(url),
      path: String(url).slice(API.length).split('?')[0],
      method: init.method ?? 'GET',
      authorization: headers.get('Authorization'),
      contentType: headers.get('Content-Type'),
      rawBody: init.body,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    requests.push(request);
    return handler(request);
  };
  httpClient.setToken('staff-access-token');
});

let view;
afterEach(() => {
  if (view) act(() => view.unmount());
  view = undefined;
  httpClient.clearToken();
});

const text = (node) =>
  typeof node === 'string'
    ? node
    : Array.isArray(node)
      ? node.map(text).join('')
      : (node?.children ?? []).map(text).join('');
const settle = (ms = 800) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
const imageFile = (name = 'foto.jpg', type = 'image/jpeg', size = 2048) =>
  new File([new Uint8Array(size)], name, { type });

// --- mediaService --------------------------------------------------------

test('uploadImage: POST /media multipart con file y target, sin Content-Type manual', async () => {
  handler = () => json(uploadResponse('m1'), 201);

  const uploaded = await mediaService.uploadImage('roomType', imageFile());

  assert.equal(requests.length, 1);
  const [request] = requests;
  assert.equal(`${request.method} ${request.path}`, 'POST /media');
  assert.ok(request.rawBody instanceof FormData);
  assert.equal(request.rawBody.get('target'), 'room_type');
  assert.equal(request.rawBody.get('file').name, 'foto.jpg');
  assert.equal(request.contentType, null, 'el navegador arma el boundary del multipart');
  assert.equal(request.authorization, 'Bearer staff-access-token');
  assert.equal(uploaded.id, 'm1');
  assert.equal(uploaded.target, 'roomType');
  assert.ok(uploaded.expiresAt instanceof Date);
});

test('uploadImage: admite artículos de inventario', async () => {
  handler = () => json(uploadResponse('inventory-image', 'inventory_item'), 201);

  const uploaded = await mediaService.uploadImage('inventoryItem', imageFile());

  assert.equal(requests[0].rawBody.get('target'), 'inventory_item');
  assert.equal(uploaded.target, 'inventoryItem');
});

test('inventario: crea un artículo asociando la imagen subida', async () => {
  handler = (request) =>
    json(
      {
        id: '11111111-1111-4111-8111-111111111111',
        sku: 'TOALLA-001',
        name: 'Toallas',
        category: 'housekeeping',
        unit: 'unit',
        currentQuantity: 0,
        minimumQuantity: 0,
        lowStock: false,
        active: true,
        createdAt: NOW,
        updatedAt: NOW,
        images: [apiImage('inventory-image', 0, true, 'Toallas')],
      },
      request.method === 'POST' ? 201 : 200,
    );

  const item = await inventoryService.createItem({
    sku: 'TOALLA-001',
    name: 'Toallas',
    category: 'housekeeping',
    unit: 'unit',
    minimumQuantity: 0,
    active: true,
    images: [{ media_id: 'inventory-image', alt_text: 'Toallas' }],
  });

  assert.equal(requests[0].path, '/admin/inventory/items');
  assert.deepEqual(requests[0].body.images, [{ mediaId: 'inventory-image', altText: 'Toallas' }]);
  assert.equal(item.images?.[0].id, 'inventory-image');
});

test('uploadImage: valida formato, tamaño y vacío antes de llamar a la red', async () => {
  await assert.rejects(mediaService.uploadImage('product', imageFile('anim.gif', 'image/gif')), {
    message: MEDIA_ERROR_MESSAGES.unsupported,
  });
  await assert.rejects(
    mediaService.uploadImage(
      'product',
      imageFile('grande.jpg', 'image/jpeg', MEDIA_LIMITS.maxFileSizeBytes + 1),
    ),
    { message: MEDIA_ERROR_MESSAGES.tooLarge },
  );
  await assert.rejects(
    mediaService.uploadImage('product', imageFile('vacia.png', 'image/png', 0)),
    {
      message: MEDIA_ERROR_MESSAGES.empty,
    },
  );
  assert.equal(requests.length, 0);
});

test('uploadImage: traduce los errores del backend y no informa éxito', async () => {
  const cases = [
    [413, 'Image exceeds the maximum size of 5 MB', MEDIA_ERROR_MESSAGES.tooLarge],
    [415, 'Only JPEG, PNG and WebP images are allowed', MEDIA_ERROR_MESSAGES.unsupported],
    [400, 'Image file is corrupt or unreadable', MEDIA_ERROR_MESSAGES.corrupt],
    [
      400,
      'Image dimensions are too large; maximum is 24000000 pixels',
      MEDIA_ERROR_MESSAGES.tooManyPixels,
    ],
    [403, 'Forbidden', MEDIA_ERROR_MESSAGES.forbidden],
    [503, 'Image storage is temporarily unavailable', MEDIA_ERROR_MESSAGES.unavailable],
  ];
  for (const [status, message, expected] of cases) {
    handler = () => json({ status, message }, status);
    await assert.rejects(mediaService.uploadImage('amenity', imageFile()), { message: expected });
  }

  globalThis.fetch = async () => {
    throw new TypeError('fetch failed');
  };
  await assert.rejects(mediaService.uploadImage('amenity', imageFile()), {
    message: MEDIA_ERROR_MESSAGES.unavailable,
  });
});

test('deletePendingImage y vista previa del personal usan las rutas con token', async () => {
  handler = (request) =>
    request.method === 'DELETE'
      ? new Response(null, { status: 204 })
      : new Response(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), {
          status: 200,
          headers: { 'content-type': 'image/png' },
        });

  await mediaService.deletePendingImage('m1');
  const previewUrl = await mediaService.getStaffPreviewUrl('m2', 'medium');

  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.path}`),
    ['DELETE /media/m1', 'GET /media/m2/content/medium'],
  );
  assert.ok(requests.every((request) => request.authorization === 'Bearer staff-access-token'));
  assert.ok(previewUrl.startsWith('blob:'));
  URL.revokeObjectURL(previewUrl);
});

// --- Servicios de catálogo -------------------------------------------------

test('roomService: lee images ordenadas y solo envía images cuando el formulario las trae', async () => {
  handler = (request) =>
    request.method === 'GET'
      ? json([apiRoomType([apiImage('b', 1), apiImage('a', 0, true, 'Cama king')])])
      : json(apiRoomType([apiImage('a', 0, true)]));

  const [roomType] = await roomService.getRoomTypes();
  assert.deepEqual(
    roomType.images.map((image) => [image.id, image.position, image.primary]),
    [
      ['a', 0, true],
      ['b', 1, false],
    ],
  );
  assert.equal(roomType.images[0].altText, 'Cama king');
  assert.equal(roomType.images[0].urls.large, urls('a').large);

  await roomService.updateRoomType(ROOM_TYPE_ID, {
    images: [{ media_id: 'a', alt_text: ' Vista ' }, { media_id: 'c' }],
  });
  await roomService.updateRoomType(ROOM_TYPE_ID, { active: false });

  const [withImages, withoutImages] = requests.filter((request) => request.method === 'PUT');
  assert.deepEqual(withImages.body.images, [{ mediaId: 'a', altText: 'Vista' }, { mediaId: 'c' }]);
  assert.ok(!('images' in withoutImages.body), 'sin images el backend no toca la galería');
});

test('roomService: un rechazo de images del backend llega como mensaje claro', async () => {
  handler = () =>
    json({ status: 409, message: 'Media image m9 already belongs to another record' }, 409);

  await assert.rejects(roomService.updateRoomType(ROOM_TYPE_ID, { images: [{ media_id: 'm9' }] }), {
    message: 'Una de las imágenes ya pertenece a otro registro.',
  });
});

test('catalogService: producto y amenidad envían images y mapean la respuesta', async () => {
  const apiProduct = {
    id: 'p1',
    sku: 'RS-1',
    name: 'Club sándwich',
    category: 'food_and_beverage',
    priceCents: 8500,
    currency: 'GTQ',
    active: true,
    images: [apiImage('pi', 0, true)],
  };
  const apiAmenity = {
    id: 'a1',
    name: 'Piscina',
    category: 'hotel',
    active: true,
    images: [apiImage('ai', 0, true)],
  };
  handler = (request) => {
    if (request.path.startsWith('/admin/room-service/products'))
      return json(request.method === 'GET' ? [apiProduct] : apiProduct);
    return json(request.method === 'GET' ? [apiAmenity] : apiAmenity);
  };

  const product = await catalogService.updateAdminProduct('p1', { images: [{ media_id: 'pi' }] });
  const amenity = await catalogService.updateAmenity('a1', { images: [] });

  const puts = requests.filter((request) => request.method === 'PUT');
  assert.deepEqual(puts[0].body.images, [{ mediaId: 'pi' }]);
  assert.deepEqual(puts[1].body.images, [], 'lista vacía: quita la imagen');
  assert.equal(product.images[0].id, 'pi');
  assert.equal(amenity.images[0].urls.thumb, urls('ai').thumb);
});

test('publicBookingCatalogService.getAmenities: /public/amenities sin token, con imágenes', async () => {
  handler = () =>
    json([
      {
        id: 'a1',
        name: 'Piscina',
        category: 'hotel',
        opensAt: '08:00',
        closesAt: '20:00',
        images: [],
      },
      { id: 'a2', name: 'Spa', category: 'service', images: [apiImage('s1', 0, true)] },
    ]);

  const amenities = await publicBookingCatalogService.getAmenities();

  assert.equal(requests[0].url, `${API}/public/amenities`);
  assert.equal(requests[0].authorization, null);
  assert.deepEqual(
    amenities.map((amenity) => [amenity.name, amenity.images.length]),
    [
      ['Piscina', 0],
      ['Spa', 1],
    ],
  );
});

// --- Lógica de galería ---------------------------------------------------

const modelImage = (id, position, primary = false) => ({
  id,
  position,
  primary,
  width: 10,
  height: 10,
  urls: urls(id),
});

test('galería: la principal va primero, se reordena y solo se envían las listas', () => {
  const items = galleryFromImages([
    modelImage('b', 0),
    modelImage('c', 2),
    modelImage('a', 1, true),
  ]);
  assert.deepEqual(
    items.map((item) => item.mediaId),
    ['a', 'b', 'c'],
  );

  const reordered = moveGalleryItem(items, 2, 1);
  assert.deepEqual(
    reordered.map((item) => item.mediaId),
    ['a', 'c', 'b'],
  );
  assert.equal(moveGalleryItem(items, 0, 9), items, 'fuera de rango no cambia nada');
  assert.deepEqual(
    makePrimaryGalleryItem(reordered, 2).map((item) => item.mediaId),
    ['b', 'a', 'c'],
  );

  const withPending = [
    ...items,
    { key: 'x', altText: '', status: 'uploading', pendingUpload: false },
    { key: 'y', altText: '', status: 'error', error: 'mal', pendingUpload: false },
  ];
  assert.deepEqual(toImageAssignments(withPending), [
    { media_id: 'a', alt_text: undefined },
    { media_id: 'b', alt_text: undefined },
    { media_id: 'c', alt_text: undefined },
  ]);
  assert.match(getGallerySaveBlocker(withPending), /terminen de subir/);
  assert.match(getGallerySaveBlocker(withPending.filter((item) => item.key !== 'x')), /con error/);
  assert.equal(getGallerySaveBlocker(items), null);
});

// --- Componentes -----------------------------------------------------------

function GalleryHarness({ initial = [], maxImages, onItems }) {
  const [items, setItems] = useState(initial);
  onItems(items);
  return (
    <ImageGalleryField
      label="Fotos"
      target="roomType"
      items={items}
      onChange={setItems}
      maxImages={maxImages}
      recordName="Doble Deluxe"
    />
  );
}

const chooseFiles = (files) =>
  act(() => {
    view.root.findByProps({ type: 'file' }).props.onChange({ target: { files } });
  });
const buttonByLabel = (label) => view.root.findByProps({ 'aria-label': label });

test('ImageGalleryField: sube al elegir, muestra vista previa y estados, y rechaza archivos inválidos', async () => {
  let current = [];
  handler = (request) => json(uploadResponse(`up-${request.rawBody.get('file').name}`), 201);

  act(() => {
    view = create(<GalleryHarness onItems={(items) => (current = items)} />);
  });
  chooseFiles([
    imageFile('uno.jpg'),
    imageFile('dos.png', 'image/png'),
    imageFile('x.gif', 'image/gif'),
  ]);

  assert.ok(text(view.toJSON()).includes('Subiendo…'));
  const previews = view.root.findAll((node) => node.type === 'img');
  assert.ok(
    previews.every((img) => img.props.src.startsWith('blob:')),
    'vista previa local, sin Base64',
  );
  assert.ok(text(view.toJSON()).includes(MEDIA_ERROR_MESSAGES.unsupported));

  await settle(900);

  assert.equal(
    requests.filter((request) => request.path === '/media').length,
    2,
    'el gif no se sube',
  );
  assert.deepEqual(
    current.map((item) => [item.status, item.mediaId ?? null]),
    [
      ['ready', 'up-uno.jpg'],
      ['ready', 'up-dos.png'],
      ['error', null],
    ],
  );
  assert.ok(text(view.toJSON()).includes('Principal'));
});

test('ImageGalleryField: reordena, hace principal y quitar una subida nueva la borra del backend', async () => {
  let current = [];
  handler = (request) =>
    request.method === 'DELETE' ? new Response(null, { status: 204 }) : json({}, 404);
  const initial = [
    ...galleryFromImages([modelImage('a', 0, true), modelImage('b', 1)]),
    { key: 'new', mediaId: 'n1', altText: '', status: 'ready', pendingUpload: true },
  ];

  act(() => {
    view = create(<GalleryHarness initial={initial} onItems={(items) => (current = items)} />);
  });

  act(() => buttonByLabel('Mover imagen 1 de 3 hacia adelante').props.onClick());
  assert.deepEqual(
    current.map((item) => item.mediaId),
    ['b', 'a', 'n1'],
  );

  act(() =>
    view.root
      .findAll((node) => node.type === 'button' && text(node) === 'Hacer principal')[1]
      .props.onClick(),
  );
  assert.deepEqual(
    current.map((item) => item.mediaId),
    ['n1', 'b', 'a'],
  );

  act(() => buttonByLabel('Quitar imagen 1 de 3').props.onClick());
  await settle(700);
  assert.deepEqual(
    current.map((item) => item.mediaId),
    ['b', 'a'],
  );
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.path}`),
    ['DELETE /media/n1'],
  );

  act(() => buttonByLabel('Quitar imagen 1 de 2').props.onClick());
  await settle(700);
  assert.equal(requests.length, 1, 'una imagen ya guardada solo se quita al guardar el registro');
});

test('ImageGalleryField de una sola imagen: elegir otra la reemplaza', async () => {
  let current = [];
  handler = () => json(uploadResponse('nueva', 'product'), 201);
  const initial = galleryFromImages([modelImage('vieja', 0, true)]);

  act(() => {
    view = create(
      <GalleryHarness initial={initial} maxImages={1} onItems={(items) => (current = items)} />,
    );
  });
  assert.ok(text(view.toJSON()).includes('Reemplazar imagen'));
  chooseFiles([imageFile('nueva.webp', 'image/webp')]);
  await settle(900);

  assert.deepEqual(
    current.map((item) => item.mediaId),
    ['nueva'],
  );
  assert.equal(view.root.findByProps({ type: 'file' }).props.multiple, false);
});

test('CatalogImage: foto del backend o placeholder neutral, nunca otra foto', () => {
  act(() => {
    view = create(<CatalogImage image={modelImage('a', 0, true)} variant="large" alt="Suite" />);
  });
  const img = view.root.findByType('img');
  assert.equal(img.props.src, urls('a').large);
  assert.equal(img.props.alt, 'Suite');

  act(() => view.update(<CatalogImage alt="Suite sin fotos" placeholderLabel="Suite" />));
  assert.equal(view.root.findAllByType('img').length, 0);
  assert.equal(view.root.findByProps({ role: 'img' }).props['aria-label'], 'Suite sin fotos');

  act(() => view.update(<CatalogImage image={modelImage('a', 0, true)} alt="Suite" />));
  act(() => view.root.findByType('img').props.onError());
  assert.equal(view.root.findAllByType('img').length, 0, 'si la URL falla queda el placeholder');
});

// --- Vistas públicas ---------------------------------------------------------

function renderAt(path, routePath, element) {
  act(() => {
    view = create(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={element} />
        </Routes>
      </MemoryRouter>,
    );
  });
}

const publicHandler =
  (roomTypes, amenities = []) =>
  (request) => {
    if (request.path === '/public/room-types') return json(roomTypes);
    if (request.path === '/public/amenities') return json(amenities);
    return json([]);
  };

test('RoomDetailScreen: muestra la galería guardada con la principal primero', async () => {
  handler = publicHandler([apiRoomType([apiImage('b', 1), apiImage('a', 0, true, 'Cama king')])]);

  renderAt(`/rooms/${ROOM_TYPE_ID}`, '/rooms/:roomTypeId', <RoomDetailScreen />);
  await settle(1600);

  const sources = view.root.findAllByType('img').map((img) => img.props.src);
  assert.deepEqual(sources, [urls('a').large, urls('b').medium]);
  assert.equal(view.root.findAllByType('img')[0].props.alt, 'Cama king');
  assert.ok(!sources.some((src) => src.includes('pexels')));
});

test('RoomDetailScreen: sin fotos muestra placeholder neutral', async () => {
  handler = publicHandler([apiRoomType([])]);

  renderAt(`/rooms/${ROOM_TYPE_ID}`, '/rooms/:roomTypeId', <RoomDetailScreen />);
  await settle(1600);

  assert.equal(view.root.findAllByType('img').length, 0);
  assert.ok(text(view.toJSON()).includes('Fotografías próximamente'));
});

test('SearchScreen: portada = imagen principal; sin imagen, placeholder con el nombre', async () => {
  const other = { ...apiRoomType([]), id: 'other', code: 'STD', name: 'Estándar' };
  handler = publicHandler([apiRoomType([apiImage('b', 1), apiImage('a', 0, true)]), other]);

  renderAt('/', '/', <SearchScreen />);
  await settle(1600);

  const sources = view.root.findAllByType('img').map((img) => img.props.src);
  assert.deepEqual(sources, [urls('a').medium]);
  assert.ok(
    view.root.findAll(
      (node) => node.props?.role === 'img' && node.props['aria-label']?.includes('Estándar'),
    ).length > 0,
  );
});

test('SearchScreen #amenidades: amenidades y fotos del backend', async () => {
  handler = publicHandler(
    [apiRoomType([])],
    [
      {
        id: 'a1',
        name: 'Piscina',
        category: 'hotel',
        opensAt: '08:00',
        closesAt: '20:00',
        images: [apiImage('p', 0, true)],
      },
      { id: 'a2', name: 'Spa', category: 'service', images: [] },
    ],
  );

  renderAt('/#amenidades', '/', <SearchScreen />);
  await settle(1600);

  const content = text(view.toJSON());
  assert.ok(content.includes('Piscina') && content.includes('Spa'));
  assert.ok(content.includes('08:00 - 20:00'));
  assert.ok(requests.some((request) => request.path === '/public/amenities'));
  assert.deepEqual(
    view.root.findAllByType('img').map((img) => img.props.src),
    [urls('p').medium],
  );
});

// --- Formulario de administración -------------------------------------------

test('RoomTypeFormScreen: carga la galería, guarda images y muestra el rechazo del backend', async () => {
  let rejectSave = true;
  handler = (request) => {
    if (request.path === '/room-features') return json([]);
    if (request.method === 'GET')
      return json(apiRoomType([apiImage('a', 0, true), apiImage('b', 1)]));
    if (rejectSave) {
      return json({ status: 409, message: 'Media image b already belongs to another record' }, 409);
    }
    return json(apiRoomType([apiImage('b', 0, true)]));
  };

  renderAt(
    `/pms/room-types/${ROOM_TYPE_ID}/edit`,
    '/pms/room-types/:roomTypeId/edit',
    <RoomTypeFormScreen />,
  );
  await settle(1600);

  act(() => buttonByLabel('Mover imagen 2 de 2 hacia atrás').props.onClick());
  const form = view.root.findByType('form');
  await act(async () => form.props.onSubmit({ preventDefault() {} }));
  await settle(900);

  const put = requests.find((request) => request.method === 'PUT');
  assert.deepEqual(put.body.images, [{ mediaId: 'b' }, { mediaId: 'a' }]);
  assert.ok(
    text(view.toJSON()).includes('Una de las imágenes ya pertenece a otro registro.'),
    'el rechazo se muestra y el formulario sigue abierto',
  );
  assert.ok(view.root.findAllByType('form').length === 1);
});
