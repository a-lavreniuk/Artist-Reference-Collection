import { isContextMenuOpen, isEditableTarget } from '../shortcuts/shortcutGuards';

import { parseCollectionsPath } from '@arc-main-shared/collectionHierarchy';

/** Коллекция или раздел открытого экрана `/collections/...`, иначе null. */
export function collectionIdFromPathname(pathname: string): string | null {
  const parsed = parseCollectionsPath(pathname);
  if (!parsed) return null;
  return parsed.sectionId ?? parsed.collectionId;
}

/** Пути из clipboard DataTransfer; при bitmap-вставке `files` часто отсутствует. */
export function droppedPathsFromClipboard(
  getPaths: ((dt: DataTransfer) => string[]) | undefined,
  dt: DataTransfer | null
): string[] {
  if (!dt || !getPaths) return [];
  try {
    const paths = getPaths(dt);
    return Array.isArray(paths) ? paths.filter((p) => typeof p === 'string' && p.trim()) : [];
  } catch {
    return [];
  }
}

/** Вставка в библиотеку не должна перехватывать ввод, модалки и деталку. */
export function isPasteImportBlocked(event: ClipboardEvent): boolean {
  if (isEditableTarget(event.target)) return true;
  if (isContextMenuOpen()) return true;
  if (document.body.classList.contains('arc-card-detail-open')) return true;
  if (document.body.classList.contains('arc-similar-search-panel-open')) return true;
  if (document.querySelector('.arc-modal-host')) return true;
  return false;
}
