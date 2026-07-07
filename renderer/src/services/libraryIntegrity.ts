import type { ArcMetadataV1, CardRecord, CollectionRecord } from './arcSchema';

export type IntegrityAction =
  | 'auto_metadata'
  | 'delete_card'
  | 'delete_file'
  | 'pick_card_to_delete'
  | 'remove_invalid_row'
  | 'manual_only';

export type IntegrityIssue = {
  level: 'error' | 'warning';
  code: string;
  detail: string;
  action: IntegrityAction;
  cardId?: string;
  cardIds?: string[];
  path?: string;
  cardIndex?: number;
};

/** Предупреждения, которые не снимает applyMetadataWarningFixes (нужна ручная чистка или это отчёт о файлах). */
export const NON_FIXABLE_WARNING_CODES = new Set([
  'orphan_files',
  'duplicate_original_path',
  'duplicate_thumb_path'
]);

export const METADATA_FIXABLE_CODES = new Set([
  'card_tag_missing',
  'card_collection_missing',
  'tag_bad_category',
  'tag_usage_mismatch',
  'moodboard_missing_card'
]);

export const CRITICAL_MANUAL_CODES = new Set([
  'duplicate_card_id',
  'duplicate_tag_id',
  'duplicate_category_id',
  'duplicate_collection_id'
]);

const INTEGRITY_ACTION_BY_CODE: Record<string, IntegrityAction> = {
  card_tag_missing: 'auto_metadata',
  card_collection_missing: 'auto_metadata',
  tag_bad_category: 'auto_metadata',
  tag_usage_mismatch: 'auto_metadata',
  moodboard_missing_card: 'auto_metadata',
  missing_original: 'delete_card',
  missing_thumb: 'delete_card',
  orphan_files: 'delete_file',
  duplicate_original_path: 'pick_card_to_delete',
  duplicate_thumb_path: 'pick_card_to_delete',
  invalid_card_row: 'remove_invalid_row',
  duplicate_card_id: 'manual_only',
  duplicate_tag_id: 'manual_only',
  duplicate_category_id: 'manual_only',
  duplicate_collection_id: 'manual_only'
};

export const ORPHAN_LIST_PAGE_SIZE = 40;

/** Служебные файлы в meta/ и устаревшие дубликаты в корне — не «лишние». */
export const KNOWN_LIBRARY_ROOT_BASENAMES = new Set([
  'arc-metadata.json',
  'arc-metadata.backup.json',
  'arc-history.json',
  'arc-pending-restore.json',
  'arc-index.db',
  'arc-index.db-wal',
  'arc-index.db-shm',
  'arc-system.json',
  'arc-moodboard.json',
  'desktop.ini'
]);

export type IntegrityGroupedIssues = {
  metadata: IntegrityIssue[];
  missingFiles: IntegrityIssue[];
  duplicatePaths: IntegrityIssue[];
  critical: IntegrityIssue[];
  invalidRows: IntegrityIssue[];
  orphanPaths: string[];
};

export type IntegrityReport = {
  issues: IntegrityIssue[];
  grouped: IntegrityGroupedIssues;
  errorCount: number;
  warningCount: number;
  isClean: boolean;
};

function issue(
  partial: Omit<IntegrityIssue, 'action'> & { action?: IntegrityAction }
): IntegrityIssue {
  return {
    ...partial,
    action: partial.action ?? INTEGRITY_ACTION_BY_CODE[partial.code] ?? 'manual_only'
  };
}

/** Убирает из списка сканирования пути системных файлов библиотеки. */
export function filterScanOrphanPaths(paths: string[]): string[] {
  return paths.filter((rel) => {
    const norm = rel.replace(/\\/g, '/');
    if (norm === 'meta' || norm.startsWith('meta/')) return false;
    if (/^cards\/[^/]+\/card\.json$/i.test(norm)) return false;
    const base = norm.includes('/') ? norm.slice(norm.lastIndexOf('/') + 1) : norm;
    return !KNOWN_LIBRARY_ROOT_BASENAMES.has(base.toLowerCase());
  });
}

export function isWarningFixable(issueItem: IntegrityIssue): boolean {
  return issueItem.level === 'warning' && METADATA_FIXABLE_CODES.has(issueItem.code);
}

function cardIdFromMetaRow(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return '';
  const id = (raw as Record<string, unknown>).id;
  return typeof id === 'string' ? id.trim() : '';
}

/** Все id карточек из снимка метаданных. */
export function collectCardIdsFromMeta(meta: ArcMetadataV1): string[] {
  const ids = new Set<string>();
  for (const raw of meta.cards ?? []) {
    const id = cardIdFromMetaRow(raw);
    if (id) ids.add(id);
  }
  return [...ids];
}

/** Все относительные пути медиа и служебных файлов карточек из метаданных. */
export function collectReferencedMediaPathsFromMeta(meta: ArcMetadataV1): string[] {
  const rels = new Set<string>();
  for (const raw of meta.cards ?? []) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    const id = cardIdFromMetaRow(raw);
    for (const key of [
      'originalRelativePath',
      'thumbRelativePath',
      'thumbSRelativePath',
      'thumbMRelativePath',
      'thumbLRelativePath'
    ] as const) {
      const v = o[key];
      if (typeof v === 'string' && v.trim()) rels.add(v.replace(/\\/g, '/'));
    }
    if (id) {
      rels.add(`cards/${id}/card.json`);
      rels.add(`cards/${id}/thumb_s.webp`);
      rels.add(`cards/${id}/thumb_m.webp`);
      rels.add(`cards/${id}/thumb_l.webp`);
    }
  }
  return [...rels];
}

export type IntegrityOrphanScanInput = {
  paths: string[];
  cardIds: string[];
};

/** Пути и id карточек для сканирования лишних файлов (папка cards/{id}/ целиком считается привязанной). */
export function collectIntegrityOrphanScanInput(meta: ArcMetadataV1): IntegrityOrphanScanInput {
  return {
    paths: collectReferencedMediaPathsFromMeta(meta),
    cardIds: collectCardIdsFromMeta(meta)
  };
}

function asTag(r: unknown): { id: string; categoryId: string; usageCount: number } | null {
  if (!r || typeof r !== 'object') return null;
  const o = r as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.categoryId !== 'string') return null;
  const usageCount = typeof o.usageCount === 'number' ? o.usageCount : 0;
  return { id: o.id, categoryId: o.categoryId, usageCount };
}

function asCat(r: unknown): { id: string } | null {
  if (!r || typeof r !== 'object') return null;
  const o = r as Record<string, unknown>;
  if (typeof o.id !== 'string') return null;
  return { id: o.id };
}

function asCol(r: unknown): CollectionRecord | null {
  if (!r || typeof r !== 'object') return null;
  const o = r as Record<string, unknown>;
  if (typeof o.id !== 'string') return null;
  return {
    id: o.id,
    name: typeof o.name === 'string' ? o.name : '',
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : ''
  };
}

function asCard(r: unknown): CardRecord | null {
  if (!r || typeof r !== 'object') return null;
  const o = r as Record<string, unknown>;
  if (typeof o.id !== 'string') return null;
  const type = o.type === 'video' ? ('video' as const) : ('image' as const);
  const originalRelativePath = typeof o.originalRelativePath === 'string' ? o.originalRelativePath : '';
  const thumbRelativePath = typeof o.thumbRelativePath === 'string' ? o.thumbRelativePath : originalRelativePath;
  const thumbSRelativePath = typeof o.thumbSRelativePath === 'string' ? o.thumbSRelativePath : undefined;
  const thumbMRelativePath = typeof o.thumbMRelativePath === 'string' ? o.thumbMRelativePath : undefined;
  const thumbLRelativePath = typeof o.thumbLRelativePath === 'string' ? o.thumbLRelativePath : undefined;
  if (!originalRelativePath) return null;
  const tagIds = Array.isArray(o.tagIds) ? o.tagIds.filter((x): x is string => typeof x === 'string') : [];
  const collectionIds = Array.isArray(o.collectionIds)
    ? o.collectionIds.filter((x): x is string => typeof x === 'string')
    : [];
  return {
    id: o.id,
    type,
    addedAt: typeof o.addedAt === 'string' ? o.addedAt : '',
    originalRelativePath,
    thumbRelativePath,
    ...(thumbSRelativePath ? { thumbSRelativePath } : {}),
    ...(thumbMRelativePath ? { thumbMRelativePath } : {}),
    ...(thumbLRelativePath ? { thumbLRelativePath } : {}),
    tagIds,
    collectionIds
  };
}

export function analyzeIntegrity(
  meta: ArcMetadataV1,
  missingRelPaths: Set<string>,
  orphanPaths?: string[]
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const filteredOrphans = orphanPaths?.length ? filterScanOrphanPaths(orphanPaths) : [];

  const rawCards = meta.cards ?? [];
  for (let i = 0; i < rawCards.length; i++) {
    if (asCard(rawCards[i]) === null) {
      issues.push(
        issue({
          level: 'error',
          code: 'invalid_card_row',
          detail: `Карточка в метаданных [${i}]: некорректная запись`,
          cardIndex: i
        })
      );
    }
  }

  const tags = (meta.tags ?? []).map(asTag).filter((t): t is NonNullable<typeof t> => t !== null);
  const cats = (meta.categories ?? []).map(asCat).filter((c): c is NonNullable<typeof c> => c !== null);
  const cols = (meta.collections ?? []).map(asCol).filter((c): c is CollectionRecord => c !== null);
  const cards = (meta.cards ?? []).map(asCard).filter((c): c is CardRecord => c !== null);

  const countIds = (ids: string[]): Map<string, number> => {
    const m = new Map<string, number>();
    for (const id of ids) {
      m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  };

  for (const [id, n] of countIds(cards.map((c) => c.id))) {
    if (n > 1) {
      issues.push(
        issue({
          level: 'error',
          code: 'duplicate_card_id',
          detail: `Повторяется id карточки: ${id} (${n} раз)`
        })
      );
    }
  }
  for (const [id, n] of countIds(tags.map((t) => t.id))) {
    if (n > 1) {
      issues.push(
        issue({
          level: 'error',
          code: 'duplicate_tag_id',
          detail: `Повторяется id метки: ${id} (${n} раз)`
        })
      );
    }
  }
  for (const [id, n] of countIds(cats.map((c) => c.id))) {
    if (n > 1) {
      issues.push(
        issue({
          level: 'error',
          code: 'duplicate_category_id',
          detail: `Повторяется id категории: ${id} (${n} раз)`
        })
      );
    }
  }
  for (const [id, n] of countIds(cols.map((c) => c.id))) {
    if (n > 1) {
      issues.push(
        issue({
          level: 'error',
          code: 'duplicate_collection_id',
          detail: `Повторяется id коллекции: ${id} (${n} раз)`
        })
      );
    }
  }

  const byOriginal = new Map<string, string[]>();
  const byThumb = new Map<string, string[]>();
  for (const c of cards) {
    const o = c.originalRelativePath.replace(/\\/g, '/');
    const t = c.thumbRelativePath.replace(/\\/g, '/');
    if (!byOriginal.has(o)) byOriginal.set(o, []);
    byOriginal.get(o)!.push(c.id);
    if (!byThumb.has(t)) byThumb.set(t, []);
    byThumb.get(t)!.push(c.id);
  }
  for (const [rel, ids] of byOriginal) {
    if (!rel || ids.length < 2) continue;
    issues.push(
      issue({
        level: 'warning',
        code: 'duplicate_original_path',
        detail: `Один файл оригинала у нескольких карточек (${ids.join(', ')}): ${rel}`,
        cardIds: [...ids],
        path: rel
      })
    );
  }
  for (const [rel, ids] of byThumb) {
    if (!rel || ids.length < 2) continue;
    issues.push(
      issue({
        level: 'warning',
        code: 'duplicate_thumb_path',
        detail: `Один файл превью у нескольких карточек (${ids.join(', ')}): ${rel}`,
        cardIds: [...ids],
        path: rel
      })
    );
  }

  const catIds = new Set(cats.map((c) => c.id));
  const tagIds = new Set(tags.map((t) => t.id));
  const colIds = new Set(cols.map((c) => c.id));
  const cardIds = new Set(cards.map((c) => c.id));

  for (const c of cards) {
    const orig = c.originalRelativePath.replace(/\\/g, '/');
    const thumb = c.thumbRelativePath.replace(/\\/g, '/');
    if (missingRelPaths.has(orig)) {
      issues.push(
        issue({
          level: 'error',
          code: 'missing_original',
          detail: `Карточка ${c.id}: нет файла оригинала (${orig})`,
          cardId: c.id,
          path: orig
        })
      );
    }
    if (missingRelPaths.has(thumb)) {
      issues.push(
        issue({
          level: 'error',
          code: 'missing_thumb',
          detail: `Карточка ${c.id}: нет превью (${thumb})`,
          cardId: c.id,
          path: thumb
        })
      );
    }
    for (const tid of c.tagIds) {
      if (!tagIds.has(tid)) {
        issues.push(
          issue({
            level: 'warning',
            code: 'card_tag_missing',
            detail: `Карточка ${c.id}: ссылка на несуществующую метку ${tid}`,
            cardId: c.id
          })
        );
      }
    }
    for (const colId of c.collectionIds) {
      if (!colIds.has(colId)) {
        issues.push(
          issue({
            level: 'warning',
            code: 'card_collection_missing',
            detail: `Карточка ${c.id}: несуществующая коллекция ${colId}`,
            cardId: c.id
          })
        );
      }
    }
  }

  for (const t of tags) {
    if (!catIds.has(t.categoryId)) {
      issues.push(
        issue({
          level: 'warning',
          code: 'tag_bad_category',
          detail: `Метка ${t.id}: несуществующая категория ${t.categoryId}`
        })
      );
    }
  }

  const usage = new Map<string, number>();
  for (const c of cards) {
    for (const tid of c.tagIds) {
      usage.set(tid, (usage.get(tid) ?? 0) + 1);
    }
  }
  for (const t of tags) {
    const u = usage.get(t.id) ?? 0;
    if (u !== t.usageCount) {
      issues.push(
        issue({
          level: 'warning',
          code: 'tag_usage_mismatch',
          detail: `Метка «${t.id}»: счётчик ${t.usageCount}, фактически ${u}`
        })
      );
    }
  }

  for (const mid of meta.moodboardCardIds ?? []) {
    if (!cardIds.has(mid)) {
      issues.push(
        issue({
          level: 'warning',
          code: 'moodboard_missing_card',
          detail: `Мудборд: несуществующая карточка ${mid}`
        })
      );
    }
  }

  if (filteredOrphans.length > 0) {
    const n = filteredOrphans.length;
    const preview = filteredOrphans.slice(0, ORPHAN_LIST_PAGE_SIZE);
    let detail = `Лишние файлы в библиотеке (${n})`;
    if (n <= ORPHAN_LIST_PAGE_SIZE) {
      detail = `Лишние файлы в библиотеке (${n}):\n${preview.join('\n')}`;
    }
    issues.push(
      issue({
        level: 'warning',
        code: 'orphan_files',
        detail
      })
    );
  }

  return issues;
}

export function groupIntegrityIssues(issues: IntegrityIssue[], orphanPaths: string[] = []): IntegrityGroupedIssues {
  const metadata: IntegrityIssue[] = [];
  const missingFiles: IntegrityIssue[] = [];
  const duplicatePaths: IntegrityIssue[] = [];
  const critical: IntegrityIssue[] = [];
  const invalidRows: IntegrityIssue[] = [];

  for (const item of issues) {
    if (item.code === 'orphan_files') continue;
    if (METADATA_FIXABLE_CODES.has(item.code)) {
      metadata.push(item);
    } else if (item.code === 'missing_original' || item.code === 'missing_thumb') {
      missingFiles.push(item);
    } else if (item.code === 'duplicate_original_path' || item.code === 'duplicate_thumb_path') {
      duplicatePaths.push(item);
    } else if (item.code === 'invalid_card_row') {
      invalidRows.push(item);
    } else if (CRITICAL_MANUAL_CODES.has(item.code)) {
      critical.push(item);
    }
  }

  return {
    metadata,
    missingFiles,
    duplicatePaths,
    critical,
    invalidRows,
    orphanPaths: filterScanOrphanPaths(orphanPaths)
  };
}

export function buildIntegrityReport(
  issues: IntegrityIssue[],
  orphanPaths: string[] = []
): IntegrityReport {
  const filteredOrphans = filterScanOrphanPaths(orphanPaths);
  const nonOrphanIssues = issues.filter((i) => i.code !== 'orphan_files');
  const errorCount = nonOrphanIssues.filter((i) => i.level === 'error').length;
  const warningCount =
    nonOrphanIssues.filter((i) => i.level === 'warning').length + (filteredOrphans.length > 0 ? 1 : 0);

  return {
    issues,
    grouped: groupIntegrityIssues(issues, orphanPaths),
    errorCount,
    warningCount,
    isClean: errorCount === 0 && warningCount === 0
  };
}

/** Удаляет битые строки карточек из снимка метаданных по индексам. */
export function removeInvalidCardRowsFromMeta(meta: ArcMetadataV1, indices: number[]): ArcMetadataV1 {
  const out = JSON.parse(JSON.stringify(meta)) as ArcMetadataV1;
  const sorted = [...new Set(indices)].sort((a, b) => b - a);
  const cards = [...(out.cards ?? [])];
  for (const idx of sorted) {
    if (idx >= 0 && idx < cards.length) cards.splice(idx, 1);
  }
  out.cards = cards;
  return out;
}

/** Одна транзакция правок только для warnings (по плану). */
export function applyMetadataWarningFixes(meta: ArcMetadataV1): ArcMetadataV1 {
  const out = JSON.parse(JSON.stringify(meta)) as ArcMetadataV1;
  if (!Array.isArray(out.tags)) out.tags = [];
  if (!Array.isArray(out.categories)) out.categories = [];
  if (!Array.isArray(out.collections)) out.collections = [];
  if (!Array.isArray(out.cards)) out.cards = [];
  if (!Array.isArray(out.moodboardCardIds)) out.moodboardCardIds = [];

  const catIds = new Set(
    out.categories
      .map(asCat)
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .map((c) => c.id)
  );
  out.tags = out.tags.filter((raw) => {
    const t = asTag(raw);
    return t !== null && catIds.has(t.categoryId);
  });
  const tagIds = new Set(out.tags.map((raw) => asTag(raw)!.id));

  const colIds = new Set(
    out.collections
      .map(asCol)
      .filter((c): c is CollectionRecord => c !== null)
      .map((c) => c.id)
  );

  out.cards = out.cards
    .map(asCard)
    .filter((c): c is CardRecord => c !== null)
    .map((c) => ({
      ...c,
      tagIds: c.tagIds.filter((id) => tagIds.has(id)),
      collectionIds: c.collectionIds.filter((id) => colIds.has(id))
    }));

  const cardIds = new Set(out.cards.map((c) => c.id));
  out.moodboardCardIds = (out.moodboardCardIds ?? []).filter((id) => cardIds.has(id));

  const usage = new Map<string, number>();
  for (const c of out.cards) {
    for (const tid of c.tagIds) {
      usage.set(tid, (usage.get(tid) ?? 0) + 1);
    }
  }
  for (const raw of out.tags) {
    if (!raw || typeof raw !== 'object') continue;
    const t = asTag(raw);
    if (!t) continue;
    (raw as Record<string, unknown>).usageCount = usage.get(t.id) ?? 0;
  }

  return out;
}
