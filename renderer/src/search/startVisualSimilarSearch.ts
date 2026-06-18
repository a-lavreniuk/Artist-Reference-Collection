import type { NavigateFunction } from 'react-router-dom';
import { stripOpenCardFromParams } from './openCardUrl';
import { clearGallerySearchParams } from './clearGallerySearch';
import { writeNavbarSearchMode } from './navbarSearchMode';
import { setSearchSimilarInParams } from './searchUrl';
import { clearSimilarUploadPath, FULL_SIMILAR_CROP } from './similarSearchSession';

export function buildVisualSimilarSearchParams(
  prev: URLSearchParams,
  cardId: string,
  options?: { closeDetail?: boolean }
): URLSearchParams {
  clearSimilarUploadPath();
  let base = clearGallerySearchParams(prev);
  if (options?.closeDetail !== false) {
    base = stripOpenCardFromParams(base);
  }
  return setSearchSimilarInParams(base, { kind: 'card', cardId }, FULL_SIMILAR_CROP);
}

/** Переключить navbar в «Похожие» и запустить визуальный поиск по карточке. */
export function startVisualSimilarSearch(
  navigate: NavigateFunction,
  searchParams: URLSearchParams,
  cardId: string,
  options?: { pathname?: string; closeDetail?: boolean }
): void {
  writeNavbarSearchMode('similar');
  const next = buildVisualSimilarSearchParams(searchParams, cardId, options);
  const pathname = options?.pathname ?? window.location.pathname;
  const search = next.toString();
  navigate({ pathname, search: search ? `?${search}` : '' });
}
