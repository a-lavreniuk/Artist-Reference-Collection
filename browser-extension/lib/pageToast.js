(function () {
  const AUTO_HIDE_MS = 12000;
  const ARC_LAUNCH_URL = 'arc://launch';

  let toastEl = null;
  let hideTimer = null;

  function msg(key, subs) {
    return chrome.i18n.getMessage(key, subs);
  }

  function openArcApp() {
    const link = document.createElement('a');
    link.href = ARC_LAUNCH_URL;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.documentElement.appendChild(link);
    link.click();
    link.remove();
  }

  function hideToast() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    if (!toastEl) return;
    toastEl.classList.remove('is-open');
    setTimeout(() => {
      toastEl?.remove();
      toastEl = null;
    }, 180);
  }

  /**
   * @param {'queued' | 'queue_full' | 'disabled'} variant
   * @param {{ pending?: number, queueMax?: number }} detail
   */
  function showPageToast(variant, detail = {}) {
    hideToast();

    toastEl = document.createElement('aside');
    toastEl.className = 'arc-ext-toast';
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');

    const title = document.createElement('p');
    title.className = 'arc-ext-toast__title';

    const body = document.createElement('p');
    body.className = 'arc-ext-toast__body';

    if (variant === 'queued') {
      title.textContent = msg('offlineToastTitle');
      body.textContent = msg('offlineToastBody');
      if (detail.pending != null && detail.queueMax != null) {
        const queueLine = document.createElement('p');
        queueLine.className = 'arc-ext-toast__queue';
        queueLine.textContent = msg('offlineToastQueue', [String(detail.pending), String(detail.queueMax)]);
        toastEl.appendChild(title);
        toastEl.appendChild(body);
        toastEl.appendChild(queueLine);
      } else {
        toastEl.appendChild(title);
        toastEl.appendChild(body);
      }
    } else if (variant === 'queue_full') {
      title.textContent = msg('statusQueueFull');
      body.textContent = msg('offlineToastBody');
      toastEl.appendChild(title);
      toastEl.appendChild(body);
    } else {
      title.textContent = msg('statusDisabled');
      body.textContent = msg('disabledToastBody');
      toastEl.appendChild(title);
      toastEl.appendChild(body);
    }

    const actions = document.createElement('div');
    actions.className = 'arc-ext-toast__actions';

    if (variant === 'queued' || variant === 'queue_full') {
      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'arc-ext-toast__btn arc-ext-toast__btn--brand';
      openBtn.textContent = msg('openArcButton');
      openBtn.addEventListener('click', () => openArcApp());
      actions.appendChild(openBtn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'arc-ext-toast__btn arc-ext-toast__btn--ghost';
    closeBtn.textContent = msg('toastDismiss');
    closeBtn.addEventListener('click', hideToast);
    actions.appendChild(closeBtn);

    toastEl.appendChild(actions);
    document.documentElement.appendChild(toastEl);
    requestAnimationFrame(() => toastEl?.classList.add('is-open'));

    hideTimer = setTimeout(hideToast, AUTO_HIDE_MS);
  }

  window.ArcExtPageToast = { show: showPageToast, hide: hideToast, openArcApp };
})();
