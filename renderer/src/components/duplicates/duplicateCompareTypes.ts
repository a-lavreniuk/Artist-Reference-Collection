import type { CardRecord } from '../../services/arcSchema';

export type DuplicatesCompareMode = 'sideBySide' | 'overlay' | 'metadata';

export type IncomingFileMeta = {
  format: string;
  width?: number;
  height?: number;
  fileSize?: number;
  fileCreatedAt?: string;
};

export type DuplicateCompareSide = {
  key: 'a' | 'b';
  label: string;
  imageUrl: string | null;
  absolutePath: string;
  card?: CardRecord;
  incomingMeta?: IncomingFileMeta;
};

/** Статус пары в списке результатов (совпадает с макетом ARC-2). */
export type DuplicatePairStatus = 'queued' | 'replaced' | 'skipped' | 'notDuplicate';

/** Пара дублей, обогащённая карточками, из бэкенда. */
export type ScannedDuplicatePair = {
  cardIdA: string;
  cardIdB: string;
  similarity: number;
  matchKind: 'exact' | 'similar';
  libraryIdA?: string;
  libraryIdB?: string;
  libraryNameA?: string;
  libraryNameB?: string;
  libraryRootA?: string;
  libraryRootB?: string;
  previewAbsA?: string | null;
  previewAbsB?: string | null;
  cardA: CardRecord | null;
  cardB: CardRecord | null;
};

export function isCrossLibraryPair(pair: Pick<ScannedDuplicatePair, 'libraryIdA' | 'libraryIdB'>): boolean {
  return Boolean(pair.libraryIdA && pair.libraryIdB && pair.libraryIdA !== pair.libraryIdB);
}

export function scannedPairKey(pair: Pick<ScannedDuplicatePair, 'cardIdA' | 'cardIdB' | 'libraryIdA' | 'libraryIdB'>): string {
  const a = `${pair.libraryIdA ?? ''}:${pair.cardIdA}`;
  const b = `${pair.libraryIdB ?? ''}:${pair.cardIdB}`;
  return a < b ? `${a}||${b}` : `${b}||${a}`;
}
