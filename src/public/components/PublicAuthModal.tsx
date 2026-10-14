import { useEffect, useState, type FormEvent } from 'react';
import { Sparkles, X } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { routePaths } from '@/app/routes';
import { useAuth } from '@/modules/auth/components/auth-context';
import { SessionStatus } from '@/modules/auth/components/SessionStatus';
import { getLoginDestination } from '@/private/routes/navigation';
import '../pages/staff-login.css';

type PublicAuthModalProps = {
  onClose: () => void;
};

export function PublicAuthModal({ onClose }: PublicAuthModalProps) {
  const { session, isLoading, error: sessionError, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!session) return;
    onClose();
    navigate(getLoginDestination(location.state?.from, session), { replace: true });
  }, [location.state, navigate, onClose, session]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loginWith(email, password);
  }

  async function loginWith(loginEmail: string, loginPassword: string) {
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await login({ email: loginEmail, password: loginPassword });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo iniciar sesión.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="visitor-auth-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="visitor-auth-modal staff-login"
        role="dialog"
        aria-modal="true"
        aria-labelledby="visitor-auth-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="visitor-auth-modal-close"
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
        <div className="login-brand staff-login-brand">
          <span className="brand-mark" aria-hidden="true">
            <Sparkles size={18} />
          </span>
          <span>
            AURORA<small>HOTEL &amp; RESORT</small>
          </span>
        </div>
        <p className="eyebrow">Acceso Aurora</p>
        <h1 id="visitor-auth-title">Iniciar sesión</h1>
        <p className="muted">
          Usa el mismo acceso para tu estancia de huésped o tu espacio de trabajo.
        </p>
        {isLoading || sessionError ? (
          <SessionStatus />
        ) : (
          <form className="staff-login-form" onSubmit={submit} aria-busy={isSubmitting}>
            <label htmlFor="modal-auth-email">
              Correo electrónico
              <input
                id="modal-auth-email"
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isSubmitting}
              />
            </label>
            <label htmlFor="modal-auth-password">
              Contraseña
              <input
                id="modal-auth-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSubmitting}
              />
            </label>
            {error && (
              <p id="modal-login-error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Ingresando...' : 'Iniciar sesión'}
            </button>
          </form>
        )}
        <p className="muted visitor-auth-modal-switch">
          ¿Primera vez como huésped?{' '}
          <Link
            className="staff-login-register-link"
            to={routePaths.public.register}
            onClick={onClose}
          >
            Crea tu acceso con el código de reserva
          </Link>
        </p>
      </section>
    </div>
  );
}
