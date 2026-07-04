import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AlertVariant } from './types';
import { playNotificationSound } from '../../services/audioNotification';
import { useOverlayMotion } from '../../motion';

/** Как в UI-kit (`setTimeout(..., 3200)`). */
const ARC_UI_KIT_ALERT_AUTO_DISMISS_MS = 3200;

type Props = {
  message: string;
  variant?: AlertVariant;
  onClose: () => void;
  /** Автоскрытие, мс (0 — не скрывать). */
  autoDismissMs?: number;
  hostClassName?: string;
  withSound?: boolean;
};

/** Фиксированный toast внизу экрана (Figma Alert, node 52:2131). */
export default function ToastAlert({
  message,
  variant = 'info',
  onClose,
  autoDismissMs = ARC_UI_KIT_ALERT_AUTO_DISMISS_MS,
  hostClassName,
  withSound = true
}: Props) {
  const [closing, setClosing] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const lastSoundKeyRef = useRef<string | null>(null);

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
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [requestClose]);

  return (
    <div
      className={hostClassName ? `demo-alert-host ${hostClassName}` : 'demo-alert-host'}
      aria-live="polite"
      aria-atomic="true"
    >
      <div ref={alertRef} className={`alert alert-${variant}`} role="status">
        <p className="demo-alert__message">{message}</p>
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
    </div>
  );
}

export type { AlertVariant as ToastAlertVariant };
