(() => {
  const NS = (window.__ARC__ = window.__ARC__ || {});
  const {
    cleanPageTitle,
    getMetaContent,
    resolveAbsoluteUrl
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
   * @param {Map<string, { website: string, name?: string }>} pins
   * @param {string} pinId
   * @param {string} website
   * @param {string} [name]
   */
  function addBoardPin(pins, pinId, website, name) {
    if (!pinId || pins.has(pinId)) return;
    pins.set(pinId, {
      website,
      ...(name?.trim() ? { name: name.trim() } : {})
    });
  }

  /**
   * @param {Map<string, { website: string, name?: string }>} pins
   * @param {string} boardUrl
   */
  function extractPinsInto(pins, boardUrl) {
    const scope =
      document.querySelector('[data-test-id="board-feed"]') ??
      document.querySelector('main') ??
      document;

    for (const tile of scope.querySelectorAll(
      '[data-test-id="pin"], [data-test-id="pinWrapper"], [data-test-id="deep-dive-pin"]'
    )) {
      const anchor = tile.querySelector('a[href*="/pin/"]');
      if (!(anchor instanceof HTMLAnchorElement)) continue;

      const pinMatch = /\/pin\/(\d+)/.exec(anchor.pathname);
      if (!pinMatch) continue;

      const pinWebsite = resolveAbsoluteUrl(anchor.href, boardUrl);
      if (!pinWebsite) continue;

      const alt = tile.querySelector('img')?.getAttribute('alt');
      addBoardPin(pins, pinMatch[1], pinWebsite.split('?')[0], alt ?? undefined);
    }

    for (const anchor of scope.querySelectorAll('a[href*="/pin/"]')) {
      if (!(anchor instanceof HTMLAnchorElement)) continue;

      const pinMatch = /\/pin\/(\d+)/.exec(anchor.pathname);
      if (!pinMatch) continue;

      const pinWebsite = resolveAbsoluteUrl(anchor.href, boardUrl);
      if (!pinWebsite) continue;

      const container =
        anchor.closest('[data-test-id="pin"], [data-test-id="pinWrapper"], [data-test-id="deep-dive-pin"]') ??
        anchor.parentElement;
      const alt =
        container instanceof Element ? container.querySelector('img')?.getAttribute('alt') : null;

      addBoardPin(pins, pinMatch[1], pinWebsite.split('?')[0], alt ?? undefined);
    }
  }

  /**
   * @returns {Promise<{ boardName: string, boardUrl: string, pins: Array<{ website: string, name?: string }> }>}
   */
  async function collectPinterestBoardPins() {
    const meta = getPinterestBoardMeta();
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    /** @type {Map<string, { website: string, name?: string }>} */
    const pins = new Map();

    window.scrollTo(0, 0);
    await delay(600);
    extractPinsInto(pins, meta.boardUrl);

    let stablePasses = 0;
    let lastSize = pins.size;

    for (let pass = 0; pass < 80 && stablePasses < 6; pass += 1) {
      const beforeY = window.scrollY;
      window.scrollBy(0, Math.round(window.innerHeight * 0.9));
      await delay(700);
      extractPinsInto(pins, meta.boardUrl);

      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8;
      const didNotMove = window.scrollY === beforeY;

      if (pins.size !== lastSize) {
        stablePasses = 0;
        lastSize = pins.size;
      } else if (atBottom || didNotMove) {
        stablePasses += 1;
      }
    }

    window.scrollTo(0, 0);
    console.info(`[ARC board] extracted ${pins.size} pin URLs from board DOM`);
    return { ...meta, pins: [...pins.values()] };
  }

  Object.assign(NS, {
    isPinterestBoardUrl,
    getPinterestBoardMeta,
    collectPinterestBoardPins
  });
})();
