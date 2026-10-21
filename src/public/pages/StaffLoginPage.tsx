import { useState, type FormEvent } from 'react';
import { Sparkles } from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { routePaths } from '@/app/routes';
import { useAuth } from '@/modules/auth/components/auth-context';
import { SessionStatus } from '@/modules/auth/components/SessionStatus';
import { GuestAccessScreen } from '@/modules/guest-portal/components/GuestAccessScreen';
import { getLoginDestination } from '@/private/routes/navigation';
import './staff-login.css';

export function StaffLoginPage() {
  const location = useLocation();
  // Keep the guest stay/code flow available; the standard login detects the account role.
  if (location.pathname === routePaths.public.register) return <GuestAccessScreen />;
  return <StaffLoginForm />;
}

function StaffLoginForm() {
  const { session, isLoading, error: sessionError, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading || sessionError) return <SessionStatus />;
  if (session) return <Navigate replace to={getLoginDestination(location.state?.from, session)} />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Espacios accidentales al inicio o al final del correo no impiden iniciar sesión.
    await loginWith(email.trim(), password);
  }

  async function loginWith(loginEmail: string, loginPassword: string) {
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await login({ email: loginEmail, password: loginPassword });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'No se pudo iniciar sesión. Intenta nuevamente.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="public-page-shell">
      <section className="public-page-card staff-login">
        <Link className="login-brand staff-login-brand" to={routePaths.public.home}>
          <span className="brand-mark" aria-hidden="true">
            <Sparkles size={18} />
          </span>
          <span>
            AURORA
            <small>HOTEL & RESORT</small>
          </span>
        </Link>
        <p className="eyebrow">Acceso Aurora</p>
        <h1>Iniciar sesión</h1>
        <p className="muted">
          Ingresa con el mismo correo y contraseña. Te llevaremos automáticamente a tu espacio de
          huésped o de trabajo.
        </p>

        <form className="staff-login-form" onSubmit={submit} aria-busy={isSubmitting}>
          <label htmlFor="staff-email">
            Correo electrónico
            <input
              id="staff-email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isSubmitting}
              aria-describedby={error ? 'login-error' : undefined}
              aria-invalid={!!error}
            />
          </label>

          <label htmlFor="staff-password">
            Contraseña
            <input
              id="staff-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting}
              aria-describedby={error ? 'login-error' : undefined}
              aria-invalid={!!error}
            />
          </label>

          {error && (
            <p id="login-error" role="alert">
              {error}
            </p>
          )}

          <button className="button primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Ingresando...' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="muted">
          ¿Primera vez como huésped?{' '}
          <Link className="staff-login-register-link" to={routePaths.public.register}>
            Crea tu acceso con el código de reserva
          </Link>
        </p>
        <Link className="button secondary" to={routePaths.public.home}>
          Volver al inicio
        </Link>
      </section>
    </main>
  );
}
