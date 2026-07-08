import {
  cleanPageTitle,
  getMetaContent,
  pickLargestFromSrcset,
  pickLargestImageUrlFromElement,
  resolveAbsoluteUrl
} from './urlUtils.js';

/**
 * @param {string} url
 * @returns {string}
 */
function stripArtstationResizeSegment(url) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('artstation')) return url;

    const resized = parsed.pathname.replace(/\/(?:small|medium|large|4k)_square\//, '/');
    if (resized !== parsed.pathname) {
      parsed.pathname = resized;
      return parsed.href;
    }
  } catch {
    // keep original
  }
  return url;
}

/** @type {import('./types.js').SiteHandler} */
export const artstationHandler = {
  id: 'artstation',

  resolveImageUrl({ rawUrl, targetEl, pageUrl }) {
    const candidates = [];

    if (targetEl instanceof Element) {
      const artworkImg =
        targetEl.closest('.artwork-image, .project-image, [data-image], .image-container')?.querySelector('img') ??
        (targetEl instanceof HTMLImageElement ? targetEl : targetEl.closest('img'));

      if (artworkImg instanceof HTMLImageElement) {
        const fromImg = pickLargestImageUrlFromElement(artworkImg);
        if (fromImg) candidates.push(fromImg);

        if (artworkImg.srcset) {
          const fromSet = pickLargestFromSrcset(artworkImg.srcset, pageUrl);
          if (fromSet) candidates.push(fromSet);
        }
      }

      const dataImageHost = targetEl.closest('[data-image]');
      const dataImage = dataImageHost?.getAttribute('data-image');
      if (dataImage) candidates.push(dataImage);
    }

    const ogImage = getMetaContent('og:image');
    if (ogImage) candidates.push(ogImage);

    candidates.push(rawUrl);

    const absoluteCandidates = candidates
      .map((c) => resolveAbsoluteUrl(c, pageUrl))
      .filter(Boolean)
      .map(stripArtstationResizeSegment);

    const sorted = [...new Set(absoluteCandidates)].sort((a, b) => b.length - a.length);
    return sorted[0] ?? resolveAbsoluteUrl(rawUrl, pageUrl) ?? rawUrl;
  },

  resolveCardName({ pageTitle }) {
    const titleEl = document.querySelector(
      'h1.project-title, h1.artwork-title, .project-title, h1'
    );
    const title = titleEl?.textContent?.trim();
    const author =
      document.querySelector('.author-name, .artist-name, a.user-name')?.textContent?.trim() ??
      getMetaContent('author');

    const base =
      title && author && !title.includes(author) ? `${title} — ${author}` : title || author || pageTitle;

    return (
      cleanPageTitle(base, [
        /\s*[-|–—]\s*ArtStation\s*$/i,
        /\s*\|\s*ArtStation\s*$/i
      ]) ?? undefined
    );
  }
};
