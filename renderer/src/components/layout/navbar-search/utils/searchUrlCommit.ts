import { ARC_DETAIL_QUERY_CARD } from '../../../../search/openCardUrl';
import {
  ARC_SEARCH_QUERY_AI,
  ARC_SEARCH_QUERY_CARD,
  ARC_SEARCH_QUERY_COLOR,
  ARC_SEARCH_QUERY_COLOR_TOL,
  ARC_SEARCH_QUERY_SIMILAR,
  ARC_SEARCH_QUERY_SIMILAR_CROP,
  ARC_SEARCH_QUERY_TAG,
  setSearchColorInParams
} from '../../../../search/searchUrl';
import {
  COLOR_SEARCH_PRESETS,
  DEFAULT_COLOR_SEARCH_TOLERANCE
} from '../../../../search/colorPresets';
import type { NavbarSearchMode } from '../../../../search/navbarSearchMode';

export function setTagIdsInParams(prev: URLSearchParams, tagIds: readonly string[]): URLSearchParams {
  const next = new URLSearchParams(prev);
  next.delete(ARC_SEARCH_QUERY_TAG);
  for (const id of tagIds) {
    next.append(ARC_SEARCH_QUERY_TAG, id);
  }
  next.delete(ARC_SEARCH_QUERY_CARD);
  return next;
}

export function toggleTagIdInParams(prev: URLSearchParams, tagId: string, selectedIds: readonly string[]): URLSearchParams {
  const nextSet = new Set(selectedIds);
  if (nextSet.has(tagId)) {
    nextSet.delete(tagId);
  } else {
    nextSet.add(tagId);
  }
  return setTagIdsInParams(prev, [...nextSet]);
}

export function removeTagIdFromParams(prev: URLSearchParams, tagId: string, selectedIds: readonly string[]): URLSearchParams {
  return setTagIdsInParams(
    prev,
    selectedIds.filter((id) => id !== tagId)
  );
}

export function clearSearchQueryKeys(prev: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(prev);
  next.delete(ARC_SEARCH_QUERY_TAG);
  next.delete(ARC_SEARCH_QUERY_CARD);
  next.delete(ARC_SEARCH_QUERY_AI);
  next.delete(ARC_SEARCH_QUERY_COLOR);
  next.delete(ARC_SEARCH_QUERY_COLOR_TOL);
  next.delete(ARC_SEARCH_QUERY_SIMILAR);
  next.delete(ARC_SEARCH_QUERY_SIMILAR_CROP);
  next.delete(ARC_DETAIL_QUERY_CARD);
  return next;
}

export function buildModeChangeParams(prev: URLSearchParams, mode: NavbarSearchMode): URLSearchParams {
  const cleared = clearSearchQueryKeys(prev);
  if (mode === 'color') {
    return setSearchColorInParams(
      cleared,
      COLOR_SEARCH_PRESETS[1].hex,
      DEFAULT_COLOR_SEARCH_TOLERANCE
    );
  }
  return cleared;
}
