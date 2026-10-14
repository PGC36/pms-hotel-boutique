import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, LogIn, Sparkles } from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { routePaths } from '@/app/routes';
import { useAuth } from '@/modules/auth/components/auth-context';
import { SessionStatus } from '@/modules/auth/components/SessionStatus';
import { authService } from '@/modules/auth/services/auth-service';
import { getLoginDestination } from '@/private/routes/navigation';
import '@/public/pages/staff-login.css';

export function GuestAccessScreen() {
  const { session, isLoading, error: sessionError, registerGuest, linkGuest } = useAuth();
  const location = useLocation();
  const expired =
    (location.state as { guestExpired?: boolean } | null)?.guestExpired === true ||
    authService.isGuestAccessExpired();
  const [mode, setMode] = useState<'register' | 'temporary'>('register');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => authService.clearGuestAccessExpired(), []);

  if (isLoading || sessionError) return <SessionStatus />;
  if (session) return <Navigate replace to={getLoginDestination(undefined, session)} />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      if (mode === 'register') await registerGuest(code, email, password);
      else await linkGuest(code);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible validar tu reserva.');
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
            AURORA<small>HOTEL &amp; RESORT</small>
          </span>
        </Link>
        <p className="eyebrow">Acceso de huésped</p>
        <h1>{mode === 'register' ? 'Crea tu acceso' : 'Código de reserva'}</h1>
        <p className="muted">
          {mode === 'register'
            ? 'Usa el código de tu reserva y el correo registrado para crear tu contraseña. El código confirma que la reserva es tuya.'
            : 'Ingresa el código de confirmación para acceder temporalmente a tu estancia, sin crear contraseña.'}
        </p>
        {expired && (
          <p className="staff-login-success" role="status">
            Tu acceso venció. Ingresa otra vez el código de reserva.
          </p>
        )}
        <form className="staff-login-form" onSubmit={submit} aria-busy={isSubmitting}>
          <label htmlFor="guest-reservation-code">
            Código de reserva
            <input
              id="guest-reservation-code"
              name="code"
              type="text"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
              disabled={isSubmitting}
            />
          </label>
          {mode === 'register' && (
            <>
              <label htmlFor="guest-registration-email">
                Correo electrónico de la reserva
                <input
                  id="guest-registration-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isSubmitting}
                />
              </label>
              <label htmlFor="guest-registration-password">
                Crear contraseña
                <input
                  id="guest-registration-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isSubmitting}
                />
                <small>Al menos 8 caracteres</small>
              </label>
            </>
          )}
          {error && (
            <p id="guest-registration-error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary" type="submit" disabled={isSubmitting}>
            {mode === 'register' ? (
              <LogIn size={16} aria-hidden="true" />
            ) : (
              <KeyRound size={16} aria-hidden="true" />
            )}
            {isSubmitting
              ? 'Validando reserva...'
              : mode === 'register'
                ? 'Crear cuenta y entrar'
                : 'Ingresar con código'}
          </button>
        </form>
        <div className="guest-secondary-access" style={{ marginTop: '1.25rem' }}>
          <button
            type="button"
            id="guest-toggle-temporary-mode"
            className="button secondary"
            onClick={() => {
              setMode(mode === 'register' ? 'temporary' : 'register');
              setError(null);
            }}
            disabled={isSubmitting}
          >
            {mode === 'register'
              ? 'Solo quiero entrar temporalmente'
              : 'Crear cuenta con este código'}
          </button>
        </div>
        <p className="muted">
          ¿Ya tienes cuenta? <Link to={routePaths.public.login}>Inicia sesión</Link>
        </p>
        <Link className="button secondary" to={routePaths.public.home}>
          Volver al inicio
        </Link>
      </section>
    </main>
  );
}
