(() => {
  const NS = (window.__ARC__ = window.__ARC__ || {});
  const { isInstagramPostMediaUrl, dedupeInstagramImageUrls } = NS;

  const SHORTCODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const DEFAULT_IG_APP_ID = '936619743392459';

  /**
   * @param {string} shortcode
   * @returns {string | null}
   */
  function shortcodeToMediaId(shortcode) {
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
   * @returns {string}
   */
  function getInstagramAppId() {
    for (const script of document.querySelectorAll('script')) {
      const text = script.textContent ?? '';
      const match = /"APP_ID":"(\d{8,})"/.exec(text);
      if (match?.[1]) return match[1];
    }

    return DEFAULT_IG_APP_ID;
  }

  /**
   * @returns {string}
   */
  function getInstagramCsrfToken() {
    return document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/)?.[1]?.trim() ?? '';
  }

  /**
   * @param {unknown} slide
   * @returns {string | null}
   */
  function pickBestImageUrlFromApiSlide(slide) {
    if (!slide || typeof slide !== 'object') return null;

    const candidates = slide.image_versions2?.candidates;
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
   * @returns {string[]}
   */
  function parseInstagramMediaInfoResponse(data) {
    const post = data?.items?.[0];
    if (!post || typeof post !== 'object') return [];

    const slides = Array.isArray(post.carousel_media) && post.carousel_media.length
      ? post.carousel_media
      : [post];

    const urls = [];
    for (const slide of slides) {
      const url = pickBestImageUrlFromApiSlide(slide);
      if (url && isInstagramPostMediaUrl(url)) urls.push(url);
    }

    return dedupeInstagramImageUrls?.(urls) ?? [...new Set(urls)];
  }

  /**
   * @param {string} shortcode
   * @returns {Promise<string[]>}
   */
  async function fetchInstagramPostImagesFromApi(shortcode) {
    const mediaId = shortcodeToMediaId(shortcode);
    if (!mediaId) return [];

    try {
      const res = await fetch(`https://www.instagram.com/api/v1/media/${mediaId}/info/`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: '*/*',
          'X-CSRFToken': getInstagramCsrfToken(),
          'X-IG-App-ID': getInstagramAppId(),
          'X-ASBD-ID': '129477',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      if (!res.ok) return [];
      return parseInstagramMediaInfoResponse(await res.json());
    } catch {
      return [];
    }
  }

  Object.assign(NS, {
    fetchInstagramPostImagesFromApi
  });
})();
