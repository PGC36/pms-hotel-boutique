import { useAuth } from './auth-context';

export function SessionStatus() {
  const { error, retry } = useAuth();
  return (
    <main className="public-page-shell">
      <section className="public-page-card">
        {error ? (
          <>
            <h1>No pudimos recuperar tu sesión</h1>
            <p role="alert">{error}</p>
            <button className="button primary" type="button" onClick={retry}>
              Reintentar
            </button>
          </>
        ) : (
          <p role="status">Comprobando sesión…</p>
        )}
      </section>
    </main>
  );
}
