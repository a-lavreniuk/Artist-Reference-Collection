const PINIMG_SIZE_SEGMENT = /^\/(\d+x|\d+x\d+)\//;
const PIN_VIDEO_MP4_RE = /https?:\/\/v\d*\.pinimg\.com\/videos\/[^\s"'\\)]+?\.mp4/gi;
const PIN_VIDEO_HLS_RE = /https?:\/\/v\d*\.pinimg\.com\/videos\/[^\s"'\\)]+?\.m3u8/gi;

/**
 * @param {string} html
 * @param {string} property
 * @returns {string | null}
 */
function extractMetaContent(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i')
  ];
  for (const re of patterns) {
    const match = re.exec(html);
    if (match?.[1]) return match[1].trim();
  }
  return null;
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
    /* keep */
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
 * @param {string | null} pinId
 * @returns {{ mp4: string[], hls: string[] }}
 */
function collectVideoUrlsFromHtml(html, pinId = null) {
  const mp4 = new Set();
  const hls = new Set();

  const chunks = pinId ? html.split(pinId) : [html];
  const scan = chunks.length > 1 ? chunks[0] + pinId + chunks[1] : html;

  let match;
  PIN_VIDEO_MP4_RE.lastIndex = 0;
  while ((match = PIN_VIDEO_MP4_RE.exec(scan))) mp4.add(match[0]);
  PIN_VIDEO_HLS_RE.lastIndex = 0;
  while ((match = PIN_VIDEO_HLS_RE.exec(scan))) hls.add(match[0]);

  return { mp4: [...mp4], hls: [...hls] };
}

/**
 * @param {{ mp4: string[], hls: string[] }} sets
 * @returns {string | null}
 */
function pickBestVideoUrl(sets) {
  const byRes = (a, b) => pinVideoResolutionScore(b) - pinVideoResolutionScore(a);
  if (sets.mp4.length) return sets.mp4.slice().sort(byRes)[0];
  if (sets.hls.length) return sets.hls.slice().sort(byRes)[0];
  return null;
}

/**
 * @param {string} title
 * @returns {string | undefined}
 */
function cleanPinTitle(title) {
  if (!title?.trim()) return undefined;
  return (
    title
      .trim()
      .replace(/\s*[-|–—]\s*Pinterest\s*$/i, '')
      .replace(/\s*\|\s*Pinterest\s*$/i, '')
      .replace(/\s+on Pinterest\s*$/i, '')
      .trim() || undefined
  );
}

/**
 * @param {string} html
 * @param {string} pinId
 * @returns {string}
 */
function getPinHtmlSlice(html, pinId) {
  if (!pinId) return html.slice(0, 200000);

  const markers = [`"entityId":"${pinId}"`, `"id":"${pinId}"`, `"pinId":"${pinId}"`];
  for (const marker of markers) {
    const idx = html.indexOf(marker);
    if (idx >= 0) return html.slice(idx, idx + 25000);
  }

  const idx = html.indexOf(pinId);
  if (idx < 0) return html.slice(0, 200000);
  return html.slice(Math.max(0, idx - 800), idx + 25000);
}

/**
 * @param {string} html
 * @param {string | null} pinId
 * @returns {boolean}
 */
function pinimgUrlSizeScore(url) {
  if (!url) return 0;
  if (url.includes('/originals/')) return 1_000_000;
  const match = /\/(\d{2,4})x(?:(\d{2,4})\/)?/i.exec(url);
  if (!match) return 0;
  const width = Number(match[1]);
  const height = match[2] ? Number(match[2]) : width;
  return width * height;
}

/**
 * @param {string} html
 * @param {string | null} pinId
 * @returns {string[]}
 */
function collectPinImageUrls(html, pinId) {
  const slice = pinId ? getPinHtmlSlice(html, pinId) : html;
  const urls = new Set();

  const ogImage = extractMetaContent(html, 'og:image');
  if (ogImage) urls.add(ogImage);

  for (const match of slice.matchAll(/"images_orig"\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"/g)) {
    urls.add(match[1]);
  }

  for (const match of slice.matchAll(
    /"url"\s*:\s*"(https:\/\/i\.pinimg\.com\/[^"]+\.(?:jpg|jpeg|png|webp))"/gi
  )) {
    urls.add(match[1]);
  }

  return [...urls];
}

/**
 * @param {string[]} urls
 * @returns {string | null}
 */
function pickBestPinImageUrl(urls) {
  if (!urls.length) return null;

  const ranked = urls
    .map((url) => upgradePinimgUrl(url))
    .sort((a, b) => pinimgUrlSizeScore(b) - pinimgUrlSizeScore(a));

  return ranked[0] ?? null;
}

/**
 * @param {string} html
 * @param {string | null} pinId
 * @returns {boolean}
 */
function isVideoPinHtml(html, pinId) {
  if (
    extractMetaContent(html, 'og:video:url') ||
    extractMetaContent(html, 'og:video:secure_url') ||
    extractMetaContent(html, 'og:video')
  ) {
    return true;
  }

  const slice = pinId ? getPinHtmlSlice(html, pinId) : html;
  if (slice.includes('video_list')) return true;
  if (/\"is_video\"\s*:\s*true/i.test(slice)) return true;
  if (slice.includes('pin-closeup-video') || slice.includes('closeup-video')) return true;

  const sets = collectVideoUrlsFromHtml(slice, null);
  return sets.mp4.length > 0 || sets.hls.length > 0;
}

/**
 * @param {string} html
 * @param {string} boardUrl
 * @returns {Array<{ website: string }>}
 */
export function extractPinUrlsFromBoardHtml(html, boardUrl) {
  if (!html?.trim() || !boardUrl?.trim()) return [];

  let origin;
  try {
    origin = new URL(boardUrl).origin;
  } catch {
    return [];
  }

  const ids = new Set();
  for (const match of html.matchAll(/\/pin\/(\d+)/g)) {
    if (match[1]) ids.add(match[1]);
  }

  return [...ids].map((id) => ({ website: `${origin}/pin/${id}/` }));
}

/**
 * @param {string} html
 * @param {string} pinWebsite
 * @returns {{ url: string, mediaKind: 'image' | 'video', website: string, name?: string, fallbackUrl?: string } | null}
 */
export function parsePinMediaFromHtml(html, pinWebsite) {
  if (!html?.trim() || !pinWebsite?.trim()) return null;

  const pinId = /\/pin\/(\d+)/.exec(pinWebsite)?.[1] ?? null;
  const pageTitle = extractMetaContent(html, 'og:title') || '';
  const name = cleanPinTitle(pageTitle);
  const pinSlice = pinId ? getPinHtmlSlice(html, pinId) : html;

  const ogVideo =
    extractMetaContent(html, 'og:video:url') ||
    extractMetaContent(html, 'og:video:secure_url') ||
    extractMetaContent(html, 'og:video');

  const videoSets = collectVideoUrlsFromHtml(pinSlice, null);
  const videoUrl = ogVideo || pickBestVideoUrl(videoSets);
  const isVideoPin = isVideoPinHtml(html, pinId);

  if (isVideoPin) {
    if (!videoUrl) return null;
    return {
      url: videoUrl,
      mediaKind: 'video',
      website: pinWebsite,
      ...(name ? { name } : {})
    };
  }

  const ogImage = extractMetaContent(html, 'og:image');

  const imageUrl = (() => {
    const origMatch = pinSlice.match(/"images_orig"\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"/);
    if (origMatch?.[1]) return upgradePinimgUrl(origMatch[1]);

    return pickBestPinImageUrl(collectPinImageUrls(html, pinId)) ?? (ogImage ? upgradePinimgUrl(ogImage) : null);
  })();
  if (!imageUrl) return null;

  return {
    url: imageUrl,
    mediaKind: 'image',
    website: pinWebsite,
    ...(name ? { name } : {})
  };
}
