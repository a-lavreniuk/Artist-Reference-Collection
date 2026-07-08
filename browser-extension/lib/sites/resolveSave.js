import { findImageUrlFromTarget } from './generic.js';
import { getSiteHandler } from './registry.js';
import { resolveAbsoluteUrl } from './urlUtils.js';

/**
 * @param {Element} targetEl
 * @returns {import('./types.js').SavePayload | null}
 */
export function resolveSaveFromTarget(targetEl) {
  const found = findImageUrlFromTarget(targetEl);
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

  const resolvedUrl = handler.resolveImageUrl(ctx) ?? absoluteRaw;
  const url = resolveAbsoluteUrl(resolvedUrl, pageUrl) ?? absoluteRaw;
  const name = handler.resolveCardName(ctx);

  /** @type {import('./types.js').SavePayload} */
  const payload = {
    url,
    website: pageUrl,
    pageTitle
  };

  if (name) {
    payload.name = name;
  }

  return payload;
}

/**
 * @param {{ url: string, website?: string, pageTitle?: string, name?: string }} partial
 * @returns {import('./types.js').SavePayload | null}
 */
export function resolveSaveFromUrl(partial) {
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

  const resolvedUrl = handler.resolveImageUrl(ctx) ?? absoluteRaw;
  const url = resolveAbsoluteUrl(resolvedUrl, pageUrl) ?? absoluteRaw;
  const name = partial.name || handler.resolveCardName(ctx);

  return {
    url,
    website: pageUrl,
    pageTitle,
    ...(name ? { name } : {})
  };
}
