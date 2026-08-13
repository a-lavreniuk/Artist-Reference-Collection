import { existsSync } from 'fs';
import { cp } from 'fs/promises';
import path from 'path';

import { DEFAULT_GALLERY_SORT } from './galleryFilters';
import type { GallerySortState } from './galleryFilters';
import { cardDirAbs, deleteCardFolder, readCardJson, writeCardJson } from './cardFolder';
import { withLibraryDbReadonly, withPreservedActiveDb } from './db';
import { shuffleSortKeyForId } from './shuffleOrder';
import { isInsideLibrary } from '../media/arcMediaPath';
import { readParentLibraryPathSync } from '../libraryRootConfig';
import {
  countCardsReadonly,
  deleteCardFromStorage,
  emptyTrashFromStorage,
  ensureLibraryReady,
  getCardByIdIsolated,
  importExistingCardFolder,
  listCardsFromDbReadonly,
  restoreCardFromStorage
} from './libraryStorage';
import type { CardIndexRow, ListCardsParams } from './types';

const TRASH_FETCH_CAP = 20_000;

export type LibraryTrashSource = {
  id: string;
  name: string;
  path: string;
};

export type SharedTrashCardRow = CardIndexRow & {
  libraryId: string;
  libraryName: string;
  libraryRoot: string;
};

export type RestoreTrashResult =
  | { ok: true }
  | { ok: false; error: 'origin-missing' | 'files-unavailable' | 'id-conflict' | string };

function compareSharedTrashRows(
  a: SharedTrashCardRow,
  b: SharedTrashCardRow,
  sort: GallerySortState
): number {
  const dir = sort.direction === 'asc' ? 1 : -1;
  const byAddedDesc = b.addedAt.localeCompare(a.addedAt);
  switch (sort.field) {
    case 'fileType': {
      const t = a.type.localeCompare(b.type) || (a.format ?? '').localeCompare(b.format ?? '');
      return t !== 0 ? t * dir : byAddedDesc;
    }
    case 'fileWeight': {
      const t = (a.fileSize ?? 0) - (b.fileSize ?? 0);
      return t !== 0 ? t * dir : byAddedDesc;
    }
    case 'resolution': {
      const longA = Math.max(a.width ?? 0, a.height ?? 0);
      const longB = Math.max(b.width ?? 0, b.height ?? 0);
      const t = longA - longB;
      return t !== 0 ? t * dir : byAddedDesc;
    }
    case 'duration': {
      const t = (a.durationMs ?? 0) - (b.durationMs ?? 0);
      return t !== 0 ? t * dir : byAddedDesc;
    }
    case 'rating': {
      const t = (a.rating ?? 0) - (b.rating ?? 0);
      return t !== 0 ? t * dir : byAddedDesc;
    }
    case 'shuffle': {
      const seed = sort.shuffleSeed ?? 0;
      return shuffleSortKeyForId(a.id, seed) - shuffleSortKeyForId(b.id, seed);
    }
    case 'addedAt':
    default:
      return a.addedAt.localeCompare(b.addedAt) * dir;
  }
}

export function listSharedTrashCards(
  libraries: readonly LibraryTrashSource[],
  params: ListCardsParams
): SharedTrashCardRow[] {
  const sort = params.sort ?? DEFAULT_GALLERY_SORT;
  const merged: SharedTrashCardRow[] = [];
  for (const lib of libraries) {
    if (!existsSync(lib.path)) continue;
    const rows = listCardsFromDbReadonly(lib.path, {
      ...params,
      libraryScope: 'trash',
      offset: 0,
      limit: TRASH_FETCH_CAP
    });
    for (const row of rows) {
      merged.push({
        ...row,
        libraryId: lib.id,
        libraryName: lib.name,
        libraryRoot: lib.path
      });
    }
  }
  merged.sort((a, b) => compareSharedTrashRows(a, b, sort));
  const offset = Math.max(0, params.offset);
  const limit = Math.max(0, params.limit);
  return merged.slice(offset, offset + limit);
}

export function countSharedTrashCards(
  libraries: readonly LibraryTrashSource[],
  filter: 'all' | 'images' | 'videos' = 'all'
): number {
  let n = 0;
  for (const lib of libraries) {
    if (!existsSync(lib.path)) continue;
    n += countCardsReadonly(lib.path, filter, 'trash');
  }
  return n;
}

export async function emptySharedTrash(libraries: readonly LibraryTrashSource[]): Promise<number> {
  return withPreservedActiveDb(async () => {
    let n = 0;
    for (const lib of libraries) {
      if (!existsSync(lib.path)) continue;
      n += await emptyTrashFromStorage(lib.path);
    }
    return n;
  });
}

function isSameLibraryPath(a: string, b: string): boolean {
  return path.resolve(a) === path.resolve(b);
}

function isAllowedTrashSourceRoot(
  sourceRoot: string,
  libraries: readonly LibraryTrashSource[]
): boolean {
  const resolved = path.resolve(sourceRoot);
  if (libraries.some((lib) => isSameLibraryPath(lib.path, resolved))) return true;
  const parent = readParentLibraryPathSync();
  if (!parent) return false;
  return isInsideLibrary(parent, resolved);
}

function isTrashedAtRoot(sourceRoot: string, cardId: string, deletedAt?: string): boolean {
  const flagged = withLibraryDbReadonly(sourceRoot, (db) => {
    const row = db.prepare('SELECT is_deleted FROM cards WHERE id = ?').get(cardId) as
      | { is_deleted?: number }
      | undefined;
    return row?.is_deleted === 1;
  });
  if (flagged === true) return true;
  if (flagged === false) return false;
  return Boolean(deletedAt);
}

export function resolveLibrarySource(
  libraries: readonly LibraryTrashSource[],
  libraryId: string | undefined
): LibraryTrashSource | null {
  if (!libraryId) return null;
  return libraries.find((lib) => lib.id === libraryId) ?? null;
}

export function findCardAcrossLibraries(
  libraries: readonly LibraryTrashSource[],
  cardId: string
): { row: CardIndexRow; library: LibraryTrashSource } | null {
  for (const lib of libraries) {
    if (!existsSync(lib.path)) continue;
    const row = getCardByIdIsolated(lib.path, cardId);
    if (row) return { row, library: lib };
  }
  return null;
}

async function relocateTrashedCardToLibrary(options: {
  cardId: string;
  sourceRoot: string;
  dest: LibraryTrashSource;
}): Promise<RestoreTrashResult> {
  const { cardId, sourceRoot, dest } = options;
  const sourceDir = cardDirAbs(sourceRoot, cardId);
  if (!existsSync(sourceDir)) {
    return { ok: false, error: 'files-unavailable' };
  }
  const destExisting = getCardByIdIsolated(dest.path, cardId);
  if (destExisting) {
    return { ok: false, error: 'id-conflict' };
  }

  const cardJson = await readCardJson(sourceRoot, cardId);
  if (!cardJson) {
    return { ok: false, error: 'files-unavailable' };
  }
  const sourceRow = getCardByIdIsolated(sourceRoot, cardId);
  const destDir = cardDirAbs(dest.path, cardId);

  try {
    await withPreservedActiveDb(async () => {
      await ensureLibraryReady(dest.path);
    });
    await cp(sourceDir, destDir, { recursive: true });
    const modified = new Date().toISOString();
    delete cardJson.deletedAt;
    cardJson.dateModified = modified;
    await writeCardJson(dest.path, cardJson);
    await withPreservedActiveDb(async () => {
      await importExistingCardFolder(dest.path, cardJson, sourceRow);
    });
  } catch (err) {
    try {
      await deleteCardFolder(dest.path, cardId);
    } catch {
      /* ignore rollback */
    }
    if (err instanceof Error && err.message.includes('уже есть')) {
      return { ok: false, error: 'id-conflict' };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Не удалось восстановить карточку'
    };
  }

  try {
    await withPreservedActiveDb(async () => {
      await deleteCardFromStorage(sourceRoot, cardId);
    });
  } catch {
    try {
      await deleteCardFolder(sourceRoot, cardId);
    } catch {
      /* dest copy is enough */
    }
  }
  return { ok: true };
}

export async function restoreSharedTrashCard(options: {
  cardId: string;
  libraryId?: string;
  sourceLibraryRoot?: string;
  destinationLibraryId?: string;
  libraries: readonly LibraryTrashSource[];
}): Promise<RestoreTrashResult> {
  const origin = resolveLibrarySource(options.libraries, options.libraryId);
  if (origin) {
    await withPreservedActiveDb(async () => {
      await restoreCardFromStorage(origin.path, options.cardId);
    });
    return { ok: true };
  }

  if (!options.libraryId || !options.destinationLibraryId) {
    return { ok: false, error: 'origin-missing' };
  }

  const dest = resolveLibrarySource(options.libraries, options.destinationLibraryId);
  if (!dest) {
    return { ok: false, error: 'origin-missing' };
  }

  const sourceRoot =
    options.sourceLibraryRoot && existsSync(options.sourceLibraryRoot)
      ? path.resolve(options.sourceLibraryRoot)
      : null;
  if (!sourceRoot || !isAllowedTrashSourceRoot(sourceRoot, options.libraries)) {
    return { ok: false, error: 'files-unavailable' };
  }

  const listedSource = options.libraries.find((lib) => isSameLibraryPath(lib.path, sourceRoot));
  if (listedSource) {
    await withPreservedActiveDb(async () => {
      await restoreCardFromStorage(listedSource.path, options.cardId);
    });
    return { ok: true };
  }

  const cardJson = await readCardJson(sourceRoot, options.cardId);
  if (!cardJson || !isTrashedAtRoot(sourceRoot, options.cardId, cardJson.deletedAt)) {
    return { ok: false, error: 'files-unavailable' };
  }

  return relocateTrashedCardToLibrary({
    cardId: options.cardId,
    sourceRoot,
    dest
  });
}

export async function permanentDeleteSharedTrashCard(
  libraries: readonly LibraryTrashSource[],
  cardId: string,
  libraryId?: string
): Promise<void> {
  const origin =
    resolveLibrarySource(libraries, libraryId) ??
    findCardAcrossLibraries(libraries, cardId)?.library ??
    null;
  if (!origin) return;
  await withPreservedActiveDb(async () => {
    await deleteCardFromStorage(origin.path, cardId);
  });
}
