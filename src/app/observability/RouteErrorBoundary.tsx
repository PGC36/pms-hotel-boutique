import { useEffect } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { AppErrorFallback } from './AppErrorFallback';
import { reportError } from './error-reporting';

/**
 * errorElement de las rutas raíz. React Router atrapa los errores de render de sus
 * rutas antes de que lleguen al error boundary de main.tsx, así que aquí se reportan
 * a mano. Sin esto, además, React Router muestra su pantalla por defecto con el
 * mensaje del error.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();
  useEffect(() => {
    if (!isRouteErrorResponse(error)) reportError(error);
  }, [error]);
  return <AppErrorFallback />;
}
