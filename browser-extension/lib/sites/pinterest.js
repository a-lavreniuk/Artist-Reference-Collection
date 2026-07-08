import { findImageUrlFromTarget } from './generic.js';

export { findImageUrlFromTarget };

import {
  cleanPageTitle,
  getMetaContent,
  pickLargestImageUrlFromElement,
  resolveAbsoluteUrl
} from './urlUtils.js';

const PINIMG_SIZE_SEGMENT = /^\/(\d+x|\d+x\d+)\//;

/**
 * @param {string} url
 * @returns {string}
 */
export function upgradePinimgUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'i.pinimg.com') return url;
    if (parsed.pathname.includes('/originals/')) return url;

    const upgraded = parsed.pathname.replace(PINIMG_SIZE_SEGMENT, '/originals/');
    if (upgraded !== parsed.pathname) {
      parsed.pathname = upgraded;
      return parsed.href;
    }
  } catch {
    // keep original
  }
  return url;
}

/** @type {import('./types.js').SiteHandler} */
export const pinterestHandler = {
  id: 'pinterest',

  resolveImageUrl({ rawUrl, targetEl, pageUrl }) {
    const candidates = [];

    const fromElement = pickLargestImageUrlFromElement(targetEl);
    if (fromElement) candidates.push(fromElement);

    if (targetEl instanceof Element) {
      const pinMedia = targetEl.closest('[data-pin-media]');
      if (pinMedia) {
        const media = pinMedia.getAttribute('data-pin-media');
        if (media) candidates.push(media);
      }
    }

    const ogImage = getMetaContent('og:image');
    if (ogImage) candidates.push(ogImage);

    candidates.push(rawUrl);

    const absoluteCandidates = candidates
      .map((c) => resolveAbsoluteUrl(c, pageUrl))
      .filter(Boolean);

    const upgraded = absoluteCandidates.map(upgradePinimgUrl);

    for (const url of upgraded) {
      if (url.includes('/originals/')) return url;
    }

    return upgraded[0] ?? resolveAbsoluteUrl(rawUrl, pageUrl) ?? rawUrl;
  },

  resolveCardName({ pageTitle }) {
    const h1 = document.querySelector('h1')?.textContent?.trim();
    const ogTitle = getMetaContent('og:title');
    const raw = h1 || ogTitle || pageTitle;
    return (
      cleanPageTitle(raw, [
        /\s*[-|–—]\s*Pinterest\s*$/i,
        /\s*\|\s*Pinterest\s*$/i,
        /\s+on Pinterest\s*$/i
      ]) ?? undefined
    );
  }
};
