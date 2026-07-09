/**
 * @param {string} url
 * @returns {number}
 */
export function instagramImageScore(url) {
  if (!url) return 0;
  if (/\/s1080x1080\//i.test(url)) return 1_166_400;
  const dim = /[=/](\d{3,4})x(\d{3,4})/i.exec(url);
  if (dim) return Number(dim[1]) * Number(dim[2]);
  const width = /[=/](\d{3,4})(?:[/?&]|$)/i.exec(url);
  if (width) return Number(width[1]) ** 2;
  return url.length;
}

/**
 * Stable key for deduplicating the same Instagram media at different resolutions.
 * @param {string} url
 * @returns {string}
 */
export function getInstagramMediaKey(url) {
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
export function dedupeInstagramImageUrls(urls) {
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
