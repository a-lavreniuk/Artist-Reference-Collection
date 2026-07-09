(() => {
  const NS = (window.__ARC__ = window.__ARC__ || {});
  const { findImageUrlFromTarget, getSiteHandler, resolveAbsoluteUrl } = NS;

  /**
   * @param {string | { url?: string, fallbackUrl?: string, mediaKind?: 'image' | 'video' } | null | undefined} resolved
   * @returns {{ url: string | null, fallbackUrl: string | null, mediaKind: 'image' | 'video' | null }}
   */
  function normalizeResolved(resolved) {
    if (resolved && typeof resolved === 'object') {
      return {
        url: resolved.url ?? null,
        fallbackUrl: resolved.fallbackUrl ?? null,
        mediaKind: resolved.mediaKind === 'video' || resolved.mediaKind === 'image' ? resolved.mediaKind : null
      };
    }
    return {
      url: typeof resolved === 'string' ? resolved : null,
      fallbackUrl: null,
      mediaKind: null
    };
  }

  /**
   * @param {Element | null} targetEl
   * @returns {{ el: Element, url: string } | null}
   */
  function findSaveableTarget(targetEl) {
    const handler = getSiteHandler(location.hostname);

    if (handler.id === 'pinterest' || handler.id === 'youtube' || handler.id === 'artstation') {
      const video = handler.findVideoTarget?.(targetEl);
      if (video?.url) return video;
    }

    if (handler.id === 'instagram' && NS.isInstagramPostUrl?.(location.href)) {
      const anchor = NS.instagramHoverAnchor?.(targetEl);
      if (anchor instanceof Element) {
        const image = findImageUrlFromTarget(anchor) ?? findImageUrlFromTarget(targetEl);
        if (image?.url) return { el: anchor, url: image.url };
        return { el: anchor, url: location.href };
      }
    }

    if (handler.id === 'artstation') {
      const anchor = NS.artstationHoverAnchor?.(targetEl);
      if (anchor instanceof Element) {
        const image = findImageUrlFromTarget(anchor) ?? findImageUrlFromTarget(targetEl);
        if (image?.url) return { el: anchor, url: image.url };
      }
    }

    const image = findImageUrlFromTarget(targetEl);
    if (image?.url) return image;

    const video = handler.findVideoTarget?.(targetEl);
    return video?.url ? video : null;
  }

  /**
   * @param {string} url
   * @returns {boolean}
   */
  function isDirectMediaUrl(url) {
    if (!url?.trim()) return false;
    try {
      const parsed = new URL(url);
      if (/\.(mp4|webm|m3u8|mov)(\?|$)/i.test(parsed.pathname)) return true;
      if (/^v\d*\.pinimg\.com$/i.test(parsed.hostname) || parsed.hostname === 'i.pinimg.com') return true;
      return false;
    } catch {
      return false;
    }
  }

  /**
   * @param {string} url
   * @returns {boolean}
   */
  function isPinterestPinPageUrl(url) {
    return /\/pin\/\d+/i.test(url);
  }

  /**
   * @param {import('./types.js').SiteResolveContext} ctx
   * @param {import('./types.js').SiteHandler} handler
   * @returns {import('./types.js').SavePayload | null}
   */
  function buildPayloadFromContext(ctx, handler) {
    const { pageUrl, pageTitle } = ctx;
    const absoluteRaw = resolveAbsoluteUrl(ctx.rawUrl, pageUrl);
    if (!absoluteRaw) return null;

    const resolved = normalizeResolved(handler.resolveImageUrl(ctx));
    if (
      handler.id === 'pinterest' &&
      isPinterestPinPageUrl(pageUrl) &&
      !resolved.url &&
      !isDirectMediaUrl(absoluteRaw)
    ) {
      return null;
    }

    const url = resolveAbsoluteUrl(resolved.url ?? absoluteRaw, pageUrl) ?? absoluteRaw;
    if (handler.id === 'pinterest' && isPinterestPinPageUrl(url) && !isDirectMediaUrl(url)) {
      return null;
    }

    const mediaKind =
      resolved.mediaKind ??
      (handler.id === 'youtube' || isDirectMediaUrl(url) ? 'video' : 'image');
    const fallbackUrl =
      mediaKind === 'video'
        ? null
        : resolved.fallbackUrl
          ? resolveAbsoluteUrl(resolved.fallbackUrl, pageUrl) ?? resolved.fallbackUrl
          : null;
    const name = handler.resolveCardName(ctx);

    /** @type {import('./types.js').SavePayload} */
    const payload = {
      url,
      website: pageUrl,
      pageTitle,
      mediaKind
    };

    if (fallbackUrl && fallbackUrl !== url) {
      payload.fallbackUrl = fallbackUrl;
    }
    if (name) {
      payload.name = name;
    }

    return payload;
  }

  /**
   * @param {Element} targetEl
   * @returns {import('./types.js').SavePayload | null}
   */
  function resolveSaveFromTarget(targetEl) {
    const found = findSaveableTarget(targetEl);
    if (!found?.url) return null;

    const handler = getSiteHandler(location.hostname);
    return buildPayloadFromContext(
      {
        targetEl: found.el,
        rawUrl: found.url,
        pageUrl: location.href,
        pageTitle: document.title
      },
      handler
    );
  }

  /**
   * @param {{ url: string, website?: string, pageTitle?: string, name?: string }} partial
   * @returns {import('./types.js').SavePayload | null}
   */
  function resolveSaveFromUrl(partial) {
    const pageUrl = partial.website?.trim() || (typeof location !== 'undefined' ? location.href : '');
    const pageTitle = partial.pageTitle?.trim() || (typeof document !== 'undefined' ? document.title : '');
    let rawCandidate = partial.url?.trim() ?? '';
    if (partial.mediaKind === 'video' && /^blob:/i.test(rawCandidate)) {
      rawCandidate = pageUrl;
    }
    const absoluteRaw = resolveAbsoluteUrl(rawCandidate, pageUrl);
    if (!absoluteRaw || !pageUrl) return null;

    let hostname;
    try {
      hostname = new URL(pageUrl).hostname;
    } catch {
      return {
        url: absoluteRaw,
        website: pageUrl,
        pageTitle,
        mediaKind: 'image',
        ...(partial.name ? { name: partial.name } : {})
      };
    }

    const handler = getSiteHandler(hostname);
    const ctx = {
      targetEl: document.body,
      rawUrl: absoluteRaw,
      pageUrl,
      pageTitle
    };

    const payload = buildPayloadFromContext(ctx, handler);
    if (!payload) return null;
    if (partial.name) {
      payload.name = partial.name;
    }
    return payload;
  }

  Object.assign(NS, {
    findSaveableTarget,
    resolveSaveFromTarget,
    resolveSaveFromUrl,
    buildPayloadFromContext,
    isDirectMediaUrl,
    isPinterestPinPageUrl
  });
})();
