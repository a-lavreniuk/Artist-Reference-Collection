import type { NavigateFunction } from 'react-router-dom';
import { getCardById } from '../services/db';
import { stripOpenCardFromParams } from './openCardUrl';
import { clearGallerySearchParams } from './clearGallerySearch';
import { writeNavbarSearchMode } from './navbarSearchMode';
import { setSearchSimilarInParams, setSearchTagsInParams } from './searchUrl';
import { clearSimilarUploadPath, FULL_SIMILAR_CROP } from './similarSearchSession';
import { maybeShowTagSimilarAiHint } from './tagSimilarAiHint';

export type FindSimilarSearchOptions = {
  pathname?: string;
  closeDetail?: boolean;
};

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

function buildTagSimilarSearchParams(
  prev: URLSearchParams,
  tagIds: string[],
  options?: { closeDetail?: boolean }
): URLSearchParams {
  clearSimilarUploadPath();
  let base = clearGallerySearchParams(prev);
  if (options?.closeDetail !== false) {
    base = stripOpenCardFromParams(base);
  }
  return setSearchTagsInParams(base, tagIds);
}

function navigateWithSearchParams(
  navigate: NavigateFunction,
  next: URLSearchParams,
  options?: FindSimilarSearchOptions
): void {
  const search = next.toString();
  const suffix = search ? `?${search}` : '';
  if (options?.pathname) {
    navigate({ pathname: options.pathname, search: suffix });
    return;
  }
  navigate({ search: suffix });
}

/** Включён ли AI-поиск в настройках (без проверки установки модели). */
export async function isAiSemanticSearchEnabled(): Promise<boolean> {
  const arc = window.arc;
  if (!arc?.aiGetStatus) return false;
  try {
    const status = await arc.aiGetStatus();
    return Boolean(status.enabled);
  } catch {
    return false;
  }
}

/** Переключить navbar в «Похожие» и запустить визуальный поиск по карточке. */
export function startVisualSimilarSearch(
  navigate: NavigateFunction,
  searchParams: URLSearchParams,
  cardId: string,
  options?: FindSimilarSearchOptions
): void {
  writeNavbarSearchMode('similar');
  const next = buildVisualSimilarSearchParams(searchParams, cardId, options);
  navigateWithSearchParams(navigate, next, options);
}

/** Фильтр ленты по меткам выбранной карточки (режим «Метки» в navbar). */
export async function startTagSimilarSearch(
  navigate: NavigateFunction,
  searchParams: URLSearchParams,
  cardId: string,
  options?: FindSimilarSearchOptions
): Promise<void> {
  const card = await getCardById(cardId);
  if (!card) return;
  writeNavbarSearchMode('tags');
  const next = buildTagSimilarSearchParams(searchParams, card.tagIds, options);
  navigateWithSearchParams(navigate, next, options);
  maybeShowTagSimilarAiHint();
}

/**
 * «Найти похожее»: визуальный AI-поиск при включённом AI в настройках,
 * иначе — фильтр ленты по меткам карточки.
 */
export async function startFindSimilarSearch(
  navigate: NavigateFunction,
  searchParams: URLSearchParams,
  cardId: string,
  options?: FindSimilarSearchOptions
): Promise<void> {
  if (await isAiSemanticSearchEnabled()) {
    startVisualSimilarSearch(navigate, searchParams, cardId, options);
    return;
  }
  await startTagSimilarSearch(navigate, searchParams, cardId, options);
}
