export type NavbarSearchMode = 'tags' | 'ai' | 'color' | 'similar';

export const ARC_NAVBAR_SEARCH_MODE_CHANGED_EVENT = 'arc:navbar-search-mode-changed';

const STORAGE_KEY = 'arc-navbar-search-mode';

export function readNavbarSearchMode(): NavbarSearchMode {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw === 'ai' || raw === 'color' || raw === 'similar' || raw === 'tags') return raw;
  } catch {
    /* ignore */
  }
  return 'tags';
}

export function writeNavbarSearchMode(mode: NavbarSearchMode): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(
    new CustomEvent(ARC_NAVBAR_SEARCH_MODE_CHANGED_EVENT, { detail: { mode } })
  );
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
    iconClass: 'arc-icon-ai',
    enabled: true
  },
  color: {
    label: 'По цвету',
    panelTitle: 'Поиск по цвету',
    panelHint: 'Задайте доминирующий цвет — найдём карточки с похожей палитрой',
    placeholder: 'Поиск по доминирующему цвету…',
    iconClass: 'arc-icon-eyedropper',
    enabled: true
  },
  similar: {
    label: 'Похожие',
    panelTitle: 'Поиск по совпадениям',
    panelHint: 'Загрузите изображение или выберите карточку из недавних просмотров',
    placeholder: 'Выберите файл для поиска совпадений…',
    iconClass: 'arc-icon-image',
    enabled: true
  }
};

export function getLongestSearchPlaceholder(): string {
  return Object.values(SEARCH_MODE_META)
    .filter((meta) => meta.enabled)
    .map((meta) => meta.placeholder)
    .reduce((longest, current) => (current.length > longest.length ? current : longest), '');
}
