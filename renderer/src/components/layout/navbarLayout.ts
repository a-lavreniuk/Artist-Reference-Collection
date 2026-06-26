export type NavbarVariant = 'full' | 'compact';

export type MainTabKey = 'gallery' | 'collections' | 'moodboard' | 'board';

export const MAIN_NAV_TABS: ReadonlyArray<{ key: MainTabKey; label: string; path: string }> = [
  { key: 'gallery', label: 'Библиотека', path: '/gallery' },
  { key: 'collections', label: 'Коллекции', path: '/collections' },
  { key: 'moodboard', label: 'Мудборд', path: '/moodboard' },
  { key: 'board', label: 'Доска', path: '/board' }
];

export function resolveMainTab(pathname: string): MainTabKey {
  if (pathname.startsWith('/collections')) return 'collections';
  if (pathname.startsWith('/moodboard')) return 'moodboard';
  if (pathname.startsWith('/board')) return 'board';
  return 'gallery';
}

/** Полный Search Container: библиотека, коллекция, список карточек мудборда */
export function resolveNavbarVariant(pathname: string, _search = ''): NavbarVariant {
  if (pathname === '/gallery') return 'full';
  if (pathname.startsWith('/collections')) return 'full';
  if (pathname.startsWith('/moodboard')) return 'full';
  return 'compact';
}

/** L в макете ARC-2: отступ Shade/навбара от края окна (= --s-4). */
export const NAVBAR_LAYOUT_GUTTER_PX = 32;

/** Высота Top Bar (Figma 1225:11377). */
export const TOPBAR_HEIGHT_PX = 24;

/** Высота островка навбара 2.0 (padding 12 + content 32 + padding 12). */
export const NAVBAR_ISLAND_HEIGHT_PX = 56;

/** Полоса L + island + L (Figma Navbar 2.0). */
export const NAVBAR_BAND_HEIGHT_PX = NAVBAR_LAYOUT_GUTTER_PX * 2 + NAVBAR_ISLAND_HEIGHT_PX;

export function navbarPanelHeightPx(): number {
  return NAVBAR_ISLAND_HEIGHT_PX;
}

export function navbarShadeBandHeightPx(): number {
  return NAVBAR_BAND_HEIGHT_PX;
}

const NAVBAR_STACK_CSS_VARS = [
  '--arc-topbar-height',
  '--arc-navbar-stack-height',
  '--arc-navbar-shade-band-height',
  '--arc-navbar-panel-height',
  '--arc-chrome-top-height',
  '--arc-navbar-search-max-width',
  '--arc-navbar-search-expanded-width',
  '--arc-navbar-search-collapsed-width'
] as const;

const NAVBAR_SEARCH_WIDTH_CAP_PX = 1008;

/** Figma 889-9667: ширина открытого Search Bar и Search Menu. */
export const NAVBAR_SEARCH_EXPANDED_WIDTH_PX = 840;

/** Синхронизирует высоту Shade (L + island + L) и chrome stack с фактическим layout host. */
export function applyNavbarStackCssVars(hostEl: HTMLElement, islandsEl: HTMLElement | null): void {
  const panelHeight = islandsEl?.offsetHeight ?? NAVBAR_ISLAND_HEIGHT_PX;
  const bandHeight = hostEl.offsetHeight;
  const chromeTopHeight = TOPBAR_HEIGHT_PX + bandHeight;
  const root = document.body;
  root.style.setProperty('--arc-topbar-height', `${TOPBAR_HEIGHT_PX}px`);
  root.style.setProperty('--arc-navbar-panel-height', `${panelHeight}px`);
  root.style.setProperty('--arc-navbar-stack-height', `${bandHeight}px`);
  root.style.setProperty('--arc-navbar-shade-band-height', `${bandHeight}px`);
  root.style.setProperty('--arc-chrome-top-height', `${chromeTopHeight}px`);
}

export function applyTopbarCssVars(): void {
  document.body.style.setProperty('--arc-topbar-height', `${TOPBAR_HEIGHT_PX}px`);
}

export function clearNavbarStackCssVars(): void {
  for (const name of NAVBAR_STACK_CSS_VARS) {
    document.body.style.removeProperty(name);
  }
}

/** Ширина search-island в expanded: по центру, без налезания на боковые островки. */
export function applyNavbarIslandsLayoutVars(hostEl: HTMLElement | null): void {
  if (!hostEl) return;

  const islandsRow = hostEl.querySelector('.arc-navbar-islands');
  if (!islandsRow) {
    document.body.style.removeProperty('--arc-navbar-search-max-width');
    document.body.style.removeProperty('--arc-navbar-search-expanded-width');
    return;
  }

  const nav = islandsRow.querySelector('.arc-navbar-island--nav');
  const search = islandsRow.querySelector('.arc-navbar-island--search');
  const mgmt = islandsRow.querySelector('.arc-navbar-island--mgmt');
  const rowWidth = islandsRow.getBoundingClientRect().width;
  const navWidth = nav?.getBoundingClientRect().width ?? 0;
  const mgmtWidth = mgmt?.getBoundingClientRect().width ?? 0;
  const gapPx = parseFloat(getComputedStyle(islandsRow).columnGap) || 0;
  const sideClearance = Math.max(navWidth, mgmtWidth) + gapPx;
  const maxWidth = Math.min(
    NAVBAR_SEARCH_WIDTH_CAP_PX,
    Math.max(0, rowWidth - sideClearance * 2)
  );

  document.body.style.setProperty('--arc-navbar-search-max-width', `${maxWidth}px`);
  document.body.style.setProperty(
    '--arc-navbar-search-expanded-width',
    `${Math.min(NAVBAR_SEARCH_EXPANDED_WIDTH_PX, maxWidth)}px`
  );

  if (search) {
    const collapsedRaw = parseFloat(
      getComputedStyle(search).getPropertyValue('--arc-navbar-search-collapsed-width')
    );
    if (Number.isFinite(collapsedRaw) && collapsedRaw > 0) {
      const available = Math.max(0, rowWidth - navWidth - mgmtWidth - gapPx * 2);
      const clampedCollapsed = Math.min(collapsedRaw, available);
      document.body.style.setProperty('--arc-navbar-search-collapsed-width', `${clampedCollapsed}px`);
    }
  }
}
