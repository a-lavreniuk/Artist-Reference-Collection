(() => {
  const NS = (window.__ARC__ = window.__ARC__ || {});
  const {
    cleanPageTitle,
    getMetaContent,
    pickLargestImageUrlFromElement,
    resolveAbsoluteUrl
  } = NS;

  const PINIMG_SIZE_SEGMENT = /^\/(\d+x|\d+x\d+)\//;

  const PIN_VIDEO_MP4_RE = /https?:\/\/v\.pinimg\.com\/videos\/[^\s"'\\)]+?\.mp4/gi;
  const PIN_VIDEO_HLS_RE = /https?:\/\/v\.pinimg\.com\/videos\/[^\s"'\\)]+?\.m3u8/gi;
  const PIN_CLOSEUP_VIDEO_SELECTOR =
    '[data-test-id="pin-closeup-video"], [data-test-id="closeup-video"], [data-test-id="pin-closeup-image"]';

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
   * Приоритет разрешения по адресу mp4/HLS Pinterest (например `.../720p/...`).
   * @param {string} url
   * @returns {number}
   */
  function pinVideoResolutionScore(url) {
    const byLabel = /\/(\d{3,4})p(?:\/|_|\.)/i.exec(url);
    if (byLabel) return Number(byLabel[1]);
    const byDim = /_(\d{3,4})x(\d{3,4})/i.exec(url);
    if (byDim) return Number(byDim[2]);
    return 0;
  }

  /**
   * Собирает адреса видео Pinterest со страницы: из встроенных данных (regex по HTML)
   * и из элементов `<video>` / `<source>`.
   * @returns {{ mp4: string[], hls: string[] }}
   */
  function collectPinterestVideoUrls() {
    const mp4 = new Set();
    const hls = new Set();

    const html = document.documentElement?.outerHTML || '';
    let match;
    PIN_VIDEO_MP4_RE.lastIndex = 0;
    while ((match = PIN_VIDEO_MP4_RE.exec(html))) mp4.add(match[0]);
    PIN_VIDEO_HLS_RE.lastIndex = 0;
    while ((match = PIN_VIDEO_HLS_RE.exec(html))) hls.add(match[0]);

    for (const el of document.querySelectorAll('video, video source')) {
      const src = el.currentSrc || el.src || el.getAttribute('src') || '';
      if (!/^https?:/i.test(src)) continue;
      if (/\.mp4(\?|$)/i.test(src)) mp4.add(src);
      else if (/\.m3u8(\?|$)/i.test(src)) hls.add(src);
    }

    return { mp4: [...mp4], hls: [...hls] };
  }

  /**
   * Выбирает лучший скачиваемый адрес: приоритет прямому mp4, затем HLS.
   * @returns {string | null}
   */
  function pickBestPinterestVideoUrl() {
    const { mp4, hls } = collectPinterestVideoUrls();
    const byRes = (a, b) => pinVideoResolutionScore(b) - pinVideoResolutionScore(a);
    if (mp4.length) return mp4.slice().sort(byRes)[0];
    if (hls.length) return hls.slice().sort(byRes)[0];
    return null;
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
   * @param {{ targetEl?: Element | null }} ctx
   * @returns {boolean}
   */
  function isPinterestVideoContext(ctx) {
    return findVideoElement(ctx?.targetEl) != null;
  }

  /**
   * Адрес постера (превью) видео для использования как fallback.
   * @param {{ targetEl?: Element | null }} ctx
   * @returns {string | null}
   */
  function pinterestVideoPoster(ctx) {
    const video = findVideoElement(ctx?.targetEl);
    if (video?.poster) return video.poster;
    return getMetaContent('og:image');
  }

  /**
   * @param {{ targetEl?: Element | null, pageUrl?: string }} ctx
   * @returns {{ url: string, fallbackUrl?: string } | null}
   */
  function resolvePinterestVideo(ctx) {
    const best = pickBestPinterestVideoUrl();
    if (!best) {
      console.warn('[ARC pinterest] видео на странице не найдено (mp4/HLS отсутствуют)');
      return null;
    }
    const url = resolveAbsoluteUrl(best, ctx?.pageUrl) || best;
    const result = { url };

    const posterRaw = pinterestVideoPoster(ctx);
    if (posterRaw) {
      const poster = resolveAbsoluteUrl(upgradePinimgUrl(posterRaw), ctx?.pageUrl) || posterRaw;
      if (poster && poster !== url) result.fallbackUrl = poster;
    }

    console.info('[ARC pinterest] видео найдено:', result);
    return result;
  }

  /**
   * Наведение/сохранение поверх видео-пина.
   * @param {Element | null} target
   * @returns {{ el: Element, url: string } | null}
   */
  function findVideoTarget(target) {
    const video = findVideoElement(target);
    if (!video) return null;
    const url = video.poster || getMetaContent('og:image') || location.href;
    return { el: video, url };
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

  Object.assign(NS, { upgradePinimgUrl, pinterestHandler });
})();
