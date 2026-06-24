import path from 'path';
import { Worker } from 'worker_threads';

import type { CardIndexRow, ListCardsParams } from './types';

type Pending = {
  resolve: (rows: CardIndexRow[]) => void;
  reject: (error: Error) => void;
};

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function workerScriptPath(): string {
  return path.join(__dirname, 'listCardsWorker.js');
}

function rejectAllPending(error: Error): void {
  for (const item of pending.values()) {
    item.reject(error);
  }
  pending.clear();
}

function ensureWorker(): Worker {
  if (worker) return worker;

  const child = new Worker(workerScriptPath());
  worker = child;

  child.on('message', (message: { id: number; ok: boolean; rows?: CardIndexRow[]; error?: string }) => {
    const item = pending.get(message.id);
    if (!item) return;
    pending.delete(message.id);
    if (message.ok && message.rows) {
      item.resolve(message.rows);
      return;
    }
    item.reject(new Error(message.error ?? 'listCardsWorker failed'));
  });

  child.on('error', (error) => {
    rejectAllPending(error instanceof Error ? error : new Error(String(error)));
    worker = null;
  });

  child.on('exit', (code) => {
    if (pending.size > 0) {
      rejectAllPending(new Error(`listCardsWorker exited (${String(code)})`));
    }
    worker = null;
  });

  return child;
}

export function queryListCardsInWorker(libraryRoot: string, params: ListCardsParams): Promise<CardIndexRow[]> {
  const id = nextId++;
  return new Promise<CardIndexRow[]>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ensureWorker().postMessage({ id, libraryRoot, params });
  });
}

export function shutdownListCardsWorker(): void {
  if (!worker) return;
  worker.terminate();
  worker = null;
  rejectAllPending(new Error('listCardsWorker shutdown'));
}
