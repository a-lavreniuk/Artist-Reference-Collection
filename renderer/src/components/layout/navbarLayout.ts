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
  '--arc-navbar-panel-height'
] as const;

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
