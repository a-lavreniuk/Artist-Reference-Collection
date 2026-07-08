import { checkArc, ensureCollection, importItem } from './lib/arcApi.js';
import { drainQueue, enqueue, queueLength, QUEUE_MAX } from './lib/queue.js';

const MENU_ID = 'arc-add-to-library';
const DRAIN_ALARM = 'arc-drain-queue';

/** @typedef {{ url: string, fallbackUrl?: string, website?: string, pageTitle?: string, name?: string, collectionId?: string, quiet?: boolean }} SavePayload */

async function syncDrainAlarm() {
  const len = await queueLength();
  if (len === 0) {
    await chrome.alarms.clear(DRAIN_ALARM);
    return;
  }
  const existing = await chrome.alarms.get(DRAIN_ALARM);
  if (!existing) {
    chrome.alarms.create(DRAIN_ALARM, { periodInMinutes: 1 });
  }
}

async function drainPendingQueue() {
  const arc = await checkArc();
  if (!arc.ok) return 0;

  const processed = await drainQueue(async (item) => {
    const result = await importItem(item);
    return result.ok ? 'ok' : 'retry';
  });

  await syncDrainAlarm();
  return processed;
}

/**
 * @param {SavePayload} payload
 * @returns {Promise<{ ok: true } | { ok: false, code: string, message?: string, pending?: number, queueMax?: number }>}
 */
async function trySaveOrQueue(payload) {
  const arc = await checkArc();
  if (!arc.ok) {
    if (arc.reason === 'disabled') {
      return { ok: false, code: 'disabled' };
    }
    const q = await enqueue(payload);
    if (q === 'full') {
      return { ok: false, code: 'queue_full', pending: await queueLength(), queueMax: QUEUE_MAX };
    }
    await syncDrainAlarm();
    return {
      ok: false,
      code: 'queued',
      pending: await queueLength(),
      queueMax: QUEUE_MAX
    };
  }

  const result = await importItem(payload);
  if (result.ok) {
    void drainPendingQueue();
    return { ok: true };
  }
  if (result.code === 'no_library' || result.code === 'disabled') {
    return { ok: false, code: result.code, message: result.message };
  }
  return { ok: false, code: 'error', message: result.message };
}

/**
 * @param {number} tabId
 * @param {(detail: { done: number, total: number }) => void} [onProgress]
 */
async function downloadPinterestBoard(tabId, onProgress) {
  const arc = await checkArc();
  if (!arc.ok) {
    return { ok: false, code: arc.reason === 'disabled' ? 'disabled' : 'offline' };
  }

  let board;
  try {
    board = await chrome.tabs.sendMessage(tabId, { type: 'arc:collect-pinterest-board' });
  } catch {
    return { ok: false, code: 'no_content' };
  }

  if (!board?.pins?.length) {
    return { ok: false, code: 'no_pins' };
  }

  console.info(
    `[ARC board] collected ${board.pins.length} pins:`,
    board.pins.map((p) => ({ url: p.url, fallbackUrl: p.fallbackUrl }))
  );

  const collection = await ensureCollection(board.boardName);
  if (!collection.ok) {
    return { ok: false, code: collection.code, message: collection.message };
  }

  const total = board.pins.length;
  let imported = 0;
  let failed = 0;

  for (let index = 0; index < board.pins.length; index += 1) {
    const pin = board.pins[index];
    const result = await importItem({
      url: pin.url,
      fallbackUrl: pin.fallbackUrl,
      website: pin.website ?? board.boardUrl,
      pageTitle: board.boardName,
      name: pin.name,
      collectionId: collection.id,
      quiet: true
    });

    if (result.ok) {
      imported += 1;
    } else {
      failed += 1;
      console.warn('[ARC board] pin import failed:', pin.url, result.message ?? result.code);
    }

    onProgress?.({ done: index + 1, total });
  }

  if (imported > 0) {
    void drainPendingQueue();
  }

  return {
    ok: imported > 0,
    code: imported > 0 ? 'done' : 'error',
    imported,
    failed,
    total,
    collectionId: collection.id,
    collectionName: collection.name,
    created: collection.created
  };
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: chrome.i18n.getMessage('contextMenuTitle'),
      contexts: ['image']
    });
  });
  void syncDrainAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  void drainPendingQueue();
  void syncDrainAlarm();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === DRAIN_ALARM) {
    void drainPendingQueue();
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.srcUrl) return;

  void (async () => {
    /** @type {SavePayload} */
    let payload = {
      url: info.srcUrl,
      website: tab?.url ?? info.pageUrl ?? undefined,
      pageTitle: tab?.title
    };

    if (tab?.id) {
      try {
        const resolved = await chrome.tabs.sendMessage(tab.id, {
          type: 'arc:resolve-save',
          url: info.srcUrl,
          website: payload.website,
          pageTitle: payload.pageTitle
        });
        if (resolved?.url) {
          payload = resolved;
        }
      } catch {
        // Content script unavailable — use raw URL from context menu.
      }
    }

    await trySaveOrQueue(payload);
  })();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'arc:save-image' && typeof message.url === 'string') {
    void trySaveOrQueue({
      url: message.url,
      fallbackUrl: typeof message.fallbackUrl === 'string' ? message.fallbackUrl : undefined,
      website: typeof message.website === 'string' ? message.website : undefined,
      pageTitle: typeof message.pageTitle === 'string' ? message.pageTitle : undefined,
      name: typeof message.name === 'string' ? message.name : undefined
    }).then((res) => sendResponse(res));
    return true;
  }

  if (message?.type === 'arc:popup-opened') {
    void (async () => {
      const arc = await checkArc();
      const pending = await queueLength();
      if (arc.ok && pending > 0) {
        void drainPendingQueue();
      }
      sendResponse({ arc, drained: 0, pending, queueMax: QUEUE_MAX });
    })();
    return true;
  }

  if (message?.type === 'arc:download-pinterest-board' && typeof message.tabId === 'number') {
    void downloadPinterestBoard(message.tabId, (progress) => {
      chrome.runtime.sendMessage({
        type: 'arc:board-download-progress',
        tabId: message.tabId,
        ...progress
      }).catch(() => {});
    }).then((res) => sendResponse(res));
    return true;
  }

  return false;
});

void queueLength().then((len) => {
  if (len > 0) void syncDrainAlarm();
});
