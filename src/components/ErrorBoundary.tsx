import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Unexpected error' };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Basketball Dynasty error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <p className="eyebrow">Front office systems interrupted</p>
          <h1 className="title-lg">Something broke behind the scenes.</h1>
          <p className="body" style={{ marginBottom: 20 }}>
            Your local save should still be intact. Reload the app to return to your franchise.
          </p>
          {this.state.message && (
            <p className="body" style={{ marginBottom: 20, fontSize: 12, opacity: 0.7, wordBreak: 'break-word' }}>
              {this.state.message}
            </p>
          )}
          <button type="button" className="btn btn-primary" onClick={() => window.location.assign('/')}>
            Return to main menu
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
