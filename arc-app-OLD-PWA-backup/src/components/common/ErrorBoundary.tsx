/**
 * Error Boundary - отлавливает ошибки React и показывает fallback UI
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './Button';
import './ErrorBoundary.css';

interface Props {
  children: ReactNode;
  /** Функция для сброса состояния (опционально) */
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary поймал ошибку:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });

    // Вызываем callback если передан
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary__content">
            <svg width="96" height="96" viewBox="0 0 24 24" fill="none" className="error-boundary__icon">
              <path
                d="M12 8V12M12 16H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            <h2 className="h2" style={{ marginBottom: '8px' }}>
              Что-то пошло не так
            </h2>

            <p className="text-m" style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Произошла ошибка при отображении этого раздела
            </p>

            {this.state.error && (
              <div className="error-boundary__details">
                <p className="text-s" style={{ color: 'var(--text-error)', marginBottom: '8px' }}>
                  <strong>Ошибка:</strong> {this.state.error.toString()}
                </p>
                
                {this.state.errorInfo && (
                  <details className="error-boundary__stack">
                    <summary className="text-s" style={{ cursor: 'pointer', marginBottom: '8px' }}>
                      Подробности (для разработчика)
                    </summary>
                    <pre className="text-s" style={{ overflow: 'auto', maxHeight: '200px' }}>
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
              <Button variant="primary" onClick={this.handleReset}>
                Попробовать снова
              </Button>
              <Button variant="secondary" onClick={() => window.location.href = '/'}>
                Вернуться на главную
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

