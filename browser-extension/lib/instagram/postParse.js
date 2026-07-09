const INSTAGRAM_POST_PATH_RE = /\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/i;
const SMALL_SIZE_RE = /\/s(\d+)x(\d+)\//i;
const PROFILE_PIC_RE = /\/s(?:64|150|320)x(?:64|150|320)\//i;

import {
  dedupeInstagramImageUrls,
  getInstagramMediaKey,
  instagramImageScore
} from './mediaKeys.js';

export { getInstagramMediaKey, dedupeInstagramImageUrls, instagramImageScore };
/**
 * @param {string} url
 * @returns {boolean}
 */
export function isInstagramPostMediaUrl(url) {
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
 * @param {string} postUrl
 * @returns {string | null}
 */
export function extractShortcodeFromPostUrl(postUrl) {
  if (!postUrl?.trim()) return null;
  return INSTAGRAM_POST_PATH_RE.exec(postUrl)?.[1] ?? null;
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
 * @returns {boolean}
 */
function isInstagramMediaCdnUrl(url) {
  return isInstagramPostMediaUrl(url);
}

/**
 * @param {string} url
 * @returns {string}
 */
function normalizeInstagramImageUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.href;
  } catch {
    return url;
  }
}

/**
 * @param {string} html
 * @param {string} shortcode
 * @param {number} [before]
 * @param {number} [after]
 * @returns {string}
 */
function getPostHtmlSlice(html, shortcode, before = 2_000, after = 45_000) {
  const markers = [`"shortcode":"${shortcode}"`, `"code":"${shortcode}"`];

  for (const marker of markers) {
    const idx = html.indexOf(marker);
    if (idx !== -1) {
      return html.slice(Math.max(0, idx - before), Math.min(html.length, idx + after));
    }
  }

  return '';
}

/**
 * @param {string} slice
 * @param {string} shortcode
 * @returns {string | null}
 */
function findPostJsonSlice(slice, shortcode) {
  const markers = [
    `"shortcode":"${shortcode}"`,
    `"shortcode": "${shortcode}"`,
    `"code":"${shortcode}"`,
    `"code": "${shortcode}"`
  ];

  for (const marker of markers) {
    const idx = slice.indexOf(marker);
    if (idx !== -1) return slice.slice(idx, idx + 45_000);
  }

  return null;
}

/**
 * @param {string} postSlice
 * @param {string} shortcode
 * @returns {string}
 */
function trimPostSliceBeforeRelated(postSlice, shortcode) {
  const escaped = shortcode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let end = postSlice.length;

  for (const marker of ['"more_posts"', '"suggested_posts"', '"related_posts"']) {
    const idx = postSlice.indexOf(marker);
    if (idx !== -1 && idx < end) end = idx;
  }

  const otherShortcode = new RegExp(`"shortcode":"(?!${escaped})[A-Za-z0-9_-]+"`, 'i').exec(
    postSlice.slice(25_000)
  );
  if (otherShortcode?.index !== undefined) {
    end = Math.min(end, 25_000 + otherShortcode.index);
  }

  const otherCode = new RegExp(`"code":"(?!${escaped})[A-Za-z0-9_-]+"`, 'i').exec(postSlice.slice(25_000));
  if (otherCode?.index !== undefined) {
    end = Math.min(end, 25_000 + otherCode.index);
  }

  return postSlice.slice(0, end);
}

/**
 * @param {string} text
 * @returns {string | null}
 */
function pickBestInstagramUrlFromText(text) {
  let best = null;
  let bestScore = 0;

  for (const match of text.matchAll(/"url"\s*:\s*"([^"]+)"|"display_url"\s*:\s*"([^"]+)"/g)) {
    const raw = match[1] || match[2];
    const decoded = raw.replace(/\\u0026/g, '&').replace(/\\\//g, '/');
    if (!isInstagramMediaCdnUrl(decoded)) continue;
    const normalized = normalizeInstagramImageUrl(decoded);
    const score = instagramImageScore(normalized);
    if (score > bestScore) {
      bestScore = score;
      best = normalized;
    }
  }

  return best;
}

/**
 * @param {string} postSlice
 * @param {Set<string>} urls
 */
function collectCarouselMediaUrls(postSlice, urls) {
  const carouselIdx = postSlice.indexOf('"carousel_media"');
  if (carouselIdx === -1) return;

  const tail = postSlice.slice(carouselIdx);
  const arrayMatch = /"carousel_media"\s*:\s*\[([\s\S]*?)\]\s*[,}]/.exec(tail);
  if (!arrayMatch?.[1]) return;

  for (const item of arrayMatch[1].split(/\},\s*\{/)) {
    const best = pickBestInstagramUrlFromText(item);
    if (best) urls.add(best);
  }
}

/**
 * @param {string} slice
 * @param {string} shortcode
 * @returns {string[]}
 */
function collectShortcodeScopedImageUrls(slice, shortcode) {
  const urls = new Set();
  const postSliceRaw = findPostJsonSlice(slice, shortcode);
  if (!postSliceRaw) return [];

  const postSlice = trimPostSliceBeforeRelated(postSliceRaw, shortcode);

  const sidecarIdx = postSlice.indexOf('"edge_sidecar_to_children"');
  if (sidecarIdx !== -1) {
    const sidecarSlice = postSlice.slice(sidecarIdx, sidecarIdx + 80_000);
    const edgesMatch = /"edges"\s*:\s*\[([\s\S]*?)\]\s*\}/.exec(sidecarSlice);
    if (edgesMatch?.[1]) {
      for (const edge of edgesMatch[1].split(/\},\s*\{/)) {
        const best = pickBestInstagramUrlFromText(edge);
        if (best) urls.add(best);
      }
      if (urls.size > 0) return dedupeInstagramImageUrls([...urls]);
    }
  }

  collectCarouselMediaUrls(postSlice, urls);
  if (urls.size > 0) return dedupeInstagramImageUrls([...urls]);

  const singleMatch = new RegExp(
    `"shortcode"\\s*:\\s*"${shortcode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]{0,25_000}?"display_url"\\s*:\\s*"([^"]+)"`,
    'i'
  ).exec(postSlice);
  if (!singleMatch) {
    const codeMatch = new RegExp(
      `"code"\\s*:\\s*"${shortcode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]{0,25_000}?"display_url"\\s*:\\s*"([^"]+)"`,
      'i'
    ).exec(postSlice);
    if (codeMatch?.[1]) {
      const decoded = codeMatch[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
      if (isInstagramMediaCdnUrl(decoded)) urls.add(normalizeInstagramImageUrl(decoded));
    }
  } else if (singleMatch[1]) {
    const decoded = singleMatch[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
    if (isInstagramMediaCdnUrl(decoded)) urls.add(normalizeInstagramImageUrl(decoded));
  }

  if (urls.size === 0) {
    const iv2 = /"image_versions2"[\s\S]{0,4000}?"url"\s*:\s*"([^"]+)"/.exec(postSlice);
    if (iv2?.[1]) {
      const decoded = iv2[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
      if (isInstagramMediaCdnUrl(decoded)) urls.add(normalizeInstagramImageUrl(decoded));
    }
  }

  return dedupeInstagramImageUrls([...urls]);
}

/**
 * @param {string} html
 * @param {string | null} [shortcode]
 * @returns {string[]}
 */
export function collectInstagramImageUrlsFromHtml(html, shortcode = null) {
  const candidates = [];

  const ogImage = extractMetaContent(html, 'og:image');
  if (ogImage && isInstagramMediaCdnUrl(ogImage)) {
    candidates.push(normalizeInstagramImageUrl(ogImage));
  }

  if (shortcode) {
    const slice = getPostHtmlSlice(html, shortcode);
    if (slice) {
      candidates.push(...collectShortcodeScopedImageUrls(slice, shortcode));
    }

    for (const match of html.matchAll(
      /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi
    )) {
      const body = match[1];
      if (!body.includes(shortcode)) continue;
      const jsonSlice = getPostHtmlSlice(body, shortcode) || body;
      candidates.push(...collectShortcodeScopedImageUrls(jsonSlice, shortcode));
    }
  }

  const merged = dedupeInstagramImageUrls(candidates);
  const scopedOnly =
    shortcode && getPostHtmlSlice(html, shortcode)
      ? collectShortcodeScopedImageUrls(getPostHtmlSlice(html, shortcode), shortcode)
      : [];

  if (scopedOnly.length >= 2) return scopedOnly;

  if (scopedOnly.length === 1) return scopedOnly;

  return merged;
}

/**
 * @param {string} html
 * @param {string | null} [shortcode]
 * @returns {string[]}
 */
function collectInstagramImageUrls(html, shortcode = null) {
  return collectInstagramImageUrlsFromHtml(html, shortcode);
}

/**
 * @param {string} html
 * @returns {string | null}
 */
function extractInstagramAuthor(html) {
  const ogTitle = extractMetaContent(html, 'og:title');
  if (ogTitle) {
    const onIg = /^(.+?)\s+on\s+Instagram/i.exec(ogTitle);
    if (onIg?.[1]) return onIg[1].trim();
    const atUser = /@([A-Za-z0-9._]+)/.exec(ogTitle);
    if (atUser?.[1]) return atUser[1];
  }

  for (const match of html.matchAll(/"username"\s*:\s*"([A-Za-z0-9._]+)"/g)) {
    if (match[1] && match[1] !== 'instagram') return match[1];
  }

  return null;
}

/**
 * @param {string} html
 * @returns {string | null}
 */
function extractInstagramCaption(html) {
  const ogDesc = extractMetaContent(html, 'og:description');
  if (ogDesc) {
    const cleaned = ogDesc
      .replace(/^\d[\d,.\s]*\s+likes?,\s*\d[\d,.\s]*\s+comments?\s*[-–—]\s*/i, '')
      .replace(/^[^:]+:\s*"/, '')
      .replace(/"\s*$/, '')
      .trim();
    if (cleaned) return cleaned.slice(0, 200);
  }

  for (const match of html.matchAll(/"text"\s*:\s*"((?:\\.|[^"\\])*)"/g)) {
    const decoded = match[1]
      .replace(/\\n/g, ' ')
      .replace(/\\u([\dA-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .trim();
    if (decoded.length > 8) return decoded.slice(0, 200);
  }

  return null;
}

/**
 * @param {string} caption
 * @param {string | null} author
 * @param {number} index
 * @param {number} total
 * @returns {string | undefined}
 */
export function buildInstagramCardName(caption, author, index = 0, total = 1) {
  const authorLabel = author ? (author.startsWith('@') ? author : `@${author}`) : null;
  const base = caption && authorLabel ? `${caption} — ${authorLabel}` : caption || authorLabel || undefined;
  if (!base) return undefined;
  if (total > 1) return `${base} — ${index + 1}/${total}`;
  return base;
}

/**
 * @param {string} html
 * @param {string} postUrl
 * @returns {{ shortcode: string, author: string | null, caption: string | null, images: Array<{ url: string, name?: string }>, website: string } | null}
 */
export function parseInstagramPostFromHtml(html, postUrl) {
  if (!html?.trim() || !postUrl?.trim()) return null;

  const shortcode = extractShortcodeFromPostUrl(postUrl);
  if (!shortcode) return null;

  const canonical = postUrl.split('?')[0];
  const author = extractInstagramAuthor(html);
  const caption = extractInstagramCaption(html);
  const ranked = collectInstagramImageUrls(html, shortcode);

  if (!ranked.length) return null;

  const images = ranked.map((url, index) => ({
    url,
    name: buildInstagramCardName(caption, author, index, ranked.length)
  }));

  return {
    shortcode,
    author,
    caption,
    images,
    website: canonical.endsWith('/') ? canonical : `${canonical}/`
  };
}

/**
 * @param {string} html
 * @param {string} collectionUrl
 * @returns {Array<{ website: string, shortcode: string }>}
 */
export function extractPostUrlsFromSavedHtml(html, collectionUrl) {
  if (!html?.trim() || !collectionUrl?.trim()) return [];

  let origin;
  try {
    origin = new URL(collectionUrl).origin;
  } catch {
    return [];
  }

  /** @type {Map<string, { website: string, shortcode: string }>} */
  const posts = new Map();

  for (const match of html.matchAll(/\/p\/([A-Za-z0-9_-]+)/g)) {
    const shortcode = match[1];
    if (!shortcode) continue;
    const website = `${origin}/p/${shortcode}/`;
    posts.set(shortcode, { website, shortcode });
  }

  return [...posts.values()];
}
