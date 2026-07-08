import {
  cleanPageTitle,
  getMetaContent,
  pickLargestImageUrlFromElement,
  resolveAbsoluteUrl
} from '../sites/urlUtils.js';
import { upgradePinimgUrl } from '../sites/pinterest.js';

const BOARD_PATH_BLOCKLIST = new Set([
  'pin',
  'search',
  'ideas',
  'today',
  'settings',
  'about',
  'business',
  'login',
  'signup',
  'password',
  'edit',
  'shopping',
  'videos',
  'topics'
]);

/**
 * @param {string} url
 * @returns {boolean}
 */
export function isPinterestBoardUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!host.endsWith('pinterest.com') && host !== 'pinterest.ru') return false;

    const segments = decodeURIComponent(parsed.pathname)
      .split('/')
      .filter(Boolean);
    if (segments.length < 2) return false;

    const head = segments[0].toLowerCase();
    if (head === 'pin' || head === 'pins') return false;
    if (BOARD_PATH_BLOCKLIST.has(head)) return false;
    if (head.startsWith('_')) return false;
    if (segments.some((segment) => segment.toLowerCase() === 'pin')) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} [pageUrl]
 * @returns {{ boardName: string, boardUrl: string }}
 */
export function getPinterestBoardMeta(pageUrl = location.href) {
  const parsed = new URL(pageUrl);
  const segments = parsed.pathname.split('/').filter(Boolean);
  const slug = decodeURIComponent(segments[1] ?? '').replace(/-/g, ' ');

  const h1 = document.querySelector('h1')?.textContent?.trim();
  const ogTitle = getMetaContent('og:title');
  const raw = h1 || ogTitle || slug || document.title;

  const boardName =
    cleanPageTitle(raw, [
      /\s*[-|–—]\s*Pinterest\s*$/i,
      /\s*\|\s*Pinterest\s*$/i,
      /\s+on Pinterest\s*$/i,
      /\s*·\s*Pinterest\s*$/i
    ]) ?? slug ?? 'Pinterest board';

  return { boardName, boardUrl: pageUrl };
}

/**
 * @returns {Promise<void>}
 */
async function scrollBoardToLoadPins() {
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let stablePasses = 0;
  let lastPinCount = 0;

  for (let pass = 0; pass < 40 && stablePasses < 4; pass += 1) {
    window.scrollTo(0, document.documentElement.scrollHeight);
    await delay(650);

    const pinCount = document.querySelectorAll('a[href*="/pin/"]').length;
    if (pinCount === lastPinCount) {
      stablePasses += 1;
    } else {
      stablePasses = 0;
      lastPinCount = pinCount;
    }
  }

  window.scrollTo(0, 0);
}

/**
 * @param {string} boardUrl
 * @returns {Array<{ url: string, website: string, name?: string }>}
 */
function extractPinsFromBoard(boardUrl) {
  /** @type {Map<string, { url: string, website: string, name?: string }>} */
  const pins = new Map();

  for (const anchor of document.querySelectorAll('a[href*="/pin/"]')) {
    if (!(anchor instanceof HTMLAnchorElement)) continue;

    const pinMatch = /\/pin\/(\d+)/.exec(anchor.pathname);
    if (!pinMatch) continue;

    const pinId = pinMatch[1];
    if (pins.has(pinId)) continue;

    const container =
      anchor.closest('[data-test-id="pin"], [data-test-id="pinWrapper"], [data-test-id="deep-dive-pin"]') ??
      anchor.parentElement ??
      anchor;

    let imageUrl = null;

    if (container instanceof Element) {
      const img = container.querySelector('img[src*="pinimg"]');
      if (img instanceof HTMLImageElement) {
        imageUrl = pickLargestImageUrlFromElement(img) || img.currentSrc || img.src;
      }

      const dataPinMedia =
        container.getAttribute('data-pin-media') ??
        anchor.getAttribute('data-pin-media') ??
        container.querySelector('[data-pin-media]')?.getAttribute('data-pin-media');
      if (dataPinMedia) {
        imageUrl = dataPinMedia;
      }
    }

    const absolute = resolveAbsoluteUrl(imageUrl ?? '', boardUrl);
    if (!absolute || !absolute.includes('pinimg.com')) continue;

    const pinWebsite = resolveAbsoluteUrl(anchor.href, boardUrl);
    if (!pinWebsite) continue;

    const alt = container instanceof Element ? container.querySelector('img')?.getAttribute('alt') : null;

    pins.set(pinId, {
      url: upgradePinimgUrl(absolute),
      website: pinWebsite.split('?')[0],
      ...(alt?.trim() ? { name: alt.trim() } : {})
    });
  }

  return [...pins.values()];
}

/**
 * @returns {Promise<{ boardName: string, boardUrl: string, pins: Array<{ url: string, website: string, name?: string }> }>}
 */
export async function collectPinterestBoardPins() {
  const meta = getPinterestBoardMeta();
  await scrollBoardToLoadPins();
  const pins = extractPinsFromBoard(meta.boardUrl);
  return { ...meta, pins };
}
