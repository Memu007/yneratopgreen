import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error no controlado en la interfaz:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main role="alert" style={{ padding: '3rem', textAlign: 'center' }}>
          <h1>Ocurrió un error</h1>
          <p>Recargá la página para volver a intentarlo.</p>
        </main>
      );
    }

    return this.props.children;
  }
}
