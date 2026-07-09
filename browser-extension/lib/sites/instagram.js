(() => {
  const NS = (window.__ARC__ = window.__ARC__ || {});
  const {
    cleanPageTitle,
    getMetaContent,
    pickLargestImageUrlFromElement,
    pickLargestFromSrcset,
    resolveAbsoluteUrl,
    isInstagramPostMediaUrl
  } = NS;

  const POST_PATH_RE = /\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/i;
  const RELATED_POSTS_HEADING_RE =
    /more (?:posts|publications) from|ещё публикаци|другие публикаци/i;

  /**
   * @param {string} [url]
   * @returns {string | null}
   */
  function getInstagramPostShortcode(url = location.href) {
    return POST_PATH_RE.exec(url)?.[1] ?? null;
  }

  /**
   * @param {string} url
   * @returns {boolean}
   */
  function isInstagramPostUrl(url) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host !== 'instagram.com' && !host.endsWith('.instagram.com')) return false;
      return POST_PATH_RE.test(new URL(url).pathname);
    } catch {
      return false;
    }
  }

  /**
   * @returns {Element | null}
   */
  function findRelatedPostsCutoff() {
    const root = document.querySelector('main');
    if (!root) return null;

    for (const el of root.querySelectorAll('h1, h2, h3, span, div')) {
      if (!(el instanceof Element)) continue;
      const text = el.textContent?.trim() ?? '';
      if (text.length < 6 || text.length > 160) continue;
      if (RELATED_POSTS_HEADING_RE.test(text)) return el;
    }

    return null;
  }

  /**
   * Collect images in document order inside main, stopping before related-posts block.
   * @returns {string[]}
   */
  function collectMainImagesBeforeRelated() {
    const dedupe = NS.dedupeInstagramImageUrls ?? ((urls) => [...new Set(urls)]);
    const root = document.querySelector('main');
    if (!root) return [];

    const cutoff = findRelatedPostsCutoff();
    const urls = [];

    for (const img of root.querySelectorAll('img[srcset], img[src]')) {
      if (!(img instanceof HTMLImageElement)) continue;
      if (cutoff && cutoff.compareDocumentPosition(img) & Node.DOCUMENT_POSITION_FOLLOWING) {
        break;
      }

      const fromEl = pickLargestImageUrlFromElement(img);
      if (fromEl && isInstagramPostMediaUrl(fromEl)) urls.push(fromEl);
    }

    return dedupe(urls);
  }

  /**
   * @param {string} shortcode
   * @returns {string[]}
   */
  function collectDomImageUrls(shortcode) {
    const dedupe = NS.dedupeInstagramImageUrls ?? ((urls) => [...new Set(urls)]);
    const html = document.documentElement.outerHTML;
    const hasJsonMarker =
      html.includes(`"shortcode":"${shortcode}"`) || html.includes(`"code":"${shortcode}"`);
    const fromHtml = NS.collectInstagramImageUrlsFromHtml?.(html, shortcode) ?? [];

    if (fromHtml.length >= 2) return fromHtml;
    if (fromHtml.length === 1 && hasJsonMarker) return fromHtml;

    const candidates = [];

    const ogImage = getMetaContent('og:image');
    if (ogImage && isInstagramPostMediaUrl(ogImage)) candidates.push(ogImage);

    candidates.push(...collectMainImagesBeforeRelated());
    candidates.push(...fromHtml);

    let result = dedupe(candidates);

    if (!result.length) {
      const fallbackImg = document.querySelector('main img[srcset], main img[src]');
      if (fallbackImg instanceof HTMLImageElement) {
        const fromEl = pickLargestImageUrlFromElement(fallbackImg);
        if (fromEl && isInstagramPostMediaUrl(fromEl)) result = [fromEl];
      }
    }

    return result;
  }

  /**
   * @param {string} shortcode
   * @returns {Promise<string[]>}
   */
  async function collectInstagramImageUrls(shortcode) {
    const fromApi = (await NS.fetchInstagramPostImagesFromApi?.(shortcode)) ?? [];
    if (fromApi.length) return fromApi;

    return collectDomImageUrls(shortcode);
  }

  /**
   * @returns {Promise<{ shortcode: string, author: string | null, caption: string | null, images: Array<{ url: string, name?: string }>, website: string } | null>}
   */
  async function resolveInstagramPostMediaFromDom() {
    const pageUrl = location.href.split('?')[0];
    const shortcode = getInstagramPostShortcode(pageUrl);
    if (!shortcode) return null;

    const author =
      document.querySelector('header a[href^="/"]')?.textContent?.trim() ??
      extractAuthorFromTitle(document.title);
    const caption = getMetaContent('og:description')?.slice(0, 200) ?? null;
    const ranked = await collectInstagramImageUrls(shortcode);

    if (!ranked.length) return null;

    const website = pageUrl.endsWith('/') ? pageUrl : `${pageUrl}/`;
    const images = ranked.map((url, index) => ({
      url,
      name: buildCardName(caption, author)
        ? `${buildCardName(caption, author)}${ranked.length > 1 ? ` — ${index + 1}/${ranked.length}` : ''}`
        : undefined
    }));

    return { shortcode, author, caption, images, website };
  }

  /**
   * @returns {Promise<import('./types.js').SavePayload | null>}
   */
  async function resolveInstagramPostFromDom() {
    const post = await resolveInstagramPostMediaFromDom();
    if (!post?.images?.length) return null;

    return {
      url: post.images[0].url,
      mediaKind: 'image',
      website: post.website,
      pageTitle: document.title,
      ...(post.images[0].name ? { name: post.images[0].name } : {})
    };
  }

  /**
   * @param {string} title
   * @returns {string | null}
   */
  function extractAuthorFromTitle(title) {
    const onIg = /^(.+?)\s+on\s+Instagram/i.exec(title);
    if (onIg?.[1]) return onIg[1].trim();
    const atUser = /@([A-Za-z0-9._]+)/.exec(title);
    return atUser?.[1] ?? null;
  }

  /**
   * @param {string | null | undefined} caption
   * @param {string | null | undefined} author
   * @returns {string | undefined}
   */
  function buildCardName(caption, author) {
    const authorLabel = author ? (author.startsWith('@') ? author : `@${author}`) : null;
    const base = caption && authorLabel ? `${caption} — ${authorLabel}` : caption || authorLabel;
    return base?.trim() || undefined;
  }

  /**
   * Caption / comments column markers — absent from the media gallery column.
   * @param {Element} el
   * @returns {boolean}
   */
  function elementHasCaptionSignals(el) {
    if (!(el instanceof Element)) return false;

    return Boolean(
      el.querySelector('time[datetime]') ||
        el.querySelector('textarea') ||
        el.querySelector('form[enctype]') ||
        el.querySelector('[contenteditable="true"]')
    );
  }

  /**
   * Narrow hover/position target to the post media column (carousel / main image).
   * @param {Element} scope
   * @param {Element} targetEl
   * @returns {Element | null}
   */
  function findInstagramGalleryContainer(scope, targetEl) {
    const hoveredImg = targetEl instanceof Element ? targetEl.closest('img') : null;
    const mediaSeed =
      (hoveredImg instanceof HTMLImageElement ? hoveredImg : null) ??
      scope.querySelector('ul[role="list"]') ??
      scope.querySelector('div[role="presentation"] img[srcset], div[role="presentation"] img[src]')
        ?.closest('div[role="presentation"]') ??
      scope.querySelector('img[srcset], img[src]') ??
      scope.querySelector('video');

    if (!(mediaSeed instanceof Element)) return null;

    let node = mediaSeed;
    let largest = null;
    let largestArea = 0;

    while (node instanceof Element && scope.contains(node)) {
      const rect = node.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (rect.width >= 180 && rect.height >= 180 && area >= largestArea) {
        largestArea = area;
        largest = node;
      }

      if (!elementHasCaptionSignals(node)) {
        const parent = node.parentElement;
        if (parent instanceof Element && scope.contains(parent)) {
          for (const sibling of parent.children) {
            if (sibling === node || !(sibling instanceof Element)) continue;
            if (elementHasCaptionSignals(sibling)) {
              return node;
            }
          }
        }
      }

      if (node === scope) break;
      node = node.parentElement;
    }

    if (largest instanceof Element) return largest;

    const carousel = scope.querySelector('ul[role="list"]');
    if (carousel?.parentElement instanceof Element) return carousel.parentElement;

    const presentation = scope.querySelector('div[role="presentation"]');
    return presentation instanceof Element ? presentation : null;
  }

  /**
   * @param {Element | null | undefined} targetEl
   * @returns {Element | null}
   */
  function instagramHoverAnchor(targetEl) {
    if (!(targetEl instanceof Element)) return null;

    const scope =
      targetEl.closest('article') ??
      targetEl.closest('main') ??
      document.querySelector('main');

    if (scope instanceof Element) {
      const gallery = findInstagramGalleryContainer(scope, targetEl);
      if (gallery instanceof Element) return gallery;
    }

    const img = targetEl.closest('img');
    if (img instanceof HTMLImageElement) return img;

    return targetEl;
  }

  /**
   * @returns {Promise<{ shortcode: string, author: string | null, caption: string | null, images: Array<{ url: string, name?: string }>, website: string } | null>}
   */
  async function waitForInstagramPostMedia(maxMs = 12000) {
    const deadline = Date.now() + maxMs;
    let last = null;

    while (Date.now() < deadline) {
      last = await resolveInstagramPostMediaFromDom();
      if (last?.images?.length) return last;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    return last;
  }

  /** @type {import('./types.js').SiteHandler} */
  const instagramHandler = {
    id: 'instagram',

    resolveImageUrl({ rawUrl, targetEl, pageUrl }) {
      const candidates = [];

      if (targetEl instanceof Element) {
        const article = targetEl.closest('article');
        const scope = article instanceof Element ? article : targetEl;
        const img =
          scope instanceof Element
            ? scope.querySelector('img[srcset], img[src]') ??
              (targetEl instanceof HTMLImageElement ? targetEl : null)
            : null;

        if (img instanceof HTMLImageElement) {
          const fromImg = pickLargestImageUrlFromElement(img);
          if (fromImg) candidates.push(fromImg);
          if (img.srcset) {
            const fromSet = pickLargestFromSrcset(img.srcset, pageUrl);
            if (fromSet) candidates.push(fromSet);
          }
        }
      }

      const ogImage = getMetaContent('og:image');
      if (ogImage) candidates.push(ogImage);

      if (rawUrl) candidates.push(rawUrl);

      const absolute = candidates
        .map((c) => resolveAbsoluteUrl(c, pageUrl))
        .filter((url) => url && isInstagramPostMediaUrl(url));

      return absolute[0] ?? resolveAbsoluteUrl(rawUrl, pageUrl) ?? rawUrl;
    },

    resolveCardName({ pageTitle }) {
      const caption = getMetaContent('og:description')?.slice(0, 200) ?? null;
      const author = extractAuthorFromTitle(pageTitle || document.title);
      const built = buildCardName(caption, author);
      if (built) return built;

      return (
        cleanPageTitle(pageTitle || document.title, [
          /\s*[-|–—]\s*Instagram\s*$/i,
          /\s*\|\s*Instagram\s*$/i,
          /\s+on Instagram\s*$/i
        ]) ?? undefined
      );
    }
  };

  Object.assign(NS, {
    instagramHandler,
    isInstagramPostUrl,
    getInstagramPostShortcode,
    resolveInstagramPostFromDom,
    resolveInstagramPostMediaFromDom,
    waitForInstagramPostMedia,
    instagramHoverAnchor
  });
})();
