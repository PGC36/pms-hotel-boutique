import { Component, type ReactNode } from 'react';
import { AppErrorFallback } from './AppErrorFallback';

/** Error boundary sin Sentry (build sin VITE_SENTRY_DSN): misma pantalla, sin reportar. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? <AppErrorFallback /> : this.props.children;
  }
}
