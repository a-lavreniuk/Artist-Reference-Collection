(() => {
  const NS = (window.__ARC__ = window.__ARC__ || {});
  const {
    cleanPageTitle,
    getMetaContent,
    pickLargestFromSrcset,
    pickLargestImageUrlFromElement,
    pickVideoSourceUrl,
    findVideoElement,
    resolveAbsoluteUrl
  } = NS;

  /**
   * @param {string} url
   * @returns {string}
   */
  function stripArtstationResizeSegment(url) {
    try {
      const parsed = new URL(url);
      if (!parsed.hostname.includes('artstation')) return url;

      const resized = parsed.pathname.replace(
        /\/(?:small|medium|large|4k|sm|md|lg)_square\//,
        '/'
      );
      if (resized !== parsed.pathname) {
        parsed.pathname = resized;
        return parsed.href;
      }
    } catch {
      // keep original
    }
    return url;
  }

  /**
   * @param {Element | null | undefined} targetEl
   * @returns {Element | null}
   */
  function artstationHoverAnchor(targetEl) {
    if (!(targetEl instanceof Element)) return null;

    const artworkContainer = targetEl.closest(
      '.artwork-image, .project-image, .image-container, .album-image, [data-image], .portfolio-item, a[href*="/artwork/"]'
    );
    if (artworkContainer instanceof Element) {
      const img = artworkContainer.querySelector('img');
      return img instanceof HTMLImageElement ? img : artworkContainer;
    }

    if (targetEl instanceof HTMLImageElement) return targetEl;
    return targetEl.closest('img');
  }

  /**
   * @param {Element | null} target
   * @returns {{ el: Element, url: string } | null}
   */
  function findVideoTarget(target) {
    const scope =
      target?.closest?.('.artwork-image, .project-image, .image-container, main') ?? document.querySelector('main');
    const video = findVideoElement(target) ?? scope?.querySelector?.('video');
    if (!(video instanceof HTMLVideoElement)) return null;

    const url = pickVideoSourceUrl(video);
    if (!url) return null;

    const anchor =
      video.closest('.artwork-image, .project-image, .image-container') ??
      artstationHoverAnchor(target) ??
      video;
    if (!(anchor instanceof Element)) return null;

    return { el: anchor, url };
  }

  /** @type {import('./types.js').SiteHandler} */
  const artstationHandler = {
    id: 'artstation',

    findVideoTarget,

    resolveImageUrl({ rawUrl, targetEl, pageUrl }) {
      const candidates = [];

      if (targetEl instanceof Element) {
        const artworkRoot =
          targetEl.closest('.artwork-image, .project-image, .image-container, [data-image], .album-image') ??
          targetEl;

        const artworkImg =
          artworkRoot?.querySelector?.('img') ??
          (targetEl instanceof HTMLImageElement ? targetEl : targetEl.closest('img'));

        if (artworkImg instanceof HTMLImageElement) {
          const dataOriginal = artworkImg.getAttribute('data-original') || artworkImg.getAttribute('data-src');
          if (dataOriginal) candidates.push(dataOriginal);

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
        document.querySelector('.author-name, .artist-name, a.user-name, .user-name')?.textContent?.trim() ??
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

  /**
   * @param {string} hashId
   * @param {string} [artworkUrl]
   * @returns {Promise<object | null>}
   */
  async function fetchArtstationProjectMedia(hashId, artworkUrl = location.href.split('?')[0]) {
    if (!hashId?.trim()) return null;

    try {
      const res = await fetch(`https://www.artstation.com/projects/${hashId}.json`, {
        credentials: 'include',
        headers: { Accept: 'application/json, text/plain, */*' }
      });
      if (!res.ok) return null;
      const data = await res.json();
      return NS.parseArtstationProjectJson?.(data, artworkUrl) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * @returns {Promise<object | null>}
   */
  async function resolveArtstationArtworkMediaFromPage() {
    const pageUrl = location.href.split('?')[0];
    const artworkId = /\/artwork\/([A-Za-z0-9_-]+)/i.exec(pageUrl)?.[1];
    if (!artworkId) return null;

    const fromJson = await fetchArtstationProjectMedia(artworkId, pageUrl);
    if (fromJson?.images?.length || fromJson?.videoUrl) return fromJson;

    return resolveArtstationArtworkMediaFromDom();
  }

  /**
   * @returns {object | null}
   */
  function resolveArtstationArtworkMediaFromDom() {
    const pageUrl = location.href.split('?')[0];
    const artworkId = /\/artwork\/([A-Za-z0-9_-]+)/i.exec(pageUrl)?.[1];
    if (!artworkId) return null;

    const title =
      document.querySelector('h1.project-title, h1.artwork-title, .project-title, h1')?.textContent?.trim() ??
      null;
    const author =
      document.querySelector('.author-name, .artist-name, a.user-name, .user-name')?.textContent?.trim() ??
      getMetaContent('author');

    const videoTarget = findVideoTarget(document.body);
    if (videoTarget?.url) {
      return {
        artworkId,
        title,
        author,
        images: [],
        videoUrl: videoTarget.url,
        website: pageUrl,
        mediaKind: 'video'
      };
    }

    const imageUrls = [];
    for (const el of document.querySelectorAll('[data-image], .carousel img, .image-gallery img, .project-image img, .artwork-image img')) {
      if (el instanceof HTMLImageElement) {
        const fromImg = pickLargestImageUrlFromElement(el);
        if (fromImg) imageUrls.push(stripArtstationResizeSegment(fromImg));
      } else if (el instanceof Element) {
        const dataImage = el.getAttribute('data-image');
        if (dataImage) imageUrls.push(stripArtstationResizeSegment(dataImage));
      }
    }

    const ogImage = getMetaContent('og:image');
    if (ogImage) imageUrls.push(stripArtstationResizeSegment(ogImage));

    const unique = [...new Set(imageUrls.filter(Boolean))];
    if (!unique.length) {
      const single = artstationHandler.resolveImageUrl({
        targetEl: document.body,
        rawUrl: pageUrl,
        pageUrl,
        pageTitle: document.title
      });
      const url = typeof single === 'string' ? single : single?.url;
      if (url) unique.push(url);
    }

    if (!unique.length) return null;

    const images = unique.map((url, index) => ({
      url,
      name:
        title && author
          ? `${title} — ${author}${unique.length > 1 ? ` — ${index + 1}/${unique.length}` : ''}`
          : title || author || undefined
    }));

    return {
      artworkId,
      title,
      author,
      images,
      videoUrl: null,
      website: pageUrl,
      mediaKind: 'image'
    };
  }

  /**
   * @returns {import('./types.js').SavePayload | null}
   */
  function resolveArtstationArtworkFromDom() {
    const pageUrl = location.href.split('?')[0];
    const video = findVideoTarget(document.body);
    if (video?.url) {
      const name = artstationHandler.resolveCardName({ pageUrl, pageTitle: document.title, targetEl: document.body, rawUrl: video.url });
      return {
        url: video.url,
        mediaKind: 'video',
        website: pageUrl,
        pageTitle: document.title,
        ...(name ? { name } : {})
      };
    }

    const ctx = {
      targetEl: document.body,
      rawUrl: pageUrl,
      pageUrl,
      pageTitle: document.title
    };
    const resolved = artstationHandler.resolveImageUrl(ctx);
    const url = typeof resolved === 'string' ? resolved : resolved?.url;
    if (!url) return null;

    const name = artstationHandler.resolveCardName(ctx);
    return {
      url,
      mediaKind: 'image',
      website: pageUrl,
      pageTitle: document.title,
      ...(name ? { name } : {})
    };
  }

  /**
   * @returns {Promise<import('./types.js').SavePayload | null>}
   */
  async function waitForArtstationArtworkMedia(maxMs = 12000) {
    const deadline = Date.now() + maxMs;
    let last = null;

    while (Date.now() < deadline) {
      last = resolveArtstationArtworkFromDom();
      if (last?.url) return last;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    return last;
  }

  Object.assign(NS, {
    stripArtstationResizeSegment,
    artstationHandler,
    artstationHoverAnchor,
    resolveArtstationArtworkFromDom,
    resolveArtstationArtworkMediaFromDom,
    resolveArtstationArtworkMediaFromPage,
    fetchArtstationProjectMedia,
    waitForArtstationArtworkMedia
  });
})();
