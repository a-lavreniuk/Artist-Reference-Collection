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
  cardA: CardRecord | null;
  cardB: CardRecord | null;
};
