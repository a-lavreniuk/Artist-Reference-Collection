export const ARC_FOCUS_SEARCH_REQUEST_EVENT = 'arc:focus-search-request';

export function requestNavbarSearchFocus(): void {
  window.dispatchEvent(new CustomEvent(ARC_FOCUS_SEARCH_REQUEST_EVENT));
}
