import { mkdtemp, mkdir, readFile, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getPath: () => os.tmpdir(),
    getVersion: () => '0.0.0-test'
  }
}));

import { pairKey, scopedPairKey } from '../duplicateMatch';
import {
  collectDuplicatePairsFromIndex,
  type DuplicateScanIndexItem
} from '../duplicateScanPairs';
import {
  addCrossSkippedPair,
  crossSkippedFilePath,
  loadCrossSkippedPairKeys
} from '../storage/containerSkippedDuplicates';
import {
  clearDestructiveConfirms,
  consumeDestructiveConfirm,
  issueDestructiveConfirm
} from '../destructiveConfirm';

function item(
  override: Partial<DuplicateScanIndexItem> & Pick<DuplicateScanIndexItem, 'libraryId' | 'id'>
): DuplicateScanIndexItem {
  return {
    libraryName: override.libraryId,
    libraryRoot: `/lib/${override.libraryId}`,
    type: 'image',
    originalAbs: `/lib/${override.libraryId}/${override.id}.jpg`,
    phash: null,
    sha256: null,
    fileSize: 100,
    ...override
  };
}

const samePhash = {
  rotHashes: ['aaaaaaaa', 'bbbbbbbb', 'cccccccc', 'dddddddd'] as [string, string, string, string],
  hist: [0.25, 0.25, 0.25, 0.25]
};

describe('scopedPairKey', () => {
  it('is order-independent across libraries', () => {
    expect(scopedPairKey('lib-a', 'c1', 'lib-b', 'c2')).toBe(scopedPairKey('lib-b', 'c2', 'lib-a', 'c1'));
    expect(scopedPairKey('lib-a', 'c1', 'lib-b', 'c2')).not.toBe(scopedPairKey('lib-a', 'c2', 'lib-b', 'c1'));
  });
});

describe('collectDuplicatePairsFromIndex', () => {
  it('finds exact SHA pairs across libraries and intra pairs in a mixed list', () => {
    const index = [
      item({ libraryId: 'a', libraryName: 'Alpha', id: 'c1', sha256: 'same-hash' }),
      item({ libraryId: 'b', libraryName: 'Beta', id: 'c2', sha256: 'same-hash' }),
      item({ libraryId: 'a', libraryName: 'Alpha', id: 'c3', sha256: 'same-hash' })
    ];
    const pairs = collectDuplicatePairsFromIndex(index, 85, () => false);
    expect(pairs).toHaveLength(3);

    const cross = pairs.find((p) => p.libraryIdA !== p.libraryIdB);
    expect(cross).toMatchObject({ matchKind: 'exact', similarity: 100 });
    expect([cross?.libraryNameA, cross?.libraryNameB].sort()).toEqual(['Alpha', 'Beta']);

    const intra = pairs.find((p) => p.libraryIdA === 'a' && p.libraryIdB === 'a');
    expect(intra).toBeTruthy();
  });

  it('does not look at another library when the index is current-scope only', () => {
    const index = [
      item({ libraryId: 'a', id: 'c1', sha256: 'same-hash' }),
      item({ libraryId: 'a', id: 'c2', sha256: 'other' })
    ];
    const pairs = collectDuplicatePairsFromIndex(index, 85, () => false);
    expect(pairs).toHaveLength(0);
  });

  it('skips intra pairs by card id key and cross pairs by scoped key', () => {
    const a = item({ libraryId: 'a', id: 'c1', sha256: 'same-hash' });
    const bSameLib = item({ libraryId: 'a', id: 'c2', sha256: 'same-hash' });
    const bOther = item({ libraryId: 'b', id: 'c3', sha256: 'same-hash' });
    const intraSkip = new Set([pairKey('c1', 'c2')]);
    const crossSkip = new Set([scopedPairKey('a', 'c1', 'b', 'c3')]);

    const pairs = collectDuplicatePairsFromIndex([a, bSameLib, bOther], 85, (left, right) => {
      if (left.libraryId === right.libraryId) {
        return intraSkip.has(pairKey(left.id, right.id));
      }
      return crossSkip.has(scopedPairKey(left.libraryId, left.id, right.libraryId, right.id));
    });
    expect(pairs).toHaveLength(1);
    expect([pairs[0]?.cardIdA, pairs[0]?.cardIdB].sort()).toEqual(['c2', 'c3']);
    expect(new Set([pairs[0]?.libraryIdA, pairs[0]?.libraryIdB])).toEqual(new Set(['a', 'b']));
  });

  it('matches similar images by phash when SHA differs', () => {
    const phashB = {
      rotHashes: ['aaaaaaab', 'bbbbbbbc', 'cccccccd', 'ddddddde'] as [string, string, string, string],
      hist: [0.26, 0.24, 0.25, 0.25]
    };
    const index = [
      item({ libraryId: 'a', id: 'c1', sha256: 'sha-1', phash: samePhash }),
      item({ libraryId: 'b', id: 'c2', sha256: 'sha-2', phash: phashB })
    ];
    const pairs = collectDuplicatePairsFromIndex(index, 70, () => false);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.matchKind).toBe('similar');
    expect(pairs[0]?.libraryIdA).toBe('a');
    expect(pairs[0]?.libraryIdB).toBe('b');
  });

  it('matches exact video SHA across libraries without phash', () => {
    const index = [
      item({ libraryId: 'a', id: 'v1', type: 'video', sha256: 'vid-hash', phash: null }),
      item({ libraryId: 'b', id: 'v2', type: 'video', sha256: 'vid-hash', phash: null })
    ];
    const pairs = collectDuplicatePairsFromIndex(index, 85, () => false);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.matchKind).toBe('exact');
  });
});

describe('container cross skipped pairs', () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('persists and reloads a cross-library ignore key', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'arc-cross-skip-'));
    dirs.push(dir);
    await mkdir(path.join(dir, 'meta'), { recursive: true });
    addCrossSkippedPair(dir, 'lib-a', 'c1', 'lib-b', 'c2');
    const keys = loadCrossSkippedPairKeys(dir);
    expect(keys.has(scopedPairKey('lib-b', 'c2', 'lib-a', 'c1'))).toBe(true);
    const raw = JSON.parse(await readFile(crossSkippedFilePath(dir), 'utf8')) as { pairs: unknown[] };
    expect(raw.pairs).toHaveLength(1);
  });
});

describe('duplicate-delete-card confirm', () => {
  it('accepts binding libraryId:cardId', () => {
    clearDestructiveConfirms();
    const token = issueDestructiveConfirm('duplicate-delete-card', { binding: 'lib-a:card-1' });
    expect(consumeDestructiveConfirm(token, 'duplicate-delete-card', 'lib-a:card-1')).toBe(true);
    expect(consumeDestructiveConfirm(token, 'duplicate-delete-card', 'lib-a:card-1')).toBe(false);
  });
});
