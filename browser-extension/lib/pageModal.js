(function () {
  const NS = (window.__ARC__ = window.__ARC__ || {});
  const { ARC_LAUNCH_URL, ARC_WEBSITE_URL } = NS;

  const AUTO_HIDE_MS = 14000;
  const LOGO_URL = chrome.runtime.getURL('icons/icon-32.png');

  let hostEl = null;
  let hideTimer = null;

  function msg(key, subs) {
    return chrome.i18n.getMessage(key, subs);
  }

  async function openArcApp() {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'arc:popup-opened' });
      if (res?.arc?.ok) {
        hideModal();
        return;
      }
    } catch {
      // ignore
    }

    const link = document.createElement('a');
    link.href = ARC_LAUNCH_URL;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.documentElement.appendChild(link);
    link.click();
    link.remove();
  }

  function hideModal() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    if (!hostEl) return;
    hostEl.classList.remove('is-open');
    setTimeout(() => {
      hostEl?.remove();
      hostEl = null;
    }, 180);
  }

  function makeButton(label, className, onClick, disabled = false) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `arc-ext-btn ${className}`;
    btn.textContent = label;
    btn.disabled = disabled;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function buildFooter(variant) {
    const footer = document.createElement('footer');
    footer.className = 'arc-ext-modal__footer arc-ext-modal__footer--end';

    const right = document.createElement('div');
    right.className = 'arc-ext-modal__footer-right';

    right.appendChild(
      makeButton(msg('modalClose'), 'arc-ext-btn--outline', hideModal)
    );

    if (variant === 'queued' || variant === 'queue_full') {
      right.appendChild(
        makeButton(msg('openArcButton'), 'arc-ext-btn--brand', openArcApp)
      );
    }

    footer.appendChild(right);
    return footer;
  }

  /**
   * @param {'queued' | 'queue_full' | 'disabled'} variant
   * @param {{ pending?: number, queueMax?: number }} detail
   */
  function showPageModal(variant, detail = {}) {
    hideModal();

    hostEl = document.createElement('div');
    hostEl.className = 'arc-ext-modal-host';
    hostEl.setAttribute('role', 'presentation');

    const modal = document.createElement('article');
    modal.className = 'arc-ext-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'arc-ext-modal-title');

    const header = document.createElement('header');
    header.className = 'arc-ext-modal__header';

    const titleBlock = document.createElement('div');
    titleBlock.className = 'arc-ext-modal__title-block';

    const title = document.createElement('h1');
    title.id = 'arc-ext-modal-title';
    title.className = 'arc-ext-modal__title';
    title.textContent = msg('modalTitle');

    const subtitle = document.createElement('p');
    subtitle.className = 'arc-ext-modal__subtitle';

    if (variant === 'disabled') {
      subtitle.textContent = msg('statusDisabled');
      subtitle.classList.add('arc-ext-modal__subtitle--danger');
    } else if (variant === 'queue_full') {
      subtitle.textContent = msg('statusQueueFull');
      subtitle.classList.add('arc-ext-modal__subtitle--danger');
    } else {
      subtitle.textContent = msg('statusOffline');
      subtitle.classList.add('arc-ext-modal__subtitle--danger');
    }

    titleBlock.appendChild(title);
    titleBlock.appendChild(subtitle);

    const logo = document.createElement('img');
    logo.className = 'arc-ext-modal__logo';
    logo.src = LOGO_URL;
    logo.alt = '';
    logo.width = 32;
    logo.height = 32;

    header.appendChild(titleBlock);
    header.appendChild(logo);

    const body = document.createElement('div');
    body.className = 'arc-ext-modal__body';

    const slot1 = document.createElement('div');
    slot1.className = 'arc-ext-modal__slot';
    const text1 = document.createElement('p');
    text1.className = 'arc-ext-modal__slot-text';
    text1.textContent =
      variant === 'disabled' ? msg('disabledToastBody') : msg('modalQueueBody');
    slot1.appendChild(text1);
    body.appendChild(slot1);

    if (variant !== 'disabled' && detail.pending != null && detail.queueMax != null) {
      const slot2 = document.createElement('div');
      slot2.className = 'arc-ext-modal__slot';
      const text2 = document.createElement('p');
      text2.className = 'arc-ext-modal__slot-text';
      text2.textContent = msg('offlineToastQueue', [String(detail.pending), String(detail.queueMax)]);
      slot2.appendChild(text2);
      body.appendChild(slot2);
    }

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(buildFooter(variant));
    hostEl.appendChild(modal);
    document.documentElement.appendChild(hostEl);

    requestAnimationFrame(() => hostEl?.classList.add('is-open'));
    hideTimer = setTimeout(hideModal, AUTO_HIDE_MS);
  }

  window.ArcExtPageModal = { show: showPageModal, hide: hideModal, openArcApp };
})();
