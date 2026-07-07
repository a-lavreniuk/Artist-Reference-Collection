import { ARC_LAUNCH_URL, ARC_WEBSITE_URL } from './lib/constants.js';

const modalEl = document.querySelector('.arc-ext-modal--popup');
const subtitleEl = document.getElementById('arc-modal-subtitle');
const slot1El = document.getElementById('arc-slot-1');
const slot2Wrap = document.getElementById('arc-slot-2-wrap');
const slot2El = document.getElementById('arc-slot-2');
const websiteBtn = document.getElementById('arc-website-btn');
const closeBtn = document.getElementById('arc-close-btn');
const openBtn = document.getElementById('arc-open-btn');

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
}

function showConnectedLayout(pending, queueMax) {
  modalEl?.classList.remove('is-offline', 'is-disabled');
  setSubtitle(msg('statusConnectedSubtitle'), 'success');
  if (slot1El) slot1El.textContent = msg('modalHowToSave');
  if (slot2El) slot2El.textContent = msg('modalQueueInfo');
  if (slot2Wrap) slot2Wrap.hidden = false;
  if (pending > 0 && subtitleEl) {
    setSubtitle(`${msg('statusConnectedSubtitle')} · ${msg('offlineToastQueue', [String(pending), String(queueMax)])}`, 'success');
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

  if (!res) {
    showOfflineLayout(pending, queueMax);
    setSubtitle(msg('statusOffline'), 'danger');
    return;
  }

  if (res?.arc?.ok) {
    showConnectedLayout(pending, queueMax);
    return;
  }

  if (res?.arc?.reason === 'disabled') {
    showDisabledLayout();
    return;
  }

  showOfflineLayout(pending, queueMax);
}

bindStaticLabels();
void refreshConnectionStatus();
