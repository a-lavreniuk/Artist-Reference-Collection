(() => {
  const NS = (window.__ARC__ = window.__ARC__ || {});
  const { resolveAbsoluteUrl } = NS;

  /**
   * @param {EventTarget | null} target
   * @returns {{ el: Element, url: string } | null}
   */
  function findImageUrlFromTarget(target) {
    if (!(target instanceof Element)) return null;

    if (target instanceof HTMLImageElement) {
      return { el: target, url: target.currentSrc || target.src || '' };
    }

    if (target instanceof HTMLPictureElement) {
      const img = target.querySelector('img');
      if (img instanceof HTMLImageElement) {
        return { el: img, url: img.currentSrc || img.src || '' };
      }
    }

    const imgEl = target.closest('img');
    if (imgEl instanceof HTMLImageElement) {
      return { el: imgEl, url: imgEl.currentSrc || imgEl.src || '' };
    }

    const bg = getComputedStyle(target).backgroundImage;
    if (bg && bg !== 'none') {
      const match = /url\(["']?(.*?)["']?\)/i.exec(bg);
      if (match?.[1]) {
        return { el: target, url: match[1] };
      }
    }

    return null;
  }

  /**
   * @param {HTMLVideoElement} video
   * @returns {string | null}
   */
  function pickVideoSourceUrl(video) {
    const candidates = [];

    if (video.currentSrc) candidates.push(video.currentSrc);
    if (video.src) candidates.push(video.src);

    for (const source of video.querySelectorAll('source')) {
      const src = source.src || source.getAttribute('src') || '';
      if (src) candidates.push(src);
    }

    for (const raw of candidates) {
      const absolute = resolveAbsoluteUrl(raw);
      if (!absolute) continue;
      if (/^blob:/i.test(absolute)) continue;
      if (/^https?:/i.test(absolute)) return absolute;
    }

    return null;
  }

  /**
   * @param {Element | null | undefined} root
   * @returns {HTMLVideoElement | null}
   */
  function findVideoElement(root) {
    if (!(root instanceof Element)) return null;
    if (root instanceof HTMLVideoElement) return root;
    const nested = root.querySelector?.('video');
    return nested instanceof HTMLVideoElement ? nested : null;
  }

  /**
   * @param {Element | null} target
   * @returns {{ el: Element, url: string } | null}
   */
  function findVideoTarget(target) {
    if (!(target instanceof Element)) return null;

    let video = null;
    if (target instanceof HTMLVideoElement) {
      video = target;
    } else {
      const direct = target.querySelector?.('video');
      if (direct instanceof HTMLVideoElement) video = direct;
      const closest = target.closest?.('video');
      if (!video && closest instanceof HTMLVideoElement) video = closest;
    }

    if (!video) return null;
    const url = pickVideoSourceUrl(video);
    if (!url) return null;
    return { el: video, url };
  }

  /** @type {import('./types.js').SiteHandler} */
  const genericHandler = {
    id: 'generic',

    findVideoTarget,

    resolveImageUrl(ctx) {
      const video = findVideoElement(ctx?.targetEl);
      if (video) {
        const url = pickVideoSourceUrl(video);
        if (url) return { url, mediaKind: 'video' };
      }
      return ctx.rawUrl;
    },

    resolveCardName() {
      return undefined;
    }
  };

  Object.assign(NS, {
    findImageUrlFromTarget,
    findVideoElement,
    pickVideoSourceUrl,
    genericHandler
  });
})();
