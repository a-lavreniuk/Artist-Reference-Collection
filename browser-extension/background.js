import { checkArc, ensureCollection, importItem } from './lib/arcApi.js';
import { extractPinUrlsFromBoardHtml, parsePinMediaFromHtml } from './lib/pinterest/pinParse.js';
import { drainQueue, enqueue, queueLength, QUEUE_MAX } from './lib/queue.js';

const MENU_ID = 'arc-add-to-library';
const DRAIN_ALARM = 'arc-drain-queue';
const PIN_TAB_TIMEOUT_MS = 90_000;

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
  Accept: 'text/html,application/xhtml+xml'
};

/** @typedef {{ url: string, fallbackUrl?: string, mediaKind?: 'image' | 'video', website?: string, pageTitle?: string, name?: string, collectionId?: string, quiet?: boolean }} SavePayload */

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
 * @returns {Promise<void>}
 */
function waitForTabComplete(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Pin page load timed out'));
    }, PIN_TAB_TIMEOUT_MS);

    const listener = (updatedTabId, info) => {
      if (updatedTabId !== tabId || info.status !== 'complete') return;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };

    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) return;
      if (tab?.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });
  });
}

/**
 * @param {string} pinWebsite
 * @returns {Promise<SavePayload | null>}
 */
async function resolvePinPayload(pinWebsite) {
  const canonical = pinWebsite.split('?')[0];
  try {
    const res = await fetch(canonical, {
      redirect: 'follow',
      credentials: 'omit',
      headers: FETCH_HEADERS
    });
    if (res.ok) {
      const html = await res.text();
      const payload = parsePinMediaFromHtml(html, canonical);
      if (payload?.url) return payload;
    }
  } catch (err) {
    console.warn('[ARC board] pin fetch failed:', canonical, err);
  }

  const tab = await chrome.tabs.create({ url: canonical, active: false });
  try {
    await waitForTabComplete(tab.id);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      const payload = await chrome.tabs.sendMessage(tab.id, { type: 'arc:resolve-pin-page' });
      if (payload?.url) return payload;
    } catch (err) {
      console.warn('[ARC board] pin resolve message failed:', canonical, err);
    }

    return null;
  } catch (err) {
    console.warn('[ARC board] pin resolve failed:', canonical, err);
    return null;
  } finally {
    try {
      await chrome.tabs.remove(tab.id);
    } catch {
      /* tab may already be closed */
    }
  }
}

/**
 * @param {{ boardUrl: string, pins: Array<{ website: string, name?: string }> }} board
 * @returns {Promise<typeof board>}
 */
async function mergeBoardPinsFromHtml(board) {
  try {
    const res = await fetch(board.boardUrl.split('?')[0], {
      redirect: 'follow',
      credentials: 'omit',
      headers: FETCH_HEADERS
    });
    if (!res.ok) return board;

    const html = await res.text();
    const fromHtml = extractPinUrlsFromBoardHtml(html, board.boardUrl);
    const seen = new Set(board.pins.map((pin) => pin.website.split('?')[0]));

    for (const pin of fromHtml) {
      const website = pin.website.split('?')[0];
      if (seen.has(website)) continue;
      seen.add(website);
      board.pins.push({ website });
    }

    console.info(`[ARC board] after HTML merge: ${board.pins.length} pin URLs`);
  } catch (err) {
    console.warn('[ARC board] board HTML merge failed:', err);
  }

  return board;
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

  board = await mergeBoardPinsFromHtml(board);

  console.info(`[ARC board] collected ${board.pins.length} pin URLs`);

  const collection = await ensureCollection(board.boardName);
  if (!collection.ok) {
    return { ok: false, code: collection.code, message: collection.message };
  }

  const total = board.pins.length;
  let imported = 0;
  let failed = 0;

  for (let index = 0; index < board.pins.length; index += 1) {
    const pin = board.pins[index];
    const resolved = await resolvePinPayload(pin.website);
    if (!resolved?.url) {
      failed += 1;
      console.warn('[ARC board] pin resolve returned no media:', pin.website);
      onProgress?.({ done: index + 1, total });
      continue;
    }

    const result = await importItem({
      url: resolved.url,
      fallbackUrl: resolved.mediaKind === 'video' ? undefined : resolved.fallbackUrl,
      mediaKind: resolved.mediaKind,
      website: resolved.website ?? pin.website ?? board.boardUrl,
      pageTitle: board.boardName,
      name: resolved.name ?? pin.name,
      collectionId: collection.id,
      quiet: true
    });

    if (result.ok) {
      imported += 1;
    } else {
      failed += 1;
      console.warn('[ARC board] pin import failed:', resolved.url, result.message ?? result.code);
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
      contexts: ['image', 'video']
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
  if (info.menuItemId !== MENU_ID) return;

  void (async () => {
    const isVideo = info.mediaType === 'video';
    const pageUrl = tab?.url ?? info.pageUrl ?? undefined;
    const pinWebsite =
      typeof pageUrl === 'string' && /\/pin\/\d+/i.test(pageUrl) ? pageUrl.split('?')[0] : null;

    /** @type {SavePayload | null} */
    let payload = null;

    if (pinWebsite) {
      payload = await resolvePinPayload(pinWebsite);
    }

    if (!payload?.url && tab?.id && info.srcUrl) {
      try {
        const resolved = await chrome.tabs.sendMessage(tab.id, {
          type: 'arc:resolve-save',
          url: info.srcUrl,
          website: pageUrl,
          pageTitle: tab?.title,
          mediaKind: isVideo ? 'video' : undefined
        });
        if (resolved?.url) {
          payload = resolved;
        }
      } catch {
        // Content script unavailable — fall back to raw URL below.
      }
    }

    if (!payload?.url && info.srcUrl && !/^blob:/i.test(info.srcUrl)) {
      payload = {
        url: info.srcUrl,
        mediaKind: isVideo ? 'video' : 'image',
        website: pageUrl,
        pageTitle: tab?.title
      };
    }

    if (!payload?.url) return;
    await trySaveOrQueue(payload);
  })();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'arc:save-image' && typeof message.url === 'string') {
    void trySaveOrQueue({
      url: message.url,
      fallbackUrl: typeof message.fallbackUrl === 'string' ? message.fallbackUrl : undefined,
      mediaKind: message.mediaKind === 'video' || message.mediaKind === 'image' ? message.mediaKind : undefined,
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

  if (message?.type === 'arc:resolve-pin-payload' && typeof message.pinWebsite === 'string') {
    void resolvePinPayload(message.pinWebsite).then((payload) => sendResponse(payload));
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
