import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Changing this (e.g. the route) clears a previous error. */
  resetKey?: string;
}

interface State {
  error: Error | null;
  key: string | undefined;
}

/** Catches render errors (and failed lazy chunks) so one broken page does not blank the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[app] error de renderizado', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="card" role="alert" data-testid="error-boundary">
        <h2>Algo salió mal</h2>
        <p className="muted">
          No se pudo mostrar esta pantalla. Tu progreso está a salvo en este navegador. Puedes recargar la página o volver al inicio.
        </p>
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Recargar
          </button>
          <a className="btn" href="/" style={{ textDecoration: 'none' }}>
            Ir al inicio
          </a>
        </div>
      </section>
    );
  }
}
