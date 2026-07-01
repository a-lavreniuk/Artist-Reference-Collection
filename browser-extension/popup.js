import { ARC_LAUNCH_URL } from './lib/constants.js';

const statusEl = document.getElementById('arc-status');
const hintEl = document.getElementById('arc-hint');
const offlinePanel = document.getElementById('arc-offline-panel');
const offlineText = document.getElementById('arc-offline-text');
const queueInfo = document.getElementById('arc-queue-info');
const openAppBtn = document.getElementById('arc-open-app');

function msg(key, substitutions) {
  return chrome.i18n.getMessage(key, substitutions);
}

function setStatus(text, tone = '') {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.className = 'arc-ext-popup__status';
  if (tone) statusEl.classList.add(tone);
}

function openArcApp() {
  window.location.href = ARC_LAUNCH_URL;
}

function showOfflinePanel(pending, queueMax) {
  if (!offlinePanel) return;
  offlinePanel.hidden = false;
  if (offlineText) offlineText.textContent = msg('popupOfflineExplain');
  if (queueInfo) {
    queueInfo.textContent =
      pending > 0 ? msg('offlineToastQueue', [String(pending), String(queueMax)]) : msg('popupOfflineQueueEmpty');
  }
  if (openAppBtn) {
    openAppBtn.textContent = msg('openArcButton');
    openAppBtn.onclick = openArcApp;
  }
}

function hideOfflinePanel() {
  if (offlinePanel) offlinePanel.hidden = true;
}

async function refreshConnectionStatus() {
  setStatus(msg('statusDraining'), 'is-warn');
  hideOfflinePanel();

  const res = await chrome.runtime.sendMessage({ type: 'arc:popup-opened' });
  const queueMax = res?.queueMax ?? 50;

  if (res?.drained > 0) {
    setStatus(msg('statusDrained', [String(res.drained)]), 'is-ok');
    return;
  }

  if (res?.arc?.ok) {
    if (res.pending > 0) {
      setStatus(`${msg('statusConnected')} · ${msg('offlineToastQueue', [String(res.pending), String(queueMax)])}`, 'is-warn');
    } else {
      setStatus(msg('statusConnected'), 'is-ok');
    }
    return;
  }

  if (res?.arc?.reason === 'disabled') {
    setStatus(msg('statusDisabled'), 'is-error');
    return;
  }

  setStatus(msg('statusOffline'), 'is-warn');
  showOfflinePanel(res?.pending ?? 0, queueMax);
}

if (hintEl) {
  hintEl.textContent = msg('popupHoverHint');
}

void refreshConnectionStatus();
