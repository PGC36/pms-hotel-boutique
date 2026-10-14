import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchRoutes } from 'react-router-dom';
import { router as configuredRouter } from '@/app/router';
import { ModuleHomePage } from '@/private/pages/ModuleHomePage';
import { PrivateNotFoundPage } from '@/private/pages/PrivateNotFoundPage';
import { RoomListScreen } from '@/modules/rooms/screens/RoomListScreen';
import { RoomTypeListScreen } from '@/modules/rooms/screens/RoomTypeListScreen';
import { OccupancyScreen } from '@/modules/occupancy/screens/OccupancyScreen';
import { PrivateSessionWorkspace } from '@/private/workspace/PrivateSessionWorkspace';

/**
 * React Router no rechaza dos rutas hijas con el mismo `path`: cuando
 * empatan en especificidad, la primera declarada gana en silencio y la
 * segunda queda inalcanzable, sin ningún error ni advertencia. Así se
 * ocultó RoomListScreen/RoomTypeListScreen/OccupancyScreen detrás del
 * placeholder ModuleHomePage. Esta prueba camina el árbol de rutas
 * completo y falla si un mismo padre declara el mismo `path` dos veces.
 */
function findDuplicateSiblingPaths(routes, trail = []) {
  const seen = new Map();
  for (const route of routes) {
    if (!route.path) continue;
    seen.set(route.path, (seen.get(route.path) ?? 0) + 1);
  }

  const duplicates = [];
  for (const [path, count] of seen) {
    if (count > 1) duplicates.push([...trail, path].join(' > '));
  }

  for (const route of routes) {
    if (route.children?.length) {
      duplicates.push(
        ...findDuplicateSiblingPaths(route.children, [...trail, route.path ?? '(layout)']),
      );
    }
  }

  return duplicates;
}

test('ninguna ruta del router queda declarada dos veces bajo el mismo padre', () => {
  const duplicates = findDuplicateSiblingPaths(configuredRouter.routes);
  assert.deepEqual(
    duplicates,
    [],
    `Rutas duplicadas (la primera gana en silencio y esconde la pantalla real de la segunda): ${duplicates.join(', ')}`,
  );
});

function leafElementType(pathname) {
  const matches = matchRoutes(configuredRouter.routes, pathname);
  if (!matches) return undefined;
  return matches[matches.length - 1].route.element?.type;
}

test('rooms, tipos de habitación y ocupación resuelven a su pantalla real, no al placeholder', () => {
  assert.equal(leafElementType('/pms/rooms'), RoomListScreen);
  assert.equal(leafElementType('/pms/room-types'), RoomTypeListScreen);
  assert.equal(leafElementType('/pms/occupancy'), OccupancyScreen);
});

test('recepción abre su workspace al entrar directamente, no la pantalla diaria antigua', () => {
  assert.equal(leafElementType('/pms/reception'), PrivateSessionWorkspace);
});

test('los módulos web de Ronda 1 sin pantalla propia todavía siguen mostrando el placeholder', () => {
  assert.equal(leafElementType('/pms/cash'), ModuleHomePage);
  assert.equal(leafElementType('/pms/users'), ModuleHomePage);
});

/**
 * Los workspaces Bolt migrados de Limpieza, Room Service y Conserjeria entran
 * por rutas dedicadas, fuera del menu PMS clasico, para conservar sus menus
 * internos por rol.
 */
test('limpieza, room service y conserjeria resuelven al workspace privado dedicado', () => {
  assert.equal(leafElementType('/pms/housekeeping'), PrivateSessionWorkspace);
  assert.equal(leafElementType('/pms/room-service'), PrivateSessionWorkspace);
  assert.equal(leafElementType('/pms/concierge'), PrivateSessionWorkspace);
});
