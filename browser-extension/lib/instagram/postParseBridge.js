(() => {
  const NS = (window.__ARC__ = window.__ARC__ || {});
  const { isInstagramPostMediaUrl, dedupeInstagramImageUrls, instagramImageScore } = NS;

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
      if (!isInstagramPostMediaUrl(decoded)) continue;
      const normalized = normalizeInstagramImageUrl(decoded);
      const score = instagramImageScore?.(normalized) ?? normalized.length;
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
    const escaped = shortcode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const sidecarIdx = postSlice.indexOf('"edge_sidecar_to_children"');
    if (sidecarIdx !== -1) {
      const sidecarSlice = postSlice.slice(sidecarIdx, sidecarIdx + 80_000);
      const edgesMatch = /"edges"\s*:\s*\[([\s\S]*?)\]\s*\}/.exec(sidecarSlice);
      if (edgesMatch?.[1]) {
        for (const edge of edgesMatch[1].split(/\},\s*\{/)) {
          const best = pickBestInstagramUrlFromText(edge);
          if (best) urls.add(best);
        }
        if (urls.size > 0) return dedupeInstagramImageUrls?.([...urls]) ?? [...urls];
      }
    }

    collectCarouselMediaUrls(postSlice, urls);
    if (urls.size > 0) return dedupeInstagramImageUrls?.([...urls]) ?? [...urls];

    const singleMatch = new RegExp(
      `"shortcode"\\s*:\\s*"${escaped}"[\\s\\S]{0,25_000}?"display_url"\\s*:\\s*"([^"]+)"`,
      'i'
    ).exec(postSlice);
    if (!singleMatch) {
      const codeMatch = new RegExp(
        `"code"\\s*:\\s*"${escaped}"[\\s\\S]{0,25_000}?"display_url"\\s*:\\s*"([^"]+)"`,
        'i'
      ).exec(postSlice);
      if (codeMatch?.[1]) {
        const decoded = codeMatch[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
        if (isInstagramPostMediaUrl(decoded)) urls.add(normalizeInstagramImageUrl(decoded));
      }
    } else if (singleMatch[1]) {
      const decoded = singleMatch[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
      if (isInstagramPostMediaUrl(decoded)) urls.add(normalizeInstagramImageUrl(decoded));
    }

    if (urls.size === 0) {
      const iv2 = /"image_versions2"[\s\S]{0,4000}?"url"\s*:\s*"([^"]+)"/.exec(postSlice);
      if (iv2?.[1]) {
        const decoded = iv2[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
        if (isInstagramPostMediaUrl(decoded)) urls.add(normalizeInstagramImageUrl(decoded));
      }
    }

    return dedupeInstagramImageUrls?.([...urls]) ?? [...urls];
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
   * @param {string} html
   * @param {string | null} [shortcode]
   * @returns {string[]}
   */
  function collectInstagramImageUrlsFromHtml(html, shortcode = null) {
    const candidates = [];

    const ogImage = extractMetaContent(html, 'og:image');
    if (ogImage && isInstagramPostMediaUrl(ogImage)) {
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

    const merged = dedupeInstagramImageUrls?.(candidates) ?? [...new Set(candidates)];
    const scopedOnly =
      shortcode && getPostHtmlSlice(html, shortcode)
        ? collectShortcodeScopedImageUrls(getPostHtmlSlice(html, shortcode), shortcode)
        : [];

    if (scopedOnly.length >= 2) return scopedOnly;

    if (scopedOnly.length === 1) return scopedOnly;

    return merged;
  }

  Object.assign(NS, { collectInstagramImageUrlsFromHtml });
})();
