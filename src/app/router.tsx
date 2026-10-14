import { createBrowserRouter } from 'react-router-dom';
import { PrivateLayout } from '@/layouts/PrivateLayout';
import { PublicLayout } from '@/layouts/PublicLayout';
import { LoginPage } from '@/pages/LoginPage';
import { OperationsHomePage } from '@/pages/OperationsHomePage';
import { PrivateNotFoundPage } from '@/private/pages/PrivateNotFoundPage';
import { PublicNotFoundPage } from '@/public/pages/PublicNotFoundPage';
import { routePaths } from '@/app/routes';
import { RequireSession } from '@/private/guards/RequireSession';
import { RequirePermission } from '@/private/guards/RequirePermission';
import { privateNavigation } from '@/private/routes/navigation';
import { ModuleHomePage } from '@/private/pages/ModuleHomePage';
import { ComponentsCatalogPage } from '@/public/pages/ComponentsCatalogPage';
import { SearchScreen } from '@/modules/booking-engine/screens/SearchScreen';
import { RoomDetailScreen } from '@/modules/booking-engine/screens/RoomDetailScreen';
import { BookingFormScreen } from '@/modules/booking-engine/screens/BookingFormScreen';
import { BookingConfirmationScreen } from '@/modules/booking-engine/screens/BookingConfirmationScreen';
import { RoomListScreen } from '@/modules/rooms/screens/RoomListScreen';
import { RoomFormScreen } from '@/modules/rooms/screens/RoomFormScreen';
import { RoomTypeListScreen } from '@/modules/rooms/screens/RoomTypeListScreen';
import { RoomTypeFormScreen } from '@/modules/rooms/screens/RoomTypeFormScreen';
import { OccupancyScreen } from '@/modules/occupancy/screens/OccupancyScreen';
import { ManualBookingScreen } from '@/modules/occupancy/screens/ManualBookingScreen';
import { BookingDetailScreen } from '@/modules/occupancy/screens/BookingDetailScreen';
import { CheckInScreen } from '@/modules/front-desk/screens/CheckInScreen';
import { GuestAccountScreen } from '@/modules/front-desk/screens/GuestAccountScreen';
import { CheckOutScreen } from '@/modules/front-desk/screens/CheckOutScreen';
import { PrivateSessionWorkspace } from '@/private/workspace/PrivateSessionWorkspace';

/**
 * Cada pantalla real de un módulo de privateNavigation vive aquí, con su
 * propio permiso y ruta. Es la única fuente de verdad de "qué path ya tiene
 * pantalla propia" — placeholderRoutes se calcula a partir de esta lista,
 * nunca al revés, para que una ruta nunca pueda quedar declarada dos veces
 * (una perdería contra la otra según el orden del array, un bug silencioso:
 * ver docs/DECISIONES.md).
 */
const dedicatedPmsRoutes = [
  {
    path: routePaths.pms.rooms,
    element: <RequirePermission permission="rooms:manage" />,
    children: [
      { index: true, element: <RoomListScreen /> },
      { path: routePaths.pms.notFound, element: <PrivateNotFoundPage /> },
    ],
  },
  {
    path: routePaths.pms.roomNew,
    element: <RequirePermission permission="rooms:manage" />,
    children: [
      { index: true, element: <RoomFormScreen /> },
      { path: routePaths.pms.notFound, element: <PrivateNotFoundPage /> },
    ],
  },
  {
    path: routePaths.pms.roomEdit,
    element: <RequirePermission permission="rooms:manage" />,
    children: [
      { index: true, element: <RoomFormScreen /> },
      { path: routePaths.pms.notFound, element: <PrivateNotFoundPage /> },
    ],
  },
  {
    path: routePaths.pms.roomTypes,
    element: <RequirePermission permission="rooms:manage" />,
    children: [
      { index: true, element: <RoomTypeListScreen /> },
      { path: routePaths.pms.notFound, element: <PrivateNotFoundPage /> },
    ],
  },
  {
    path: routePaths.pms.roomTypeNew,
    element: <RequirePermission permission="rooms:manage" />,
    children: [
      { index: true, element: <RoomTypeFormScreen /> },
      { path: routePaths.pms.notFound, element: <PrivateNotFoundPage /> },
    ],
  },
  {
    path: routePaths.pms.roomTypeEdit,
    element: <RequirePermission permission="rooms:manage" />,
    children: [
      { index: true, element: <RoomTypeFormScreen /> },
      { path: routePaths.pms.notFound, element: <PrivateNotFoundPage /> },
    ],
  },
  {
    path: routePaths.pms.occupancy,
    element: <RequirePermission permission="occupancy:view" />,
    children: [
      { index: true, element: <OccupancyScreen /> },
      { path: routePaths.pms.notFound, element: <PrivateNotFoundPage /> },
    ],
  },
  {
    path: routePaths.pms.manualBookingNew,
    element: <RequirePermission permission="occupancy:view" />,
    children: [
      { index: true, element: <ManualBookingScreen /> },
      { path: routePaths.pms.notFound, element: <PrivateNotFoundPage /> },
    ],
  },
  {
    path: routePaths.pms.bookingDetail,
    element: <RequirePermission permission="occupancy:view" />,
    children: [
      { index: true, element: <BookingDetailScreen /> },
      { path: routePaths.pms.notFound, element: <PrivateNotFoundPage /> },
    ],
  },
  {
    path: routePaths.pms.bookingEdit,
    element: <RequirePermission permission="occupancy:view" />,
    children: [
      { index: true, element: <BookingDetailScreen /> },
      { path: routePaths.pms.notFound, element: <PrivateNotFoundPage /> },
    ],
  },
  {
    path: routePaths.pms.checkIn,
    element: <RequirePermission permission="front-desk:operate" />,
    children: [
      { index: true, element: <CheckInScreen /> },
      { path: routePaths.pms.notFound, element: <PrivateNotFoundPage /> },
    ],
  },
  {
    path: routePaths.pms.guestAccount,
    element: <RequirePermission permission="front-desk:operate" />,
    children: [
      { index: true, element: <GuestAccountScreen /> },
      { path: routePaths.pms.notFound, element: <PrivateNotFoundPage /> },
    ],
  },
  {
    path: routePaths.pms.checkOut,
    element: <RequirePermission permission="front-desk:operate" />,
    children: [
      { index: true, element: <CheckOutScreen /> },
      { path: routePaths.pms.notFound, element: <PrivateNotFoundPage /> },
    ],
  },
];

const dedicatedPmsPaths = new Set<string>([
  routePaths.pms.reception,
  ...dedicatedPmsRoutes.map((route) => route.path),
]);

/**
 * Un placeholder ModuleHomePage por cada entrada de privateNavigation que
 * todavía no tiene pantalla propia. dashboard tiene su propia ruta arriba;
 * cualquier path que ya esté en dedicatedPmsRoutes se excluye aquí, así que
 * agregar una pantalla nueva a dedicatedPmsRoutes es lo único que hace
 * falta para que deje de mostrar el placeholder — no hay una segunda lista
 * que mantener sincronizada a mano.
 */
const placeholderPmsRoutes = privateNavigation
  .filter((item) => item.path !== routePaths.pms.dashboard && !dedicatedPmsPaths.has(item.path))
  .map((item) => ({
    path: item.path,
    element: <RequirePermission permission={item.permission} />,
    children: [
      { index: true, element: <ModuleHomePage title={item.label} /> },
      { path: routePaths.pms.notFound, element: <PrivateNotFoundPage /> },
    ],
  }));

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: routePaths.public.home, element: <SearchScreen /> },
      { path: routePaths.public.roomTypeDetail, element: <RoomDetailScreen /> },
      { path: routePaths.public.bookingNew, element: <BookingFormScreen /> },
      { path: routePaths.public.bookingConfirmation, element: <BookingConfirmationScreen /> },
      { path: routePaths.public.login, element: <LoginPage /> },
      { path: routePaths.public.register, element: <LoginPage /> },
      { path: routePaths.public.legacyLogin, element: <LoginPage /> },
      { path: routePaths.public.components, element: <ComponentsCatalogPage /> },
      { path: routePaths.public.notFound, element: <PublicNotFoundPage /> },
    ],
  },
  {
    element: <RequireSession />,
    children: [
      { path: routePaths.pms.dashboard, element: <PrivateSessionWorkspace /> },
      { path: routePaths.pms.reception, element: <PrivateSessionWorkspace role="reception" /> },
      {
        path: routePaths.pms.housekeeping,
        element: <PrivateSessionWorkspace role="housekeeping" />,
      },
      {
        path: routePaths.pms.roomService,
        element: <PrivateSessionWorkspace role="room-service" />,
      },
      { path: routePaths.pms.concierge, element: <PrivateSessionWorkspace role="concierge" /> },
      {
        path: routePaths.pms.cash,
        element: <PrivateSessionWorkspace role="admin" initialNav="Caja" />,
      },
      {
        path: routePaths.pms.users,
        element: <PrivateSessionWorkspace role="admin" initialNav="Usuarios y roles" />,
      },
      {
        path: routePaths.pms.rooms,
        element: <PrivateSessionWorkspace role="admin" initialNav="Habitaciones" />,
      },
      {
        path: routePaths.pms.roomTypes,
        element: <PrivateSessionWorkspace role="admin" initialNav="Habitaciones" />,
      },
      {
        path: routePaths.pms.root,
        element: <PrivateLayout />,
        children: [
          { index: true, element: <OperationsHomePage /> },
          { path: routePaths.pms.dashboard, element: <OperationsHomePage /> },
          ...placeholderPmsRoutes,
          ...dedicatedPmsRoutes,
          { path: routePaths.pms.notFound, element: <PrivateNotFoundPage /> },
        ],
      },
    ],
  },
]);
