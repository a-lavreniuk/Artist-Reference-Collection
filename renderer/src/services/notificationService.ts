import type { DemoAlertVariant } from '../components/layout/DemoAlert';
import type { NotificationPrefKey } from './appPreferences';

export const APP_NOTIFICATION_EVENT = 'arc:app-notification';

export type AppNotificationPayload = {
  message: string;
  variant: DemoAlertVariant;
  prefKey?: NotificationPrefKey;
  skipPrefCheck?: boolean;
};

export function showAppNotification(payload: AppNotificationPayload): void {
  window.dispatchEvent(new CustomEvent(APP_NOTIFICATION_EVENT, { detail: payload }));
}
