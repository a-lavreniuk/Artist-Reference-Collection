export type NavbarSearchMode = 'tags' | 'ai' | 'color' | 'similar';

const STORAGE_KEY = 'arc-navbar-search-mode';

export function readNavbarSearchMode(): NavbarSearchMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'ai' || raw === 'color' || raw === 'similar' || raw === 'tags') return raw;
  } catch {
    /* ignore */
  }
  return 'tags';
}

export function writeNavbarSearchMode(mode: NavbarSearchMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export const SEARCH_MODE_META: Record<
  NavbarSearchMode,
  { label: string; placeholder: string; iconClass: string; enabled: boolean }
> = {
  tags: {
    label: 'Метки',
    placeholder: 'Поиск по меткам или ID карточек…',
    iconClass: 'arc-icon-tag',
    enabled: true
  },
  ai: {
    label: 'AI Семантика',
    placeholder: 'Опишите что ищете…',
    iconClass: 'arc-icon-filter-list',
    enabled: true
  },
  color: {
    label: 'По цвету',
    placeholder: 'Поиск по доминирующему цвету…',
    iconClass: 'arc-icon-filter',
    enabled: false
  },
  similar: {
    label: 'Похожие',
    placeholder: 'Поиск по совпадениям…',
    iconClass: 'arc-icon-image',
    enabled: false
  }
};
