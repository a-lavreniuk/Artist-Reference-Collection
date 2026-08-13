import { useCallback, useEffect, useState } from 'react';
import { showAppNotification } from '../../../../services/notificationService';
import { normalizeHex } from '../../../../utils/colorPicker';

/** Панель поиска закрывается fade-slide-down (--transition-base = 250ms) плюс запас. */
const PANEL_CLOSE_WAIT_MS = 350;

type UseColorEyedropperParams = {
  closePanel: () => void;
  openPanel: () => void;
  onColorChange: (hex: string) => void;
};

/** Живёт вне панели: closePanel размонтирует хук, но сессия пипетки продолжается. */
let sessionBusy = false;
const busyListeners = new Set<(busy: boolean) => void>();

function setSessionBusy(next: boolean): void {
  sessionBusy = next;
  busyListeners.forEach((listener) => listener(next));
}

export function useColorEyedropper({ closePanel, openPanel, onColorChange }: UseColorEyedropperParams) {
  const [busy, setBusy] = useState(sessionBusy);

  useEffect(() => {
    const onBusy = (next: boolean) => setBusy(next);
    busyListeners.add(onBusy);
    setBusy(sessionBusy);
    return () => {
      busyListeners.delete(onBusy);
    };
  }, []);

  const start = useCallback(async () => {
    if (sessionBusy) return;
    const startPicker = window.arc?.colorEyedropperStart;
    if (!startPicker) {
      showAppNotification({
        message: 'Пипетка недоступна в этом окружении',
        variant: 'warning',
        skipPrefCheck: true
      });
      return;
    }

    setSessionBusy(true);
    closePanel();
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, PANEL_CLOSE_WAIT_MS);
    });

    try {
      const result = await startPicker();
      openPanel();
      if (result.ok) {
        const hex = normalizeHex(result.hex);
        if (hex) onColorChange(hex);
        return;
      }
      if (result.error) {
        showAppNotification({
          message: result.error,
          variant: 'danger',
          skipPrefCheck: true
        });
      }
    } catch (err) {
      openPanel();
      showAppNotification({
        message: err instanceof Error ? err.message : 'Не удалось взять цвет',
        variant: 'danger',
        skipPrefCheck: true
      });
    } finally {
      setSessionBusy(false);
    }
  }, [closePanel, onColorChange, openPanel]);

  return { start, busy };
}
