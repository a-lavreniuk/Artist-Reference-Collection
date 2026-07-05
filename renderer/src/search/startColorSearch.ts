import type { NavigateFunction } from 'react-router-dom';
import { DEFAULT_COLOR_SEARCH_TOLERANCE } from './colorPresets';
import { clearGallerySearchParams } from './clearGallerySearch';
import { stripOpenCardFromParams } from './openCardUrl';
import { writeNavbarSearchMode } from './navbarSearchMode';
import { setSearchColorInParams } from './searchUrl';
import { clearSimilarUploadPath } from './similarSearchSession';

export type ColorSearchLaunchOptions = {
  pathname?: string;
  closeDetail?: boolean;
  tolerance?: number;
};

export function buildColorSearchParams(
  prev: URLSearchParams,
  hex: string,
  options?: { closeDetail?: boolean; tolerance?: number }
): URLSearchParams {
  clearSimilarUploadPath();
  let base = clearGallerySearchParams(prev);
  if (options?.closeDetail !== false) {
    base = stripOpenCardFromParams(base);
  }
  return setSearchColorInParams(
    base,
    hex,
    options?.tolerance ?? DEFAULT_COLOR_SEARCH_TOLERANCE
  );
}

function navigateWithSearchParams(
  navigate: NavigateFunction,
  next: URLSearchParams,
  options?: ColorSearchLaunchOptions
): void {
  const search = next.toString();
  const suffix = search ? `?${search}` : '';
  if (options?.pathname) {
    navigate({ pathname: options.pathname, search: suffix });
    return;
  }
  navigate({ search: suffix });
}

/** Переключить navbar в «Цвет» и запустить поиск по выбранному HEX. */
export function startColorSearch(
  navigate: NavigateFunction,
  searchParams: URLSearchParams,
  hex: string,
  options?: ColorSearchLaunchOptions
): void {
  writeNavbarSearchMode('color');
  const next = buildColorSearchParams(searchParams, hex, options);
  navigateWithSearchParams(navigate, next, options);
}
