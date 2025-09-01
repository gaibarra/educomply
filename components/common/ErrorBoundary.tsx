import React from 'react';

type Props = {
  /** Nombre lógico de la sección/componente que envuelves (para mensajes y logs). */
  name?: string;
  /** Callback opcional para limpiar estado externo al reintentar. */
  onReset?: () => void;
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
  info: React.ErrorInfo | null;
};

class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ info });
    // Aquí podrías enviar el error a un servicio (Sentry, LogRocket, etc.)
    // console.error('[ErrorBoundary]', this.props.name, error, info?.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, info: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 border border-red-300 bg-red-50 rounded-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-red-700">
                Ocurrió un error en {this.props.name ?? 'esta sección'}.
              </p>
              <p className="text-sm text-red-600">
                Puedes reintentar. Si persiste, revisa el detalle técnico.
              </p>
            </div>
            <button
              onClick={this.handleReset}
              className="px-3 py-1.5 text-sm rounded-md bg-red-600 text-white hover:bg-red-700"
            >
              Reintentar
            </button>
          </div>
          <details className="mt-3 text-xs text-red-700 whitespace-pre-wrap">
            <summary className="cursor-pointer">Detalle técnico</summary>
            {this.state.error?.message}
            {'\n'}
            {this.state.info?.componentStack}
          </details>
        </div>
      );
    }
    return this.props.children as React.ReactElement;
  }
}

export default ErrorBoundary;
