import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Last-resort UI so a rendering crash never leaves a blank screen. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('OSSensa crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" style={{ padding: '48px 24px', maxWidth: 560, margin: '0 auto' }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ opacity: 0.75, marginBottom: 16 }}>
            OSSensa hit an unexpected error. Your search history is stored locally
            and is not lost.
          </p>
          <pre style={{ fontSize: 12, opacity: 0.6, whiteSpace: 'pre-wrap', marginBottom: 20 }}>
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ padding: '8px 18px', cursor: 'pointer' }}
          >
            Reload OSSensa
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
