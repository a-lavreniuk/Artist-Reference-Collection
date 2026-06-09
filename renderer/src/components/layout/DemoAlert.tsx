import { useEffect, useRef } from 'react';

/** Как в `initDemoAlerts` / `showAlert` в arc-ui.html (`setTimeout(..., 3200)`). */
const ARC_UI_KIT_ALERT_AUTO_DISMISS_MS = 3200;

/** Типы блоков EL-ALERT в arc-ui (см. `.alert-*`). */
export type DemoAlertVariant = 'info' | 'success' | 'warning' | 'danger';

type Props = {
  message: string;
  /** По умолчанию `info` — информационное уведомление (`.alert-info`). */
  variant?: DemoAlertVariant;
  onClose: () => void;
  /**
   * Автоскрытие, мс (0 — не скрывать). По умолчанию как в UI-kit: {@link ARC_UI_KIT_ALERT_AUTO_DISMISS_MS}.
   */
  autoDismissMs?: number;
  /** Доп. класс на хост (например, z-index поверх вложенных модалок). */
  hostClassName?: string;
};

/**
 * Фиксированное уведомление внизу экрана (разметка EL-ALERT / `demo-alert-host` из arc-ui).
 */
export default function DemoAlert({
  message,
  variant = 'info',
  onClose,
  autoDismissMs = ARC_UI_KIT_ALERT_AUTO_DISMISS_MS,
  hostClassName
}: Props) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (autoDismissMs <= 0) return;
    const id = window.setTimeout(() => onCloseRef.current(), autoDismissMs);
    return () => window.clearTimeout(id);
  }, [message, variant, autoDismissMs]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className={hostClassName ? `demo-alert-host ${hostClassName}` : 'demo-alert-host'}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className={`alert alert-${variant}`} role="status">
        <p className="demo-alert__message">{message}</p>
        <button type="button" className="demo-alert__close" aria-label="Закрыть уведомление" onClick={onClose}>
          <svg className="demo-alert__close-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6L18 18" strokeWidth="2" strokeLinecap="round" />
            <path d="M18 6L6 18" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
