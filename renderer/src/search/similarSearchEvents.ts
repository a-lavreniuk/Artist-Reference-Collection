export const ARC_SIMILAR_SEARCH_LOADING_EVENT = 'arc:similar-search-loading';

export function dispatchSimilarSearchLoading(loading: boolean): void {
  window.dispatchEvent(
    new CustomEvent(ARC_SIMILAR_SEARCH_LOADING_EVENT, { detail: { loading } })
  );
}
