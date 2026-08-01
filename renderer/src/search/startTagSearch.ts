import type { NavigateFunction } from 'react-router-dom';
import { clearGallerySearchParams } from './clearGallerySearch';
import { stripOpenCardFromParams } from './openCardUrl';
import { writeNavbarSearchMode } from './navbarSearchMode';
import { setSearchTagsInParams } from './searchUrl';
import { clearSimilarUploadPath } from './similarSearchSession';

export type TagSearchLaunchOptions = {
  pathname?: string;
  closeDetail?: boolean;
};

export function buildTagSearchParams(
  prev: URLSearchParams,
  tagIds: string | string[],
  options?: { closeDetail?: boolean }
): URLSearchParams {
  const ids = (Array.isArray(tagIds) ? tagIds : [tagIds]).filter((id) => id.trim().length > 0);
  clearSimilarUploadPath();
  let base = clearGallerySearchParams(prev);
  if (options?.closeDetail !== false) {
    base = stripOpenCardFromParams(base);
  }
  return setSearchTagsInParams(base, ids);
}

function navigateWithSearchParams(
  navigate: NavigateFunction,
  next: URLSearchParams,
  options?: TagSearchLaunchOptions
): void {
  const search = next.toString();
  const suffix = search ? `?${search}` : '';
  if (options?.pathname) {
    navigate({ pathname: options.pathname, search: suffix });
    return;
  }
  navigate({ search: suffix });
}

/** Переключить navbar в «Метки» и запустить поиск по выбранным id. */
export function startTagSearch(
  navigate: NavigateFunction,
  searchParams: URLSearchParams,
  tagIds: string | string[],
  options?: TagSearchLaunchOptions
): void {
  const ids = (Array.isArray(tagIds) ? tagIds : [tagIds]).filter((id) => id.trim().length > 0);
  if (ids.length === 0) return;
  writeNavbarSearchMode('tags');
  const next = buildTagSearchParams(searchParams, ids, options);
  navigateWithSearchParams(navigate, next, options);
}
