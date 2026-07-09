(() => {
  const NS = (window.__ARC__ = window.__ARC__ || {});
  const { cleanPageTitle, getMetaContent, resolveAbsoluteUrl } = NS;

  const SAVED_PATH_RE = /^\/[^/]+\/saved\/[^/]+\/?$/i;

  /**
   * @param {string} url
   * @returns {boolean}
   */
  function isInstagramSavedCollectionUrl(url) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      if (host !== 'instagram.com' && !host.endsWith('.instagram.com')) return false;
      return SAVED_PATH_RE.test(parsed.pathname);
    } catch {
      return false;
    }
  }

  /**
   * @param {string} [pageUrl]
   * @returns {{ collectionName: string, collectionUrl: string }}
   */
  function getInstagramSavedMeta(pageUrl = location.href) {
    const parsed = new URL(pageUrl);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const slug = decodeURIComponent(segments[2] ?? '').replace(/-/g, ' ');

    const h1 = document.querySelector('h1')?.textContent?.trim();
    const ogTitle = getMetaContent('og:title');
    const raw = h1 || ogTitle || slug || document.title;

    const collectionName =
      cleanPageTitle(raw, [
        /\s*[-|–—]\s*Instagram\s*$/i,
        /\s*\|\s*Instagram\s*$/i,
        /\s+on Instagram\s*$/i
      ]) ?? slug ?? 'Instagram saved';

    return { collectionName, collectionUrl: pageUrl };
  }

  /**
   * @param {Map<string, { website: string, shortcode: string }>} posts
   * @param {string} shortcode
   * @param {string} website
   */
  function addSavedPost(posts, shortcode, website) {
    if (!shortcode || posts.has(shortcode)) return;
    posts.set(shortcode, { shortcode, website: website.split('?')[0] });
  }

  /**
   * @param {Map<string, { website: string, shortcode: string }>} posts
   * @param {string} pageUrl
   */
  function extractPostsInto(posts, pageUrl) {
    const scope = document.querySelector('main') ?? document.body;

    for (const anchor of scope.querySelectorAll('a[href*="/p/"]')) {
      if (!(anchor instanceof HTMLAnchorElement)) continue;
      const match = /\/p\/([A-Za-z0-9_-]+)/.exec(anchor.pathname);
      if (!match) continue;
      const website = resolveAbsoluteUrl(anchor.href, pageUrl);
      if (!website) continue;
      addSavedPost(posts, match[1], website);
    }
  }

  /**
   * @returns {Promise<{ collectionName: string, collectionUrl: string, posts: Array<{ website: string, shortcode: string }> }>}
   */
  async function collectInstagramSavedPosts() {
    const meta = getInstagramSavedMeta();
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    /** @type {Map<string, { website: string, shortcode: string }>} */
    const posts = new Map();

    window.scrollTo(0, 0);
    await delay(600);
    extractPostsInto(posts, meta.collectionUrl);

    let stablePasses = 0;
    let lastSize = posts.size;

    for (let pass = 0; pass < 80 && stablePasses < 6; pass += 1) {
      const beforeY = window.scrollY;
      window.scrollBy(0, Math.round(window.innerHeight * 0.9));
      await delay(700);
      extractPostsInto(posts, meta.collectionUrl);

      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8;
      const didNotMove = window.scrollY === beforeY;

      if (posts.size !== lastSize) {
        stablePasses = 0;
        lastSize = posts.size;
      } else if (atBottom || didNotMove) {
        stablePasses += 1;
      }
    }

    window.scrollTo(0, 0);
    console.info(`[ARC instagram] extracted ${posts.size} post URLs from saved collection`);
    return { ...meta, posts: [...posts.values()] };
  }

  Object.assign(NS, {
    isInstagramSavedCollectionUrl,
    getInstagramSavedMeta,
    collectInstagramSavedPosts
  });
})();
