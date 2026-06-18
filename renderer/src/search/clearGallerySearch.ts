import {
  ARC_SEARCH_QUERY_AI,
  ARC_SEARCH_QUERY_CARD,
  ARC_SEARCH_QUERY_COLOR,
  ARC_SEARCH_QUERY_COLOR_TOL,
  ARC_SEARCH_QUERY_SIMILAR,
  ARC_SEARCH_QUERY_SIMILAR_CROP,
  ARC_SEARCH_QUERY_TAG
} from './searchUrl';

export function clearGallerySearchParams(prev: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(prev);
  next.delete(ARC_SEARCH_QUERY_TAG);
  next.delete(ARC_SEARCH_QUERY_CARD);
  next.delete(ARC_SEARCH_QUERY_AI);
  next.delete(ARC_SEARCH_QUERY_COLOR);
  next.delete(ARC_SEARCH_QUERY_COLOR_TOL);
  next.delete(ARC_SEARCH_QUERY_SIMILAR);
  next.delete(ARC_SEARCH_QUERY_SIMILAR_CROP);
  return next;
}
