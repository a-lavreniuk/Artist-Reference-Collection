import type { NavigateFunction } from 'react-router-dom';
import { DEFAULT_COLOR_SEARCH_TOLERANCE } from './colorPresets';
import { clearGallerySearchParams } from './clearGallerySearch';
import { stripOpenCardFromParams } from './openCardUrl';
import { writeNavbarSearchMode } from './navbarSearchMode';
import { setSearchColorInParams } from './searchUrl';
import { clearSimilarUploadPath } from './similarSearchSession';

export const ARC_START_COLOR_SEARCH_EVENT = 'arc:start-color-search';

export type StartColorSearchDetail = {
  hex: string;
  tolerance: number;
};

export type ColorSearchLaunchOptions = {
  pathname?: string;
  closeDetail?: boolean;
  tolerance?: number;
  replace?: boolean;
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
  const navOpts = { replace: options?.replace ?? true };
  if (options?.pathname) {
    navigate({ pathname: options.pathname, search: suffix }, navOpts);
    return;
  }
  navigate({ search: suffix }, navOpts);
}

function dispatchStartColorSearch(hex: string, tolerance: number): void {
  window.dispatchEvent(
    new CustomEvent<StartColorSearchDetail>(ARC_START_COLOR_SEARCH_EVENT, {
      detail: { hex, tolerance }
    })
  );
}

/** Переключить navbar в «Цвет» и запустить поиск по выбранному HEX. */
export function startColorSearch(
  navigate: NavigateFunction,
  searchParams: URLSearchParams,
  hex: string,
  options?: ColorSearchLaunchOptions
): void {
  const tolerance = options?.tolerance ?? DEFAULT_COLOR_SEARCH_TOLERANCE;
  const next = buildColorSearchParams(searchParams, hex, options);
  // Режим → URL → событие (провайдер дублирует color= и обновляет панель).
  writeNavbarSearchMode('color');
  navigateWithSearchParams(navigate, next, options);
  dispatchStartColorSearch(hex, tolerance);
}