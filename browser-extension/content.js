(function () {
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

  function findImageUrlFromTarget(target) {
    if (!(target instanceof Element)) return null;

    if (target instanceof HTMLImageElement) {
      return { el: target, url: target.currentSrc || target.src || null };
    }

    if (target instanceof HTMLPictureElement) {
      const img = target.querySelector('img');
      if (img instanceof HTMLImageElement) {
        return { el: img, url: img.currentSrc || img.src || null };
      }
    }

    const imgEl = target.closest('img');
    if (imgEl instanceof HTMLImageElement) {
      return { el: imgEl, url: imgEl.currentSrc || imgEl.src || null };
    }

    if (target instanceof Element) {
      const bg = getComputedStyle(target).backgroundImage;
      if (bg && bg !== 'none') {
        const match = /url\(["']?(.*?)["']?\)/i.exec(bg);
        if (match?.[1]) {
          return { el: target, url: match[1] };
        }
      }
    }

    return null;
  }

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
    const left = Math.max(BTN_INSET, Math.min(window.innerWidth - BTN_SIZE - BTN_INSET, rect.right - BTN_SIZE - BTN_INSET));
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

  function resolveAbsoluteUrl(url) {
    try {
      return new URL(url, location.href).href;
    } catch {
      return null;
    }
  }

  function showFeedback(state, thenHide = true) {
    setButtonState(state);
    if (thenHide) {
      setTimeout(hideButton, FEEDBACK_MS);
    }
  }

  async function onSaveClick(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!activeImage || !saveBtn || saveInFlight || saveBtn.disabled) return;

    const found = findImageUrlFromTarget(activeImage);
    if (!found?.url) return;

    const absolute = resolveAbsoluteUrl(found.url);
    if (!absolute) return;

    saveInFlight = true;
    setButtonState('loading');

    try {
      const res = await chrome.runtime.sendMessage({
        type: 'arc:save-image',
        url: absolute,
        website: location.href,
        pageTitle: document.title
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

    const found = findImageUrlFromTarget(target);
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
      const found = findImageUrlFromTarget(event.target);
      if (!found?.url) return;
      const absolute = resolveAbsoluteUrl(found.url);
      if (!absolute) return;
      event.preventDefault();
      event.stopPropagation();
      chrome.runtime.sendMessage({
        type: 'arc:save-image',
        url: absolute,
        website: location.href,
        pageTitle: document.title
      });
    },
    true
  );
})();
