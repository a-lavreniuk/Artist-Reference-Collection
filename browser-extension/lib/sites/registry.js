import { genericHandler } from './generic.js';
import { pinterestHandler } from './pinterest.js';
import { artstationHandler } from './artstation.js';

/**
 * @param {string} hostname
 * @returns {import('./types.js').SiteHandler}
 */
export function getSiteHandler(hostname) {
  const host = hostname.toLowerCase();

  if (host === 'pinterest.com' || host.endsWith('.pinterest.com')) {
    return pinterestHandler;
  }

  if (host === 'artstation.com' || host.endsWith('.artstation.com')) {
    return artstationHandler;
  }

  return genericHandler;
}
