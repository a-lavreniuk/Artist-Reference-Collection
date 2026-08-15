import type { ImageDupFingerprint } from './storage/types';
import {
  matchKindFromSimilarity,
  meetsScanThreshold,
  scopedPairKey,
  similarityCombined
} from './duplicateMatch';

export type DuplicateScanLibrary = {
  id: string;
  name: string;
  path: string;
};

export type DuplicateScanScope = {
  mode: 'current' | 'all' | 'ids';
  libraryIds?: string[];
};

export type DuplicateScanIndexItem = {
  libraryId: string;
  libraryName: string;
  libraryRoot: string;
  id: string;
  type: 'image' | 'video';
  originalAbs: string;
  phash: ImageDupFingerprint | null;
  sha256: string | null;
  fileSize?: number;
};

export type DuplicatePairDto = {
  cardIdA: string;
  cardIdB: string;
  similarity: number;
  matchKind: 'exact' | 'similar';
  libraryIdA: string;
  libraryIdB: string;
  libraryNameA: string;
  libraryNameB: string;
  libraryRootA: string;
  libraryRootB: string;
};

export const FALLBACK_SCAN_LIBRARY_ID = 'active';

export function similarityForPair(
  shaA: string | null,
  shaB: string | null,
  phashA: ImageDupFingerprint | null,
  phashB: ImageDupFingerprint | null
): { similarity: number; exactSha256: boolean } {
  const exactSha256 = Boolean(shaA && shaB && shaA === shaB);
  if (exactSha256) return { similarity: 100, exactSha256: true };
  if (phashA && phashB) {
    return { similarity: similarityCombined(phashA, phashB), exactSha256: false };
  }
  return { similarity: 0, exactSha256: false };
}

function toPairDto(
  a: DuplicateScanIndexItem,
  b: DuplicateScanIndexItem,
  similarity: number,
  exactSha256: boolean
): DuplicatePairDto {
  return {
    cardIdA: a.id,
    cardIdB: b.id,
    similarity: exactSha256 ? 100 : Math.round(similarity * 10) / 10,
    matchKind: matchKindFromSimilarity(similarity, exactSha256),
    libraryIdA: a.libraryId,
    libraryIdB: b.libraryId,
    libraryNameA: a.libraryName,
    libraryNameB: b.libraryName,
    libraryRootA: a.libraryRoot,
    libraryRootB: b.libraryRoot
  };
}

/**
 * Пары по уже посчитанным SHA/phash. Exact — группы одинакового SHA;
 * similar — перцептив только у изображений с phash, без повторных exact-пар.
 */
export function collectDuplicatePairsFromIndex(
  index: DuplicateScanIndexItem[],
  thresholdPct: number,
  isSkipped: (a: DuplicateScanIndexItem, b: DuplicateScanIndexItem) => boolean
): DuplicatePairDto[] {
  const pairs: DuplicatePairDto[] = [];
  const seen = new Set<string>();

  const shaGroups = new Map<string, DuplicateScanIndexItem[]>();
  for (const item of index) {
    if (!item.sha256) continue;
    const group = shaGroups.get(item.sha256);
    if (group) group.push(item);
    else shaGroups.set(item.sha256, [item]);
  }

  for (const group of shaGroups.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]!;
        const b = group[j]!;
        if (isSkipped(a, b)) continue;
        const key = scopedPairKey(a.libraryId, a.id, b.libraryId, b.id);
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push(toPairDto(a, b, 100, true));
      }
    }
  }

  for (let i = 0; i < index.length; i++) {
    const a = index[i]!;
    if (a.type !== 'image' || !a.phash) continue;
    for (let j = i + 1; j < index.length; j++) {
      const b = index[j]!;
      if (b.type !== 'image' || !b.phash) continue;
      if (isSkipped(a, b)) continue;
      const key = scopedPairKey(a.libraryId, a.id, b.libraryId, b.id);
      if (seen.has(key)) continue;
      const { similarity, exactSha256 } = similarityForPair(a.sha256, b.sha256, a.phash, b.phash);
      if (exactSha256) continue;
      if (!meetsScanThreshold(similarity, false, thresholdPct)) continue;
      seen.add(key);
      pairs.push(toPairDto(a, b, similarity, false));
    }
  }

  pairs.sort((x, y) => y.similarity - x.similarity);
  return pairs;
}
