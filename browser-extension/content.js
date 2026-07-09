(() => {
const NS = (window.__ARC__ = window.__ARC__ || {});
const {
  findSaveableTarget,
  resolveSaveFromTarget,
  resolveSaveFromUrl,
  resolvePinPageMedia,
  waitForPinPageMedia,
  isDirectMediaUrl,
  isPinterestPinPageUrl,
  findPinWebsiteFromTarget,
  collectPinterestBoardPins,
  getPinterestBoardMeta,
  isPinterestBoardUrl,
  isInstagramPostUrl,
  collectInstagramSavedPosts,
  isInstagramSavedCollectionUrl,
  getInstagramSavedMeta,
  isArtstationAlbumUrl,
  getArtstationAlbumMeta,
  collectArtstationAlbumItems,
  isArtstationArtworkUrl,
  waitForArtstationArtworkMedia
} = NS;

const MIN_IMAGE_PX = 64;
const HOVER_DELAY_MS = 120;
const BTN_SIZE = 32;
const BTN_INSET = 8;
const FEEDBACK_MS = 900;

const IMAGE_PLUS_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M5.5 4.5C6.05228 4.5 6.5 4.94772 6.5 5.5C6.5 6.05228 6.05228 6.5 5.5 6.5C4.94772 6.5 4.5 6.05228 4.5 5.5C4.5 4.94772 4.94772 4.5 5.5 4.5Z" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.5 14.5L9.58579 8.41421C10.3668 7.63317 11.6332 7.63316 12.4142 8.41421L14.5 10.5" stroke="currentColor" stroke-width="1"/><path d="M13.5 0.5V4.5" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.5 7V12.5C14.5 13.6046 13.6046 14.5 12.5 14.5H3.5C2.39543 14.5 1.5 13.6046 1.5 12.5V3.5C1.5 2.39543 2.39543 1.5 3.5 1.5H8" stroke="currentColor" stroke-width="1" stroke-linecap="round"/><path d="M11.5 2.5H15.5" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const CHECK_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M13.5 4.5L5.99935 11.5L2.5 8.5" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const CLOSE_ICON = `<svg width="16" height="16" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const STATE_CLASS = {
  idle: 'arc-ext-hover-btn--idle',
  loading: 'arc-ext-hover-btn--loading',
  success: 'arc-ext-hover-btn--success',
  error: 'arc-ext-hover-btn--error',
  queue: 'arc-ext-hover-btn--queue'
};

let saveHost = null;
let saveAnchor = null;
let saveBtn = null;
let iconGlyph = null;
let activeImage = null;
let hoverTimer = null;
let hideTimer = null;
let moveRaf = 0;
let saveInFlight = false;

function isLargeEnough(el) {
  const rect = el.getBoundingClientRect();
  return rect.width >= MIN_IMAGE_PX && rect.height >= MIN_IMAGE_PX;
}

function setIcon(svg) {
  if (iconGlyph) iconGlyph.innerHTML = svg;
}

function setButtonState(state) {
  if (!saveBtn) return;

  saveBtn.className = 'arc-ext-hover-btn';
  saveBtn.classList.add(STATE_CLASS[state] ?? STATE_CLASS.idle);
  saveBtn.disabled = state === 'loading' || state === 'queue';

  if (state === 'success') {
    setIcon(CHECK_ICON);
    return;
  }
  if (state === 'error') {
    setIcon(CLOSE_ICON);
    return;
  }
  if (state === 'idle' || state === 'loading' || state === 'queue') {
    setIcon(IMAGE_PLUS_ICON);
  }
}

function ensureButton() {
  if (saveHost && saveAnchor && saveBtn) return saveBtn;

  saveHost = document.createElement('div');
  saveHost.id = 'arc-ext-save-root';

  const shadow = saveHost.attachShadow({ mode: 'open' });

  const sheet = document.createElement('link');
  sheet.rel = 'stylesheet';
  sheet.href = chrome.runtime.getURL('content.css');
  shadow.appendChild(sheet);

  saveAnchor = document.createElement('div');
  saveAnchor.className = 'arc-ext-save-anchor';

  saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'arc-ext-hover-btn arc-ext-hover-btn--idle';
  saveBtn.setAttribute('aria-label', chrome.i18n.getMessage('hoverSaveLabel'));

  iconGlyph = document.createElement('span');
  iconGlyph.className = 'arc-ext-hover-btn__glyph';
  iconGlyph.setAttribute('aria-hidden', 'true');
  iconGlyph.innerHTML = IMAGE_PLUS_ICON;

  const loader = document.createElement('span');
  loader.className = 'arc-ext-hover-btn__loader';
  loader.setAttribute('aria-hidden', 'true');

  saveBtn.appendChild(iconGlyph);
  saveBtn.appendChild(loader);
  saveAnchor.appendChild(saveBtn);
  shadow.appendChild(saveAnchor);
  document.documentElement.appendChild(saveHost);

  saveBtn.addEventListener('click', onSaveClick);
  saveAnchor.addEventListener('mouseenter', () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  });
  saveAnchor.addEventListener('mouseleave', scheduleHide);

  return saveBtn;
}

function positionButton(el) {
  ensureButton();
  const rect = el.getBoundingClientRect();
  const top = Math.max(BTN_INSET, rect.top + BTN_INSET);
  const left = Math.max(
    BTN_INSET,
    Math.min(window.innerWidth - BTN_SIZE - BTN_INSET, rect.right - BTN_SIZE - BTN_INSET)
  );
  saveAnchor.style.top = `${top}px`;
  saveAnchor.style.left = `${left}px`;
}

function showForImage(el) {
  if (activeImage === el && saveAnchor?.classList.contains('is-visible')) return;
  activeImage = el;
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  positionButton(el);
  ensureButton();
  setButtonState('idle');
  saveAnchor.classList.add('is-visible');
}

function hideButton() {
  activeImage = null;
  if (!saveAnchor) return;
  saveAnchor.classList.remove('is-visible');
  setButtonState('idle');
}

function scheduleHide() {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(hideButton, 180);
}

function showFeedback(state, thenHide = true) {
  setButtonState(state);
  if (thenHide) {
    setTimeout(hideButton, FEEDBACK_MS);
  }
}

/**
 * @param {import('./lib/sites/types.js').SavePayload} payload
 */
async function sendSavePayload(payload) {
  const res = await chrome.runtime.sendMessage({
    type: 'arc:save-image',
    ...payload
  });

  if (res?.ok) {
    showFeedback('success');
    return;
  }

  if (res?.code === 'queued') {
    showFeedback('queue');
    window.ArcExtPageModal?.show('queued', {
      pending: res.pending,
      queueMax: res.queueMax
    });
    return;
  }

  if (res?.code === 'queue_full') {
    showFeedback('error');
    window.ArcExtPageModal?.show('queue_full', {
      pending: res.pending,
      queueMax: res.queueMax
    });
    return;
  }

  if (res?.code === 'disabled') {
    setButtonState('idle');
    window.ArcExtPageModal?.show('disabled');
    return;
  }

  showFeedback('error');
}

/**
 * @param {{ ok?: boolean, code?: string }} res
 */
function handleInstagramSaveResult(res) {
  if (res?.ok) {
    showFeedback('success');
    return;
  }
  if (res?.code === 'disabled') {
    setButtonState('idle');
    window.ArcExtPageModal?.show('disabled');
    return;
  }
  showFeedback('error');
}

/**
 * @param {Element} targetEl
 * @returns {Promise<import('./lib/sites/types.js').SavePayload | null>}
 */
async function resolveSavePayloadForClick(targetEl) {
  if (isInstagramPostUrl(location.href)) {
    const postUrl = location.href.split('?')[0];
    return {
      url: postUrl,
      website: postUrl,
      pageTitle: document.title,
      mediaKind: 'image'
    };
  }

  if (isArtstationArtworkUrl(location.href) && /artstation/i.test(location.hostname)) {
    try {
      const remote = await chrome.runtime.sendMessage({
        type: 'arc:resolve-artstation-artwork-payload',
        artworkUrl: location.href.split('?')[0]
      });
      if (remote?.url) return remote;
    } catch (err) {
      console.warn('[ARC] background artstation resolve failed:', err);
    }
  }

  const pinWebsite =
    (isPinterestPinPageUrl(location.href) ? location.href.split('?')[0] : null) ??
    findPinWebsiteFromTarget(targetEl);

  if (pinWebsite && /pinterest\./i.test(location.hostname)) {
    try {
      const remote = await chrome.runtime.sendMessage({
        type: 'arc:resolve-pin-payload',
        pinWebsite
      });
      if (remote?.url) return remote;
    } catch (err) {
      console.warn('[ARC] background pin resolve failed:', err);
    }
  }

  const pinCloseup = isPinterestPinPageUrl(location.href);
  if (pinCloseup && typeof waitForPinPageMedia === 'function') {
    const quick = resolveSaveFromTarget(targetEl);
    if (quick?.url && isDirectMediaUrl(quick.url)) {
      return quick;
    }

    const waited = await waitForPinPageMedia(8000);
    if (waited?.url && isDirectMediaUrl(waited.url)) {
      return waited;
    }

    return quick?.url ? quick : waited;
  }

  return resolveSaveFromTarget(targetEl);
}

async function onSaveClick(event) {
  event.preventDefault();
  event.stopPropagation();
  if (!activeImage || !saveBtn || saveInFlight || saveBtn.disabled) return;

  saveInFlight = true;
  setButtonState('loading');

  try {
    if (isInstagramPostUrl(location.href)) {
      const postUrl = location.href.split('?')[0];
      const res = await chrome.runtime.sendMessage({
        type: 'arc:save-instagram-post',
        postUrl
      });
      handleInstagramSaveResult(res);
      return;
    }

    const payload = await resolveSavePayloadForClick(activeImage);
    if (!payload?.url) {
      showFeedback('error');
      return;
    }
    if (!isDirectMediaUrl(payload.url) && isPinterestPinPageUrl(payload.url)) {
      showFeedback('error');
      return;
    }
    await sendSavePayload(payload);
  } catch {
    showFeedback('error');
  } finally {
    saveInFlight = false;
  }
}

function isInsideSaveUi(node) {
  if (!(node instanceof Node) || !saveHost?.shadowRoot) {
    return false;
  }
  return saveHost === node || saveHost.shadowRoot.contains(node);
}

function considerTarget(target) {
  if (isInsideSaveUi(target)) {
    return;
  }

  const found = findSaveableTarget(target);
  if (!found?.url || !isLargeEnough(found.el)) {
    scheduleHide();
    return;
  }

  if (hoverTimer) clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => {
    hoverTimer = null;
    showForImage(found.el);
  }, HOVER_DELAY_MS);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'arc:resolve-save') {
    const payload = resolveSaveFromUrl({
      url: typeof message.url === 'string' ? message.url : '',
      website: typeof message.website === 'string' ? message.website : location.href,
      pageTitle: typeof message.pageTitle === 'string' ? message.pageTitle : document.title,
      mediaKind: message.mediaKind === 'video' || message.mediaKind === 'image' ? message.mediaKind : undefined
    });

    sendResponse(payload);
    return true;
  }

  if (message?.type === 'arc:resolve-pin-page') {
    void waitForPinPageMedia()
      .then((payload) => sendResponse(payload))
      .catch(() => sendResponse(null));
    return true;
  }

  if (message?.type === 'arc:collect-pinterest-board') {
    if (!isPinterestBoardUrl(location.href)) {
      sendResponse({ ok: false, code: 'not_board' });
      return true;
    }

    void collectPinterestBoardPins()
      .then((board) => sendResponse(board))
      .catch(() => sendResponse({ ok: false, code: 'collect_failed' }));
    return true;
  }

  if (message?.type === 'arc:resolve-instagram-post-dom') {
    void (NS.waitForInstagramPostMedia?.() ?? Promise.resolve(NS.resolveInstagramPostMediaFromDom?.()))
      .then((payload) => sendResponse(payload))
      .catch(() => sendResponse(null));
    return true;
  }

  if (message?.type === 'arc:resolve-artstation-artwork-dom') {
    void (NS.resolveArtstationArtworkMediaFromPage?.() ?? Promise.resolve(NS.resolveArtstationArtworkMediaFromDom?.()))
      .then((payload) => sendResponse(payload))
      .catch(() => sendResponse(null));
    return true;
  }

  if (message?.type === 'arc:collect-instagram-saved') {
    if (!isInstagramSavedCollectionUrl(location.href)) {
      sendResponse({ ok: false, code: 'not_saved' });
      return true;
    }

    void collectInstagramSavedPosts()
      .then((saved) => sendResponse(saved))
      .catch(() => sendResponse({ ok: false, code: 'collect_failed' }));
    return true;
  }

  if (message?.type === 'arc:collect-artstation-album') {
    if (!isArtstationAlbumUrl(location.href)) {
      sendResponse({ ok: false, code: 'not_album' });
      return true;
    }

    void collectArtstationAlbumItems()
      .then((album) => sendResponse(album))
      .catch(() => sendResponse({ ok: false, code: 'collect_failed' }));
    return true;
  }

  if (message?.type === 'arc:instagram-page-state') {
    const isSaved = isInstagramSavedCollectionUrl(location.href);
    const meta = isSaved ? getInstagramSavedMeta() : null;
    sendResponse({
      isSaved,
      collectionName: meta?.collectionName ?? null,
      collectionUrl: meta?.collectionUrl ?? location.href
    });
    return true;
  }

  if (message?.type === 'arc:artstation-page-state') {
    const isAlbum = isArtstationAlbumUrl(location.href);
    const isArtwork = isArtstationArtworkUrl(location.href);
    sendResponse({
      isAlbum,
      isArtwork,
      albumName: isAlbum ? getArtstationAlbumMeta().albumName : null
    });
    return true;
  }

  if (message?.type === 'arc:board-page-state') {
    const isBoard = isPinterestBoardUrl(location.href);
    const meta = isBoard ? getPinterestBoardMeta() : null;
    sendResponse({
      isBoard,
      boardName: meta?.boardName ?? null,
      boardUrl: meta?.boardUrl ?? location.href
    });
    return true;
  }

  return false;
});

document.addEventListener(
  'mousemove',
  (event) => {
    if (moveRaf) return;
    moveRaf = requestAnimationFrame(() => {
      moveRaf = 0;
      considerTarget(event.target);
    });
  },
  true
);

document.addEventListener(
  'scroll',
  () => {
    if (activeImage) positionButton(activeImage);
  },
  true
);

document.addEventListener(
  'contextmenu',
  (event) => {
    if (!event.altKey) return;
    const found = findSaveableTarget(event.target);
    if (!found?.url) return;

    if (isInstagramPostUrl(location.href)) {
      event.preventDefault();
      event.stopPropagation();
      void chrome.runtime.sendMessage({
        type: 'arc:save-instagram-post',
        postUrl: location.href.split('?')[0]
      }).then((res) => {
        if (!res?.ok && res?.code === 'disabled') {
          window.ArcExtPageModal?.show('disabled');
        }
      });
      return;
    }

    const payload = resolveSaveFromTarget(found.el);
    if (!payload) return;

    event.preventDefault();
    event.stopPropagation();
    void chrome.runtime.sendMessage({
      type: 'arc:save-image',
      ...payload
    });
  },
  true
);
})();
