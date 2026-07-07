import type { CollectionRecord } from '../services/arcSchema';

export type FolderImportTargetMode = 'existing' | 'new-per-folder';

/** Правило при совпадении имени коллекции с именем папки (режим new-per-folder). */
export type CollectionNameConflictRule = 'merge' | 'suffix' | 'skip';

export type FolderImportPlan = {
  mode: FolderImportTargetMode;
  existingCollectionId?: string;
  conflictRule: CollectionNameConflictRule;
};

/** Одна папка при drop: коллекция с именем папки, при совпадении — merge. */
export const SINGLE_FOLDER_IMPORT_PLAN: FolderImportPlan = {
  mode: 'new-per-folder',
  conflictRule: 'merge'
};

export type FolderImportEntry = {
  folderPath: string;
  folderName: string;
  filePaths: string[];
};

export function folderBaseName(folderPath: string): string {
  const normalized = folderPath.replace(/\\/g, '/');
  const base = normalized.slice(normalized.lastIndexOf('/') + 1);
  return base.trim() || folderPath;
}

export function findCollectionByName(
  collections: readonly CollectionRecord[],
  name: string
): CollectionRecord | null {
  const q = name.trim().toLowerCase();
  if (!q) return null;
  return collections.find((c) => c.name.trim().toLowerCase() === q) ?? null;
}

export function nextAvailableCollectionName(
  collections: readonly CollectionRecord[],
  baseName: string
): string {
  const trimmed = baseName.trim();
  if (!trimmed) return trimmed;
  if (!findCollectionByName(collections, trimmed)) return trimmed;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${trimmed} (${i})`;
    if (!findCollectionByName(collections, candidate)) return candidate;
  }
  return `${trimmed} (${Date.now()})`;
}

export type ResolvedFolderCollection =
  | { kind: 'target'; collectionId: string; createName?: string }
  | { kind: 'skip' };

export function resolveFolderCollectionTarget(
  folderName: string,
  collections: readonly CollectionRecord[],
  plan: FolderImportPlan,
  pendingNames: ReadonlySet<string>
): ResolvedFolderCollection {
  if (plan.mode === 'existing') {
    if (!plan.existingCollectionId) return { kind: 'skip' };
    return { kind: 'target', collectionId: plan.existingCollectionId };
  }

  const existing = findCollectionByName(collections, folderName);
  const reserved = pendingNames.has(folderName.trim().toLowerCase());

  if (!existing && !reserved) {
    return { kind: 'target', collectionId: '', createName: folderName.trim() };
  }

  if (plan.conflictRule === 'skip') {
    return { kind: 'skip' };
  }

  if (plan.conflictRule === 'merge' && existing) {
    return { kind: 'target', collectionId: existing.id };
  }

  const createName = nextAvailableCollectionName(collections, folderName);
  return { kind: 'target', collectionId: '', createName };
}
