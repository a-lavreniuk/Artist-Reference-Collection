import { checkArc, importItem } from './lib/arcApi.js';
import { drainQueue, enqueue, queueLength, QUEUE_MAX } from './lib/queue.js';

const MENU_ID = 'arc-add-to-library';
const DRAIN_ALARM = 'arc-drain-queue';

/** @typedef {{ url: string, website?: string, pageTitle?: string }} SavePayload */

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
  void trySaveOrQueue({
    url: info.srcUrl,
    website: tab?.url ?? info.pageUrl,
    pageTitle: tab?.title
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'arc:save-image' && typeof message.url === 'string') {
    void trySaveOrQueue({
      url: message.url,
      website: typeof message.website === 'string' ? message.website : undefined,
      pageTitle: typeof message.pageTitle === 'string' ? message.pageTitle : undefined
    }).then((res) => sendResponse(res));
    return true;
  }

  if (message?.type === 'arc:popup-opened') {
    void (async () => {
      const arc = await checkArc();
      const drained = await drainPendingQueue();
      const pending = await queueLength();
      sendResponse({ arc, drained, pending, queueMax: QUEUE_MAX });
    })();
    return true;
  }

  return false;
});

void queueLength().then((len) => {
  if (len > 0) void syncDrainAlarm();
});
