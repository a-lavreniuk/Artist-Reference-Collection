import { showAppNotification } from '../../services/notificationService';

const RUNTIME_ERROR_TOAST =
  'Произошла ошибка. Приложение продолжает работать.';

/** Полный экран ErrorBoundary уже показан — не дублировать тостом. */
let reactTreeCrashed = false;

let lastToastAt = 0;
const TOAST_THROTTLE_MS = 3000;

let handlersRegistered = false;

export function markReactTreeCrashed(): void {
  reactTreeCrashed = true;
}

export function isReactTreeCrashed(): boolean {
  return reactTreeCrashed;
}

function showRuntimeErrorToast(): void {
  if (reactTreeCrashed) return;
  const now = Date.now();
  if (now - lastToastAt < TOAST_THROTTLE_MS) return;
  lastToastAt = now;
  showAppNotification({
    message: RUNTIME_ERROR_TOAST,
    variant: 'danger',
    skipPrefCheck: true
  });
}

/**
 * Глобальный перехват: пока React-дерево живо — тост.
 * Полноэкранный экран только из ErrorBoundary.
 */
export function registerGlobalErrorHandlers(): void {
  if (handlersRegistered || typeof window === 'undefined') return;
  handlersRegistered = true;

  window.addEventListener('error', (event) => {
    /* Ошибки загрузки ресурсов (img/script) — не runtime. */
    if (event.target !== window) return;
    window.setTimeout(() => {
      showRuntimeErrorToast();
    }, 0);
  });

  window.addEventListener('unhandledrejection', () => {
    showRuntimeErrorToast();
  });
}
