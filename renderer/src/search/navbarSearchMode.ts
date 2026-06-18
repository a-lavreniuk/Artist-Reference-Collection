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
  {
    label: string;
    panelTitle: string;
    panelHint: string;
    placeholder: string;
    iconClass: string;
    enabled: boolean;
  }
> = {
  tags: {
    label: 'Метки',
    panelTitle: 'Поиск по категориям и меткам',
    panelHint: 'Начните вводить название метки или ID карточки',
    placeholder: 'Поиск по меткам или ID карточек…',
    iconClass: 'arc-icon-tag',
    enabled: true
  },
  ai: {
    label: 'AI Семантика',
    panelTitle: 'AI поиск',
    panelHint:
      'Опишите, что ищите, например: «Чёрная кошка». Однако поиск может допускать ошибки…',
    placeholder: 'Поисковый запрос',
    iconClass: 'arc-icon-filter-list',
    enabled: true
  },
  color: {
    label: 'По цвету',
    panelTitle: 'Поиск по цвету',
    panelHint: '',
    placeholder: 'Поиск по доминирующему цвету…',
    iconClass: 'arc-icon-filter',
    enabled: true
  },
  similar: {
    label: 'Похожие',
    panelTitle: 'Поиск по совпадениям',
    panelHint: '',
    placeholder: 'Выберите файл для поиска совпадений…',
    iconClass: 'arc-icon-image',
    enabled: true
  }
};
