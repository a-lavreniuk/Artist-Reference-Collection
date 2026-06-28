export const INTERFACE_TOUR_ANCHOR_ATTR = 'data-interface-tour-anchor';

/** Якоря navbar / глобального chrome — не подтверждают монтирование целевой страницы. */
export const GLOBAL_INTERFACE_TOUR_ANCHOR_IDS = new Set([
  'main-tabs',
  'main-tab-moodboard',
  'navbar-menu',
  'navbar-search',
  'navbar-sort-filters',
  'navbar-add',
  'bug-report-widget'
]);

export function isPageSpecificTourAnchor(anchorId: string): boolean {
  return !GLOBAL_INTERFACE_TOUR_ANCHOR_IDS.has(anchorId);
}

export function queryInterfaceTourAnchor(anchorId: string): HTMLElement | null {
  const el = document.querySelector(`[${INTERFACE_TOUR_ANCHOR_ATTR}="${anchorId}"]`);
  return el instanceof HTMLElement ? el : null;
}

function isAnchorVisible(el: HTMLElement): boolean {
  let node: HTMLElement | null = el;

  while (node) {
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return false;

    const opacity = Number.parseFloat(style.opacity);
    if (Number.isFinite(opacity) && opacity <= 0) return false;

    const rect = node.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) return true;

    if (style.display !== 'contents') break;
    node = node.parentElement;
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

/** Pathname из HashRouter (`#/gallery`) или BrowserRouter. */
export function readAppPathname(): string {
  const { hash, pathname } = window.location;
  if (hash.startsWith('#/')) {
    const fromHash = hash.slice(1).split('?')[0];
    return fromHash || '/';
  }
  if (hash === '#' || hash === '') {
    return pathname || '/';
  }
  return pathname || '/';
}

export type PathnameReader = () => string;

/** React Router pathname + fallback на hash (HashRouter). */
export function resolveActivePathname(getPathname?: PathnameReader): string {
  const fromRouter = getPathname?.().trim();
  if (fromRouter) return fromRouter;
  return readAppPathname();
}

export function resolveInterfaceTourFallbacks(
  fallbackAnchorId?: string,
  fallbackAnchorIds?: readonly string[]
): string[] {
  const ids: string[] = [];
  if (fallbackAnchorId) ids.push(fallbackAnchorId);
  if (fallbackAnchorIds) {
    for (const id of fallbackAnchorIds) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

/** Маркеры готовности страницы — только якоря контента, без navbar. */
export function resolvePageRouteMarkerIds(
  anchorId: string,
  fallbackAnchorId?: string,
  fallbackAnchorIds?: readonly string[]
): string[] {
  const ids = [anchorId, ...resolveInterfaceTourFallbacks(fallbackAnchorId, fallbackAnchorIds)];
  return ids.filter((id, index, list) => isPageSpecificTourAnchor(id) && list.indexOf(id) === index);
}

function findTourAnchor(anchorId: string, fallbackIds: readonly string[]): HTMLElement | null {
  const primary = queryInterfaceTourAnchor(anchorId);
  if (primary && isAnchorVisible(primary)) return primary;

  for (const fallbackId of fallbackIds) {
    const fallback = queryInterfaceTourAnchor(fallbackId);
    if (fallback && isAnchorVisible(fallback)) return fallback;
  }

  return null;
}

async function waitForPathnamePrefix(
  routePrefix: string,
  timeoutMs: number,
  getPathname?: PathnameReader
): Promise<boolean> {
  const read = () => resolveActivePathname(getPathname);
  if (read().startsWith(routePrefix)) return true;

  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve) => {
    const finish = (ok: boolean) => {
      window.removeEventListener('hashchange', onRouteChange);
      window.removeEventListener('popstate', onRouteChange);
      window.clearInterval(pollId);
      resolve(ok);
    };

    const check = () => {
      if (read().startsWith(routePrefix)) finish(true);
      else if (Date.now() >= deadline) finish(false);
    };

    const onRouteChange = () => check();
    window.addEventListener('hashchange', onRouteChange);
    window.addEventListener('popstate', onRouteChange);
    const pollId = window.setInterval(check, 16);
    check();
  });
}

/**
 * Ждёт смену hash/path и монтирование страницы (HashRouter обновляет URL до commit React).
 */
export async function waitForRouteCommit(
  routePrefix: string,
  markerAnchorIds: readonly string[] = [],
  timeoutMs = 12000,
  getPathname?: PathnameReader
): Promise<boolean> {
  const read = () => resolveActivePathname(getPathname);
  const pathnameReady = await waitForPathnamePrefix(routePrefix, timeoutMs, getPathname);
  if (!pathnameReady) return false;

  const pageMarkers = markerAnchorIds.filter(isPageSpecificTourAnchor);
  if (pageMarkers.length === 0) return true;

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await waitForPaint();

    for (const markerId of pageMarkers) {
      const marker = queryInterfaceTourAnchor(markerId);
      if (marker && isAnchorVisible(marker)) return true;
    }

    await sleep(50);
  }

  return read().startsWith(routePrefix);
}

type WaitForTourAnchorOptions = {
  routePrefix?: string;
  getPathname?: PathnameReader;
};

function isTourAnchorAllowed(
  anchorId: string,
  routePrefix: string | undefined,
  pathname: string
): boolean {
  if (!routePrefix || !pathname.startsWith(routePrefix)) return false;
  if (isPageSpecificTourAnchor(anchorId)) return true;
  return GLOBAL_INTERFACE_TOUR_ANCHOR_IDS.has(anchorId);
}

export async function waitForInterfaceTourAnchor(
  anchorId: string,
  fallbackAnchorId?: string,
  timeoutMs = 12000,
  fallbackAnchorIds?: readonly string[],
  options?: WaitForTourAnchorOptions
): Promise<{ element: HTMLElement; anchorId: string } | null> {
  const fallbacks = resolveInterfaceTourFallbacks(fallbackAnchorId, fallbackAnchorIds);
  const readPathname = () => resolveActivePathname(options?.getPathname);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const pathname = readPathname();

    const primary = queryInterfaceTourAnchor(anchorId);
    if (primary && isAnchorVisible(primary) && isTourAnchorAllowed(anchorId, options?.routePrefix, pathname)) {
      return { element: primary, anchorId };
    }

    for (const fallbackId of fallbacks) {
      const fallback = queryInterfaceTourAnchor(fallbackId);
      if (
        fallback &&
        isAnchorVisible(fallback) &&
        isTourAnchorAllowed(fallbackId, options?.routePrefix, pathname)
      ) {
        return { element: fallback, anchorId: fallbackId };
      }
    }

    await sleep(50);
  }

  const pathname = readPathname();
  const last = findTourAnchor(anchorId, fallbacks);
  if (!last) {
    const navbarHost = document.querySelector('.arc-navbar-host');
    if (
      navbarHost instanceof HTMLElement &&
      isAnchorVisible(navbarHost) &&
      options?.routePrefix &&
      pathname.startsWith(options.routePrefix)
    ) {
      return { element: navbarHost, anchorId: 'navbar-host' };
    }
    return null;
  }

  const resolvedId =
    queryInterfaceTourAnchor(anchorId) === last
      ? anchorId
      : fallbacks.find((id) => queryInterfaceTourAnchor(id) === last) ?? anchorId;

  if (!isTourAnchorAllowed(resolvedId, options?.routePrefix, pathname)) return null;

  return { element: last, anchorId: resolvedId };
}

export async function waitForPathname(routePrefix: string, timeoutMs = 12000): Promise<boolean> {
  return waitForRouteCommit(routePrefix, [], timeoutMs);
}
