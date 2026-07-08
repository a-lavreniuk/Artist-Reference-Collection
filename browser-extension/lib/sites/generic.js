/**
 * @param {EventTarget | null} target
 * @returns {{ el: Element, url: string } | null}
 */
export function findImageUrlFromTarget(target) {
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

/** @type {import('./types.js').SiteHandler} */
export const genericHandler = {
  id: 'generic',

  resolveImageUrl({ rawUrl }) {
    return rawUrl;
  },

  resolveCardName() {
    return undefined;
  }
};
