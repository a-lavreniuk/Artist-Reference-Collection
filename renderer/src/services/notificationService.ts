import type { AlertVariant } from '../components/alert/types';
import type { NotificationPrefKey } from './appPreferences';

export const APP_NOTIFICATION_EVENT = 'arc:app-notification';

/** Окно отмены для undo-toast (Gmail/Figma-подобный интервал). */
export const UNDO_NOTIFICATION_DISMISS_MS = 16_000;

export type AppNotificationPayload = {
  message: string;
  variant: AlertVariant;
  prefKey?: NotificationPrefKey;
  skipPrefCheck?: boolean;
  /** 0 — только закрытие по крестику. */
  autoDismissMs?: number;
  withSound?: boolean;
  /** Клик по alert — переход (например /duplicates?from=alert). */
  navigateTo?: string;
  /** Стабильный id toast (для стека и dismiss). */
  id?: string;
  /** Подпись кнопки действия (например «Отменить»). */
  actionLabel?: string;
  /** Ключ callback в реестре — не сериализуется в DOM. */
  actionId?: string;
};

type NotificationActionHandler = () => void | Promise<void>;

const actionRegistry = new Map<string, NotificationActionHandler>();

let notificationSeq = 0;

function nextNotificationId(): string {
  notificationSeq += 1;
  return `arc-notify-${Date.now()}-${notificationSeq}`;
}

export function createNotificationId(): string {
  return nextNotificationId();
}

export function registerNotificationAction(
  actionId: string,
  handler: NotificationActionHandler
): void {
  actionRegistry.set(actionId, handler);
}

export function consumeNotificationAction(actionId: string): NotificationActionHandler | undefined {
  const handler = actionRegistry.get(actionId);
  actionRegistry.delete(actionId);
  return handler;
}

export function dropNotificationAction(actionId: string): void {
  actionRegistry.delete(actionId);
}

export function showAppNotification(payload: AppNotificationPayload): void {
  const id = payload.id ?? nextNotificationId();
  window.dispatchEvent(
    new CustomEvent(APP_NOTIFICATION_EVENT, {
      detail: { ...payload, id }
    })
  );
}

export type UndoableNotificationOptions = {
  message: string;
  variant?: AlertVariant;
  undo: NotificationActionHandler;
  autoDismissMs?: number;
  withSound?: boolean;
  prefKey?: NotificationPrefKey;
  skipPrefCheck?: boolean;
};

/** Toast с кнопкой «Отменить»; callback хранится в реестре до dismiss/действия. */
export function showUndoableNotification(options: UndoableNotificationOptions): void {
  const actionId = nextNotificationId();
  registerNotificationAction(actionId, options.undo);
  showAppNotification({
    message: options.message,
    variant: options.variant ?? 'success',
    autoDismissMs: options.autoDismissMs ?? UNDO_NOTIFICATION_DISMISS_MS,
    withSound: options.withSound,
    prefKey: options.prefKey,
    skipPrefCheck: options.skipPrefCheck,
    actionLabel: 'Отменить',
    actionId
  });
}
