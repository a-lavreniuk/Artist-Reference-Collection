import { describe, expect, it } from 'vitest';
import {
  findCollectionByName,
  nextAvailableCollectionName,
  resolveFolderCollectionTarget,
  type FolderImportPlan
} from '../folderImportPlan';
import type { CollectionRecord } from '../services/arcSchema';

const collections: CollectionRecord[] = [
  { id: 'c1', name: 'Photos', createdAt: '', sortIndex: 0 },
  { id: 'c2', name: 'Refs (2)', createdAt: '', sortIndex: 1 }
];

const basePlan = (patch: Partial<FolderImportPlan>): FolderImportPlan => ({
  mode: 'new-per-folder',
  conflictRule: 'merge',
  ...patch
});

describe('folderImportPlan', () => {
  it('finds collection by case-insensitive name', () => {
    expect(findCollectionByName(collections, 'photos')?.id).toBe('c1');
  });

  it('resolves existing single target', () => {
    const result = resolveFolderCollectionTarget('Any', collections, basePlan({ mode: 'existing', existingCollectionId: 'c2' }), new Set());
    expect(result).toEqual({ kind: 'target', collectionId: 'c2' });
  });

  it('creates new collection name when no conflict', () => {
    const result = resolveFolderCollectionTarget('NewFolder', collections, basePlan({}), new Set());
    expect(result).toEqual({ kind: 'target', collectionId: '', createName: 'NewFolder' });
  });

  it('merges into existing collection on merge rule', () => {
    const result = resolveFolderCollectionTarget('Photos', collections, basePlan({ conflictRule: 'merge' }), new Set());
    expect(result).toEqual({ kind: 'target', collectionId: 'c1' });
  });

  it('skips folder on skip rule', () => {
    const result = resolveFolderCollectionTarget('Photos', collections, basePlan({ conflictRule: 'skip' }), new Set());
    expect(result).toEqual({ kind: 'skip' });
  });

  it('uses suffix for duplicate names', () => {
    const name = nextAvailableCollectionName(collections, 'Photos');
    expect(name).toBe('Photos (2)');
  });
});
