import React from 'react';
import { useNotificationStore } from '../../store/notificationStore';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message?: string | null;
  name?: string | null;
  stack?: string | null;
  componentStack?: string | null;
}

// ErrorBoundary clásico basado en clase para capturar errores de render
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: undefined, name: undefined, stack: undefined, componentStack: undefined };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, message: error?.message || String(error), name: error?.name, stack: error?.stack };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    try {
      const store = useNotificationStore.getState();
      store.showError('Error de aplicación', error?.message || String(error), { scope: 'error-boundary' });
      // Log extendido a consola para depuración
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary] Render error', error, errorInfo);
      this.setState({ componentStack: errorInfo?.componentStack });
  } catch (error) { console.warn('ErrorBoundary: failed to reset error state:', error); }
  }

  handleReload = () => {
    this.setState({ hasError: false, message: undefined });
    try {
      // Fuerza una recarga completa para limpiar estado corrupto
      window.location.reload();
  } catch (error) { console.warn('ErrorBoundary: failed to log error:', error); }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
          <div className="max-w-lg w-full bg-white rounded shadow p-6">
            <h1 className="text-lg font-semibold text-red-700 mb-2">Se produjo un error</h1>
            <p className="text-sm text-gray-700 mb-4">
              {this.state.message || 'Algo salió mal al renderizar la interfaz.'}
            </p>
            {this.state.name && (
              <p className="text-xs text-gray-600 mb-2">Tipo: {this.state.name}</p>
            )}
            {this.state.stack && (
              <details className="mb-3">
                <summary className="text-xs text-gray-600 cursor-pointer">Ver stack</summary>
                <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-48 whitespace-pre-wrap">{this.state.stack}</pre>
              </details>
            )}
            {this.state.componentStack && (
              <details className="mb-3">
                <summary className="text-xs text-gray-600 cursor-pointer">Componente</summary>
                <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-48 whitespace-pre-wrap">{this.state.componentStack}</pre>
              </details>
            )}
            <div className="flex gap-2">
              <button
                onClick={this.handleReload}
                className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
              >
                Recargar
              </button>
              <button
                onClick={() => this.setState({ hasError: false })}
                className="px-3 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Intentar continuar
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
