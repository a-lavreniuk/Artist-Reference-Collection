import { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { parseCollectionsPath } from '@arc-main-shared/collectionHierarchy';
import { parseDetailCardId } from '../search/openCardUrl';
import { libraryScopeLabel, parseLibraryScope } from '../search/libraryScopeUrl';
import { ARC_COLLECTIONS_CHANGED_EVENT, getAllCollections, type CollectionRecord } from '../services/db';

const SETTINGS_TITLES: Record<string, string> = {
  '/settings/general': 'Общие',
  '/settings/detail-template': 'Шаблон деталки',
  '/settings/screenshots': 'Скриншоты',
  '/settings/notifications': 'Уведомления',
  '/settings/shortcuts': 'Горячие клавиши',
  '/settings/library': 'Библиотека',
  '/settings/auto-import': 'Автоимпорт',
  '/settings/browser-extension': 'Расширение браузера',
  '/settings/mcp-server': 'MCP сервер',
  '/settings/ai': 'AI',
  '/settings/ai-search': 'AI',
  '/settings/auto-tag': 'AI',
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

function collectionsChromeTitle(pathname: string, collections: CollectionRecord[]): string | null {
  const parsed = parseCollectionsPath(pathname);
  if (!parsed) return null;
  const parent = collections.find((item) => item.id === parsed.collectionId);
  if (!parent) return 'Коллекции';
  if (!parsed.sectionId) return parent.name;
  const section = collections.find((item) => item.id === parsed.sectionId);
  if (!section) return parent.name;
  return `${parent.name} / ${section.name}`;
}

export function resolveChromeTitle(
  pathname: string,
  search: string,
  collections: CollectionRecord[] = []
): string {
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

  if (pathname.startsWith('/collections')) {
    return collectionsChromeTitle(pathname, collections) ?? 'Коллекции';
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
  const [collections, setCollections] = useState<CollectionRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void getAllCollections().then((list) => {
        if (!cancelled) setCollections(list);
      });
    };
    load();
    window.addEventListener(ARC_COLLECTIONS_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(ARC_COLLECTIONS_CHANGED_EVENT, load);
    };
  }, []);

  return useMemo(
    () => resolveChromeTitle(location.pathname, searchParams.toString(), collections),
    [location.pathname, searchParams, collections]
  );
}
