(() => {
  const NS = (window.__ARC__ = window.__ARC__ || {});

  /**
   * @param {string} url
   * @param {string} [base]
   * @returns {string | null}
   */
  function resolveAbsoluteUrl(url, base = location.href) {
    if (!url?.trim()) return null;
    try {
      return new URL(url.trim(), base).href;
    } catch {
      return null;
    }
  }

  /**
   * @param {string} property
   * @returns {string | null}
   */
  function getMetaContent(property) {
    const el = document.querySelector(
      `meta[property="${property}"], meta[name="${property}"]`
    );
    const value = el?.getAttribute('content')?.trim();
    return value || null;
  }

  /**
   * @param {string} srcset
   * @param {string} [base]
   * @returns {string | null}
   */
  function pickLargestFromSrcset(srcset, base = location.href) {
    if (!srcset?.trim()) return null;

    let bestUrl = null;
    let bestScore = -1;

    for (const part of srcset.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      const spaceIdx = trimmed.lastIndexOf(' ');
      const urlPart = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx).trim();
      const descriptor = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim().toLowerCase();

      const absolute = resolveAbsoluteUrl(urlPart, base);
      if (!absolute) continue;

      let score = 0;
      const widthMatch = /^(\d+)w$/.exec(descriptor);
      const densityMatch = /^([\d.]+)x$/.exec(descriptor);
      if (widthMatch) {
        score = Number(widthMatch[1]);
      } else if (densityMatch) {
        score = Number(densityMatch[1]) * 1000;
      } else {
        score = 1;
      }

      if (score >= bestScore) {
        bestScore = score;
        bestUrl = absolute;
      }
    }

    return bestUrl;
  }

  /**
   * @param {Element | null | undefined} el
   * @returns {string | null}
   */
  function pickLargestImageUrlFromElement(el) {
    if (!(el instanceof Element)) return null;

    const candidates = [];

    if (el instanceof HTMLImageElement) {
      if (el.currentSrc) candidates.push(el.currentSrc);
      if (el.src) candidates.push(el.src);
      if (el.srcset) {
        const fromSet = pickLargestFromSrcset(el.srcset);
        if (fromSet) candidates.push(fromSet);
      }
      const dataSrc = el.getAttribute('data-src');
      if (dataSrc) candidates.push(dataSrc);
      const dataSrcset = el.getAttribute('data-srcset');
      if (dataSrcset) {
        const fromData = pickLargestFromSrcset(dataSrcset);
        if (fromData) candidates.push(fromData);
      }
    }

    for (const attr of ['data-pin-media', 'data-pin-url', 'data-big-image', 'data-image']) {
      const value = el.getAttribute(attr);
      if (value) candidates.push(value);
    }

    return candidates.map((c) => resolveAbsoluteUrl(c)).find(Boolean) ?? null;
  }

  /**
   * @param {string} title
   * @param {RegExp[]} suffixPatterns
   * @returns {string | null}
   */
  function cleanPageTitle(title, suffixPatterns = []) {
    if (!title?.trim()) return null;
    let cleaned = title.trim();
    for (const pattern of suffixPatterns) {
      cleaned = cleaned.replace(pattern, '').trim();
    }
    return cleaned || null;
  }

  Object.assign(NS, {
    resolveAbsoluteUrl,
    getMetaContent,
    pickLargestFromSrcset,
    pickLargestImageUrlFromElement,
    cleanPageTitle
  });
})();
