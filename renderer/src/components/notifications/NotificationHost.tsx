import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DemoAlert, { type DemoAlertVariant } from '../layout/DemoAlert';
import type { NotificationPrefKey } from '../../services/appPreferences';
import { getAppPreferencesSync } from '../../services/appPreferencesRuntime';
import { APP_NOTIFICATION_EVENT, type AppNotificationPayload } from '../../services/notificationService';

type ActiveAlert = {
  message: string;
  variant: DemoAlertVariant;
  autoDismissMs?: number;
  withSound?: boolean;
  navigateTo?: string;
};

function isPrefEnabled(prefKey: NotificationPrefKey | undefined, skipPrefCheck: boolean | undefined): boolean {
  if (skipPrefCheck) return true;
  if (!prefKey) return true;
  const prefs = getAppPreferencesSync();
  return prefs[prefKey] === true;
}

export default function NotificationHost({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [active, setActive] = useState<ActiveAlert | null>(null);

  const dismiss = useCallback(() => setActive(null), []);

  useEffect(() => {
    const onNotify = (event: Event) => {
      const detail = (event as CustomEvent<AppNotificationPayload>).detail;
      if (!detail?.message) return;
      if (!isPrefEnabled(detail.prefKey, detail.skipPrefCheck)) return;

      setActive({
        message: detail.message,
        variant: detail.variant ?? 'info',
        autoDismissMs: detail.autoDismissMs,
        withSound: detail.withSound,
        navigateTo: detail.navigateTo
      });
    };

    window.addEventListener(APP_NOTIFICATION_EVENT, onNotify);
    return () => window.removeEventListener(APP_NOTIFICATION_EVENT, onNotify);
  }, []);

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

  const onActivate = useCallback(() => {
    if (!active?.navigateTo) return;
    navigate(active.navigateTo);
    dismiss();
  }, [active?.navigateTo, dismiss, navigate]);

  return (
    <>
      {children}
      {active ? (
        <DemoAlert
          message={active.message}
          variant={active.variant}
          autoDismissMs={active.autoDismissMs}
          withSound={active.withSound}
          onClose={dismiss}
          onActivate={active.navigateTo ? onActivate : undefined}
        />
      ) : null}
    </>
  );
}
