import EmptyState from '../empty-state/EmptyState';
import NotificationHost from '../notifications/NotificationHost';
import { EMPTY_STATE_COPY } from '../../content/emptyStates';
import { openBugReportForm } from '../../services/bugReportService';

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
            <summary className="text-s arc-error-screen__details-summary">Подробности</summary>
            <pre className="text-code-s arc-error-screen__details-body">{details}</pre>
          </details>
        </EmptyState>
      </div>
    </NotificationHost>
  );
}
