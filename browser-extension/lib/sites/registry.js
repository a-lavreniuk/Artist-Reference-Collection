(() => {
  const NS = (window.__ARC__ = window.__ARC__ || {});
  const {
    genericHandler,
    pinterestHandler,
    artstationHandler,
    instagramHandler,
    youtubeHandler,
    isYoutubeHost
  } = NS;

  /**
   * @param {string} hostname
   * @returns {import('./types.js').SiteHandler}
   */
  function getSiteHandler(hostname) {
    const host = hostname.toLowerCase();

    if (isYoutubeHost?.(host)) {
      return youtubeHandler;
    }

    if (host === 'pinterest.com' || host.endsWith('.pinterest.com')) {
      return pinterestHandler;
    }

    if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
      return instagramHandler;
    }

    if (host === 'artstation.com' || host.endsWith('.artstation.com')) {
      return artstationHandler;
    }

    return genericHandler;
  }

  Object.assign(NS, { getSiteHandler });
})();
