(() => {
  const NS = (window.__ARC__ = window.__ARC__ || {});
  const {
    cleanPageTitle,
    getMetaContent,
    pickLargestImageUrlFromElement,
    resolveAbsoluteUrl
  } = NS;

  const PINIMG_SIZE_SEGMENT = /^\/(\d+x|\d+x\d+)\//;

  const PIN_VIDEO_MP4_RE = /https?:\/\/v\d*\.pinimg\.com\/videos\/[^\s"'\\)]+?\.mp4/gi;
  const PIN_VIDEO_HLS_RE = /https?:\/\/v\d*\.pinimg\.com\/videos\/[^\s"'\\)]+?\.m3u8/gi;
  const PIN_CLOSEUP_VIDEO_SELECTOR =
    '[data-test-id="pin-closeup-video"], [data-test-id="closeup-video"], [data-test-id="pin-closeup-image"]';
  const PIN_VIDEO_CLOSEUP_SELECTOR =
    '[data-test-id="pin-closeup-video"], [data-test-id="closeup-video"]';
  const PIN_IMAGE_CLOSEUP_SELECTOR =
    '[data-test-id="pin-closeup-image"], [data-test-id="closeup-image"]';
  const PIN_CONTAINER_SELECTOR =
    '[data-test-id="pin"], [data-test-id="pinWrapper"], [data-test-id="deep-dive-pin"]';

  const HERO_CLOSEUP_SELECTORS = [
    '[data-test-id="pin-closeup-video"]',
    '[data-test-id="closeup-video"]',
    '[data-test-id="pin-closeup-image"]',
    '[data-test-id="closeup-image"]',
    '[data-test-id="visual-content-container"]'
  ];

  /**
   * @returns {boolean}
   */
  function isPinCloseupPage() {
    return /\/pin\/\d+/i.test(location.pathname);
  }

  /**
   * @returns {string | null}
   */
  function getCurrentPinId() {
    const match = /\/pin\/(\d+)/i.exec(location.pathname);
    return match?.[1] ?? null;
  }

  /**
   * Главный closeup текущего пина (не рекомендации внизу).
   * @returns {Element | null}
   */
  function getPinHeroRoot() {
    const main = document.querySelector('main') ?? document.body;
    for (const selector of HERO_CLOSEUP_SELECTORS) {
      const el = main.querySelector(selector);
      if (el instanceof Element) return el;
    }
    return null;
  }

  /** @deprecated use getPinHeroRoot */
  function getPinCloseupRoot() {
    return getPinHeroRoot();
  }

  /**
   * @returns {string | null}
   */
  function getOgVideoUrl() {
    return (
      getMetaContent('og:video:url') ||
      getMetaContent('og:video:secure_url') ||
      getMetaContent('og:video')
    );
  }

  /**
   * @param {string} url
   * @returns {string}
   */
  function upgradePinimgUrl(url) {
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

  /**
   * @param {string} url
   * @returns {number}
   */
  function pinVideoResolutionScore(url) {
    const byLabel = /\/(\d{3,4})p(?:\/|_|\.)/i.exec(url);
    if (byLabel) return Number(byLabel[1]);
    const byWidth = /_(\d{3,4})w\.mp4/i.exec(url);
    if (byWidth) return Number(byWidth[1]);
    const byDim = /_(\d{3,4})x(\d{3,4})/i.exec(url);
    if (byDim) return Number(byDim[2]);
    return 0;
  }

  /**
   * @param {string} html
   * @returns {{ mp4: string[], hls: string[] }}
   */
  function collectVideoUrlsFromHtml(html) {
    const mp4 = new Set();
    const hls = new Set();

    let match;
    PIN_VIDEO_MP4_RE.lastIndex = 0;
    while ((match = PIN_VIDEO_MP4_RE.exec(html))) mp4.add(match[0]);
    PIN_VIDEO_HLS_RE.lastIndex = 0;
    while ((match = PIN_VIDEO_HLS_RE.exec(html))) hls.add(match[0]);

    return { mp4: [...mp4], hls: [...hls] };
  }

  /**
   * @param {{ mp4: string[], hls: string[] }} sets
   * @returns {string | null}
   */
  function pickBestFromVideoSets(sets) {
    const byRes = (a, b) => pinVideoResolutionScore(b) - pinVideoResolutionScore(a);
    if (sets.mp4.length) return sets.mp4.slice().sort(byRes)[0];
    if (sets.hls.length) return sets.hls.slice().sort(byRes)[0];
    return null;
  }

  /**
   * @param {ParentNode} [root]
   * @returns {{ mp4: string[], hls: string[] }}
   */
  function collectPinterestVideoUrls(root = document) {
    const mp4 = new Set();
    const hls = new Set();

    if (!(root instanceof Element) && root !== document) {
      return { mp4: [], hls: [] };
    }

    const html =
      root === document
        ? document.documentElement?.outerHTML || ''
        : root.outerHTML;

    const fromHtml = collectVideoUrlsFromHtml(html);
    for (const url of fromHtml.mp4) mp4.add(url);
    for (const url of fromHtml.hls) hls.add(url);

    const scope = root instanceof Element ? root : document;
    for (const el of scope.querySelectorAll?.('video, video source') ?? []) {
      const src = el.currentSrc || el.src || el.getAttribute('src') || '';
      if (!/^https?:/i.test(src)) continue;
      if (/\.mp4(\?|$)/i.test(src)) mp4.add(src);
      else if (/\.m3u8(\?|$)/i.test(src)) hls.add(src);
    }

    return { mp4: [...mp4], hls: [...hls] };
  }

  /**
   * @param {ParentNode} [root]
   * @returns {string | null}
   */
  function pickBestPinterestVideoUrl(root = document) {
    return pickBestFromVideoSets(collectPinterestVideoUrls(root));
  }

  /**
   * @param {string | null} [pinId]
   * @returns {{ mp4: string[], hls: string[] }}
   */
  function extractVideoUrlsFromScripts(pinId = null) {
    const mp4 = new Set();
    const hls = new Set();

    for (const script of document.querySelectorAll('script')) {
      const text = script.textContent || '';
      if (!text.includes('pinimg.com')) continue;
      if (pinId && !text.includes(pinId)) continue;

      let match;
      PIN_VIDEO_MP4_RE.lastIndex = 0;
      while ((match = PIN_VIDEO_MP4_RE.exec(text))) mp4.add(match[0]);
      PIN_VIDEO_HLS_RE.lastIndex = 0;
      while ((match = PIN_VIDEO_HLS_RE.exec(text))) hls.add(match[0]);
    }

    return { mp4: [...mp4], hls: [...hls] };
  }

  /**
   * @param {Element | null | undefined} targetEl
   * @returns {HTMLVideoElement | null}
   */
  function findVideoElement(targetEl) {
    if (!(targetEl instanceof Element)) return null;
    if (targetEl instanceof HTMLVideoElement) return targetEl;
    const direct = targetEl.querySelector?.('video');
    if (direct instanceof HTMLVideoElement) return direct;
    const closest = targetEl.closest?.('video');
    if (closest instanceof HTMLVideoElement) return closest;
    const closeup = targetEl.closest?.(PIN_CLOSEUP_VIDEO_SELECTOR);
    const inCloseup = closeup?.querySelector?.('video');
    return inCloseup instanceof HTMLVideoElement ? inCloseup : null;
  }

  /**
   * @param {Element | null | undefined} targetEl
   * @returns {Element | null}
   */
  function findPinterestPinContainer(targetEl) {
    if (!(targetEl instanceof Element)) return null;
    const container = targetEl.closest?.(PIN_CONTAINER_SELECTOR);
    return container instanceof Element ? container : null;
  }

  /**
   * @param {Element | null | undefined} container
   * @returns {boolean}
   */
  function pinContainerHasVideo(container) {
    if (!(container instanceof Element)) return false;
    if (container.querySelector('video')) return true;
    const sets = collectPinterestVideoUrls(container);
    return sets.mp4.length > 0 || sets.hls.length > 0;
  }

  /**
   * @returns {boolean}
   */
  function isPinCloseupVideoPin() {
    const hero = getPinHeroRoot();
    if (hero?.querySelector('video')) return true;
    if (hero?.matches?.(PIN_VIDEO_CLOSEUP_SELECTOR)) return true;
    if (hero?.querySelector(PIN_VIDEO_CLOSEUP_SELECTOR)) return true;
    if (document.querySelector(PIN_VIDEO_CLOSEUP_SELECTOR)) return true;
    if (getOgVideoUrl()) return true;
    if (hero) {
      const sets = collectPinterestVideoUrls(hero);
      if (sets.mp4.length > 0 || sets.hls.length > 0) return true;
    }
    const pinId = getCurrentPinId();
    if (pinId) {
      const fromScripts = extractVideoUrlsFromScripts(pinId);
      if (fromScripts.mp4.length > 0 || fromScripts.hls.length > 0) return true;
      const pageHtml = document.documentElement?.outerHTML || '';
      if (pageHtml.includes(`"entityId":"${pinId}"`) && pageHtml.includes('video_list')) return true;
    }
    return false;
  }

  /**
   * @returns {boolean}
   */
  function isVideoPinPage() {
    if (!isPinCloseupPage()) return false;
    return isPinCloseupVideoPin();
  }

  /**
   * @param {{ targetEl?: Element | null, pageUrl?: string }} ctx
   * @returns {string | null}
   */
  function resolveVideoUrlForPinPage(ctx) {
    const pageUrl = ctx?.pageUrl || location.href;
    const hero = getPinHeroRoot();
    const main = document.querySelector('main');

    const roots = [hero, main].filter((r) => r instanceof Element);
    for (const root of roots) {
      const best = pickBestPinterestVideoUrl(root);
      if (best) return resolveAbsoluteUrl(best, pageUrl) || best;
    }

    const pinId = getCurrentPinId();
    const fromScripts = pickBestFromVideoSets(extractVideoUrlsFromScripts(pinId));
    if (fromScripts) return resolveAbsoluteUrl(fromScripts, pageUrl) || fromScripts;

    const ogVideo = getOgVideoUrl();
    if (ogVideo) return resolveAbsoluteUrl(ogVideo, pageUrl) || ogVideo;

    const videoEl = findVideoElement(ctx?.targetEl) || hero?.querySelector('video');
    if (videoEl instanceof HTMLVideoElement) {
      const src = videoEl.currentSrc || videoEl.src || '';
      if (/^https?:/i.test(src)) return resolveAbsoluteUrl(src, pageUrl) || src;
    }

    return null;
  }

  /**
   * @param {{ targetEl?: Element | null, pageUrl?: string, pageTitle?: string }} ctx
   * @returns {import('./types.js').SavePayload | null}
   */
  /**
   * @param {string | null} [pinId]
   * @returns {string[]}
   */
  function extractImageUrlsFromScripts(pinId = null) {
    const urls = new Set();

    for (const script of document.querySelectorAll('script')) {
      const text = script.textContent || '';
      if (!text.includes('pinimg.com')) continue;
      if (pinId && !text.includes(pinId)) continue;

      for (const match of text.matchAll(/"images_orig"\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"/g)) {
        urls.add(match[1]);
      }

      let match;
      const pinimgRe = /https?:\/\/i\.pinimg\.com\/[^"'\\s]+?\.(?:jpg|jpeg|png|webp)/gi;
      while ((match = pinimgRe.exec(text))) urls.add(match[0]);
    }

    return [...urls];
  }

  /**
   * @param {string[]} candidates
   * @returns {string | null}
   */
  function pickBestPinImageUrl(candidates) {
    if (!candidates.length) return null;

    const pinimgUrlSizeScore = (url) => {
      if (!url) return 0;
      if (url.includes('/originals/')) return 1_000_000;
      const sizeMatch = /\/(\d{2,4})x(?:(\d{2,4})\/)?/i.exec(url);
      if (!sizeMatch) return 0;
      const width = Number(sizeMatch[1]);
      const height = sizeMatch[2] ? Number(sizeMatch[2]) : width;
      return width * height;
    };

    const ranked = candidates
      .map((url) => upgradePinimgUrl(url))
      .sort((a, b) => pinimgUrlSizeScore(b) - pinimgUrlSizeScore(a));

    return ranked[0] ?? null;
  }

  function resolveImageUrlForPinPage(ctx) {
    const pageUrl = ctx.pageUrl || location.href;
    const pageTitle = ctx.pageTitle || document.title;
    const hero = getPinHeroRoot();

    const candidates = [];
    const ogImage = getMetaContent('og:image');
    if (ogImage) candidates.push(ogImage);

    const closeupImg =
      hero?.querySelector('img') ?? document.querySelector(`${PIN_IMAGE_CLOSEUP_SELECTOR} img`);
    if (closeupImg instanceof HTMLImageElement) {
      const fromEl = pickLargestImageUrlFromElement(closeupImg);
      if (fromEl) candidates.push(fromEl);
    }

    const pinId = getCurrentPinId();
    const scriptUrls = extractImageUrlsFromScripts(pinId);
    for (const url of scriptUrls) {
      candidates.push(url);
    }

    const origFromScripts = scriptUrls.find((url) => /\/originals\//i.test(url));
    if (origFromScripts) {
      const name = pinterestHandler.resolveCardName(ctx);
      return {
        url: upgradePinimgUrl(resolveAbsoluteUrl(origFromScripts, pageUrl) || origFromScripts),
        mediaKind: 'image',
        website: pageUrl,
        pageTitle,
        ...(name ? { name } : {})
      };
    }

    const url = pickBestPinImageUrl(
      candidates
        .map((c) => resolveAbsoluteUrl(c, pageUrl))
        .filter(Boolean)
    );
    if (!url) return null;

    const name = pinterestHandler.resolveCardName(ctx);
    return {
      url,
      mediaKind: 'image',
      website: pageUrl,
      pageTitle,
      ...(name ? { name } : {})
    };
  }

  /**
   * @param {{ targetEl?: Element | null }} ctx
   * @returns {boolean}
   */
  function isPinterestVideoContext(ctx) {
    if (isPinCloseupPage()) {
      return isVideoPinPage();
    }

    if (findVideoElement(ctx?.targetEl)) return true;
    const container = findPinterestPinContainer(ctx?.targetEl);
    return pinContainerHasVideo(container);
  }

  /**
   * @param {{ targetEl?: Element | null, pageUrl?: string }} ctx
   * @returns {{ url: string, mediaKind: 'video' } | null}
   */
  function resolvePinterestVideo(ctx) {
    const url = resolveVideoUrlForPinPage(ctx);
    if (!url) {
      console.warn('[ARC pinterest] видео на странице не найдено (mp4/HLS отсутствуют)');
      return null;
    }

    console.info('[ARC pinterest] видео найдено:', url);
    return { url, mediaKind: 'video' };
  }

  /**
   * Элемент для позиции hover-кнопки — видимая рамка медиа, не сырой <video>.
   * @param {Element | null | undefined} target
   * @param {HTMLVideoElement | null} [video]
   * @returns {Element | null}
   */
  function pinterestHoverAnchor(target, video = null) {
    const fromTarget = target?.closest?.(HERO_CLOSEUP_SELECTORS.join(', '));
    if (fromTarget instanceof Element) return fromTarget;

    const hero = getPinHeroRoot();
    if (hero) return hero;

    const fromVideo =
      video?.closest?.(PIN_VIDEO_CLOSEUP_SELECTOR) ??
      video?.closest?.(PIN_IMAGE_CLOSEUP_SELECTOR);
    if (fromVideo instanceof Element) return fromVideo;

    const container = findPinterestPinContainer(target);
    return container instanceof Element ? container : video;
  }

  /**
   * @param {Element | null} target
   * @returns {{ el: Element, url: string } | null}
   */
  function findVideoTarget(target) {
    if (isPinCloseupPage()) {
      const hero = getPinHeroRoot();
      const video = findVideoElement(target) || hero?.querySelector('video');
      const hasVideoPin =
        isVideoPinPage() || video instanceof HTMLVideoElement || !!getOgVideoUrl();

      if (!hasVideoPin) return null;

      const anchor = pinterestHoverAnchor(target, video instanceof HTMLVideoElement ? video : null);
      if (!(anchor instanceof Element)) return null;

      const url = resolveVideoUrlForPinPage({ pageUrl: location.href, targetEl: hero }) || location.href;
      return { el: anchor, url };
    }

    const video = findVideoElement(target);
    if (video) {
      const scope =
        video.closest(PIN_VIDEO_CLOSEUP_SELECTOR) ??
        video.closest(PIN_IMAGE_CLOSEUP_SELECTOR) ??
        findPinterestPinContainer(target);
      const url = pickBestPinterestVideoUrl(scope instanceof Element ? scope : video);
      if (url) {
        const anchor = pinterestHoverAnchor(target, video);
        if (anchor instanceof Element) {
          return { el: anchor, url };
        }
      }
    }

    const container = findPinterestPinContainer(target);
    if (container && pinContainerHasVideo(container)) {
      const url = pickBestPinterestVideoUrl(container);
      if (url) {
        return { el: container, url };
      }
    }

    return null;
  }

  /**
   * @returns {import('./types.js').SavePayload | null}
   */
  function resolvePinPageMedia() {
    const pageUrl = location.href;
    const pageTitle = document.title;
    const hero = getPinHeroRoot();
    const ctx = {
      targetEl: hero ?? document.body,
      rawUrl: pageUrl,
      pageUrl,
      pageTitle
    };

    if (isVideoPinPage()) {
      const video = resolvePinterestVideo(ctx);
      if (video) {
        const name = pinterestHandler.resolveCardName(ctx);
        return {
          url: video.url,
          mediaKind: 'video',
          website: pageUrl,
          pageTitle,
          ...(name ? { name } : {})
        };
      }
      return null;
    }

    return resolveImageUrlForPinPage(ctx);
  }

  /**
   * Ожидание готовности closeup (SPA / фоновая вкладка).
   * @param {number} [maxMs]
   * @returns {Promise<import('./types.js').SavePayload | null>}
   */
  async function waitForPinPageMedia(maxMs = 18000) {
    const deadline = Date.now() + maxMs;
    let last = null;

    while (Date.now() < deadline) {
      last = resolvePinPageMedia();
      if (last?.url) return last;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return last;
  }

  /** @type {import('./types.js').SiteHandler} */
  const pinterestHandler = {
    id: 'pinterest',

    findVideoTarget,

    resolveImageUrl(ctx) {
      const { rawUrl, targetEl, pageUrl } = ctx;

      if (isPinterestVideoContext(ctx)) {
        const video = resolvePinterestVideo(ctx);
        if (video) return video;
        if (isVideoPinPage()) return null;
      }

      if (isPinCloseupPage()) {
        const imagePayload = resolveImageUrlForPinPage({
          targetEl,
          pageUrl,
          pageTitle: document.title
        });
        if (imagePayload) return imagePayload;
      }

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

      if (rawUrl && !/\/pin\/\d+/i.test(rawUrl)) {
        candidates.push(rawUrl);
      }

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

  /**
   * @param {Element | null | undefined} targetEl
   * @returns {string | null}
   */
  function findPinWebsiteFromTarget(targetEl) {
    if (!(targetEl instanceof Element)) return null;

    const anchor = targetEl.closest('a[href*="/pin/"]');
    if (anchor instanceof HTMLAnchorElement) {
      const match = /\/pin\/(\d+)/.exec(anchor.pathname);
      if (match) return anchor.href.split('?')[0];
    }

    const container = findPinterestPinContainer(targetEl);
    const inContainer = container?.querySelector?.('a[href*="/pin/"]');
    if (inContainer instanceof HTMLAnchorElement) {
      const match = /\/pin\/(\d+)/.exec(inContainer.pathname);
      if (match) return inContainer.href.split('?')[0];
    }

    return null;
  }

  Object.assign(NS, {
    upgradePinimgUrl,
    pinterestHandler,
    resolvePinPageMedia,
    waitForPinPageMedia,
    pickBestPinterestVideoUrl,
    findPinWebsiteFromTarget
  });
})();
