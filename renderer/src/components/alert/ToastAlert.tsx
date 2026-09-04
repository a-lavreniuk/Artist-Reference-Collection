import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { AlertVariant } from './types';
import { playNotificationSound } from '../../services/audioNotification';
import { useOverlayMotion } from '../../motion';

/** Как в UI-kit (`setTimeout(..., 6400)`). */
const ARC_UI_KIT_ALERT_AUTO_DISMISS_MS = 6400;

/** Action в тосте — outline; цвет обводки задаёт `.alert-*` в UI-Kit. */

type Props = {
  message: string;
  variant?: AlertVariant;
  onClose: () => void;
  /** Автоскрытие, мс (0 — не скрывать). */
  autoDismissMs?: number;
  hostClassName?: string;
  withSound?: boolean;
  onActivate?: () => void;
  /** Кнопка действия (например «Отменить»). */
  actionLabel?: string;
  onAction?: () => void;
  /**
   * Без собственного fixed-host — для стека в NotificationHost.
   * Escape не слушает (хост закрывает только верхний toast).
   */
  embedded?: boolean;
  /** Слушать Escape (по умолчанию true, если не embedded). */
  listenEscape?: boolean;
};

/** Фиксированный toast внизу экрана (Figma Alert, node 52:2131). */
export default function ToastAlert({
  message,
  variant = 'info',
  onClose,
  autoDismissMs = ARC_UI_KIT_ALERT_AUTO_DISMISS_MS,
  hostClassName,
  withSound = true,
  onActivate,
  actionLabel,
  onAction,
  embedded = false,
  listenEscape
}: Props) {
  const [closing, setClosing] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const lastSoundKeyRef = useRef<string | null>(null);
  const shouldListenEscape = listenEscape ?? !embedded;

  const alertRef = useOverlayMotion<HTMLDivElement>(!closing, {
    preset: 'fade-slide-up',
    onExitComplete: () => onCloseRef.current()
  });

  const requestClose = useCallback(() => {
    setClosing(true);
  }, []);

  useEffect(() => {
    if (!withSound) return;
    const key = `${variant}:${message}`;
    if (lastSoundKeyRef.current === key) return;
    lastSoundKeyRef.current = key;
    playNotificationSound(variant);
  }, [message, variant, withSound]);

  useEffect(() => {
    if (autoDismissMs <= 0 || closing) return;
    const id = window.setTimeout(() => requestClose(), autoDismissMs);
    return () => window.clearTimeout(id);
  }, [message, variant, autoDismissMs, closing, requestClose]);

  useEffect(() => {
    if (!shouldListenEscape) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [requestClose, shouldListenEscape]);

  const handleActivateClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('.demo-alert__close')) return;
    if ((e.target as HTMLElement).closest('.demo-alert__action')) return;
    onActivate?.();
  };

  const alert = (
    <div
      ref={alertRef}
      className={`alert alert-${variant}${onActivate ? ' alert--clickable' : ''}`}
      role="status"
      {...(onActivate
        ? {
            onClick: handleActivateClick,
            onKeyDown: (e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onActivate();
              }
            },
            tabIndex: 0
          }
        : {})}
    >
      <p className="demo-alert__message">{message}</p>
      {actionLabel && onAction ? (
        <span className="arc-ui-kit-scope demo-alert__action-wrap" data-btn-size="s">
          <button
            type="button"
            className="btn btn-outline btn-ds demo-alert__action"
            onClick={(e) => {
              e.stopPropagation();
              onAction();
              requestClose();
            }}
          >
            <span className="btn-ds__value">{actionLabel}</span>
          </button>
        </span>
      ) : null}
      <button
        type="button"
        className="demo-alert__close"
        aria-label="Закрыть уведомление"
        onClick={requestClose}
      >
        <svg className="demo-alert__close-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6L18 18" strokeWidth="2" strokeLinecap="round" />
          <path d="M18 6L6 18" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );

  if (embedded) {
    return (
      <div className={hostClassName ? `demo-alert-item ${hostClassName}` : 'demo-alert-item'} aria-live="polite" aria-atomic="true">
        {alert}
      </div>
    );
  }

  return (
    <div
      className={hostClassName ? `demo-alert-host ${hostClassName}` : 'demo-alert-host'}
      aria-live="polite"
      aria-atomic="true"
    >
      {alert}
    </div>
  );
}

export type { AlertVariant as ToastAlertVariant };
