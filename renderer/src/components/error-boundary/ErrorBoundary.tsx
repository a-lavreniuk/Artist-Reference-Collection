import { Component, type ErrorInfo, type ReactNode } from 'react';
import ErrorScreen from './ErrorScreen';
import { markReactTreeCrashed } from './globalErrorHandlers';

type Props = {
  children: ReactNode;
  /** Не помечает всё дерево как упавшее — для вложенных зон (деталка). */
  isolate?: boolean;
};

type State = {
  error: Error | null;
};

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, _info: ErrorInfo): void {
    if (!this.props.isolate) {
      markReactTreeCrashed();
    }
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error);
    }
  }

  render(): ReactNode {
    if (this.state.error) {
      if (!this.props.isolate) {
        markReactTreeCrashed();
      }
      return <ErrorScreen error={this.state.error} />;
    }
    return this.props.children;
  }
}
