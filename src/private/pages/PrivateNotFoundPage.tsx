import { Link } from 'react-router-dom';
import { routePaths } from '@/app/routes';

export function PrivateNotFoundPage() {
  return (
    <section className="content">
      <div className="welcome-row">
        <div>
          <p className="eyebrow">Error 404</p>
          <h1>Página no encontrada</h1>
          <p className="muted">La página que buscas no está disponible en el panel operativo.</p>
          <Link className="button primary" to={routePaths.pms.dashboard}>
            Volver al panel operativo
          </Link>
        </div>
      </div>
    </section>
  );
}
