import { Link } from 'react-router-dom';
import { routePaths } from '@/app/routes';

export function PublicNotFoundPage() {
  return (
    <main className="public-page-shell">
      <section className="public-page-card">
        <p className="eyebrow">Error 404</p>
        <h1>Página no encontrada</h1>
        <p className="muted">La página que buscas no está disponible. Puedes volver al inicio.</p>
        <Link className="button primary" to={routePaths.public.home}>
          Volver al inicio
        </Link>
      </section>
    </main>
  );
}
