export const ARC_LIBRARY_SCOPE_PARAM = 'lib';

export type LibraryScope = 'all' | 'untagged' | 'trash';

export function parseLibraryScope(searchParams: URLSearchParams): LibraryScope {
  const raw = searchParams.get(ARC_LIBRARY_SCOPE_PARAM);
  if (raw === 'trash') return 'trash';
  // legacy lib=untagged → фильтр tagPresence в advanced filters
  return 'all';
}

export function libraryScopeLabel(scope: LibraryScope): string {
  if (scope === 'untagged') return 'Без меток';
  if (scope === 'trash') return 'Корзина';
  return 'Вся библиотека';
}

export function setLibraryScopeInParams(
  params: URLSearchParams,
  scope: LibraryScope
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (scope === 'all') next.delete(ARC_LIBRARY_SCOPE_PARAM);
  else next.set(ARC_LIBRARY_SCOPE_PARAM, scope);
  return next;
}
