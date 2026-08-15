import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ToastAlert, { type ToastAlertVariant } from '../alert/ToastAlert';
import type { NotificationPrefKey } from '../../services/appPreferences';
import { getAppPreferencesSync } from '../../services/appPreferencesRuntime';
import {
  APP_NOTIFICATION_DISMISS_EVENT,
  APP_NOTIFICATION_EVENT,
  consumeNotificationAction,
  createNotificationId,
  dropNotificationAction,
  upsertNotificationStack,
  type AppNotificationPayload
} from '../../services/notificationService';

type ActiveAlert = {
  id: string;
  message: string;
  variant: ToastAlertVariant;
  autoDismissMs?: number;
  withSound?: boolean;
  navigateTo?: string;
  actionLabel?: string;
  actionId?: string;
};

function isPrefEnabled(prefKey: NotificationPrefKey | undefined, skipPrefCheck: boolean | undefined): boolean {
  if (skipPrefCheck) return true;
  if (!prefKey) return true;
  const prefs = getAppPreferencesSync();
  return prefs[prefKey] === true;
}

export default function NotificationHost({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<ActiveAlert[]>([]);

  const dismiss = useCallback((id: string) => {
    setAlerts((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.actionId) dropNotificationAction(target.actionId);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  useEffect(() => {
    const onNotify = (event: Event) => {
      const detail = (event as CustomEvent<AppNotificationPayload>).detail;
      if (!detail?.message) return;
      if (!isPrefEnabled(detail.prefKey, detail.skipPrefCheck)) {
        if (detail.actionId) dropNotificationAction(detail.actionId);
        return;
      }

      const id = detail.id ?? createNotificationId();
      setAlerts((prev) => {
        const { next, droppedActionId } = upsertNotificationStack(prev, {
          id,
          message: detail.message,
          variant: detail.variant ?? 'info',
          autoDismissMs: detail.autoDismissMs,
          withSound: detail.withSound,
          navigateTo: detail.navigateTo,
          actionLabel: detail.actionLabel,
          actionId: detail.actionId
        });
        if (droppedActionId) dropNotificationAction(droppedActionId);
        return next;
      });
    };

    const onDismiss = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (id) dismiss(id);
    };

    window.addEventListener(APP_NOTIFICATION_EVENT, onNotify);
    window.addEventListener(APP_NOTIFICATION_DISMISS_EVENT, onDismiss);
    return () => {
      window.removeEventListener(APP_NOTIFICATION_EVENT, onNotify);
      window.removeEventListener(APP_NOTIFICATION_DISMISS_EVENT, onDismiss);
    };
  }, [dismiss]);

  useEffect(() => {
    if (!window.arc?.onDuplicatesFound) return undefined;
    return window.arc.onDuplicatesFound(() => {
      window.dispatchEvent(
        new CustomEvent(APP_NOTIFICATION_EVENT, {
          detail: {
            message: 'Найдены дубликаты — нажмите, чтобы просмотреть',
            variant: 'warning',
            prefKey: 'notifyDuplicatesFound',
            autoDismissMs: 0,
            navigateTo: '/duplicates?from=alert'
          } satisfies AppNotificationPayload
        })
      );
    });
  }, []);

  useEffect(() => {
    if (!window.arc?.onAutoTagApplied) return undefined;
    return window.arc.onAutoTagApplied((detail) => {
      const parts: string[] = [];
      if (detail.tags > 0) {
        parts.push(
          detail.cards === 1
            ? `добавлено меток: ${detail.tags}`
            : `меток на ${detail.cards} карт.: ${detail.tags}`
        );
      }
      if (detail.created > 0) {
        parts.push(`создано новых: ${detail.created}`);
      }
      if (parts.length === 0) return;
      window.dispatchEvent(
        new CustomEvent(APP_NOTIFICATION_EVENT, {
          detail: {
            message: `Автотегирование: ${parts.join(', ')}`,
            variant: 'brand',
            skipPrefCheck: true,
            autoDismissMs: 8000
          } satisfies AppNotificationPayload
        })
      );
    });
  }, []);

  useEffect(() => {
    if (alerts.length === 0) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const top = alerts[alerts.length - 1];
      if (top) dismiss(top.id);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [alerts, dismiss]);

  const runAction = useCallback(
    (alert: ActiveAlert) => {
      if (!alert.actionId) return;
      const handler = consumeNotificationAction(alert.actionId);
      if (!handler) return;
      void Promise.resolve(handler()).catch(() => {
        window.dispatchEvent(
          new CustomEvent(APP_NOTIFICATION_EVENT, {
            detail: {
              message: 'Не удалось отменить действие',
              variant: 'danger',
              skipPrefCheck: true
            } satisfies AppNotificationPayload
          })
        );
      });
    },
    []
  );

  return (
    <>
      {children}
      {alerts.length > 0 ? (
        <div className="demo-alert-stack" aria-live="polite">
          {alerts.map((alert) => (
            <ToastAlert
              key={alert.id}
              embedded
              listenEscape={false}
              message={alert.message}
              variant={alert.variant}
              autoDismissMs={alert.autoDismissMs}
              withSound={alert.withSound}
              onClose={() => dismiss(alert.id)}
              onActivate={
                alert.navigateTo
                  ? () => {
                      navigate(alert.navigateTo!);
                      dismiss(alert.id);
                    }
                  : undefined
              }
              actionLabel={alert.actionLabel}
              onAction={alert.actionLabel && alert.actionId ? () => runAction(alert) : undefined}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}
