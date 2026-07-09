const SHORTCODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const DEFAULT_IG_APP_ID = '936619743392459';

/**
 * @param {string} shortcode
 * @returns {string | null}
 */
export function shortcodeToMediaId(shortcode) {
  if (!shortcode?.trim()) return null;

  let mediaId = 0n;
  for (const letter of shortcode) {
    const index = SHORTCODE_ALPHABET.indexOf(letter);
    if (index < 0) return null;
    mediaId = mediaId * 64n + BigInt(index);
  }

  return mediaId.toString();
}

/**
 * @param {string} shortcode
 * @returns {string | null}
 */
export function buildInstagramMediaInfoUrl(shortcode) {
  const mediaId = shortcodeToMediaId(shortcode);
  if (!mediaId) return null;
  return `https://www.instagram.com/api/v1/media/${mediaId}/info/`;
}

/**
 * @param {unknown} slide
 * @returns {string | null}
 */
export function pickBestImageUrlFromApiSlide(slide) {
  if (!slide || typeof slide !== 'object') return null;

  const candidates = /** @type {{ url?: string, width?: number, height?: number }[]} */ (
    slide.image_versions2?.candidates
  );
  if (!Array.isArray(candidates) || !candidates.length) return null;

  let best = null;
  let bestArea = 0;
  for (const candidate of candidates) {
    const url = candidate?.url;
    if (!url) continue;
    const area = Number(candidate.width ?? 0) * Number(candidate.height ?? 0);
    if (area >= bestArea) {
      bestArea = area;
      best = url;
    }
  }

  return best;
}

/**
 * @param {unknown} data
 * @param {(url: string) => boolean} [isValidUrl]
 * @param {(urls: string[]) => string[]} [dedupe]
 * @returns {string[]}
 */
export function parseInstagramMediaInfoResponse(
  data,
  isValidUrl = () => true,
  dedupe = (urls) => [...new Set(urls)]
) {
  const post = data?.items?.[0];
  if (!post || typeof post !== 'object') return [];

  const slides = Array.isArray(post.carousel_media) && post.carousel_media.length
    ? post.carousel_media
    : [post];

  const urls = [];
  for (const slide of slides) {
    const url = pickBestImageUrlFromApiSlide(slide);
    if (url && isValidUrl(url)) urls.push(url);
  }

  return dedupe(urls);
}

export { DEFAULT_IG_APP_ID };
