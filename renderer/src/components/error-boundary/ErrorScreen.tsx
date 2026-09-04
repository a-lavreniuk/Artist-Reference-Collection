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
 * Полноэкранный экран сбоя: EmptyState + лог (Figma 2380:15816).
 * Свой NotificationHost — AppLayout уже размонтирован.
 */
export default function ErrorScreen({ error }: Props) {
  const copy = EMPTY_STATE_COPY.appCrash;
  const details = formatErrorDetails(error);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const screenRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (screenRef.current) {
      void hydrateArcNavbarIcons(screenRef.current);
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
        : 'Скопировать в буфер';

  return (
    <NotificationHost>
      <div ref={screenRef} className="arc-error-screen" role="alert" aria-live="assertive">
        <EmptyState
          {...copy}
          fill
          primaryActionIconClass="arc-icon-refresh"
          secondaryActionIconClass="arc-icon-bug"
          onPrimaryAction={() => {
            window.location.reload();
          }}
          onSecondaryAction={() => {
            void openBugReportForm();
          }}
        >
          <div className="arc-error-screen__log arc-ui-kit-scope" data-btn-size="s" data-input-size="m">
            <label className="field arc-error-screen__log-field">
              <textarea
                className="input textarea arc-error-screen__log-input"
                value={details}
                readOnly
                aria-label="Подробности ошибки"
              />
            </label>
            <button
              type="button"
              className="btn btn-outline btn-ds btn-s arc-error-screen__copy"
              aria-label="Скопировать подробности ошибки в буфер обмена"
              onClick={() => {
                void handleCopyDetails();
              }}
            >
              <span className="btn-ds__value">{copyLabel}</span>
            </button>
          </div>
        </EmptyState>
      </div>
    </NotificationHost>
  );
}
