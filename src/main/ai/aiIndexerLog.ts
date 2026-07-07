import { BrowserWindow } from 'electron';

export type AiIndexLogLevel = 'log' | 'warn' | 'error';

export type AiIndexLogPayload = {
  level: AiIndexLogLevel;
  message: string;
  detail: Record<string, unknown> | null;
  at: number;
};

function broadcastAiIndexLog(payload: AiIndexLogPayload): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('arc:ai-index-log', payload);
    }
  }
}

function emitAiIndexLog(level: AiIndexLogLevel, message: string, detail?: Record<string, unknown>): void {
  const suffix = detail && Object.keys(detail).length > 0 ? ` ${JSON.stringify(detail)}` : '';
  const line = `[ARC AI] ${message}${suffix}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);

  broadcastAiIndexLog({
    level,
    message,
    detail: detail ?? null,
    at: Date.now()
  });
}

/** Логи индексации AI: main-консоль + DevTools renderer через arc:ai-index-log. */
export function logAiIndexer(message: string, detail?: Record<string, unknown>): void {
  emitAiIndexLog('log', message, detail);
}

export function logAiIndexerWarn(message: string, detail?: Record<string, unknown>): void {
  emitAiIndexLog('warn', message, detail);
}

export function logAiIndexerError(message: string, err?: unknown): void {
  const detail =
    err instanceof Error
      ? { error: err.message, ...(err.stack ? { stack: err.stack.split('\n')[0] } : {}) }
      : err != null
        ? { error: String(err) }
        : undefined;
  emitAiIndexLog('error', message, detail);
}
