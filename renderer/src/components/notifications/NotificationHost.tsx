import { useCallback, useEffect, useState } from 'react';
import DemoAlert, { type DemoAlertVariant } from '../layout/DemoAlert';
import type { NotificationPrefKey } from '../../services/appPreferences';
import { getAppPreferencesSync } from '../../services/appPreferencesRuntime';
import { APP_NOTIFICATION_EVENT, type AppNotificationPayload } from '../../services/notificationService';

type ActiveAlert = {
  message: string;
  variant: DemoAlertVariant;
};

function isPrefEnabled(prefKey: NotificationPrefKey | undefined, skipPrefCheck: boolean | undefined): boolean {
  if (skipPrefCheck) return true;
  if (!prefKey) return true;
  const prefs = getAppPreferencesSync();
  return prefs[prefKey] === true;
}

export default function NotificationHost({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<ActiveAlert | null>(null);

  const dismiss = useCallback(() => setActive(null), []);

  useEffect(() => {
    const onNotify = (event: Event) => {
      const detail = (event as CustomEvent<AppNotificationPayload>).detail;
      if (!detail?.message) return;
      if (!isPrefEnabled(detail.prefKey, detail.skipPrefCheck)) return;

      setActive({ message: detail.message, variant: detail.variant ?? 'info' });
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
            message: 'Найдены дубликаты файлов',
            variant: 'warning',
            prefKey: 'notifyDuplicatesFound'
          } satisfies AppNotificationPayload
        })
      );
    });
  }, []);

  return (
    <>
      {children}
      {active ? (
        <DemoAlert message={active.message} variant={active.variant} onClose={dismiss} />
      ) : null}
    </>
  );
}
