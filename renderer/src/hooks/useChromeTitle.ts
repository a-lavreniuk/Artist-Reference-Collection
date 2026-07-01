import { useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { parseDetailCardId } from '../search/openCardUrl';
import { libraryScopeLabel, parseLibraryScope } from '../search/libraryScopeUrl';

const SETTINGS_TITLES: Record<string, string> = {
  '/settings/general': 'Общие',
  '/settings/screenshots': 'Скриншоты',
  '/settings/notifications': 'Уведомления',
  '/settings/shortcuts': 'Горячие клавиши',
  '/settings/library': 'Библиотека',
  '/settings/backup': 'Резервная копия',
  '/settings/integrity': 'Проверка целостности',
  '/settings/auto-import': 'Автоимпорт',
  '/settings/browser-extension': 'Расширение браузера',
  '/settings/ai-search': 'AI Поиск',
  '/settings/updates': 'Обновления',
  '/settings/ui-kit': 'UI-Kit'
};

const PAGE_TITLES: Record<string, string> = {
  '/gallery': 'Вся библиотека',
  '/collections': 'Коллекции',
  '/moodboard': 'Мудборд',
  '/board': 'Доска',
  '/tags': 'Категории и метки',
  '/statistics': 'Статистика',
  '/history': 'История',
  '/duplicates': 'Поиск дублей',
  '/ui-kit': 'UI-Kit'
};

function shortCardLabel(cardId: string): string {
  const compact = cardId.replace(/-/g, '').slice(0, 8);
  return compact || cardId.slice(0, 8);
}

export function resolveChromeTitle(pathname: string, search: string): string {
  const detailId = parseDetailCardId(new URLSearchParams(search));
  if (detailId) {
    return `Карточка +${shortCardLabel(detailId)}`;
  }

  if (pathname === '/gallery' || pathname.startsWith('/gallery')) {
    const scope = parseLibraryScope(new URLSearchParams(search));
    return libraryScopeLabel(scope);
  }

  if (pathname.startsWith('/settings')) {
    const exact = SETTINGS_TITLES[pathname];
    if (exact) return exact;
    return 'Настройки';
  }

  for (const [path, title] of Object.entries(PAGE_TITLES)) {
    if (pathname === path || pathname.startsWith(`${path}/`)) {
      return title;
    }
  }

  return 'ARC';
}

export function useChromeTitle(): string {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  return useMemo(
    () => resolveChromeTitle(location.pathname, searchParams.toString()),
    [location.pathname, searchParams]
  );
}
