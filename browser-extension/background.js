import { checkArc, ensureCollection, importItem } from './lib/arcApi.js';
import {
  buildArtstationCardName,
  parseArtstationArtworkFromHtml
} from './lib/artstation/artworkParse.js';
import { parseArtstationProjectJson } from './lib/artstation/projectParse.js';
import {
  extractPostUrlsFromSavedHtml,
  parseInstagramPostFromHtml
} from './lib/instagram/postParse.js';
import { extractPinUrlsFromBoardHtml, parsePinMediaFromHtml } from './lib/pinterest/pinParse.js';
import { drainQueue, enqueue, queueLength, QUEUE_MAX } from './lib/queue.js';

const MENU_ID = 'arc-add-to-library';
const DRAIN_ALARM = 'arc-drain-queue';
const PIN_TAB_TIMEOUT_MS = 90_000;
const PAGE_TAB_TIMEOUT_MS = 90_000;

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
 * @param {number} [timeoutMs]
 * @returns {Promise<void>}
 */
function waitForTabComplete(tabId, timeoutMs = PIN_TAB_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Page load timed out'));
    }, timeoutMs);

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
 * @template T
 * @param {() => Promise<T | null | undefined>} fn
 * @returns {Promise<T | null | undefined>}
 */
async function retryOnce(fn) {
  let result = await fn();
  if (result) return result;
  await new Promise((resolve) => setTimeout(resolve, 800));
  return fn();
}

/**
 * @param {string} url
 * @param {string} messageType
 * @returns {Promise<object | null>}
 */
async function resolveFromBackgroundTab(url, messageType) {
  const canonical = url.split('?')[0];
  const tab = await chrome.tabs.create({ url: canonical, active: false });
  try {
    await waitForTabComplete(tab.id, PAGE_TAB_TIMEOUT_MS);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return await chrome.tabs.sendMessage(tab.id, { type: messageType });
  } catch (err) {
    console.warn(`[ARC] background tab resolve failed (${messageType}):`, canonical, err);
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
 * @param {number | undefined} tabId
 * @param {string} messageType
 * @returns {Promise<object | null>}
 */
async function resolveFromTab(tabId, messageType) {
  if (!tabId) return null;
  try {
    return await chrome.tabs.sendMessage(tabId, { type: messageType });
  } catch (err) {
    console.warn(`[ARC] tab resolve failed (${messageType}):`, tabId, err);
    return null;
  }
}

/**
 * @param {string} postUrl
 * @param {number} [tabId]
 * @returns {Promise<{ shortcode: string, author: string | null, caption: string | null, images: Array<{ url: string, name?: string }>, website: string } | null>}
 */
async function resolveInstagramPost(postUrl, tabId) {
  const canonical = postUrl.split('?')[0];

  const fromActiveTab = await resolveFromTab(tabId, 'arc:resolve-instagram-post-dom');
  if (fromActiveTab?.images?.length) return fromActiveTab;

  const fromFetch = await retryOnce(async () => {
    try {
      const res = await fetch(canonical, {
        redirect: 'follow',
        credentials: 'omit',
        headers: FETCH_HEADERS
      });
      if (!res.ok) return null;
      return parseInstagramPostFromHtml(await res.text(), canonical);
    } catch (err) {
      console.warn('[ARC instagram] post fetch failed:', canonical, err);
      return null;
    }
  });
  if (fromFetch?.images?.length) return fromFetch;

  const fromTab = await resolveFromBackgroundTab(canonical, 'arc:resolve-instagram-post-dom');
  if (fromTab?.images?.length) return fromTab;

  return null;
}

/**
 * @param {{ shortcode: string, images: Array<{ url: string, name?: string }>, website: string }} post
 * @param {string} collectionId
 * @returns {Promise<{ imported: number, failed: number }>}
 */
async function importInstagramPostImages(post, collectionId) {
  let imported = 0;
  let failed = 0;

  for (const image of post.images) {
    const result = await importItem({
      url: image.url,
      mediaKind: 'image',
      website: post.website,
      pageTitle: post.shortcode,
      name: image.name,
      collectionId,
      quiet: true
    });
    if (result.ok) imported += 1;
    else failed += 1;
  }

  return { imported, failed };
}

/**
 * @param {string} postUrl
 * @param {number} [tabId]
 * @returns {Promise<{ ok: boolean, code?: string, imported?: number, failed?: number, collectionName?: string }>}
 */
async function saveInstagramPost(postUrl, tabId) {
  const arc = await checkArc();
  if (!arc.ok) {
    return { ok: false, code: arc.reason === 'disabled' ? 'disabled' : 'offline' };
  }

  const post = await resolveInstagramPost(postUrl, tabId);
  if (!post?.images?.length) {
    return { ok: false, code: 'no_media' };
  }

  const collection = await ensureCollection(post.shortcode);
  if (!collection.ok) {
    return { ok: false, code: collection.code, message: collection.message };
  }

  const { imported, failed } = await importInstagramPostImages(post, collection.id);
  if (imported > 0) void drainPendingQueue();

  return {
    ok: imported > 0,
    code: imported > 0 ? 'done' : 'error',
    imported,
    failed,
    collectionName: collection.name
  };
}

/**
 * @param {number} tabId
 * @param {(detail: { done: number, total: number }) => void} [onProgress]
 */
async function downloadInstagramSaved(tabId, onProgress) {
  const arc = await checkArc();
  if (!arc.ok) {
    return { ok: false, code: arc.reason === 'disabled' ? 'disabled' : 'offline' };
  }

  let saved;
  try {
    saved = await chrome.tabs.sendMessage(tabId, { type: 'arc:collect-instagram-saved' });
  } catch {
    return { ok: false, code: 'no_content' };
  }

  if (!saved?.posts?.length) {
    return { ok: false, code: 'no_posts' };
  }

  try {
    const res = await fetch(saved.collectionUrl.split('?')[0], {
      redirect: 'follow',
      credentials: 'omit',
      headers: FETCH_HEADERS
    });
    if (res.ok) {
      const fromHtml = extractPostUrlsFromSavedHtml(await res.text(), saved.collectionUrl);
      const seen = new Set(saved.posts.map((post) => post.shortcode));
      for (const post of fromHtml) {
        if (seen.has(post.shortcode)) continue;
        seen.add(post.shortcode);
        saved.posts.push(post);
      }
    }
  } catch (err) {
    console.warn('[ARC instagram] saved HTML merge failed:', err);
  }

  const total = saved.posts.length;
  let importedPosts = 0;
  let failedPosts = 0;
  let importedCards = 0;

  for (let index = 0; index < saved.posts.length; index += 1) {
    const entry = saved.posts[index];
    const post = await retryOnce(() => resolveInstagramPost(entry.website));
    if (!post?.images?.length) {
      failedPosts += 1;
      onProgress?.({ done: index + 1, total });
      continue;
    }

    const collection = await ensureCollection(post.shortcode);
    if (!collection.ok) {
      failedPosts += 1;
      onProgress?.({ done: index + 1, total });
      continue;
    }

    const result = await importInstagramPostImages(post, collection.id);
    if (result.imported > 0) {
      importedPosts += 1;
      importedCards += result.imported;
    } else {
      failedPosts += 1;
    }

    onProgress?.({ done: index + 1, total });
  }

  if (importedCards > 0) void drainPendingQueue();

  return {
    ok: importedPosts > 0,
    code: importedPosts > 0 ? 'done' : 'error',
    imported: importedCards,
    importedPosts,
    failed: failedPosts,
    total,
    collectionName: saved.collectionName
  };
}

/**
 * @param {string} artworkUrl
 * @param {number} [tabId]
 * @returns {Promise<ReturnType<typeof parseArtstationArtworkFromHtml>>}
 */
async function resolveArtstationArtwork(artworkUrl, tabId) {
  const canonical = artworkUrl.split('?')[0];
  const hashId = /\/artwork\/([A-Za-z0-9_-]+)/i.exec(canonical)?.[1];

  if (hashId && tabId) {
    const fromProjectJson = await resolveFromTab(tabId, 'arc:resolve-artstation-artwork-dom');
    if (fromProjectJson?.images?.length || fromProjectJson?.videoUrl) return fromProjectJson;
  }

  if (hashId) {
    const fromProjectFetch = await retryOnce(async () => {
      try {
        const res = await fetch(`https://www.artstation.com/projects/${hashId}.json`, {
          redirect: 'follow',
          credentials: 'omit',
          headers: {
            ...FETCH_HEADERS,
            Accept: 'application/json, text/plain, */*'
          }
        });
        if (!res.ok) return null;
        return parseArtstationProjectJson(await res.json(), canonical);
      } catch (err) {
        console.warn('[ARC artstation] project JSON fetch failed:', canonical, err);
        return null;
      }
    });
    if (fromProjectFetch?.images?.length || fromProjectFetch?.videoUrl) return fromProjectFetch;
  }

  const fromFetch = await retryOnce(async () => {
    try {
      const res = await fetch(canonical, {
        redirect: 'follow',
        credentials: 'omit',
        headers: FETCH_HEADERS
      });
      if (!res.ok) return null;
      return parseArtstationArtworkFromHtml(await res.text(), canonical);
    } catch (err) {
      console.warn('[ARC artstation] artwork fetch failed:', canonical, err);
      return null;
    }
  });
  if (fromFetch?.images?.length || fromFetch?.videoUrl) return fromFetch;

  const fromTab = await resolveFromBackgroundTab(canonical, 'arc:resolve-artstation-artwork-dom');
  if (fromTab?.images?.length || fromTab?.videoUrl) return fromTab;

  return null;
}

/**
 * @param {NonNullable<Awaited<ReturnType<typeof resolveArtstationArtwork>>>} artwork
 * @param {string} collectionId
 * @returns {Promise<{ imported: number, failed: number }>}
 */
async function importArtstationArtworkMedia(artwork, collectionId) {
  let imported = 0;
  let failed = 0;

  if (artwork.mediaKind === 'video' && artwork.videoUrl) {
    const result = await importItem({
      url: artwork.videoUrl,
      mediaKind: 'video',
      website: artwork.website,
      pageTitle: artwork.title ?? artwork.artworkId,
      name: buildArtstationCardName(artwork.title, artwork.author),
      collectionId,
      quiet: true
    });
    if (result.ok) imported += 1;
    else failed += 1;
    return { imported, failed };
  }

  for (const image of artwork.images) {
    const result = await importItem({
      url: image.url,
      mediaKind: 'image',
      website: artwork.website,
      pageTitle: artwork.title ?? artwork.artworkId,
      name: image.name,
      collectionId,
      quiet: true
    });
    if (result.ok) imported += 1;
    else failed += 1;
  }

  return { imported, failed };
}

/**
 * @param {number} tabId
 * @param {(detail: { done: number, total: number }) => void} [onProgress]
 */
async function downloadArtstationAlbum(tabId, onProgress) {
  const arc = await checkArc();
  if (!arc.ok) {
    return { ok: false, code: arc.reason === 'disabled' ? 'disabled' : 'offline' };
  }

  let album;
  try {
    album = await chrome.tabs.sendMessage(tabId, { type: 'arc:collect-artstation-album' });
  } catch {
    return { ok: false, code: 'no_content' };
  }

  if (!album?.items?.length) {
    return { ok: false, code: 'no_items' };
  }

  const collection = await ensureCollection(album.collectionName);
  if (!collection.ok) {
    return { ok: false, code: collection.code, message: collection.message };
  }

  const total = album.items.length;
  let imported = 0;
  let failed = 0;

  for (let index = 0; index < album.items.length; index += 1) {
    const item = album.items[index];

    if (item.imageUrl) {
      const result = await importItem({
        url: item.imageUrl,
        mediaKind: 'image',
        website: item.website,
        pageTitle: album.albumName,
        name: buildArtstationCardName(album.albumName, album.artistName, index, album.items.length),
        collectionId: collection.id,
        quiet: true
      });
      if (result.ok) imported += 1;
      else failed += 1;
      onProgress?.({ done: index + 1, total });
      continue;
    }

    const artwork = await retryOnce(() => resolveArtstationArtwork(item.website, tabId));
    if (!artwork?.images?.length && !artwork?.videoUrl) {
      failed += 1;
      onProgress?.({ done: index + 1, total });
      continue;
    }

    const result = await importArtstationArtworkMedia(artwork, collection.id);
    imported += result.imported;
    failed += result.failed > 0 && result.imported === 0 ? 1 : 0;
    onProgress?.({ done: index + 1, total });
  }

  if (imported > 0) void drainPendingQueue();

  return {
    ok: imported > 0,
    code: imported > 0 ? 'done' : 'error',
    imported,
    failed,
    total,
    collectionId: collection.id,
    collectionName: collection.name
  };
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
    const instagramPostUrl =
      typeof pageUrl === 'string' && /instagram\.com\/(?:p|reel|tv)\//i.test(pageUrl)
        ? pageUrl.split('?')[0]
        : null;

    /** @type {SavePayload | null} */
    let payload = null;

    if (instagramPostUrl) {
      const saved = await saveInstagramPost(instagramPostUrl, tab?.id);
      if (saved.ok) return;
    }

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

  if (message?.type === 'arc:save-instagram-post' && typeof message.postUrl === 'string') {
    void saveInstagramPost(message.postUrl, sender.tab?.id).then((res) => sendResponse(res));
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

  if (message?.type === 'arc:resolve-artstation-artwork-payload' && typeof message.artworkUrl === 'string') {
    void (async () => {
      const artwork = await resolveArtstationArtwork(message.artworkUrl);
      if (!artwork) {
        sendResponse(null);
        return;
      }
      if (artwork.mediaKind === 'video' && artwork.videoUrl) {
        sendResponse({
          url: artwork.videoUrl,
          mediaKind: 'video',
          website: artwork.website,
          pageTitle: artwork.title ?? artwork.artworkId,
          name: buildArtstationCardName(artwork.title, artwork.author)
        });
        return;
      }
      const first = artwork.images[0];
      if (!first?.url) {
        sendResponse(null);
        return;
      }
      sendResponse({
        url: first.url,
        mediaKind: 'image',
        website: artwork.website,
        pageTitle: artwork.title ?? artwork.artworkId,
        name: first.name ?? buildArtstationCardName(artwork.title, artwork.author)
      });
    })();
    return true;
  }

  if (message?.type === 'arc:download-pinterest-board' && typeof message.tabId === 'number') {
    void downloadPinterestBoard(message.tabId, (progress) => {
      chrome.runtime.sendMessage({
        type: 'arc:bulk-download-progress',
        bulkKind: 'pinterest-board',
        tabId: message.tabId,
        ...progress
      }).catch(() => {});
    }).then((res) => sendResponse(res));
    return true;
  }

  if (message?.type === 'arc:download-instagram-saved' && typeof message.tabId === 'number') {
    void downloadInstagramSaved(message.tabId, (progress) => {
      chrome.runtime.sendMessage({
        type: 'arc:bulk-download-progress',
        bulkKind: 'instagram-saved',
        tabId: message.tabId,
        ...progress
      }).catch(() => {});
    }).then((res) => sendResponse(res));
    return true;
  }

  if (message?.type === 'arc:download-artstation-album' && typeof message.tabId === 'number') {
    void downloadArtstationAlbum(message.tabId, (progress) => {
      chrome.runtime.sendMessage({
        type: 'arc:bulk-download-progress',
        bulkKind: 'artstation-album',
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
