(() => {
  const NS = (window.__ARC__ = window.__ARC__ || {});
  const {
    cleanPageTitle,
    getMetaContent,
    resolveAbsoluteUrl
  } = NS;

  const ARTWORK_PATH_RE = /\/artwork\/([A-Za-z0-9_-]+)/i;
  const PROJECT_PATH_RE = /\/projects?\/([A-Za-z0-9_-]+)/i;

  /**
   * @param {string} url
   * @returns {boolean}
   */
  function isArtstationArtworkUrl(url) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (!host.includes('artstation.com')) return false;
      return ARTWORK_PATH_RE.test(new URL(url).pathname);
    } catch {
      return false;
    }
  }

  /**
   * Album pages: single artwork with gallery or multi-artwork project page.
   * @param {string} url
   * @returns {boolean}
   */
  function isArtstationAlbumUrl(url) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      if (!host.includes('artstation.com')) return false;

      if (PROJECT_PATH_RE.test(parsed.pathname)) return true;
      if (ARTWORK_PATH_RE.test(parsed.pathname)) return true;

      return false;
    } catch {
      return false;
    }
  }

  /**
   * @param {string} [pageUrl]
   * @returns {{ albumName: string, artistName: string | null, albumUrl: string }}
   */
  function getArtstationAlbumMeta(pageUrl = location.href) {
    const titleEl = document.querySelector(
      'h1.project-title, h1.artwork-title, .project-title, h1'
    );
    const title = titleEl?.textContent?.trim();
    const author =
      document.querySelector('.author-name, .artist-name, a.user-name, .user-name')?.textContent?.trim() ??
      getMetaContent('author');

    const ogTitle = getMetaContent('og:title');
    const raw = title || ogTitle || document.title;

    const albumName =
      cleanPageTitle(raw, [
        /\s*[-|–—]\s*ArtStation\s*$/i,
        /\s*\|\s*ArtStation\s*$/i,
        /\s+by\s+.+$/i
      ]) ?? 'Album';

    return {
      albumName,
      artistName: author ?? null,
      albumUrl: pageUrl
    };
  }

  /**
   * @param {string} artistName
   * @param {string} albumName
   * @returns {string}
   */
  function buildAlbumCollectionName(artistName, albumName) {
    if (artistName && albumName && !albumName.includes(artistName)) {
      return `${artistName} — ${albumName}`;
    }
    return artistName ? `${artistName} — ${albumName}` : albumName;
  }

  /**
   * @param {Map<string, { website: string, artworkId?: string, imageUrl?: string }>} items
   * @param {string} key
   * @param {{ website: string, artworkId?: string, imageUrl?: string }} item
   */
  function addAlbumItem(items, key, item) {
    if (!key || items.has(key)) return;
    items.set(key, item);
  }

  /**
   * @param {Map<string, { website: string, artworkId?: string, imageUrl?: string }>} items
   * @param {string} pageUrl
   */
  function extractAlbumItemsInto(items, pageUrl) {
    const parsed = new URL(pageUrl);

    if (PROJECT_PATH_RE.test(parsed.pathname)) {
      for (const anchor of document.querySelectorAll('a[href*="/artwork/"]')) {
        if (!(anchor instanceof HTMLAnchorElement)) continue;
        const match = /\/artwork\/([A-Za-z0-9_-]+)/.exec(anchor.pathname);
        if (!match) continue;
        const website = resolveAbsoluteUrl(anchor.href, pageUrl);
        if (!website) continue;
        addAlbumItem(items, match[1], { website: website.split('?')[0], artworkId: match[1] });
      }
      return;
    }

    const artworkMatch = ARTWORK_PATH_RE.exec(parsed.pathname);
    if (!artworkMatch) return;

    addAlbumItem(items, artworkMatch[1], {
      website: pageUrl.split('?')[0],
      artworkId: artworkMatch[1]
    });
  }

  /**
   * @returns {Promise<{ albumName: string, artistName: string | null, collectionName: string, albumUrl: string, items: Array<{ website: string, artworkId?: string, imageUrl?: string }> }>}
   */
  async function collectArtstationAlbumItems() {
    const meta = getArtstationAlbumMeta();
    const collectionName = buildAlbumCollectionName(meta.artistName ?? '', meta.albumName);

    /** @type {Map<string, { website: string, artworkId?: string, imageUrl?: string }>} */
    const items = new Map();
    extractAlbumItemsInto(items, meta.albumUrl);

    return {
      ...meta,
      collectionName,
      items: [...items.values()]
    };
  }

  Object.assign(NS, {
    isArtstationArtworkUrl,
    isArtstationAlbumUrl,
    getArtstationAlbumMeta,
    buildAlbumCollectionName,
    collectArtstationAlbumItems
  });
})();
