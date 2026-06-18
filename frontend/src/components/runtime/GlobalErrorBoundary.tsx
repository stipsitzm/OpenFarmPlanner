import React from 'react';
import RuntimeErrorState from './RuntimeErrorState';

interface GlobalErrorBoundaryState {
  error: unknown;
  componentStack?: string;
}

export default class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  GlobalErrorBoundaryState
> {
  state: GlobalErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: unknown): GlobalErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error('[GlobalErrorBoundary] Unhandled render error:', error, info);
    this.setState({ componentStack: info.componentStack ?? undefined });
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <RuntimeErrorState
          variant="routeError"
          error={this.state.error}
          componentStack={this.state.componentStack}
        />
      );
    }

    return this.props.children;
  }
}
