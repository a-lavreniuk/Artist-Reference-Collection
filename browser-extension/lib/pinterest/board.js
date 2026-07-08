(() => {
  const NS = (window.__ARC__ = window.__ARC__ || {});
  const {
    cleanPageTitle,
    getMetaContent,
    pickLargestImageUrlFromElement,
    resolveAbsoluteUrl,
    upgradePinimgUrl
  } = NS;

  const BOARD_PATH_BLOCKLIST = new Set([
    'pin',
    'search',
    'ideas',
    'today',
    'settings',
    'about',
    'business',
    'login',
    'signup',
    'password',
    'edit',
    'shopping',
    'videos',
    'topics'
  ]);

  /**
   * @param {string} url
   * @returns {boolean}
   */
  function isPinterestBoardUrl(url) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      if (!host.endsWith('pinterest.com') && host !== 'pinterest.ru') return false;

      const segments = decodeURIComponent(parsed.pathname)
        .split('/')
        .filter(Boolean);
      if (segments.length < 2) return false;

      const head = segments[0].toLowerCase();
      if (head === 'pin' || head === 'pins') return false;
      if (BOARD_PATH_BLOCKLIST.has(head)) return false;
      if (head.startsWith('_')) return false;
      if (segments.some((segment) => segment.toLowerCase() === 'pin')) return false;

      return true;
    } catch {
      return false;
    }
  }

  /**
   * @param {string} [pageUrl]
   * @returns {{ boardName: string, boardUrl: string }}
   */
  function getPinterestBoardMeta(pageUrl = location.href) {
    const parsed = new URL(pageUrl);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const slug = decodeURIComponent(segments[1] ?? '').replace(/-/g, ' ');

    const h1 = document.querySelector('h1')?.textContent?.trim();
    const ogTitle = getMetaContent('og:title');
    const raw = h1 || ogTitle || slug || document.title;

    const boardName =
      cleanPageTitle(raw, [
        /\s*[-|–—]\s*Pinterest\s*$/i,
        /\s*\|\s*Pinterest\s*$/i,
        /\s+on Pinterest\s*$/i,
        /\s*·\s*Pinterest\s*$/i
      ]) ?? slug ?? 'Pinterest board';

    return { boardName, boardUrl: pageUrl };
  }

  /**
   * Adds every currently-rendered pin into `pins`. Pinterest virtualizes the
   * board (off-screen pins leave the DOM), so this runs on each scroll pass and
   * accumulates rather than reading the DOM once at the end.
   *
   * @param {Map<string, { url: string, website: string, name?: string }>} pins
   * @param {string} boardUrl
   */
  function extractPinsInto(pins, boardUrl) {
    for (const anchor of document.querySelectorAll('a[href*="/pin/"]')) {
      if (!(anchor instanceof HTMLAnchorElement)) continue;

      const pinMatch = /\/pin\/(\d+)/.exec(anchor.pathname);
      if (!pinMatch) continue;

      const pinId = pinMatch[1];
      if (pins.has(pinId)) continue;

      const container =
        anchor.closest('[data-test-id="pin"], [data-test-id="pinWrapper"], [data-test-id="deep-dive-pin"]') ??
        anchor.parentElement ??
        anchor;

      let imageUrl = null;

      if (container instanceof Element) {
        const img = container.querySelector('img');
        if (img instanceof HTMLImageElement) {
          imageUrl = pickLargestImageUrlFromElement(img) || img.currentSrc || img.src;
        }

        const dataPinMedia =
          container.getAttribute('data-pin-media') ??
          anchor.getAttribute('data-pin-media') ??
          container.querySelector('[data-pin-media]')?.getAttribute('data-pin-media');
        if (dataPinMedia) {
          imageUrl = dataPinMedia;
        }
      }

      const absolute = resolveAbsoluteUrl(imageUrl ?? '', boardUrl);
      if (!absolute || !absolute.includes('pinimg.com')) continue;

      const pinWebsite = resolveAbsoluteUrl(anchor.href, boardUrl);
      if (!pinWebsite) continue;

      const alt = container instanceof Element ? container.querySelector('img')?.getAttribute('alt') : null;

      const upgraded = upgradePinimgUrl(absolute);

      pins.set(pinId, {
        url: upgraded,
        // Board thumbnails are always .jpg; the /originals/ upgrade can 404 when
        // the real original is png/webp/gif. Keep the rendered URL as fallback.
        ...(upgraded !== absolute ? { fallbackUrl: absolute } : {}),
        website: pinWebsite.split('?')[0],
        ...(alt?.trim() ? { name: alt.trim() } : {})
      });
    }
  }

  /**
   * @returns {Promise<{ boardName: string, boardUrl: string, pins: Array<{ url: string, website: string, name?: string }> }>}
   */
  async function collectPinterestBoardPins() {
    const meta = getPinterestBoardMeta();
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    /** @type {Map<string, { url: string, website: string, name?: string }>} */
    const pins = new Map();

    window.scrollTo(0, 0);
    await delay(400);
    extractPinsInto(pins, meta.boardUrl);

    let stablePasses = 0;
    let lastSize = pins.size;

    for (let pass = 0; pass < 60 && stablePasses < 4; pass += 1) {
      const beforeY = window.scrollY;
      window.scrollBy(0, Math.round(window.innerHeight * 0.85));
      await delay(600);
      extractPinsInto(pins, meta.boardUrl);

      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      const didNotMove = window.scrollY === beforeY;

      if (pins.size !== lastSize) {
        stablePasses = 0;
        lastSize = pins.size;
      } else if (atBottom || didNotMove) {
        stablePasses += 1;
      }
    }

    window.scrollTo(0, 0);
    return { ...meta, pins: [...pins.values()] };
  }

  Object.assign(NS, {
    isPinterestBoardUrl,
    getPinterestBoardMeta,
    collectPinterestBoardPins
  });
})();
