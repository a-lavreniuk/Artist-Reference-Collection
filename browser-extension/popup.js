import { ARC_LAUNCH_URL, ARC_WEBSITE_URL } from './lib/constants.js';
import { isPinterestBoardUrl } from './lib/pinterest/board.js';

const modalEl = document.querySelector('.arc-ext-modal--popup');
const subtitleEl = document.getElementById('arc-modal-subtitle');
const slot1El = document.getElementById('arc-slot-1');
const slot2Wrap = document.getElementById('arc-slot-2-wrap');
const slot2El = document.getElementById('arc-slot-2');
const boardSlot = document.getElementById('arc-board-slot');
const downloadBoardBtn = document.getElementById('arc-download-board-btn');
const boardProgressEl = document.getElementById('arc-board-progress');
const websiteBtn = document.getElementById('arc-website-btn');
const closeBtn = document.getElementById('arc-close-btn');
const openBtn = document.getElementById('arc-open-btn');

let activeTabId = null;
let boardDownloadInFlight = false;
let arcConnectionReady = false;

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
    downloadBoardBtn.addEventListener('click', () => void startBoardDownload());
  }
}

function setBoardProgress(text, visible = true) {
  if (!boardProgressEl) return;
  boardProgressEl.textContent = text;
  boardProgressEl.hidden = !visible;
}

function setBoardSlotVisible(visible) {
  if (!boardSlot) return;
  boardSlot.hidden = !visible;
}

function updateBoardButtonState() {
  if (!downloadBoardBtn) return;
  downloadBoardBtn.disabled = boardDownloadInFlight || !arcConnectionReady;
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

async function detectPinterestBoard() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  activeTabId = tab?.id ?? null;

  let onBoard = typeof tab?.url === 'string' && isPinterestBoardUrl(tab.url);

  if (!onBoard && tab?.id) {
    try {
      const state = await chrome.tabs.sendMessage(tab.id, { type: 'arc:board-page-state' });
      onBoard = state?.isBoard === true;
    } catch {
      // Content script not ready on this tab.
    }
  }

  setBoardSlotVisible(onBoard);
  updateBoardButtonState();

  if (!onBoard) {
    setBoardProgress('', false);
  }
}

async function startBoardDownload() {
  if (!activeTabId || boardDownloadInFlight) return;

  boardDownloadInFlight = true;
  if (downloadBoardBtn) downloadBoardBtn.disabled = true;
  setBoardProgress(msg('boardDownloadCollecting'), true);

  let result;
  try {
    result = await chrome.runtime.sendMessage({
      type: 'arc:download-pinterest-board',
      tabId: activeTabId
    });
  } catch {
    result = { ok: false, code: 'error' };
  }

  if (result?.ok) {
    setBoardProgress(
      msg('boardDownloadDone', [
        String(result.imported ?? 0),
        result.collectionName ?? ''
      ]),
      true
    );
    setSubtitle(msg('statusConnectedSubtitle'), 'success');
  } else if (result?.code === 'disabled') {
    showDisabledLayout();
    setBoardProgress(msg('statusDisabled'), true);
  } else if (result?.code === 'offline') {
    showOfflineLayout(0, 50);
    setBoardProgress(msg('statusOffline'), true);
  } else if (result?.code === 'no_pins') {
    setBoardProgress(msg('boardDownloadNoPins'), true);
  } else if (result?.code === 'no_content') {
    setBoardProgress(msg('boardDownloadNoContent'), true);
  } else {
    setBoardProgress(msg('boardDownloadFailed'), true);
  }

  boardDownloadInFlight = false;
  updateBoardButtonState();
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'arc:board-download-progress') return;
  if (message.tabId !== activeTabId) return;
  setBoardProgress(
    msg('boardDownloadProgress', [String(message.done ?? 0), String(message.total ?? 0)]),
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
    await detectPinterestBoard();
    return;
  }

  if (res?.arc?.ok) {
    showConnectedLayout(pending, queueMax);
    await detectPinterestBoard();
    return;
  }

  if (res?.arc?.reason === 'disabled') {
    showDisabledLayout();
    await detectPinterestBoard();
    return;
  }

  showOfflineLayout(pending, queueMax);
  await detectPinterestBoard();
}

bindStaticLabels();
void refreshConnectionStatus();
