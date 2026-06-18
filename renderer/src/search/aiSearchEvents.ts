export const ARC_AI_SEARCH_LOADING_EVENT = 'arc:ai-search-loading';
export const ARC_AI_SETUP_CHANGED_EVENT = 'arc:ai-setup-changed';

export function dispatchAiSearchLoading(loading: boolean): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(ARC_AI_SEARCH_LOADING_EVENT, { detail: { loading } })
  );
}

export function dispatchAiSetupChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(ARC_AI_SETUP_CHANGED_EVENT));
}
