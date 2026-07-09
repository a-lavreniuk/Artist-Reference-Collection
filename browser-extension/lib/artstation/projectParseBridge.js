(() => {
  const NS = (window.__ARC__ = window.__ARC__ || {});

  const ARTWORK_PATH_RE = /\/artwork\/([A-Za-z0-9_-]+)/i;

  /**
   * @param {string} url
   * @returns {string}
   */
  function stripArtstationResizeSegment(url) {
    try {
      const parsed = new URL(url);
      if (!parsed.hostname.includes('artstation')) return url;

      const resized = parsed.pathname.replace(/\/(?:small|medium|large|4k|sm|md|lg)_square\//, '/');
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
   * @param {string | null} title
   * @param {string | null} author
   * @param {number} index
   * @param {number} total
   * @returns {string | undefined}
   */
  function buildArtstationProjectCardName(title, author, index = 0, total = 1) {
    const base =
      title && author && !title.includes(author)
        ? `${title} — ${author}`
        : title || author || undefined;
    if (!base) return undefined;
    if (total > 1) return `${base} — ${index + 1}/${total}`;
    return base;
  }

  /**
   * @param {unknown} data
   * @param {string} artworkUrl
   * @returns {object | null}
   */
  function parseArtstationProjectJson(data, artworkUrl) {
    if (!data || typeof data !== 'object' || !artworkUrl?.trim()) return null;

    const artworkId = ARTWORK_PATH_RE.exec(artworkUrl.split('?')[0])?.[1];
    if (!artworkId) return null;

    const record = /** @type {Record<string, unknown>} */ (data);
    const assets = Array.isArray(record.assets) ? record.assets : [];
    if (!assets.length) return null;

    const website = artworkUrl.split('?')[0];
    const title = typeof record.title === 'string' ? record.title.trim() : null;
    const user = record.user && typeof record.user === 'object' ? /** @type {Record<string, unknown>} */ (record.user) : null;
    const author =
      (typeof user?.full_name === 'string' && user.full_name.trim()) ||
      (typeof user?.username === 'string' && user.username.trim()) ||
      null;

    /** @type {Array<{ url: string, name?: string }>} */
    const images = [];
    let videoUrl = null;

    for (const asset of assets) {
      if (!asset || typeof asset !== 'object') continue;
      const entry = /** @type {Record<string, unknown>} */ (asset);

      if (entry.has_image && typeof entry.image_url === 'string' && entry.image_url.trim()) {
        images.push({
          url: stripArtstationResizeSegment(entry.image_url.replace(/\\\//g, '/')),
          name: buildArtstationProjectCardName(title, author, images.length, assets.length)
        });
        continue;
      }

      if (!videoUrl && entry.has_embedded_player && typeof entry.player_embedded === 'string') {
        const srcMatch = /src=["']([^"']+)["']/i.exec(entry.player_embedded);
        if (srcMatch?.[1]) videoUrl = srcMatch[1].replace(/\\\//g, '/');
      }
    }

    if (!images.length && videoUrl) {
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

    if (!images.length) return null;

    const total = images.length;
    const namedImages = images.map((image, index) => ({
      ...image,
      name: buildArtstationProjectCardName(title, author, index, total)
    }));

    return {
      artworkId,
      title,
      author,
      images: namedImages,
      videoUrl,
      website,
      mediaKind: 'image'
    };
  }

  Object.assign(NS, { parseArtstationProjectJson });
})();
