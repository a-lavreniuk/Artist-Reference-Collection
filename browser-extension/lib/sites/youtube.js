(() => {
  const NS = (window.__ARC__ = window.__ARC__ || {});
  const { cleanPageTitle, getMetaContent } = NS;

  const YOUTUBE_HOSTS = new Set([
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'music.youtube.com',
    'youtu.be',
    'www.youtu.be'
  ]);

  /**
   * @param {string} hostname
   * @returns {boolean}
   */
  function isYoutubeHost(hostname) {
    const host = hostname.toLowerCase();
    if (host === 'youtu.be' || host.endsWith('.youtu.be')) return true;
    return YOUTUBE_HOSTS.has(host) || host.endsWith('.youtube.com');
  }

  /**
   * @returns {string}
   */
  function canonicalYoutubeWatchUrl() {
    try {
      const parsed = new URL(location.href);
      if (parsed.hostname.replace(/^www\./, '') === 'youtu.be') {
        const id = parsed.pathname.split('/').filter(Boolean)[0];
        if (id) return `https://www.youtube.com/watch?v=${id}`;
      }
      if (parsed.pathname.startsWith('/shorts/')) {
        const id = parsed.pathname.split('/').filter(Boolean)[1];
        if (id) return `https://www.youtube.com/watch?v=${id}`;
      }
      const videoId = parsed.searchParams.get('v');
      if (videoId) {
        parsed.search = `?v=${videoId}`;
        parsed.hash = '';
        return parsed.href;
      }
    } catch {
      /* keep location.href */
    }
    return location.href;
  }

  /**
   * @param {Element | null} target
   * @returns {{ el: Element, url: string } | null}
   */
  function findVideoTarget(target) {
    if (!(target instanceof Element)) return null;

    const player =
      target.closest('#movie_player, #player, ytd-player, .html5-video-player') ??
      document.querySelector('#movie_player, #player, ytd-player, .html5-video-player');
    if (!(player instanceof Element)) return null;

    const video = player.querySelector('video');
    if (!(video instanceof HTMLVideoElement)) return null;

    if (!target.closest('#movie_player, #player, ytd-player, .html5-video-player, video')) {
      if (!(target instanceof HTMLVideoElement)) return null;
    }

    return { el: video, url: canonicalYoutubeWatchUrl() };
  }

  /** @type {import('./types.js').SiteHandler} */
  const youtubeHandler = {
    id: 'youtube',

    findVideoTarget,

    resolveImageUrl() {
      return { url: canonicalYoutubeWatchUrl(), mediaKind: 'video' };
    },

    resolveCardName({ pageTitle }) {
      const ogTitle = getMetaContent('og:title');
      const raw = ogTitle || pageTitle;
      return (
        cleanPageTitle(raw, [/\s*[-|–—]\s*YouTube\s*$/i, /\s*\|\s*YouTube\s*$/i]) ?? undefined
      );
    }
  };

  Object.assign(NS, { isYoutubeHost, youtubeHandler });
})();
