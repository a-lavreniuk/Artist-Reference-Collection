export const QUEUE_KEY = 'arcImportQueue';
export const QUEUE_MAX = 50;

/**
 * @returns {Promise<Array<{ url: string, website?: string, pageTitle?: string }>>}
 */
export async function readQueue() {
  const data = await chrome.storage.local.get(QUEUE_KEY);
  const q = data[QUEUE_KEY];
  return Array.isArray(q) ? q : [];
}

/**
 * @param {Array<{ url: string, website?: string, pageTitle?: string }>} items
 */
async function writeQueue(items) {
  await chrome.storage.local.set({ [QUEUE_KEY]: items.slice(0, QUEUE_MAX) });
}

/**
 * @param {{ url: string, website?: string, pageTitle?: string }} item
 * @returns {Promise<'queued' | 'full'>}
 */
export async function enqueue(item) {
  const queue = await readQueue();
  if (queue.length >= QUEUE_MAX) return 'full';
  queue.push(item);
  await writeQueue(queue);
  return 'queued';
}

/**
 * @param {(item: { url: string, website?: string, pageTitle?: string }) => Promise<'ok' | 'retry'>} handler
 * @returns {Promise<number>}
 */
export async function drainQueue(handler) {
  let queue = await readQueue();
  if (queue.length === 0) return 0;

  let processed = 0;
  const remaining = [];

  for (const item of queue) {
    const result = await handler(item);
    if (result === 'ok') {
      processed += 1;
    } else {
      remaining.push(item);
    }
  }

  await writeQueue(remaining);
  return processed;
}

export async function queueLength() {
  return (await readQueue()).length;
}
