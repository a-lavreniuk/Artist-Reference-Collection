const ARTSTATION_RESIZE_RE = /\/(?:small|medium|large|4k|sm|md|lg)_square\//i;
const ARTSTATION_ARTWORK_RE = /\/artwork\/([A-Za-z0-9_-]+)/i;
const ARTSTATION_CDN_RE = /https?:\/\/[^"'\\\s)]+artstation[^"'\\\s)]*\.(?:jpg|jpeg|png|webp)(\?[^"'\\\s)]*)?/gi;
const ARTSTATION_VIDEO_RE = /https?:\/\/[^"'\\\s)]+artstation[^"'\\\s)]*\.(?:mp4|webm|m3u8)(\?[^"'\\\s)]*)?/gi;

/**
 * @param {string} url
 * @returns {string}
 */
export function stripArtstationResizeSegment(url) {
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
 * @param {string} html
 * @param {string} property
 * @returns {string | null}
 */
function extractMetaContent(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["']`, 'i')
  ];
  for (const re of patterns) {
    const match = re.exec(html);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

/**
 * @param {string} url
 * @returns {number}
 */
function artstationImageScore(url) {
  if (!url) return 0;
  if (!ARTSTATION_RESIZE_RE.test(url)) return 1_000_000;
  const dim = /(\d{3,4})x(\d{3,4})/i.exec(url);
  if (dim) return Number(dim[1]) * Number(dim[2]);
  return url.length;
}

/**
 * @param {string} html
 * @param {string | null} [artworkId]
 * @returns {string[]}
 */
function collectArtstationImageUrls(html, artworkId = null) {
  const urls = new Set();
  const slice = artworkId && html.includes(artworkId) ? getArtworkHtmlSlice(html, artworkId) : html;

  const ogImage = extractMetaContent(html, 'og:image');
  if (ogImage) urls.add(stripArtstationResizeSegment(ogImage));

  for (const match of slice.matchAll(/data-image=["']([^"']+)["']/gi)) {
    urls.add(stripArtstationResizeSegment(match[1]));
  }

  for (const match of slice.matchAll(/"image_url"\s*:\s*"([^"]+)"/g)) {
    urls.add(stripArtstationResizeSegment(match[1].replace(/\\\//g, '/')));
  }

  for (const match of slice.matchAll(/"original_image_url"\s*:\s*"([^"]+)"/g)) {
    urls.add(stripArtstationResizeSegment(match[1].replace(/\\\//g, '/')));
  }

  ARTSTATION_CDN_RE.lastIndex = 0;
  let cdnMatch;
  while ((cdnMatch = ARTSTATION_CDN_RE.exec(slice))) {
    urls.add(stripArtstationResizeSegment(cdnMatch[0]));
  }

  return [...urls]
    .filter((url) => /artstation/i.test(url))
    .sort((a, b) => artstationImageScore(b) - artstationImageScore(a));
}

/**
 * @param {string} html
 * @param {string} artworkId
 * @returns {string}
 */
function getArtworkHtmlSlice(html, artworkId) {
  const idx = html.indexOf(artworkId);
  if (idx === -1) return html;
  return html.slice(Math.max(0, idx - 80_000), Math.min(html.length, idx + 80_000));
}

/**
 * @param {string} html
 * @returns {string | null}
 */
function extractArtstationVideoUrl(html) {
  const ogVideo =
    extractMetaContent(html, 'og:video:url') ||
    extractMetaContent(html, 'og:video:secure_url') ||
    extractMetaContent(html, 'og:video');
  if (ogVideo) return ogVideo;

  ARTSTATION_VIDEO_RE.lastIndex = 0;
  const match = ARTSTATION_VIDEO_RE.exec(html);
  return match?.[0] ?? null;
}

/**
 * @param {string} html
 * @returns {{ title: string | null, author: string | null }}
 */
function extractArtstationMeta(html) {
  const ogTitle = extractMetaContent(html, 'og:title');
  const title = ogTitle
    ?.replace(/\s*[-|–—]\s*ArtStation\s*$/i, '')
    .replace(/\s+by\s+.+$/i, '')
    .trim() ?? null;

  let author = null;
  const byMatch = /\s+by\s+(.+?)(?:\s*[-|–—]|$)/i.exec(ogTitle ?? '');
  if (byMatch?.[1]) author = byMatch[1].trim();

  if (!author) {
    for (const match of html.matchAll(/"full_name"\s*:\s*"([^"]+)"/g)) {
      if (match[1]) {
        author = match[1];
        break;
      }
    }
  }

  if (!author) {
    for (const match of html.matchAll(/"username"\s*:\s*"([A-Za-z0-9._-]+)"/g)) {
      if (match[1] && match[1] !== 'artstation') {
        author = match[1];
        break;
      }
    }
  }

  return { title, author };
}

/**
 * @param {string | null} title
 * @param {string | null} author
 * @param {number} index
 * @param {number} total
 * @returns {string | undefined}
 */
export function buildArtstationCardName(title, author, index = 0, total = 1) {
  const base =
    title && author && !title.includes(author)
      ? `${title} — ${author}`
      : title || author || undefined;
  if (!base) return undefined;
  if (total > 1) return `${base} — ${index + 1}/${total}`;
  return base;
}

/**
 * @param {string} html
 * @param {string} artworkUrl
 * @returns {{ artworkId: string, title: string | null, author: string | null, images: Array<{ url: string, name?: string }>, videoUrl: string | null, website: string, mediaKind: 'image' | 'video' } | null}
 */
export function parseArtstationArtworkFromHtml(html, artworkUrl) {
  if (!html?.trim() || !artworkUrl?.trim()) return null;

  const artworkId = ARTSTATION_ARTWORK_RE.exec(artworkUrl)?.[1];
  if (!artworkId) return null;

  const website = artworkUrl.split('?')[0];
  const { title, author } = extractArtstationMeta(html);
  const videoUrl = extractArtstationVideoUrl(html);

  if (videoUrl && !collectArtstationImageUrls(html, artworkId).length) {
    return {
      artworkId,
      title,
      author,
      images: [],
      videoUrl,
      website,
      mediaKind: 'video'
    };
  }

  const ranked = collectArtstationImageUrls(html, artworkId);
  if (!ranked.length && videoUrl) {
    return {
      artworkId,
      title,
      author,
      images: [],
      videoUrl,
      website,
      mediaKind: 'video'
    };
  }

  if (!ranked.length) return null;

  const images = ranked.map((url, index) => ({
    url,
    name: buildArtstationCardName(title, author, index, ranked.length)
  }));

  return {
    artworkId,
    title,
    author,
    images,
    videoUrl,
    website,
    mediaKind: 'image'
  };
}

/**
 * @param {string} html
 * @param {string} pageUrl
 * @returns {Array<{ website: string, artworkId: string }>}
 */
export function extractArtworkUrlsFromPortfolioHtml(html, pageUrl) {
  if (!html?.trim() || !pageUrl?.trim()) return [];

  let origin;
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    return [];
  }

  /** @type {Map<string, { website: string, artworkId: string }>} */
  const artworks = new Map();

  for (const match of html.matchAll(/\/artwork\/([A-Za-z0-9_-]+)/g)) {
    const artworkId = match[1];
    if (!artworkId) continue;
    artworks.set(artworkId, { artworkId, website: `${origin}/artwork/${artworkId}` });
  }

  return [...artworks.values()];
}
