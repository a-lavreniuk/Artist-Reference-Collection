import {
  ARC_SEARCH_QUERY_AI,
  ARC_SEARCH_QUERY_CARD,
  ARC_SEARCH_QUERY_TAG
} from './searchUrl';

export function clearGallerySearchParams(prev: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(prev);
  next.delete(ARC_SEARCH_QUERY_TAG);
  next.delete(ARC_SEARCH_QUERY_CARD);
  next.delete(ARC_SEARCH_QUERY_AI);
  return next;
}
