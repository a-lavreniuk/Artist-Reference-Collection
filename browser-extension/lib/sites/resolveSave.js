(() => {
  const NS = (window.__ARC__ = window.__ARC__ || {});
  const { findImageUrlFromTarget, getSiteHandler, resolveAbsoluteUrl } = NS;

  /**
   * Результат `resolveImageUrl` может быть строкой (изображение) либо
   * объектом `{ url, fallbackUrl }` (например видео + постер).
   * @param {string | { url?: string, fallbackUrl?: string } | null | undefined} resolved
   * @returns {{ url: string | null, fallbackUrl: string | null }}
   */
  function normalizeResolved(resolved) {
    if (resolved && typeof resolved === 'object') {
      return { url: resolved.url ?? null, fallbackUrl: resolved.fallbackUrl ?? null };
    }
    return { url: typeof resolved === 'string' ? resolved : null, fallbackUrl: null };
  }

  /**
   * Ищет сохраняемую цель: сначала изображение, затем видео (через site-handler).
   * @param {Element | null} targetEl
   * @returns {{ el: Element, url: string } | null}
   */
  function findSaveableTarget(targetEl) {
    const image = findImageUrlFromTarget(targetEl);
    if (image?.url) return image;
    const handler = getSiteHandler(location.hostname);
    const video = handler.findVideoTarget?.(targetEl);
    return video?.url ? video : null;
  }

  /**
   * @param {Element} targetEl
   * @returns {import('./types.js').SavePayload | null}
   */
  function resolveSaveFromTarget(targetEl) {
    const found = findSaveableTarget(targetEl);
    if (!found?.url) return null;

    const pageUrl = location.href;
    const pageTitle = document.title;
    const rawUrl = found.url;

    const absoluteRaw = resolveAbsoluteUrl(rawUrl, pageUrl);
    if (!absoluteRaw) return null;

    const handler = getSiteHandler(location.hostname);
    const ctx = {
      targetEl: found.el,
      rawUrl: absoluteRaw,
      pageUrl,
      pageTitle
    };

    const resolved = normalizeResolved(handler.resolveImageUrl(ctx));
    const url = resolveAbsoluteUrl(resolved.url ?? absoluteRaw, pageUrl) ?? absoluteRaw;
    const fallbackUrl = resolved.fallbackUrl
      ? resolveAbsoluteUrl(resolved.fallbackUrl, pageUrl) ?? resolved.fallbackUrl
      : null;
    const name = handler.resolveCardName(ctx);

    /** @type {import('./types.js').SavePayload} */
    const payload = {
      url,
      website: pageUrl,
      pageTitle
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
   * @param {{ url: string, website?: string, pageTitle?: string, name?: string }} partial
   * @returns {import('./types.js').SavePayload | null}
   */
  function resolveSaveFromUrl(partial) {
    const pageUrl = partial.website?.trim() || (typeof location !== 'undefined' ? location.href : '');
    const pageTitle = partial.pageTitle?.trim() || (typeof document !== 'undefined' ? document.title : '');
    const absoluteRaw = resolveAbsoluteUrl(partial.url, pageUrl);
    if (!absoluteRaw || !pageUrl) return null;

    let hostname;
    try {
      hostname = new URL(pageUrl).hostname;
    } catch {
      return {
        url: absoluteRaw,
        website: pageUrl,
        pageTitle,
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

    const resolved = normalizeResolved(handler.resolveImageUrl(ctx));
    const url = resolveAbsoluteUrl(resolved.url ?? absoluteRaw, pageUrl) ?? absoluteRaw;
    const fallbackUrl = resolved.fallbackUrl
      ? resolveAbsoluteUrl(resolved.fallbackUrl, pageUrl) ?? resolved.fallbackUrl
      : null;
    const name = partial.name || handler.resolveCardName(ctx);

    return {
      url,
      website: pageUrl,
      pageTitle,
      ...(fallbackUrl && fallbackUrl !== url ? { fallbackUrl } : {}),
      ...(name ? { name } : {})
    };
  }

  Object.assign(NS, { findSaveableTarget, resolveSaveFromTarget, resolveSaveFromUrl });
})();
