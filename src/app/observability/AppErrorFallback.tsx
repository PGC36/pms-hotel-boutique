/**
 * Pantalla de error inesperado. No muestra el mensaje ni la pila del error: el detalle
 * va a Sentry (si está configurado), no al usuario. Usa <a> y no <Link> porque
 * también se muestra fuera del router (AppErrorBoundary / SentryErrorBoundary).
 */
export function AppErrorFallback() {
  return (
    <main className="public-page-shell">
      <section className="public-page-card" role="alert">
        <p className="eyebrow">Error inesperado</p>
        <h1>Algo salió mal</h1>
        <p className="muted">
          No pudimos mostrar esta página. Recárgala o vuelve al inicio; si el problema continúa,
          comunícate con la recepción del hotel.
        </p>
        <button className="button primary" type="button" onClick={() => window.location.reload()}>
          Recargar la página
        </button>{' '}
        <a className="button secondary" href="/">
          Volver al inicio
        </a>
      </section>
    </main>
  );
}
