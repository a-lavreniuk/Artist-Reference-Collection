export type NavbarVariant = 'full' | 'compact';

export type MainTabKey = 'gallery' | 'collections' | 'moodboard';

export const MAIN_NAV_TABS: ReadonlyArray<{ key: MainTabKey; label: string; path: string }> = [
  { key: 'gallery', label: 'Библиотека', path: '/gallery' },
  { key: 'collections', label: 'Коллекции', path: '/collections' },
  { key: 'moodboard', label: 'Мудборд', path: '/moodboard' }
];

export function resolveMainTab(pathname: string): MainTabKey {
  if (pathname.startsWith('/collections')) return 'collections';
  if (pathname.startsWith('/moodboard')) return 'moodboard';
  return 'gallery';
}

/** Полный Search Container только на списке библиотеки */
export function resolveNavbarVariant(pathname: string): NavbarVariant {
  if (pathname === '/gallery') return 'full';
  return 'compact';
}

/** L в макете ARC-2: отступ Shade/навбара от края окна (= --s-4). */
export const NAVBAR_LAYOUT_GUTTER_PX = 32;

export function navbarPanelHeightPx(filtersOpen: boolean, variant: NavbarVariant): number {
  if (variant === 'full' && filtersOpen) return 128;
  return 72;
}

/** Высота полосы Shade: L + panel + L (см. Figma 844:23306, 1112:3702). */
export function navbarShadeBandHeightFromPanelPx(panelHeightPx: number): number {
  return NAVBAR_LAYOUT_GUTTER_PX * 2 + panelHeightPx;
}

export function navbarShadeBandHeightPx(filtersOpen: boolean, variant: NavbarVariant): number {
  return navbarShadeBandHeightFromPanelPx(navbarPanelHeightPx(filtersOpen, variant));
}

const NAVBAR_STACK_CSS_VARS = [
  '--arc-navbar-stack-height',
  '--arc-navbar-shade-band-height',
  '--arc-navbar-panel-height',
  '--arc-navbar-search-max-width'
] as const;

const NAVBAR_SEARCH_WIDTH_CAP_PX = 1008;

/** Синхронизирует высоту Shade (L + panel + L) с фактическим layout host. */
export function applyNavbarStackCssVars(hostEl: HTMLElement, headerEl: HTMLElement | null): void {
  const panelHeight = headerEl?.offsetHeight ?? 0;
  const bandHeight = hostEl.offsetHeight;
  const root = document.body;
  root.style.setProperty('--arc-navbar-panel-height', `${panelHeight}px`);
  root.style.setProperty('--arc-navbar-stack-height', `${bandHeight}px`);
  root.style.setProperty('--arc-navbar-shade-band-height', `${bandHeight}px`);
}

export function clearNavbarStackCssVars(): void {
  for (const name of NAVBAR_STACK_CSS_VARS) {
    document.body.style.removeProperty(name);
  }
}

/** Ширина search-bar: по центру панели, без налезания на nav/mgmt при узком окне. */
export function applyNavbarTopBarLayoutVars(headerEl: HTMLElement | null): void {
  if (!headerEl) return;

  const topBar = headerEl.querySelector('.arc-navbar-top-bar');
  if (!topBar) return;

  const search = topBar.querySelector(
    '.arc-navbar-top-bar__search:not(.arc-navbar-top-bar__search--spacer)'
  );
  if (!search) {
    document.body.style.removeProperty('--arc-navbar-search-max-width');
    return;
  }

  const nav = topBar.querySelector('.arc-navbar-top-bar__nav');
  const mgmt = topBar.querySelector('.arc-navbar-top-bar__mgmt');
  const topBarWidth = topBar.getBoundingClientRect().width;
  const navWidth = nav?.getBoundingClientRect().width ?? 0;
  const mgmtWidth = mgmt?.getBoundingClientRect().width ?? 0;
  const gapPx = parseFloat(getComputedStyle(topBar).columnGap) || 0;
  const sideClearance = Math.max(navWidth, mgmtWidth) + gapPx;
  const maxWidth = Math.min(
    NAVBAR_SEARCH_WIDTH_CAP_PX,
    Math.max(0, topBarWidth - sideClearance * 2)
  );

  document.body.style.setProperty('--arc-navbar-search-max-width', `${maxWidth}px`);
}
