import { useEffect, useState } from 'react';
import { BedDouble, ShieldCheck, Sparkles } from 'lucide-react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { routePaths } from '@/app/routes';
import { PublicAuthModal } from '@/public/components/PublicAuthModal';

export function PublicLayout() {
  const location = useLocation();
  const [authMode, setAuthMode] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const isLoginPage =
    location.pathname === routePaths.public.login ||
    location.pathname === routePaths.public.register ||
    location.pathname === routePaths.public.legacyLogin;
  const activeSection = location.hash.replace('#', '') || 'habitaciones';

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const updateHeaderState = () => {
      const nextScrolled = window.scrollY > 8;
      setHeaderScrolled((current) => (current === nextScrolled ? current : nextScrolled));
    };

    updateHeaderState();
    window.addEventListener('scroll', updateHeaderState, { passive: true });

    return () => window.removeEventListener('scroll', updateHeaderState);
  }, []);

  return (
    <div className="visitor-page">
      {!isLoginPage ? (
        <header className={`visitor-header ${headerScrolled ? 'is-scrolled' : ''}`}>
          <Link className="brand visitor-brand" to={routePaths.public.home}>
            <span className="brand-mark" aria-hidden="true">
              <Sparkles size={18} />
            </span>
            <span>
              AURORA
              <small>HOTEL & RESORT</small>
            </span>
          </Link>

          <div className="visitor-tabs" role="navigation" aria-label="Secciones publicas">
            <Link
              className={`visitor-tab ${activeSection === 'habitaciones' ? 'active' : ''}`}
              to="/#habitaciones"
            >
              <BedDouble size={15} aria-hidden="true" />
              <span className="visitor-tab-label">Habitaciones</span>
            </Link>
            <Link
              className={`visitor-tab ${activeSection === 'amenidades' ? 'active' : ''}`}
              to="/#amenidades"
            >
              <Sparkles size={15} aria-hidden="true" />
              <span className="visitor-tab-label">Amenidades</span>
            </Link>
            <Link
              className={`visitor-tab ${activeSection === 'politicas' ? 'active' : ''}`}
              to="/#politicas"
            >
              <ShieldCheck size={15} aria-hidden="true" />
              <span className="visitor-tab-label">Politicas</span>
            </Link>
          </div>

          <nav className="visitor-auth" aria-label="Navegacion publica">
            <button className="visitor-link" type="button" onClick={() => setAuthMode(true)}>
              Iniciar sesion
            </button>
          </nav>
        </header>
      ) : null}
      <Outlet />
      {authMode ? <PublicAuthModal onClose={() => setAuthMode(false)} /> : null}
    </div>
  );
}
