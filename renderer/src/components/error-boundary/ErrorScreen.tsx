import { useLayoutEffect, useRef, useState } from 'react';
import EmptyState from '../empty-state/EmptyState';
import NotificationHost from '../notifications/NotificationHost';
import { EMPTY_STATE_COPY } from '../../content/emptyStates';
import { openBugReportForm } from '../../services/bugReportService';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';

function formatErrorDetails(error: Error): string {
  const message = error.message?.trim() || String(error);
  const stack = error.stack?.trim();
  if (!stack) return message;
  if (stack.includes(message)) return stack;
  return `${message}\n\n${stack}`;
}

type Props = {
  error: Error;
};

/**
 * Полноэкранный экран сбоя: EmptyState + сворачиваемые подробности.
 * Свой NotificationHost — AppLayout уже размонтирован.
 */
export default function ErrorScreen({ error }: Props) {
  const copy = EMPTY_STATE_COPY.appCrash;
  const details = formatErrorDetails(error);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copyButtonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (copyButtonRef.current) {
      void hydrateArcNavbarIcons(copyButtonRef.current);
    }
  }, [copyState]);

  const handleCopyDetails = async () => {
    try {
      await navigator.clipboard.writeText(details);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  const copyLabel =
    copyState === 'copied'
      ? 'Скопировано'
      : copyState === 'failed'
        ? 'Не удалось скопировать'
        : 'Скопировать подробности';

  return (
    <NotificationHost>
      <div className="arc-error-screen" role="alert" aria-live="assertive">
        <EmptyState
          {...copy}
          fill
          primaryActionIconClass="arc-icon-refresh"
          onPrimaryAction={() => {
            window.location.reload();
          }}
          onSecondaryAction={() => {
            void openBugReportForm();
          }}
        >
          <details className="arc-error-screen__details">
            <summary className="arc-error-screen__details-summary">
              <span className="arc-error-screen__details-summary-label">Подробности</span>
              <button
                ref={copyButtonRef}
                type="button"
                className="btn btn-outline btn-ds btn-s arc-error-screen__copy"
                aria-label="Скопировать подробности ошибки в буфер обмена"
                onClick={(event) => {
                  event.preventDefault();
                  void handleCopyDetails();
                }}
              >
                <span className="btn-ds__value">{copyLabel}</span>
                <span className="btn-ds__icon arc-icon-copy" aria-hidden="true" />
              </button>
            </summary>
            <pre className="text-code-s arc-error-screen__details-body">{details}</pre>
          </details>
        </EmptyState>
      </div>
    </NotificationHost>
  );
}
