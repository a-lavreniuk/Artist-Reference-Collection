import { useEffect } from 'react';
import { runArcMoodboardLibraryDiag } from './arcMoodboardLibraryDiag';

/** Регистрирует хук в DevTools; вызывается из App — не удаляется tree-shaking. */
export function installArcMoodboardLibraryDiag(): void {
  globalThis.__arcDiagMoodboardLibrary = runArcMoodboardLibraryDiag;
}

function printAiIndexLog(payload: {
  level: 'log' | 'warn' | 'error';
  message: string;
  detail: Record<string, unknown> | null;
}): void {
  const suffix = payload.detail ? ` ${JSON.stringify(payload.detail)}` : '';
  const line = `[ARC AI] ${payload.message}${suffix}`;
  if (payload.level === 'error') console.error(line);
  else if (payload.level === 'warn') console.warn(line);
  else console.log(line);
}

export function useArcMoodboardLibraryDiag(): void {
  useEffect(() => {
    installArcMoodboardLibraryDiag();

    const unsubLog = window.arc?.onAiIndexLog?.((payload) => {
      printAiIndexLog(payload);
    });

    return () => {
      unsubLog?.();
    };
  }, []);
}
