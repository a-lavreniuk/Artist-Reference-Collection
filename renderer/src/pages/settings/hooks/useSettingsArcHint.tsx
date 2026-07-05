import { useMemo, type ReactNode } from 'react';
import { runningInElectronShell } from './settingsLibraryTypes';

export function useSettingsArcHint(): ReactNode | null {
  return useMemo(() => {
    if (typeof window === 'undefined' || window.arc) return null;
    const inElectron = runningInElectronShell();
    if (!inElectron) {
      return (
        <>
          Сейчас интерфейс открыт не в Electron. Выбор папки работает только в окне ARC после{' '}
          <code className="text-m">npm run dev</code>.
        </>
      );
    }
    return (
      <>
        Нет <code className="text-m">window.arc</code>. Выполните{' '}
        <code className="text-m">npm run build:main && npm run build:preload</code> и перезапустите dev.
      </>
    );
  }, []);
}
