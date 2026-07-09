(() => {
  const NS = (window.__ARC__ = window.__ARC__ || {});

  const SMALL_SIZE_RE = /\/s(\d+)x(\d+)\//i;
  const PROFILE_PIC_RE = /\/s(?:64|150|320)x(?:64|150|320)\//i;

  /**
   * @param {string} url
   * @returns {boolean}
   */
  function isInstagramPostMediaUrl(url) {
    if (!url?.trim()) return false;

    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();

      if (host.startsWith('static.')) return false;
      if (!host.includes('cdninstagram.com') && !host.includes('fbcdn.net')) return false;
      if (PROFILE_PIC_RE.test(url)) return false;
      if (/\/profile_pic\//i.test(parsed.pathname)) return false;
      if (/glyph|sprite|favicon|emoji|logo/i.test(`${parsed.pathname}${url}`)) return false;

      const size = SMALL_SIZE_RE.exec(parsed.pathname);
      if (size) {
        const width = Number(size[1]);
        const height = Number(size[2]);
        if (width < 400 || height < 400) return false;
      }

      if (host.includes('cdninstagram.com')) {
        return /\/v\//i.test(parsed.pathname);
      }

      if (host.includes('fbcdn.net')) {
        return /\/v\//i.test(parsed.pathname) || /\.(?:jpg|jpeg|png|webp)(\?|$)/i.test(parsed.pathname);
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * @param {string} url
   * @returns {number}
   */
  function instagramImageScore(url) {
    if (!url) return 0;
    if (/\/s1080x1080\//i.test(url)) return 1_166_400;
    const dim = /[=/](\d{3,4})x(\d{3,4})/i.exec(url);
    if (dim) return Number(dim[1]) * Number(dim[2]);
    const width = /[=/](\d{3,4})(?:[/?&]|$)/i.exec(url);
    if (width) return Number(width[1]) ** 2;
    return url.length;
  }

  /**
   * @param {string} url
   * @returns {string}
   */
  function getInstagramMediaKey(url) {
    if (!url) return '';

    const idMatch = /\/(\d{8,}_\d{8,})/.exec(url);
    if (idMatch?.[1]) return idMatch[1];

    try {
      const parsed = new URL(url);
      return parsed.pathname
        .replace(/\/s\d+x\d+\//i, '/')
        .replace(/\/(?:small|medium|large)\//i, '/')
        .replace(/\/v\/t[^/]+\//i, '/v/');
    } catch {
      return url.split('?')[0];
    }
  }

  /**
   * @param {string[]} urls
   * @returns {string[]}
   */
  function dedupeInstagramImageUrls(urls) {
    /** @type {Map<string, string>} */
    const byKey = new Map();

    for (const url of urls) {
      if (!url) continue;
      const key = getInstagramMediaKey(url);
      const existing = byKey.get(key);
      if (!existing || instagramImageScore(url) > instagramImageScore(existing)) {
        byKey.set(key, url);
      }
    }

    return [...byKey.values()].sort((a, b) => instagramImageScore(b) - instagramImageScore(a));
  }

  Object.assign(NS, {
    isInstagramPostMediaUrl,
    instagramImageScore,
    getInstagramMediaKey,
    dedupeInstagramImageUrls
  });
})();
