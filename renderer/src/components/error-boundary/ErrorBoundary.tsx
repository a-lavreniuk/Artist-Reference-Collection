import { Component, type ErrorInfo, type ReactNode } from 'react';
import ErrorScreen from './ErrorScreen';
import { markReactTreeCrashed } from './globalErrorHandlers';

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    /* Раньше onerror→toast (setTimeout 0): помечаем до микрозадачи тоста. */
    markReactTreeCrashed();
    return { error };
  }

  componentDidCatch(error: Error, _info: ErrorInfo): void {
    markReactTreeCrashed();
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error);
    }
  }

  render(): ReactNode {
    if (this.state.error) {
      return <ErrorScreen error={this.state.error} />;
    }
    return this.props.children;
  }
}
