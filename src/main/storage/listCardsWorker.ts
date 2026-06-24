import { parentPort } from 'worker_threads';

import type { ListCardsParams } from './types';
import { listCardsFromDb } from './libraryStorage';

if (!parentPort) {
  throw new Error('listCardsWorker must run as worker_threads worker');
}

parentPort.on('message', (message: { id: number; libraryRoot: string; params: ListCardsParams }) => {
  try {
    const rows = listCardsFromDb(message.libraryRoot, message.params);
    parentPort!.postMessage({ id: message.id, ok: true as const, rows });
  } catch (error) {
    parentPort!.postMessage({
      id: message.id,
      ok: false as const,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});
