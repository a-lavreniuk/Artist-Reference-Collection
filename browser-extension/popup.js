(() => {
const NS = (window.__ARC__ = window.__ARC__ || {});
const {
  ARC_LAUNCH_URL,
  ARC_WEBSITE_URL,
  isPinterestBoardUrl,
  isInstagramSavedCollectionUrl,
  isArtstationAlbumUrl
} = NS;

const modalEl = document.querySelector('.arc-ext-modal--popup');
const subtitleEl = document.getElementById('arc-modal-subtitle');
const slot1El = document.getElementById('arc-slot-1');
const slot2Wrap = document.getElementById('arc-slot-2-wrap');
const slot2El = document.getElementById('arc-slot-2');
const websiteBtn = document.getElementById('arc-website-btn');
const closeBtn = document.getElementById('arc-close-btn');
const openBtn = document.getElementById('arc-open-btn');

const pinterestSection = document.getElementById('arc-pinterest-section');
const pinterestBodyEl = document.getElementById('arc-pinterest-body');
const downloadBoardBtn = document.getElementById('arc-download-board-btn');
const boardProgressWrap = document.getElementById('arc-board-progress-wrap');
const boardProgressEl = document.getElementById('arc-board-progress');

const instagramSection = document.getElementById('arc-instagram-section');
const instagramBodyEl = document.getElementById('arc-instagram-body');
const downloadSavedBtn = document.getElementById('arc-download-saved-btn');
const instagramProgressWrap = document.getElementById('arc-instagram-progress-wrap');
const instagramProgressEl = document.getElementById('arc-instagram-progress');

const artstationSection = document.getElementById('arc-artstation-section');
const artstationBodyEl = document.getElementById('arc-artstation-body');
const downloadAlbumBtn = document.getElementById('arc-download-album-btn');
const artstationProgressWrap = document.getElementById('arc-artstation-progress-wrap');
const artstationProgressEl = document.getElementById('arc-artstation-progress');

let activeTabId = null;
let arcConnectionReady = false;

/** @type {Record<string, boolean>} */
const bulkInFlight = {
  'pinterest-board': false,
  'instagram-saved': false,
  'artstation-album': false
};

/** @type {Record<string, { progressEl: HTMLElement | null, wrapEl: HTMLElement | null }>} */
const bulkUi = {
  'pinterest-board': { progressEl: boardProgressEl, wrapEl: boardProgressWrap },
  'instagram-saved': { progressEl: instagramProgressEl, wrapEl: instagramProgressWrap },
  'artstation-album': { progressEl: artstationProgressEl, wrapEl: artstationProgressWrap }
};

function msg(key, substitutions) {
  return chrome.i18n.getMessage(key, substitutions);
}

function setSubtitle(text, tone) {
  if (!subtitleEl) return;
  subtitleEl.textContent = text;
  subtitleEl.className = 'arc-ext-modal__subtitle';
  if (tone) subtitleEl.classList.add(`arc-ext-modal__subtitle--${tone}`);
}

async function openArcApp() {
  const res = await chrome.runtime.sendMessage({ type: 'arc:popup-opened' });
  if (res?.arc?.ok) {
    await refreshConnectionStatus();
    return;
  }
  window.location.href = ARC_LAUNCH_URL;
  setTimeout(() => void refreshConnectionStatus(), 2000);
}

function openWebsite() {
  if (!ARC_WEBSITE_URL) return;
  chrome.tabs.create({ url: ARC_WEBSITE_URL });
}

function bindStaticLabels() {
  if (websiteBtn) {
    websiteBtn.textContent = msg('goToWebsite');
    websiteBtn.disabled = !ARC_WEBSITE_URL;
    websiteBtn.addEventListener('click', openWebsite);
  }
  if (closeBtn) {
    closeBtn.textContent = msg('modalClose');
    closeBtn.addEventListener('click', () => window.close());
  }
  if (openBtn) {
    openBtn.textContent = msg('openArcButton');
    openBtn.addEventListener('click', openArcApp);
  }
  if (downloadBoardBtn) {
    downloadBoardBtn.textContent = msg('downloadBoardButton');
    downloadBoardBtn.addEventListener('click', () => void startBulkDownload('pinterest-board'));
  }
  if (downloadSavedBtn) {
    downloadSavedBtn.textContent = msg('downloadSavedButton');
    downloadSavedBtn.addEventListener('click', () => void startBulkDownload('instagram-saved'));
  }
  if (downloadAlbumBtn) {
    downloadAlbumBtn.textContent = msg('downloadAlbumButton');
    downloadAlbumBtn.addEventListener('click', () => void startBulkDownload('artstation-album'));
  }
  if (pinterestBodyEl) pinterestBodyEl.textContent = msg('modalPinterestBody');
  if (instagramBodyEl) instagramBodyEl.textContent = msg('modalInstagramBody');
  if (artstationBodyEl) artstationBodyEl.textContent = msg('modalArtstationBody');
  if (modalEl?.querySelector('#arc-modal-title')) {
    modalEl.querySelector('#arc-modal-title').textContent = msg('modalTitle');
  }
}

function setBulkProgress(kind, text, visible = true) {
  const ui = bulkUi[kind];
  if (!ui?.progressEl || !ui?.wrapEl) return;
  ui.progressEl.textContent = text;
  ui.wrapEl.hidden = !visible || !text;
}

function anyBulkInFlight() {
  return Object.values(bulkInFlight).some(Boolean);
}

function updateBulkButtonStates() {
  const disabled = anyBulkInFlight() || !arcConnectionReady;
  if (downloadBoardBtn) downloadBoardBtn.disabled = disabled;
  if (downloadSavedBtn) downloadSavedBtn.disabled = disabled;
  if (downloadAlbumBtn) downloadAlbumBtn.disabled = disabled;
}

function setSectionVisible(section, visible) {
  if (!section) return;
  section.hidden = !visible;
  section.classList.toggle('is-visible', visible);
}

function showConnectedLayout(pending, queueMax) {
  modalEl?.classList.remove('is-offline', 'is-disabled');
  setSubtitle(msg('statusConnectedSubtitle'), 'success');
  if (slot1El) slot1El.textContent = msg('modalHowToSave');
  if (slot2El) slot2El.textContent = msg('modalQueueInfo');
  if (slot2Wrap) slot2Wrap.hidden = false;
  if (pending > 0 && subtitleEl) {
    setSubtitle(
      `${msg('statusConnectedSubtitle')} · ${msg('offlineToastQueue', [String(pending), String(queueMax)])}`,
      'success'
    );
  }
}

function showOfflineLayout(pending, queueMax) {
  modalEl?.classList.add('is-offline');
  modalEl?.classList.remove('is-disabled');
  setSubtitle(msg('statusOffline'), 'danger');
  if (slot1El) slot1El.textContent = msg('modalQueueBody');
  if (slot2El) {
    slot2El.textContent =
      pending > 0 ? msg('offlineToastQueue', [String(pending), String(queueMax)]) : msg('popupOfflineQueueEmpty');
  }
  if (slot2Wrap) slot2Wrap.hidden = false;
}

function showDisabledLayout() {
  modalEl?.classList.add('is-disabled');
  modalEl?.classList.remove('is-offline');
  setSubtitle(msg('statusDisabled'), 'danger');
  if (slot1El) slot1El.textContent = msg('disabledToastBody');
  if (slot2Wrap) slot2Wrap.hidden = true;
}

function showDrainingLayout() {
  modalEl?.classList.remove('is-offline', 'is-disabled');
  setSubtitle(msg('statusDraining'), 'warn');
  if (slot1El) slot1El.textContent = msg('modalHowToSave');
  if (slot2Wrap) slot2Wrap.hidden = true;
}

async function detectBulkSections() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  activeTabId = tab?.id ?? null;

  let onBoard = typeof tab?.url === 'string' && isPinterestBoardUrl(tab.url);
  let onInstagramSaved = typeof tab?.url === 'string' && isInstagramSavedCollectionUrl(tab.url);
  let onArtstationAlbum = typeof tab?.url === 'string' && isArtstationAlbumUrl(tab.url);

  if (tab?.id) {
    try {
      const boardState = await chrome.tabs.sendMessage(tab.id, { type: 'arc:board-page-state' });
      onBoard = boardState?.isBoard === true;
    } catch {
      // Content script not ready.
    }

    try {
      const instagramState = await chrome.tabs.sendMessage(tab.id, { type: 'arc:instagram-page-state' });
      onInstagramSaved = instagramState?.isSaved === true;
    } catch {
      // Content script not ready.
    }

    try {
      const artstationState = await chrome.tabs.sendMessage(tab.id, { type: 'arc:artstation-page-state' });
      onArtstationAlbum = artstationState?.isAlbum === true;
    } catch {
      // Content script not ready.
    }
  }

  setSectionVisible(pinterestSection, onBoard);
  setSectionVisible(instagramSection, onInstagramSaved);
  setSectionVisible(artstationSection, onArtstationAlbum);

  updateBulkButtonStates();

  if (!onBoard) setBulkProgress('pinterest-board', '', false);
  if (!onInstagramSaved) setBulkProgress('instagram-saved', '', false);
  if (!onArtstationAlbum) setBulkProgress('artstation-album', '', false);
}

/**
 * @param {'pinterest-board' | 'instagram-saved' | 'artstation-album'} kind
 */
async function startBulkDownload(kind) {
  if (!activeTabId || bulkInFlight[kind]) return;

  const messageType = {
    'pinterest-board': 'arc:download-pinterest-board',
    'instagram-saved': 'arc:download-instagram-saved',
    'artstation-album': 'arc:download-artstation-album'
  }[kind];

  const collectingMessage = {
    'pinterest-board': msg('boardDownloadCollecting'),
    'instagram-saved': msg('savedDownloadCollecting'),
    'artstation-album': msg('albumDownloadCollecting')
  }[kind];

  bulkInFlight[kind] = true;
  updateBulkButtonStates();
  setBulkProgress(kind, collectingMessage, true);

  let result;
  try {
    result = await chrome.runtime.sendMessage({ type: messageType, tabId: activeTabId });
  } catch {
    result = { ok: false, code: 'error' };
  }

  if (result?.ok) {
    setBulkProgress(
      kind,
      msg('bulkDownloadDone', [String(result.imported ?? 0), result.collectionName ?? '']),
      true
    );
    setSubtitle(msg('statusConnectedSubtitle'), 'success');
  } else if (result?.code === 'disabled') {
    showDisabledLayout();
    setBulkProgress(kind, msg('statusDisabled'), true);
  } else if (result?.code === 'offline') {
    showOfflineLayout(0, 50);
    setBulkProgress(kind, msg('statusOffline'), true);
  } else if (result?.code === 'no_pins' || result?.code === 'no_posts' || result?.code === 'no_artworks' || result?.code === 'no_items') {
    setBulkProgress(kind, msg('bulkDownloadNoItems'), true);
  } else if (result?.code === 'no_content') {
    setBulkProgress(kind, msg('bulkDownloadNoContent'), true);
  } else {
    setBulkProgress(kind, msg('bulkDownloadFailed'), true);
  }

  bulkInFlight[kind] = false;
  updateBulkButtonStates();
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'arc:bulk-download-progress') return;
  if (message.tabId !== activeTabId) return;
  const kind = message.bulkKind;
  if (!kind || !bulkUi[kind]) return;
  setBulkProgress(
    kind,
    msg('bulkDownloadProgress', [String(message.done ?? 0), String(message.total ?? 0)]),
    true
  );
});

async function refreshConnectionStatus() {
  showDrainingLayout();

  let res;
  try {
    res = await Promise.race([
      chrome.runtime.sendMessage({ type: 'arc:popup-opened' }),
      new Promise((resolve) => setTimeout(() => resolve(null), 5000))
    ]);
  } catch {
    res = null;
  }

  const queueMax = res?.queueMax ?? 50;
  const pending = res?.pending ?? 0;
  arcConnectionReady = res?.arc?.ok === true;

  if (!res) {
    showOfflineLayout(pending, queueMax);
    setSubtitle(msg('statusOffline'), 'danger');
    await detectBulkSections();
    return;
  }

  if (res?.arc?.ok) {
    showConnectedLayout(pending, queueMax);
    await detectBulkSections();
    return;
  }

  if (res?.arc?.reason === 'disabled') {
    showDisabledLayout();
    await detectBulkSections();
    return;
  }

  showOfflineLayout(pending, queueMax);
  await detectBulkSections();
}

bindStaticLabels();
setSectionVisible(pinterestSection, false);
setSectionVisible(instagramSection, false);
setSectionVisible(artstationSection, false);
void refreshConnectionStatus();
})();
