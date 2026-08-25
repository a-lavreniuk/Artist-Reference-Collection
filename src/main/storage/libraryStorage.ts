import type Database from 'better-sqlite3';
import { mkdir, readdir, readFile, stat, unlink } from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import {
  extractVideoFrameToJpeg,
  extractVideoFrameToPng,
  isVideoExt,
  probeVideoDimensions,
  probeVideoDurationMs
} from '../ffmpeg';
import {
  ensureLibraryFilenamesMigrated,
  fileExists,
  libraryMetaDirAbs,
  libraryMetaFileAbs,
  MOODBOARD_FILENAME,
  resolveLegacyMetadataAbsPath,
  SYSTEM_FILENAME
} from '../libraryFilenames';
import {
  cardDirAbs,
  cardJsonExistsSync,
  copyOriginalToCard,
  deleteCardFolder,
  moveOriginalToCard,
  readCardJson,
  thumbLRelPath,
  thumbMRelPath,
  thumbSRelPath,
  writeCardJson,
  CARDS_DIR
} from './cardFolder';
import {
  closeLibraryDb,
  indexDbPath,
  libraryUsesNewStorage,
  openLibraryDb,
  withLibraryDb,
  withLibraryDbReadonly
} from './db';
import { ensureLibraryMetaDirLayout } from './libraryMetaLayout';
import { pruneLegacyTimestampedMetadataBackups } from './metadataBackup';
import { isExpiredDeletedAt } from './trashRetention';
import { removeEmptyLegacyMediaDir } from './libraryCleanup';
import { defaultMoodboard, defaultSystem, readMoodboard, readSystem, writeMoodboard, writeSystem } from './systemFiles';
import {
  hasLibrarySetting,
  LIBRARY_SETTING_TEMPLATE,
  readLibraryDetailTemplate,
  seedLibrarySettingsIfNeeded,
  writeLibraryDetailTemplate,
  writeSystemFilterLayout,
  readSystemFilterLayout
} from './librarySettings';
import { generateImageThumbnails, generateVideoThumbnailsFromFrame } from './thumbnails';
import {
  buildGalleryFilterWhere,
  buildGallerySortSql,
  DEFAULT_GALLERY_SORT,
  emptyGalleryAdvancedFilters
} from './galleryFilters';
import {
  getGalleryFilterBoundaries,
  invalidateGalleryFilterBoundariesCache
} from './galleryFilterBoundariesCache';
import { invalidateGalleryFilterStatsCache } from './galleryFilterStatsCache';
import { invalidateShuffleIdCache } from './shuffleIdCache';
import { ensureShuffleSqlFunctions } from './shuffleOrder';
import { invalidateScoredSearchCache } from './scoredSearchCache';
import { clearAiResultsCache } from '../ai/aiResultsCache';
import { ensureDimensionsBackfill, ensureVideoDurationBackfill } from './galleryFilterBackfill';
import { ensureThumbGenerationBackfill } from './thumbBackfill';
import { extractMediaFileMeta, isMediaMetaProbed } from './mediaFileMeta';
import { clampCardRating, normalizeCardRating } from '../shared/cardRating';
import {
  parseJsonColumn,
  sanitizeCardAnnotations,
  sanitizeCustomFieldsMap,
  serializeAnnotations,
  serializeCustomFieldsMap,
  customFieldsMapToSearchText,
  omitCustomFieldKey,
  isStarterFieldId,
  type CardAnnotationV1,
  type CustomFieldsMap,
  type DetailCardTemplateV1
} from '../shared/detailCardTemplate';
import {
  migrateGalleryAdvancedFiltersShape,
  omitCustomFieldFromFilters,
  omitCustomFieldFromSort,
  type GalleryFilterLayoutState
} from '../shared/galleryFilterCore';
import type {
  ArcMoodboardV1,
  ArcSystemV1,
  CardIndexRow,
  CardMediaMetaV1,
  CardJsonV1,
  CardType,
  CategoryRow,
  CollectionRow,
  CollectionStatsRow,
  ImageDupFingerprint,
  ImportedMediaRow,
  LibraryScope,
  ListCardsParams,
  TagRow
} from './types';
import {
  addCollectionToCardIds,
  assertCollectionParentIsRoot,
  collectionParentId,
  descendantOrSelfIds,
  isCollectionSection,
  normalizeCardCollectionIds,
  removeCollectionFromCardIds,
  siblingNameTaken,
  uniqueCopyName,
  uniqueSiblingName
} from '../shared/collectionHierarchy';

export {
  backfillCardDimensions,
  backfillVideoDurationMs,
  ensureDimensionsBackfill,
  ensureVideoDurationBackfill
} from './galleryFilterBackfill';
export { FilterStatsAborted, getGalleryFilterStats, getGalleryFilterStatsAsync } from './galleryFilterStats';
export {
  deleteFilterPreset,
  listFilterPresets,
  renameFilterPreset,
  upsertFilterPreset
} from './filterPresets';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp']);

function isImageExt(ext: string): boolean {
  return IMAGE_EXT.has(ext.toLowerCase());
}

function cardTypeForExt(ext: string): CardType | null {
  const e = ext.toLowerCase();
  if (e === '.gif') return 'video';
  if (isImageExt(e)) return 'image';
  if (isVideoExt(e)) return 'video';
  return null;
}

function rowToCardRecord(row: CardIndexRow): CardIndexRow & { thumbRelativePath: string } {
  return {
    ...row,
    thumbRelativePath: row.thumbSRel
  };
}

function readAiCaptionFromDbRow(row: Record<string, unknown>): string | undefined {
  return row.ai_caption ? String(row.ai_caption) : undefined;
}

function dbRowToIndex(row: Record<string, unknown>, tagIds: string[], collectionIds: string[]): CardIndexRow {
  return {
    id: String(row.id),
    type: row.type as CardType,
    addedAt: String(row.added_at),
    dateModified: row.date_modified ? String(row.date_modified) : undefined,
    format: row.format ? String(row.format) : undefined,
    width: typeof row.width === 'number' ? row.width : undefined,
    height: typeof row.height === 'number' ? row.height : undefined,
    fileSize: typeof row.file_size === 'number' ? row.file_size : undefined,
    dominantColor: row.dominant_color ? String(row.dominant_color) : undefined,
    paletteJson: row.palette_json ? String(row.palette_json) : undefined,
    phashJson: row.phash_json ? String(row.phash_json) : undefined,
    originalRel: String(row.original_rel),
    thumbSRel: String(row.thumb_s_rel),
    thumbMRel: String(row.thumb_m_rel),
    thumbLRel: String(row.thumb_l_rel),
    tagIds,
    collectionIds,
    description: row.description ? String(row.description) : undefined,
    aiCaption: readAiCaptionFromDbRow(row),
    name: row.name ? String(row.name) : undefined,
    linkUrl: row.link_url ? String(row.link_url) : undefined,
    durationMs: typeof row.duration_ms === 'number' ? row.duration_ms : undefined,
    rating: normalizeCardRating(row.rating),
    customFieldsJson: row.custom_fields_json ? String(row.custom_fields_json) : undefined,
    annotationsJson: row.annotations_json ? String(row.annotations_json) : undefined,
    annotationsText: row.annotations_text ? String(row.annotations_text) : undefined
  };
}

function getCardTags(db: Database.Database, cardId: string): string[] {
  return db
    .prepare('SELECT tag_id FROM card_tags WHERE card_id = ?')
    .all(cardId)
    .map((r) => String((r as { tag_id: string }).tag_id));
}

function getCardCollections(db: Database.Database, cardId: string): string[] {
  return db
    .prepare('SELECT collection_id FROM card_collections WHERE card_id = ?')
    .all(cardId)
    .map((r) => String((r as { collection_id: string }).collection_id));
}

function loadCardRelationsBatch(
  db: Database.Database,
  cardIds: readonly string[]
): { tagsByCard: Map<string, string[]>; collectionsByCard: Map<string, string[]> } {
  const tagsByCard = new Map<string, string[]>();
  const collectionsByCard = new Map<string, string[]>();
  if (cardIds.length === 0) return { tagsByCard, collectionsByCard };

  for (const id of cardIds) {
    tagsByCard.set(id, []);
    collectionsByCard.set(id, []);
  }

  const placeholders = cardIds.map(() => '?').join(',');
  const tagRows = db
    .prepare(`SELECT card_id, tag_id FROM card_tags WHERE card_id IN (${placeholders})`)
    .all(...cardIds) as { card_id: string; tag_id: string }[];
  for (const row of tagRows) {
    const id = String(row.card_id);
    tagsByCard.get(id)?.push(String(row.tag_id));
  }

  const colRows = db
    .prepare(`SELECT card_id, collection_id FROM card_collections WHERE card_id IN (${placeholders})`)
    .all(...cardIds) as { card_id: string; collection_id: string }[];
  for (const row of colRows) {
    const id = String(row.card_id);
    collectionsByCard.get(id)?.push(String(row.collection_id));
  }

  return { tagsByCard, collectionsByCard };
}

function indexCardRowsWithRelations(
  db: Database.Database,
  rows: Record<string, unknown>[]
): CardIndexRow[] {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => String(r.id));
  const { tagsByCard, collectionsByCard } = loadCardRelationsBatch(db, ids);
  return rows.map((r) => {
    const id = String(r.id);
    return dbRowToIndex(r, tagsByCard.get(id) ?? [], collectionsByCard.get(id) ?? []);
  });
}

function loadCardRow(db: Database.Database, cardId: string): CardIndexRow | null {
  const row = db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return dbRowToIndex(row, getCardTags(db, cardId), getCardCollections(db, cardId));
}

export function indexCardRowsFromDb(db: Database.Database, rows: Record<string, unknown>[]): CardIndexRow[] {
  return indexCardRowsWithRelations(db, rows);
}

function syncCardRelations(db: Database.Database, cardId: string, tagIds: string[], collectionIds: string[]): void {
  db.prepare('DELETE FROM card_tags WHERE card_id = ?').run(cardId);
  db.prepare('DELETE FROM card_collections WHERE card_id = ?').run(cardId);
  const insTag = db.prepare('INSERT INTO card_tags (card_id, tag_id) VALUES (?, ?)');
  for (const tid of tagIds) insTag.run(cardId, tid);
  const insCol = db.prepare('INSERT INTO card_collections (card_id, collection_id) VALUES (?, ?)');
  for (const cid of collectionIds) insCol.run(cardId, cid);
}

function recomputeTagUsage(_db?: Database.Database): void {
  try {
    const { recomputeAllCatalogTagUsage, openChildIndexDb } = require('./tagCatalog') as typeof import('./tagCatalog');
    const { readLibraryRootConfigSync } = require('../librarySessionSnapshot') as typeof import('../librarySessionSnapshot');
    const cfg = readLibraryRootConfigSync();
    const libs = cfg.libraries ?? [];
    recomputeAllCatalogTagUsage((tagId) => {
      let n = 0;
      for (const lib of libs) {
        const child = openChildIndexDb(lib.path);
        if (!child) continue;
        try {
          const row = child
            .prepare(
              `SELECT COUNT(*) AS n FROM card_tags ct
               INNER JOIN cards c ON c.id = ct.card_id AND COALESCE(c.is_deleted, 0) = 0
               WHERE ct.tag_id = ?`
            )
            .get(tagId) as { n: number };
          n += Number(row?.n ?? 0);
        } finally {
          try {
            child.close();
          } catch {
            /* ignore */
          }
        }
      }
      return n;
    });
  } catch {
    /* catalog may be unavailable during early migrate */
  }
}

function appendLibraryScopeConditions(scope: LibraryScope | undefined, wh: string[]): void {
  const s = scope ?? 'all';
  if (s === 'trash') {
    wh.push('COALESCE(c.is_deleted, 0) = 1');
    return;
  }
  wh.push('COALESCE(c.is_deleted, 0) = 0');
  if (s === 'untagged') {
    wh.push('NOT EXISTS (SELECT 1 FROM card_tags ct WHERE ct.card_id = c.id)');
  }
}

async function removeCardFromMoodboard(root: string, cardId: string): Promise<void> {
  const mb = await readMoodboard(root);
  mb.moodboardCardIds = mb.moodboardCardIds.filter((id) => id !== cardId);
  if (mb.moodboardBoard && typeof mb.moodboardBoard === 'object') {
    const board = mb.moodboardBoard as Record<string, unknown>;
    if (Array.isArray(board.imageInstances)) {
      board.imageInstances = board.imageInstances.filter(
        (x) => !(x && typeof x === 'object' && (x as { cardId?: string }).cardId === cardId)
      );
    }
  }
  await writeMoodboard(root, mb);
}

let currentRoot: string | null = null;
let migrationPromise: Promise<void> | null = null;
const readyPromises = new Map<string, Promise<Database.Database>>();
/** Корни, для которых полный ensureLibraryReadyInner уже выполнен в этой сессии. */
const readyRoots = new Set<string>();

export function isLibraryRootReady(libraryRoot: string): boolean {
  return readyRoots.has(path.resolve(libraryRoot));
}

export function resetLibraryStorageCache(): void {
  readyPromises.clear();
  readyRoots.clear();
  migrationPromise = null;
  currentRoot = null;
  invalidateGalleryFilterBoundariesCache();
  invalidateGalleryFilterStatsCache();
  invalidateShuffleIdCache();
  invalidateScoredSearchCache();
  clearAiResultsCache();
  closeLibraryDb();
  try {
    const { closeTagCatalogDb } = require('./tagCatalog') as typeof import('./tagCatalog');
    closeTagCatalogDb();
  } catch {
    /* ignore */
  }
}

export type MigrationProgress = {
  phase: string;
  current: number;
  total: number;
  message?: string;
};

type ProgressCb = (p: MigrationProgress) => void;

let migrationProgressCb: ProgressCb | null = null;

export function setMigrationProgressCallback(cb: ProgressCb | null): void {
  migrationProgressCb = cb;
}

function emitMigration(p: MigrationProgress): void {
  migrationProgressCb?.(p);
}

export async function ensureLibraryReady(libraryRoot: string): Promise<Database.Database> {
  const root = path.resolve(libraryRoot);
  try {
    const { readLibraryRootConfigSync } = await import('../librarySessionSnapshot');
    const pending = readLibraryRootConfigSync().pendingWrapMigrationPath?.trim();
    if (pending && path.resolve(pending) === root) {
      throw new Error('Сначала укажите имя библиотеки в диалоге переноса');
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('укажите имя библиотеки')) throw err;
    /* config read best-effort */
  }
  const inFlight = readyPromises.get(root);
  if (inFlight) return inFlight;

  const promise = ensureLibraryReadyInner(root).finally(() => {
    if (readyPromises.get(root) === promise) {
      readyPromises.delete(root);
    }
  });
  readyPromises.set(root, promise);
  return promise;
}

async function emptyIndexWithLegacyCards(root: string, legacyMetaPath: string): Promise<boolean> {
  try {
    const db = openLibraryDb(root);
    const row = db.prepare('SELECT COUNT(*) AS c FROM cards').get() as { c: number };
    if (row.c > 0) return false;
    const raw = await readFile(legacyMetaPath, 'utf8');
    const meta = JSON.parse(raw) as { cards?: unknown[] };
    return Array.isArray(meta.cards) && meta.cards.length > 0;
  } catch {
    return false;
  }
}

async function ensureLibraryReadyInner(root: string): Promise<Database.Database> {
  if (readyRoots.has(root)) {
    currentRoot = root;
    return openLibraryDb(root);
  }

  await mkdir(root, { recursive: true });
  await mkdir(path.join(root, CARDS_DIR), { recursive: true });
  await mkdir(libraryMetaDirAbs(root), { recursive: true });
  await ensureLibraryFilenamesMigrated(root);

  const legacyMetaPath = await resolveLegacyMetadataAbsPath(root);
  const legacyMetaExists = legacyMetaPath !== null;
  const usesNew = libraryUsesNewStorage(root);

  const shouldMigrate =
    legacyMetaExists &&
    legacyMetaPath &&
    (!usesNew || (usesNew && (await emptyIndexWithLegacyCards(root, legacyMetaPath))));

  if (shouldMigrate) {
    if (!migrationPromise) {
      migrationPromise = runLegacyMigration(root).finally(() => {
        migrationPromise = null;
      });
    }
    await migrationPromise;
  } else if (!usesNew) {
    await initEmptyLibrary(root);
  } else {
    await pruneLegacyTimestampedMetadataBackups(root);
    await removeEmptyLegacyMediaDir(root);
    const sys = await readSystem(root);
    if (!sys.schemaVersion) {
      await writeSystem(root, { ...sys, schemaVersion: 2 });
    }
  }

  await ensureLibraryMetaDirLayout(root);

  try {
    const { migrateChildCatalogsToShared } = await import('./migrateChildCatalogsToShared');
    const { openTagCatalogDb, resolveContainerPath } = await import('./tagCatalog');
    openTagCatalogDb(resolveContainerPath());
    await migrateChildCatalogsToShared();
  } catch (err) {
    console.error('[ARC] tag catalog migrate:', err);
  }

  readyRoots.add(root);
  currentRoot = root;
  const db = openLibraryDb(root);
  if (!hasLibrarySetting(db, LIBRARY_SETTING_TEMPLATE)) {
    let prefsTemplate: unknown;
    try {
      const { readAppPreferencesSync } = await import('../appPreferences');
      prefsTemplate = readAppPreferencesSync().detailCardTemplate;
    } catch {
      prefsTemplate = undefined;
    }
    seedLibrarySettingsIfNeeded(db, { template: prefsTemplate, useDefaultTemplate: false });
  } else {
    seedLibrarySettingsIfNeeded(db, { useDefaultTemplate: true });
  }
  // Backfill не на горячем пути: ffmpeg/SQLite на main ломают IPC list-cards (~1.5s/видео).
  setTimeout(() => {
    void (async () => {
      try {
        await ensureDimensionsBackfill(root);
      } catch {
        /* фоновое обслуживание метаданных */
      }
    })();
  }, 120_000);
  setTimeout(() => {
    void (async () => {
      try {
        await ensureThumbGenerationBackfill(root);
      } catch {
        /* фоновая перегенерация превью */
      }
    })();
  }, 180_000);
  return openLibraryDb(root);
}

async function initEmptyLibrary(root: string): Promise<void> {
  await mkdir(libraryMetaDirAbs(root), { recursive: true });
  if (!(await fileExists(libraryMetaFileAbs(root, SYSTEM_FILENAME)))) {
    await writeSystem(root, defaultSystem(app.getVersion()));
  }
  if (!(await fileExists(libraryMetaFileAbs(root, MOODBOARD_FILENAME)))) {
    await writeMoodboard(root, defaultMoodboard());
  }
  if (!(await fileExists(indexDbPath(root)))) {
    const db = openLibraryDb(root);
    seedLibrarySettingsIfNeeded(db, { useDefaultTemplate: true });
    closeLibraryDb();
  }
}

async function runLegacyMigration(root: string): Promise<void> {
  const { migrateLegacyLibrary } = await import('./migrate');
  await migrateLegacyLibrary(root, emitMigration);
}

export function getCurrentLibraryRoot(): string | null {
  return currentRoot;
}

export type ImportMediaOptions = {
  linkUrl?: string;
  name?: string;
};

export async function importMediaFile(
  libraryRoot: string,
  sourceAbs: string,
  options?: ImportMediaOptions
): Promise<{ ok: true; row: ImportedMediaRow } | { ok: false; error: string }> {
  const root = path.resolve(libraryRoot);
  const db = await ensureLibraryReady(root);
  const resolved = path.resolve(sourceAbs);
  const ext = path.extname(resolved);
  const baseName = path.basename(resolved);

  const type = cardTypeForExt(ext);
  if (!type) {
    return { ok: false, error: `Неподдерживаемый тип файла: ${baseName}` };
  }

  let st;
  try {
    st = await stat(resolved);
  } catch {
    return { ok: false, error: `Файл недоступен: ${baseName}` };
  }
  if (!st.isFile()) return { ok: false, error: `Не файл: ${baseName}` };

  const id = crypto.randomUUID();
  const addedAt = new Date().toISOString();
  const birthMs = st.birthtimeMs ?? st.birthtime.getTime();
  const fileCreatedAt =
    Number.isFinite(birthMs) && birthMs > 0 ? new Date(birthMs).toISOString() : st.mtime.toISOString();
  const cardId = id;
  const dir = cardDirAbs(root, cardId);
  await mkdir(dir, { recursive: true });

  const thumbSAbs = path.join(dir, 'thumb_s.webp');
  const thumbMAbs = path.join(dir, 'thumb_m.webp');
  const thumbLAbs = path.join(dir, 'thumb_l.webp');

  try {
    const { originalAbs, originalRel } = await copyOriginalToCard(root, cardId, resolved, ext);
    let dominantColorHex = '#2a2a2a';
    let paletteJson: string | null = null;
    let width: number | undefined;
    let height: number | undefined;
    let phash: ImageDupFingerprint | undefined;
    let durationMs: number | undefined;
    let videoWidth: number | undefined;
    let videoHeight: number | undefined;

    if (type === 'image') {
      const thumbRes = await generateImageThumbnails(originalAbs, thumbSAbs, thumbMAbs, thumbLAbs, true);
      dominantColorHex = thumbRes.dominantColorHex;
      paletteJson = JSON.stringify(thumbRes.palette);
      width = thumbRes.width || undefined;
      height = thumbRes.height || undefined;
      phash = thumbRes.phash;
    } else {
      const frameTmp = path.join(dir, '_frame.jpg');
      try {
        await extractVideoFrameToJpeg(originalAbs, frameTmp);
        const thumbRes = await generateVideoThumbnailsFromFrame(frameTmp, thumbSAbs, thumbMAbs, thumbLAbs);
        dominantColorHex = thumbRes.dominantColorHex;
        paletteJson = JSON.stringify(thumbRes.palette);
        width = thumbRes.width || undefined;
        height = thumbRes.height || undefined;
        const dims = await probeVideoDimensions(originalAbs);
        if (dims) {
          width = dims.width;
          height = dims.height;
          videoWidth = dims.width;
          videoHeight = dims.height;
        }
        durationMs = (await probeVideoDurationMs(originalAbs)) ?? undefined;
      } finally {
        try {
          await unlink(frameTmp);
        } catch {
          /* ignore */
        }
      }
    }

    const linkUrlTrimmed = options?.linkUrl?.trim();
    const nameTrimmed = options?.name?.trim();

    let mediaMeta: CardMediaMetaV1 | undefined;
    try {
      mediaMeta = await extractMediaFileMeta(originalAbs, type);
    } catch {
      mediaMeta = undefined;
    }

    const cardJson: CardJsonV1 = {
      version: 1,
      id: cardId,
      type,
      addedAt,
      fileCreatedAt,
      originalFileName: baseName,
      format: ext.slice(1).toLowerCase(),
      width,
      height,
      fileSize: st.size,
      dominantColorHex,
      tagIds: [],
      collectionIds: [],
      ...(phash ? { phash } : {}),
      ...(durationMs ? { durationMs } : {}),
      ...(videoWidth ? { videoWidth } : {}),
      ...(videoHeight ? { videoHeight } : {}),
      ...(mediaMeta ? { mediaMeta } : {}),
      ...(linkUrlTrimmed ? { linkUrl: linkUrlTrimmed } : {}),
      ...(nameTrimmed ? { name: nameTrimmed } : {})
    };
    await writeCardJson(root, cardJson);

    const thumbSRel = thumbSRelPath(cardId);
    const thumbMRel = thumbMRelPath(cardId);
    const thumbLRel = thumbLRelPath(cardId);

    db.prepare(
      `INSERT INTO cards (
        id, type, added_at, format, width, height, file_size, duration_ms, dominant_color, palette_json, phash_json,
        original_rel, thumb_s_rel, thumb_m_rel, thumb_l_rel, name, link_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      cardId,
      type,
      addedAt,
      cardJson.format ?? null,
      width ?? null,
      height ?? null,
      st.size,
      durationMs ?? null,
      dominantColorHex,
      paletteJson,
      phash ? JSON.stringify(phash) : null,
      originalRel,
      thumbSRel,
      thumbMRel,
      thumbLRel,
      cardJson.name ?? null,
      cardJson.linkUrl ?? null
    );

    return {
      ok: true,
      row: {
        id: cardId,
        type,
        originalRelativePath: originalRel,
        thumbRelativePath: thumbSRel,
        thumbSRelativePath: thumbSRel,
        thumbMRelativePath: thumbMRel,
        thumbLRelativePath: thumbLRel,
        dominantColorHex,
        fileSize: st.size,
        addedAt,
        ...(width && height ? { width, height } : {})
      }
    };
  } catch (err) {
    await deleteCardFolder(root, cardId);
    return {
      ok: false,
      error: err instanceof Error ? err.message : `Не удалось импортировать ${baseName}`
    };
  }
}

function listCardsOnDb(db: Database.Database, params: ListCardsParams): CardIndexRow[] {
  const sort = params.sort ?? DEFAULT_GALLERY_SORT;
  const filters = migrateGalleryAdvancedFiltersShape(params.advancedFilters ?? emptyGalleryAdvancedFilters());
  const template = readLibraryDetailTemplate(db);
  const boundaries = getGalleryFilterBoundaries(db, filters);
  const { wh, binds } = buildGalleryFilterWhere(
    {
      libraryScope: params.libraryScope,
      selectedTagIds: params.selectedTagIds,
      cardIdExact: params.cardIdExact,
      collectionId: params.collectionId,
      moodboardCardIds: params.moodboardCardIds,
      filters,
      sort,
      template
    },
    'c',
    boundaries
  );

  let sql = 'SELECT c.* FROM cards c';
  if (wh.length) sql += ` WHERE ${wh.join(' AND ')}`;

  if (sort.field === 'shuffle') {
    ensureShuffleSqlFunctions(db);
    const shuffleSeed = sort.shuffleSeed ?? 0;
    sql += ' ORDER BY arc_shuffle_key(c.id, ?) ASC LIMIT ? OFFSET ?';
    binds.push(shuffleSeed, params.limit, params.offset);
    const rows = db.prepare(sql).all(...binds) as Record<string, unknown>[];
    return indexCardRowsWithRelations(db, rows);
  }

  sql += ` ${buildGallerySortSql(sort, 'c', template)} LIMIT ? OFFSET ?`;
  binds.push(params.limit, params.offset);

  const rows = db.prepare(sql).all(...binds) as Record<string, unknown>[];
  return indexCardRowsWithRelations(db, rows);
}

export function listCardsFromDb(libraryRoot: string, params: ListCardsParams): CardIndexRow[] {
  const db = openLibraryDb(libraryRoot);
  return listCardsOnDb(db, params);
}

/** Список без переключения global `activeDb` — для корзины контейнера. */
export function listCardsFromDbReadonly(libraryRoot: string, params: ListCardsParams): CardIndexRow[] {
  return withLibraryDbReadonly(libraryRoot, (db) => listCardsOnDb(db, params)) ?? [];
}

export function getCardByIdFromDb(libraryRoot: string, cardId: string): CardIndexRow | null {
  const db = openLibraryDb(libraryRoot);
  return loadCardRow(db, cardId);
}

/**
 * Ленивый backfill расширенных метаданных при открытии «Информация о файле».
 * Если mediaMeta уже probed — возвращает карточку без повторного чтения файла.
 * После долгого probe перечитывает card.json, чтобы не затереть параллельные правки.
 */
export async function ensureCardMediaMeta(
  libraryRoot: string,
  cardId: string
): Promise<CardJsonV1 | null> {
  const root = path.resolve(libraryRoot);
  await ensureLibraryReady(root);
  const cardJson = await readCardJson(root, cardId);
  if (!cardJson) return null;
  if (isMediaMetaProbed(cardJson.mediaMeta)) return cardJson;

  const row = getCardByIdFromDb(root, cardId);
  let mediaMeta: CardMediaMetaV1;
  if (!row?.originalRel) {
    mediaMeta = {
      version: 1,
      probedAt: new Date().toISOString()
    };
  } else {
    const originalAbs = path.join(root, row.originalRel.replace(/\//g, path.sep));
    try {
      mediaMeta = await extractMediaFileMeta(originalAbs, cardJson.type);
    } catch {
      mediaMeta = {
        version: 1,
        probedAt: new Date().toISOString()
      };
    }
  }

  const latest = await readCardJson(root, cardId);
  if (!latest) return null;
  if (isMediaMetaProbed(latest.mediaMeta)) return latest;
  latest.mediaMeta = mediaMeta;
  await writeCardJson(root, latest);
  return latest;
}

export function countCards(
  libraryRoot: string,
  filter: 'all' | 'images' | 'videos' = 'all',
  libraryScope: LibraryScope = 'all'
): number {
  const db = openLibraryDb(libraryRoot);
  return countCardsOnDb(db, filter, libraryScope);
}

/** COUNT без переключения global activeDb (для list-libraries). */
export function countCardsReadonly(
  libraryRoot: string,
  filter: 'all' | 'images' | 'videos' = 'all',
  libraryScope: LibraryScope = 'all'
): number {
  const n = withLibraryDbReadonly(libraryRoot, (db) => countCardsOnDb(db, filter, libraryScope));
  return n ?? 0;
}

function countCardsOnDb(
  db: ReturnType<typeof openLibraryDb>,
  filter: 'all' | 'images' | 'videos',
  libraryScope: LibraryScope
): number {
  const wh: string[] = [];
  if (libraryScope === 'trash') wh.push('COALESCE(is_deleted, 0) = 1');
  else {
    wh.push('COALESCE(is_deleted, 0) = 0');
    if (libraryScope === 'untagged') {
      wh.push('NOT EXISTS (SELECT 1 FROM card_tags ct WHERE ct.card_id = cards.id)');
    }
  }
  if (filter === 'images') wh.push("type = 'image'");
  else if (filter === 'videos') wh.push("type = 'video'");
  const where = wh.length ? ` WHERE ${wh.join(' AND ')}` : '';
  return (db.prepare(`SELECT COUNT(*) AS n FROM cards${where}`).get() as { n: number }).n;
}

export function countTrashedCards(libraryRoot: string): number {
  const db = openLibraryDb(libraryRoot);
  return (db.prepare('SELECT COUNT(*) AS n FROM cards WHERE COALESCE(is_deleted, 0) = 1').get() as { n: number })
    .n;
}

/** Карточки (не в корзине), у которых есть хотя бы одна метка из списка. */
export function countCardsWithAnyTagIds(libraryRoot: string, tagIds: readonly string[]): number {
  if (tagIds.length === 0) return 0;
  const db = openLibraryDb(libraryRoot);
  const placeholders = tagIds.map(() => '?').join(',');
  const row = db
    .prepare(
      `SELECT COUNT(DISTINCT c.id) AS n
       FROM cards c
       INNER JOIN card_tags ct ON ct.card_id = c.id
       WHERE COALESCE(c.is_deleted, 0) = 0 AND ct.tag_id IN (${placeholders})`
    )
    .get(...tagIds) as { n: number };
  return row.n ?? 0;
}

export async function updateCardInStorage(
  libraryRoot: string,
  cardId: string,
  patch: {
    tagIds?: string[];
    collectionIds?: string[];
    description?: string;
    name?: string;
    linkUrl?: string;
    rating?: number;
    customFields?: CustomFieldsMap;
    annotations?: CardAnnotationV1[];
  }
): Promise<void> {
  const root = path.resolve(libraryRoot);
  const db = await ensureLibraryReady(root);
  const cardJson = await readCardJson(root, cardId);
  if (!cardJson) throw new Error('Карточка не найдена');

  if (patch.tagIds) {
    const { getActiveLibraryEntry, readLibraryRootConfigSync } = await import('../librarySessionSnapshot');
    const { filterVisibleTagIds } = await import('./tagCatalog');
    const activeId = getActiveLibraryEntry(readLibraryRootConfigSync())?.id ?? null;
    cardJson.tagIds = filterVisibleTagIds([...patch.tagIds], activeId);
  }
  if (patch.collectionIds) {
    const collections = listCollections(root);
    cardJson.collectionIds = normalizeCardCollectionIds(patch.collectionIds, collections);
  }
  if (patch.description !== undefined) {
    const trimmed = patch.description.trim();
    if (trimmed) cardJson.description = trimmed;
    else delete cardJson.description;
  }
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (trimmed) cardJson.name = trimmed;
    else delete cardJson.name;
  }
  if (patch.linkUrl !== undefined) {
    const trimmed = patch.linkUrl.trim();
    if (trimmed) cardJson.linkUrl = trimmed;
    else delete cardJson.linkUrl;
  }
  if (patch.rating !== undefined) {
    const rating = clampCardRating(patch.rating);
    if (rating > 0) cardJson.rating = rating;
    else delete cardJson.rating;
  }
  if (patch.customFields !== undefined) {
    const next = sanitizeCustomFieldsMap(patch.customFields);
    if (Object.keys(next).length) cardJson.customFields = next;
    else delete cardJson.customFields;
  }
  if (patch.annotations !== undefined) {
    const next = sanitizeCardAnnotations(patch.annotations);
    if (next.length) cardJson.annotations = next;
    else delete cardJson.annotations;
  }
  cardJson.dateModified = new Date().toISOString();
  await writeCardJson(root, cardJson);

  const sets: string[] = ['date_modified = ?'];
  const vals: unknown[] = [cardJson.dateModified];
  if (patch.description !== undefined) {
    sets.push('description = ?');
    vals.push(cardJson.description ?? null);
  }
  if (patch.name !== undefined) {
    sets.push('name = ?');
    vals.push(cardJson.name ?? null);
  }
  if (patch.linkUrl !== undefined) {
    sets.push('link_url = ?');
    vals.push(cardJson.linkUrl ?? null);
  }
  if (patch.rating !== undefined) {
    sets.push('rating = ?');
    vals.push(cardJson.rating ?? 0);
  }
  if (patch.customFields !== undefined) {
    sets.push('custom_fields_json = ?');
    vals.push(serializeCustomFieldsMap(cardJson.customFields ?? {}));
    sets.push('custom_fields_text = ?');
    vals.push(customFieldsMapToSearchText(cardJson.customFields ?? {}));
  }
  if (patch.annotations !== undefined) {
    const packed = serializeAnnotations(cardJson.annotations ?? []);
    sets.push('annotations_json = ?');
    vals.push(packed.json);
    sets.push('annotations_text = ?');
    vals.push(packed.text);
  }
  vals.push(cardId);
  db.prepare(`UPDATE cards SET ${sets.join(', ')} WHERE id = ?`).run(...vals);

  if (patch.tagIds || patch.collectionIds) {
    syncCardRelations(db, cardId, cardJson.tagIds, cardJson.collectionIds);
    recomputeTagUsage(db);
  }

  // Счётчики фильтров (в т.ч. пользовательских полей) кэшируются в IPC — без сброса список не обновится.
  invalidateGalleryFilterStatsCache();
}

export async function wipeCustomFieldFromLibrary(libraryRoot: string, fieldId: string): Promise<void> {
  const root = path.resolve(libraryRoot);
  const db = await ensureLibraryReady(root);
  const now = new Date().toISOString();
  if (isStarterFieldId(fieldId)) {
    const column = fieldId === 'name' ? 'name' : fieldId === 'link' ? 'link_url' : 'description';
    const jsonKey = fieldId === 'link' ? 'linkUrl' : fieldId;
    db.prepare(`UPDATE cards SET ${column} = NULL, date_modified = ? WHERE COALESCE(${column}, '') != ''`).run(
      now
    );
    const ids = db.prepare('SELECT id FROM cards').all() as Array<{ id: string }>;
    for (const row of ids) {
      const cardJson = await readCardJson(root, row.id);
      if (!cardJson) continue;
      const rec = cardJson as unknown as Record<string, unknown>;
      if (rec[jsonKey] == null || rec[jsonKey] === '') continue;
      delete rec[jsonKey];
      cardJson.dateModified = now;
      await writeCardJson(root, cardJson);
    }
    stripFieldFromLibraryPresets(db, fieldId);
    invalidateGalleryFilterStatsCache();
    return;
  }
  const rows = db.prepare('SELECT id, custom_fields_json FROM cards').all() as Array<{
    id: string;
    custom_fields_json: string | null;
  }>;
  const upd = db.prepare(
    'UPDATE cards SET custom_fields_json = ?, custom_fields_text = ?, date_modified = ? WHERE id = ?'
  );
  for (const row of rows) {
    const parsed = sanitizeCustomFieldsMap(parseJsonColumn(row.custom_fields_json, {}));
    if (!(fieldId in parsed)) continue;
    const next = omitCustomFieldKey(parsed, fieldId);
    const json = serializeCustomFieldsMap(next);
    upd.run(json, customFieldsMapToSearchText(next), now, row.id);
    const cardJson = await readCardJson(root, row.id);
    if (!cardJson) continue;
    const fromFile = sanitizeCustomFieldsMap(cardJson.customFields ?? {});
    const wiped = omitCustomFieldKey(fromFile, fieldId);
    if (Object.keys(wiped).length) cardJson.customFields = wiped;
    else delete cardJson.customFields;
    cardJson.dateModified = now;
    await writeCardJson(root, cardJson);
  }
  stripFieldFromLibraryPresets(db, fieldId);
  invalidateGalleryFilterStatsCache();
}

function stripFieldFromLibraryPresets(db: Database.Database, fieldId: string): void {
  const rows = db
    .prepare('SELECT id, payload_json FROM saved_filters')
    .all() as Array<{ id: string; payload_json: string }>;
  const upd = db.prepare('UPDATE saved_filters SET payload_json = ? WHERE id = ?');
  for (const row of rows) {
    let payload: { filters?: unknown; sort?: unknown; layout?: unknown };
    try {
      payload = JSON.parse(row.payload_json) as { filters?: unknown; sort?: unknown; layout?: unknown };
    } catch {
      continue;
    }
    const filters = omitCustomFieldFromFilters(migrateGalleryAdvancedFiltersShape(payload.filters), fieldId);
    const sort =
      payload.sort && typeof payload.sort === 'object'
        ? omitCustomFieldFromSort(payload.sort as { field: string; direction: 'asc' | 'desc' }, fieldId)
        : undefined;
    const next = { ...payload, filters, ...(sort ? { sort } : {}) };
    upd.run(JSON.stringify(next), row.id);
  }
}

export function getLibraryDetailTemplateFromDb(libraryRoot: string): DetailCardTemplateV1 {
  const db = openLibraryDb(libraryRoot);
  return readLibraryDetailTemplate(db);
}

export function saveLibraryDetailTemplate(libraryRoot: string, template: DetailCardTemplateV1): void {
  const db = openLibraryDb(libraryRoot);
  writeLibraryDetailTemplate(db, template);
  invalidateGalleryFilterStatsCache();
}

export function getSystemFilterLayoutFromDb(libraryRoot: string): GalleryFilterLayoutState {
  const db = openLibraryDb(libraryRoot);
  return readSystemFilterLayout(db);
}

export function saveSystemFilterLayout(libraryRoot: string, layout: GalleryFilterLayoutState): void {
  const db = openLibraryDb(libraryRoot);
  writeSystemFilterLayout(db, layout);
}

export async function insertCardMetadata(
  libraryRoot: string,
  cards: Array<{
    id: string;
    tagIds: string[];
    collectionIds: string[];
    description?: string;
    format?: string;
    width?: number;
    height?: number;
    fileSize?: number;
    fileSizeMb?: number;
    dateModified?: string;
  }>
): Promise<void> {
  for (const c of cards) {
    await updateCardInStorage(libraryRoot, c.id, {
      tagIds: c.tagIds,
      collectionIds: c.collectionIds,
      description: c.description
    });
    const db = openLibraryDb(libraryRoot);
    const cardJson = await readCardJson(libraryRoot, c.id);
    if (cardJson) {
      if (c.format) cardJson.format = c.format;
      if (c.width) cardJson.width = c.width;
      if (c.height) cardJson.height = c.height;
      if (c.fileSize) cardJson.fileSize = c.fileSize;
      await writeCardJson(libraryRoot, cardJson);
      db.prepare(
        'UPDATE cards SET format = ?, width = ?, height = ?, file_size = ?, date_modified = ? WHERE id = ?'
      ).run(c.format ?? null, c.width ?? null, c.height ?? null, c.fileSize ?? null, c.dateModified ?? null, c.id);
    }
  }
}

export async function softDeleteCardFromStorage(libraryRoot: string, cardId: string): Promise<void> {
  const root = path.resolve(libraryRoot);
  const db = await ensureLibraryReady(root);
  const cardJson = await readCardJson(root, cardId);
  if (!cardJson) throw new Error('Карточка не найдена');
  const deletedAt = new Date().toISOString();
  cardJson.deletedAt = deletedAt;
  cardJson.dateModified = deletedAt;
  await writeCardJson(root, cardJson);
  db.prepare('UPDATE cards SET is_deleted = 1, deleted_at = ?, date_modified = ? WHERE id = ?').run(
    deletedAt,
    deletedAt,
    cardId
  );
  await removeCardFromMoodboard(root, cardId);
  recomputeTagUsage(db);
  invalidateGalleryFilterStatsCache();
}

export async function restoreCardFromStorage(libraryRoot: string, cardId: string): Promise<void> {
  const root = path.resolve(libraryRoot);
  const db = await ensureLibraryReady(root);
  const cardJson = await readCardJson(root, cardId);
  if (!cardJson) throw new Error('Карточка не найдена');
  const modified = new Date().toISOString();
  delete cardJson.deletedAt;
  cardJson.dateModified = modified;
  await writeCardJson(root, cardJson);
  db.prepare('UPDATE cards SET is_deleted = 0, deleted_at = NULL, date_modified = ? WHERE id = ?').run(
    modified,
    cardId
  );
  recomputeTagUsage(db);
  invalidateGalleryFilterStatsCache();
}

/** Индексирует уже скопированную папку `cards/{id}` в библиотеке (восстановление в другую библиотеку). */
export async function importExistingCardFolder(
  destRoot: string,
  cardJson: CardJsonV1,
  sourceRow?: CardIndexRow | null
): Promise<void> {
  const root = path.resolve(destRoot);
  const db = await ensureLibraryReady(root);
  const cardId = cardJson.id;
  const existing = loadCardRow(db, cardId);
  if (existing) {
    throw new Error('Карточка с таким id уже есть в выбранной библиотеке');
  }

  const ext = cardJson.format
    ? `.${cardJson.format}`
    : path.extname(cardJson.originalFileName);
  const originalRel =
    sourceRow?.originalRel ??
    `cards/${cardId}/original${ext.startsWith('.') ? ext : `.${ext}`}`;
  const thumbS = sourceRow?.thumbSRel ?? thumbSRelPath(cardId);
  const thumbM = sourceRow?.thumbMRel ?? thumbMRelPath(cardId);
  const thumbL = sourceRow?.thumbLRel ?? thumbLRelPath(cardId);

  db.prepare(
    `INSERT INTO cards (
      id, type, added_at, date_modified, format, width, height, file_size, duration_ms, dominant_color, phash_json,
      original_rel, thumb_s_rel, thumb_m_rel, thumb_l_rel, description, name, link_url, rating, is_deleted, deleted_at,
      custom_fields_json, custom_fields_text, annotations_json, annotations_text
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, ?)`
  ).run(
    cardId,
    cardJson.type,
    cardJson.addedAt,
    cardJson.dateModified ?? null,
    cardJson.format ?? sourceRow?.format ?? null,
    cardJson.width ?? sourceRow?.width ?? null,
    cardJson.height ?? sourceRow?.height ?? null,
    cardJson.fileSize ?? sourceRow?.fileSize ?? null,
    cardJson.durationMs ?? sourceRow?.durationMs ?? null,
    cardJson.dominantColorHex ?? sourceRow?.dominantColor ?? null,
    cardJson.phash ? JSON.stringify(cardJson.phash) : sourceRow?.phashJson ?? null,
    originalRel,
    thumbS,
    thumbM,
    thumbL,
    cardJson.description ?? sourceRow?.description ?? null,
    cardJson.name ?? sourceRow?.name ?? null,
    cardJson.linkUrl ?? sourceRow?.linkUrl ?? null,
    clampCardRating(cardJson.rating ?? sourceRow?.rating),
    serializeCustomFieldsMap(sanitizeCustomFieldsMap(cardJson.customFields ?? {})),
    customFieldsMapToSearchText(sanitizeCustomFieldsMap(cardJson.customFields ?? {})),
    serializeAnnotations(sanitizeCardAnnotations(cardJson.annotations ?? [])).json,
    serializeAnnotations(sanitizeCardAnnotations(cardJson.annotations ?? [])).text
  );
  syncCardRelations(db, cardId, cardJson.tagIds ?? [], cardJson.collectionIds ?? []);
  recomputeTagUsage(db);
}

export async function deleteCardFromStorage(libraryRoot: string, cardId: string): Promise<void> {
  const root = path.resolve(libraryRoot);
  const db = await ensureLibraryReady(root);
  db.prepare('DELETE FROM cards WHERE id = ?').run(cardId);
  await deleteCardFolder(root, cardId);
  recomputeTagUsage(db);
  await removeCardFromMoodboard(root, cardId);
}

export async function emptyTrashFromStorage(libraryRoot: string): Promise<number> {
  const root = path.resolve(libraryRoot);
  const db = openLibraryDb(root);
  const ids = db
    .prepare('SELECT id FROM cards WHERE COALESCE(is_deleted, 0) = 1')
    .all()
    .map((r) => String((r as { id: string }).id));
  for (const id of ids) {
    await deleteCardFromStorage(root, id);
  }
  return ids.length;
}

export function listExpiredTrashCardIds(libraryRoot: string, cutoffIso: string): string[] {
  const root = path.resolve(libraryRoot);
  const rows =
    withLibraryDbReadonly(root, (db) =>
      db
        .prepare('SELECT id, deleted_at FROM cards WHERE COALESCE(is_deleted, 0) = 1')
        .all() as Array<{ id: string; deleted_at: string | null }>
    ) ?? [];
  return rows.filter((r) => isExpiredDeletedAt(r.deleted_at, cutoffIso)).map((r) => String(r.id));
}

// --- Categories (shared catalog) ---
export function listCategories(_libraryRoot?: string): CategoryRow[] {
  const { listCatalogCategories } = require('./tagCatalog') as typeof import('./tagCatalog');
  return listCatalogCategories().map(
    ({ visibilityMode: _m, visibilityLibraryIds: _v, visibleInActive: _a, ...rest }) => rest
  );
}

export function listCategoriesWithVisibility(activeLibraryId?: string | null) {
  const { listCatalogCategories } = require('./tagCatalog') as typeof import('./tagCatalog');
  return listCatalogCategories(activeLibraryId);
}

export function upsertCategory(
  _libraryRoot: string,
  cat: CategoryRow & {
    visibilityMode?: 'all' | 'libraries';
    visibilityLibraryIds?: string[];
  }
): void {
  const { upsertCatalogCategory } = require('./tagCatalog') as typeof import('./tagCatalog');
  upsertCatalogCategory({
    ...cat,
    visibilityMode: cat.visibilityMode ?? 'all',
    visibilityLibraryIds: cat.visibilityLibraryIds ?? []
  });
}

export async function deleteCategoryFromDb(_libraryRoot: string, id: string): Promise<void> {
  const { deleteCatalogCategory } = await import('./tagCatalog');
  const tagIds = deleteCatalogCategory(id);
  for (const tagId of tagIds) {
    await stripTagFromAllLibraries(tagId);
  }
}

// --- Tags (shared catalog) ---
export function listTagsByCategory(_libraryRoot: string, categoryId: string): TagRow[] {
  const { listCatalogTagsByCategory } = require('./tagCatalog') as typeof import('./tagCatalog');
  return listCatalogTagsByCategory(categoryId);
}

export function listAllTags(_libraryRoot?: string): TagRow[] {
  const { listAllCatalogTags } = require('./tagCatalog') as typeof import('./tagCatalog');
  return listAllCatalogTags();
}

export function upsertTag(_libraryRoot: string, tag: TagRow): void {
  const { upsertCatalogTag } = require('./tagCatalog') as typeof import('./tagCatalog');
  upsertCatalogTag(tag);
}

export async function deleteTagFromDb(_libraryRoot: string, tagId: string): Promise<void> {
  await stripTagFromAllLibraries(tagId);
  const { deleteCatalogTag } = await import('./tagCatalog');
  deleteCatalogTag(tagId);
}

/** Remove tag from card_tags + card.json in every registered library. */
export async function stripTagFromAllLibraries(tagId: string): Promise<number> {
  const { readLibraryRootConfigSync } = await import('../librarySessionSnapshot');
  const { openChildIndexDb } = await import('./tagCatalog');
  const cfg = readLibraryRootConfigSync();
  let stripped = 0;
  for (const lib of cfg.libraries ?? []) {
    stripped += await stripTagFromLibraryPath(lib.path, tagId, openChildIndexDb);
  }
  return stripped;
}

export async function stripTagFromLibraryPath(
  libraryPath: string,
  tagId: string,
  openChild?: (p: string) => import('better-sqlite3').Database | null
): Promise<number> {
  const { openChildIndexDb } = await import('./tagCatalog');
  const open = openChild ?? openChildIndexDb;
  const db = open(libraryPath);
  if (!db) return 0;
  try {
    const cardIds = (
      db.prepare('SELECT card_id FROM card_tags WHERE tag_id = ?').all(tagId) as Array<{
        card_id: string;
      }>
    ).map((r) => String(r.card_id));
    for (const cardId of cardIds) {
      const cardJson = await readCardJson(libraryPath, cardId);
      if (cardJson) {
        cardJson.tagIds = cardJson.tagIds.filter((tid) => tid !== tagId);
        await writeCardJson(libraryPath, cardJson);
      }
    }
    db.prepare('DELETE FROM card_tags WHERE tag_id = ?').run(tagId);
    return cardIds.length;
  } finally {
    try {
      db.close();
    } catch {
      /* ignore */
    }
  }
}

export type MergeTagsTargetMetadata = {
  name: string;
  description?: string;
  tooltipImage?: string;
};

/** Прежний состав меток карточки — общая часть отмены для слияния и удаления. */
export type TagCardsSnapshot = Array<{ libraryPath: string; cardId: string; tagIds: string[] }>;

/** Прежнее состояние каталога и карточек — для отмены слияния. */
export type MergeTagsUndo = {
  targetTagId: string;
  previousTarget: TagRow;
  removedTags: TagRow[];
  cards: TagCardsSnapshot;
};

/** Прежнее состояние каталога и карточек — для отмены удаления меток. */
export type DeleteTagsUndo = {
  removedTags: TagRow[];
  cards: TagCardsSnapshot;
};

/** Заменяет исходные метки целевой, сохраняя порядок и убирая дубликаты. */
export function replaceTagIds(
  tagIds: readonly string[],
  sources: ReadonlySet<string>,
  targetTagId: string
): string[] {
  const next: string[] = [];
  for (const id of tagIds) {
    const mapped = sources.has(id) ? targetTagId : id;
    if (!next.includes(mapped)) next.push(mapped);
  }
  return next;
}

/** Убирает удаляемые метки, сохраняя порядок остальных. */
export function removeTagIds(tagIds: readonly string[], removed: ReadonlySet<string>): string[] {
  const next: string[] = [];
  for (const id of tagIds) {
    if (removed.has(id) || next.includes(id)) continue;
    next.push(id);
  }
  return next;
}

/** id карточки — один сегмент пути: без разделителей и переходов вверх. */
function isPlainCardId(cardId: string): boolean {
  return cardId.length > 0 && !/[\\/]/.test(cardId) && cardId !== '.' && cardId !== '..';
}

async function applyCardTagIds(
  libraryPath: string,
  db: Database.Database,
  cardId: string,
  tagIds: readonly string[]
): Promise<void> {
  const cardJson = await readCardJson(libraryPath, cardId);
  if (cardJson) {
    cardJson.tagIds = [...tagIds];
    await writeCardJson(libraryPath, cardJson);
  }
  db.prepare('DELETE FROM card_tags WHERE card_id = ?').run(cardId);
  const ins = db.prepare('INSERT OR IGNORE INTO card_tags (card_id, tag_id) VALUES (?, ?)');
  for (const tagId of tagIds) ins.run(cardId, tagId);
}

/**
 * Перезаписывает состав меток у всех карточек, где встречается любая из `tagIds`,
 * и возвращает снимок прежнего состава для отмены.
 */
async function rewriteCardsWithTags(
  tagIds: ReadonlySet<string>,
  nextTagIds: (previous: readonly string[]) => string[]
): Promise<TagCardsSnapshot> {
  const { openChildIndexDb } = await import('./tagCatalog');
  const { readLibraryRootConfigSync } = await import('../librarySessionSnapshot');

  const snapshot: TagCardsSnapshot = [];
  if (tagIds.size === 0) return snapshot;
  const cfg = readLibraryRootConfigSync();
  const placeholders = [...tagIds].map(() => '?').join(', ');

  for (const lib of cfg.libraries ?? []) {
    const db = openChildIndexDb(lib.path);
    if (!db) continue;
    try {
      const cardIds = (
        db
          .prepare(`SELECT DISTINCT card_id FROM card_tags WHERE tag_id IN (${placeholders})`)
          .all(...tagIds) as Array<{ card_id: string }>
      ).map((r) => String(r.card_id));

      for (const cardId of cardIds) {
        const cardJson = await readCardJson(lib.path, cardId);
        const previous = cardJson
          ? [...cardJson.tagIds]
          : (
              db.prepare('SELECT tag_id FROM card_tags WHERE card_id = ?').all(cardId) as Array<{
                tag_id: string;
              }>
            ).map((r) => String(r.tag_id));
        snapshot.push({ libraryPath: lib.path, cardId, tagIds: previous });
        await applyCardTagIds(lib.path, db, cardId, nextTagIds(previous));
      }
    } finally {
      try {
        db.close();
      } catch {
        /* ignore */
      }
    }
  }

  return snapshot;
}

/**
 * Возвращает карточкам прежний состав меток по снимку.
 * Снимок приходит из renderer, поэтому пути принимаются только из библиотек контейнера,
 * а `cardId` — без разделителей пути: иначе запись ушла бы мимо текущего контейнера.
 */
async function restoreCardsSnapshot(cards: TagCardsSnapshot): Promise<void> {
  const { openChildIndexDb } = await import('./tagCatalog');
  const { readLibraryRootConfigSync } = await import('../librarySessionSnapshot');

  const allowedPaths = new Set(
    (readLibraryRootConfigSync().libraries ?? []).map((lib) => path.resolve(lib.path))
  );

  const byLibrary = new Map<string, TagCardsSnapshot>();
  for (const entry of cards) {
    if (!allowedPaths.has(path.resolve(entry.libraryPath))) continue;
    if (!isPlainCardId(entry.cardId)) continue;
    const list = byLibrary.get(entry.libraryPath) ?? [];
    list.push(entry);
    byLibrary.set(entry.libraryPath, list);
  }

  for (const [libraryPath, entries] of byLibrary) {
    const db = openChildIndexDb(libraryPath);
    if (!db) continue;
    try {
      for (const entry of entries) {
        await applyCardTagIds(libraryPath, db, entry.cardId, entry.tagIds);
      }
    } finally {
      try {
        db.close();
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Переносит все привязки исходных меток на целевую и удаляет исходные из каталога.
 * Категория целевой метки не меняется; имя, описание и картинку задаёт вызывающий.
 */
export async function mergeTagsInStorage(params: {
  targetTagId: string;
  sourceTagIds: readonly string[];
  targetMetadata: MergeTagsTargetMetadata;
}): Promise<MergeTagsUndo> {
  const { listAllCatalogTags, upsertCatalogTag, deleteCatalogTag } = await import('./tagCatalog');

  const catalog = listAllCatalogTags();
  const previousTarget = catalog.find((t) => t.id === params.targetTagId);
  if (!previousTarget) throw new Error('Целевая метка не найдена');

  const sourceTagIds = [...new Set(params.sourceTagIds)].filter((id) => id !== params.targetTagId);
  const removedTags = sourceTagIds
    .map((id) => catalog.find((t) => t.id === id))
    .filter((t): t is TagRow => t !== undefined);
  if (removedTags.length === 0) throw new Error('Нет меток для слияния');

  const sources = new Set(removedTags.map((t) => t.id));
  const cards = await rewriteCardsWithTags(sources, (previous) =>
    replaceTagIds(previous, sources, params.targetTagId)
  );

  upsertCatalogTag({
    ...previousTarget,
    name: params.targetMetadata.name.trim(),
    description: params.targetMetadata.description,
    tooltipImage: params.targetMetadata.tooltipImage
  });
  for (const tag of removedTags) deleteCatalogTag(tag.id);
  recomputeTagUsage();

  return { targetTagId: params.targetTagId, previousTarget, removedTags, cards };
}

/** Возвращает каталог и карточки в состояние до `mergeTagsInStorage`. */
export async function undoMergeTagsInStorage(undo: MergeTagsUndo): Promise<void> {
  const { upsertCatalogTag } = await import('./tagCatalog');

  upsertCatalogTag(undo.previousTarget);
  for (const tag of undo.removedTags) upsertCatalogTag(tag);
  await restoreCardsSnapshot(undo.cards);

  recomputeTagUsage();
}

/** Удаляет метки из каталога и снимает их со всех карточек во всех библиотеках. */
export async function deleteTagsInStorage(tagIds: readonly string[]): Promise<DeleteTagsUndo> {
  const { listAllCatalogTags, deleteCatalogTag } = await import('./tagCatalog');

  const catalog = listAllCatalogTags();
  const removedTags = [...new Set(tagIds)]
    .map((id) => catalog.find((t) => t.id === id))
    .filter((t): t is TagRow => t !== undefined);
  if (removedTags.length === 0) throw new Error('Нет меток для удаления');

  const removed = new Set(removedTags.map((t) => t.id));
  const cards = await rewriteCardsWithTags(removed, (previous) => removeTagIds(previous, removed));

  for (const tag of removedTags) deleteCatalogTag(tag.id);
  recomputeTagUsage();

  return { removedTags, cards };
}

/** Возвращает каталог и карточки в состояние до `deleteTagsInStorage`. */
export async function undoDeleteTagsInStorage(undo: DeleteTagsUndo): Promise<void> {
  const { upsertCatalogTag } = await import('./tagCatalog');

  for (const tag of undo.removedTags) upsertCatalogTag(tag);
  await restoreCardsSnapshot(undo.cards);

  recomputeTagUsage();
}

export async function stripTagsOfCategoryFromLibraries(
  categoryId: string,
  libraryIds: string[]
): Promise<number> {
  const { listCatalogTagsByCategory, openChildIndexDb } = await import('./tagCatalog');
  const { readLibraryRootConfigSync } = await import('../librarySessionSnapshot');
  const tags = listCatalogTagsByCategory(categoryId);
  const cfg = readLibraryRootConfigSync();
  const paths = (cfg.libraries ?? [])
    .filter((l) => libraryIds.includes(l.id))
    .map((l) => l.path);
  let total = 0;
  for (const tag of tags) {
    for (const libPath of paths) {
      total += await stripTagFromLibraryPath(libPath, tag.id, openChildIndexDb);
    }
  }
  return total;
}

export function countCardsWithTagIdsInLibraries(
  tagIds: string[],
  libraryIds: string[]
): number {
  if (tagIds.length === 0 || libraryIds.length === 0) return 0;
  const { openChildIndexDb } = require('./tagCatalog') as typeof import('./tagCatalog');
  const { readLibraryRootConfigSync } = require('../librarySessionSnapshot') as typeof import('../librarySessionSnapshot');
  const cfg = readLibraryRootConfigSync();
  const paths = (cfg.libraries ?? []).filter((l) => libraryIds.includes(l.id)).map((l) => l.path);
  const placeholders = tagIds.map(() => '?').join(',');
  let total = 0;
  for (const libPath of paths) {
    const db = openChildIndexDb(libPath);
    if (!db) continue;
    try {
      const row = db
        .prepare(
          `SELECT COUNT(DISTINCT ct.card_id) AS n FROM card_tags ct
           INNER JOIN cards c ON c.id = ct.card_id AND COALESCE(c.is_deleted, 0) = 0
           WHERE ct.tag_id IN (${placeholders})`
        )
        .get(...tagIds) as { n: number };
      total += Number(row?.n ?? 0);
    } finally {
      try {
        db.close();
      } catch {
        /* ignore */
      }
    }
  }
  return total;
}

// --- Collections ---
export function listCollections(libraryRoot: string): CollectionRow[] {
  const db = openLibraryDb(libraryRoot);
  return db
    .prepare('SELECT * FROM collections ORDER BY sort_index ASC, name ASC')
    .all()
    .map((r) => {
      const row = r as Record<string, unknown>;
      const parentRaw = row.parent_id;
      const parentId =
        typeof parentRaw === 'string' && parentRaw.trim() ? parentRaw.trim() : undefined;
      return {
        id: String(row.id),
        name: String(row.name),
        createdAt: String(row.created_at),
        sortIndex: typeof row.sort_index === 'number' ? row.sort_index : Number(row.sort_index) || 0,
        ...(typeof row.description === 'string' && row.description.trim()
          ? { description: row.description.trim() }
          : {}),
        ...(parentId ? { parentId } : {})
      };
    });
}

export function upsertCollection(libraryRoot: string, col: CollectionRow): void {
  const db = openLibraryDb(libraryRoot);
  const existing = listCollections(libraryRoot);
  const parentId = collectionParentId(col);
  if (parentId) assertCollectionParentIsRoot(existing.filter((item) => item.id !== col.id).concat(col), parentId);
  if (siblingNameTaken(existing, col.name, parentId, col.id)) {
    throw new Error(parentId ? 'Раздел с таким названием уже есть' : 'Коллекция с таким названием уже есть');
  }
  db.prepare(
    `INSERT INTO collections (id, name, created_at, sort_index, description, parent_id) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name,
       sort_index=excluded.sort_index,
       description=excluded.description,
       parent_id=excluded.parent_id`
  ).run(col.id, col.name, col.createdAt, col.sortIndex, col.description ?? null, parentId);
}

async function rewriteCardCollectionIds(
  libraryRoot: string,
  cardId: string,
  nextIds: string[]
): Promise<void> {
  const cardJson = await readCardJson(libraryRoot, cardId);
  if (!cardJson) return;
  const prev = [...cardJson.collectionIds].sort().join('\0');
  const next = [...nextIds].sort().join('\0');
  if (prev === next) return;
  await updateCardInStorage(libraryRoot, cardId, { collectionIds: nextIds });
}

function listCardIdsLinkedToCollections(libraryRoot: string, collectionIds: string[]): string[] {
  if (collectionIds.length === 0) return [];
  const db = openLibraryDb(libraryRoot);
  const placeholders = collectionIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT DISTINCT card_id FROM card_collections WHERE collection_id IN (${placeholders})`
    )
    .all(...collectionIds) as Array<{ card_id: string }>;
  return rows.map((row) => String(row.card_id));
}

export async function deleteCollectionFromDb(libraryRoot: string, id: string): Promise<void> {
  const root = path.resolve(libraryRoot);
  const collections = listCollections(root);
  const target = collections.find((item) => item.id === id);
  if (!target) return;
  const removeIds = descendantOrSelfIds(collections, id);
  const cardIds = listCardIdsLinkedToCollections(root, removeIds);
  for (const cardId of cardIds) {
    const cardJson = await readCardJson(root, cardId);
    if (!cardJson) continue;
    const nextIds = removeIds.reduce(
      (ids, collectionId) => removeCollectionFromCardIds(ids, collectionId, collections),
      cardJson.collectionIds
    );
    await rewriteCardCollectionIds(root, cardId, nextIds);
  }
  const db = openLibraryDb(root);
  const placeholders = removeIds.map(() => '?').join(',');
  db.prepare(`DELETE FROM card_collections WHERE collection_id IN (${placeholders})`).run(...removeIds);
  db.prepare(`DELETE FROM collections WHERE id IN (${placeholders})`).run(...removeIds);
}

export async function mergeCollectionInto(
  libraryRoot: string,
  sourceId: string,
  targetId: string
): Promise<void> {
  if (sourceId === targetId) return;
  const root = path.resolve(libraryRoot);
  const collections = listCollections(root);
  const source = collections.find((item) => item.id === sourceId);
  const target = collections.find((item) => item.id === targetId);
  if (!source || !target) throw new Error('Коллекция не найдена');
  if (!isCollectionSection(source) || !isCollectionSection(target)) {
    throw new Error('Сливать можно только разделы');
  }
  const cardIds = listCardIdsLinkedToCollections(root, [sourceId]);
  for (const cardId of cardIds) {
    const cardJson = await readCardJson(root, cardId);
    if (!cardJson) continue;
    let ids = addCollectionToCardIds(cardJson.collectionIds, targetId, collections);
    ids = removeCollectionFromCardIds(ids, sourceId, collections);
    await rewriteCardCollectionIds(root, cardId, ids);
  }
  await deleteCollectionFromDb(root, sourceId);
}

export async function duplicateCollection(libraryRoot: string, sourceId: string): Promise<CollectionRow> {
  const root = path.resolve(libraryRoot);
  const collections = listCollections(root);
  const source = collections.find((item) => item.id === sourceId);
  if (!source) throw new Error('Коллекция не найдена');
  const parentId = collectionParentId(source);
  const copy: CollectionRow = {
    id: crypto.randomUUID(),
    name: uniqueCopyName(collections, source.name, parentId),
    createdAt: new Date().toISOString(),
    sortIndex: source.sortIndex + 1,
    ...(source.description ? { description: source.description } : {}),
    ...(parentId ? { parentId } : {})
  };
  upsertCollection(root, copy);
  const siblings = collections.filter(
    (item) => collectionParentId(item) === parentId && item.id !== source.id
  );
  for (const sibling of siblings) {
    if (sibling.sortIndex > source.sortIndex) {
      upsertCollection(root, { ...sibling, sortIndex: sibling.sortIndex + 1 });
    }
  }
  const cardIds = listCardIdsLinkedToCollections(root, [sourceId]);
  const nextCollections = [...collections, copy];
  for (const cardId of cardIds) {
    const cardJson = await readCardJson(root, cardId);
    if (!cardJson) continue;
    await rewriteCardCollectionIds(
      root,
      cardId,
      addCollectionToCardIds(cardJson.collectionIds, copy.id, nextCollections)
    );
  }
  return copy;
}

export async function moveCollectionToParent(
  libraryRoot: string,
  sectionId: string,
  newParentId: string
): Promise<void> {
  const root = path.resolve(libraryRoot);
  const collections = listCollections(root);
  const section = collections.find((item) => item.id === sectionId);
  if (!section) throw new Error('Раздел не найден');
  if (!isCollectionSection(section)) throw new Error('Переносить можно только раздел');
  const oldParentId = collectionParentId(section);
  if (!oldParentId) throw new Error('Раздел не найден');
  if (oldParentId === newParentId) return;
  assertCollectionParentIsRoot(collections, newParentId);
  const moved: CollectionRow = {
    ...section,
    parentId: newParentId,
    name: uniqueSiblingName(collections, section.name, newParentId, sectionId)
  };
  upsertCollection(root, moved);
  const nextCollections = collections.map((item) => (item.id === sectionId ? moved : item));
  const cardIds = listCardIdsLinkedToCollections(root, [sectionId]);
  for (const cardId of cardIds) {
    const cardJson = await readCardJson(root, cardId);
    if (!cardJson) continue;
    const stripped = cardJson.collectionIds.filter((id) => id !== oldParentId);
    await rewriteCardCollectionIds(
      root,
      cardId,
      normalizeCardCollectionIds(stripped, nextCollections)
    );
  }
}

export function getCollectionCardCounts(libraryRoot: string): Record<string, number> {
  const db = openLibraryDb(libraryRoot);
  const rows = db
    .prepare(
      `SELECT c.id AS collection_id,
              COUNT(DISTINCT CASE WHEN COALESCE(card.is_deleted, 0) = 0 THEN cc.card_id END) AS n
       FROM collections c
       LEFT JOIN collections child ON child.parent_id = c.id
       LEFT JOIN card_collections cc
         ON cc.collection_id = c.id OR cc.collection_id = child.id
       LEFT JOIN cards card ON card.id = cc.card_id
       GROUP BY c.id`
    )
    .all() as Array<{ collection_id: string; n: number }>;
  const m: Record<string, number> = {};
  for (const r of rows) m[r.collection_id] = Number(r.n) || 0;
  return m;
}

/** До N последних карточек на коллекцию — без загрузки всей библиотеки в renderer. */
export function getCollectionPreviewSlicesFromDb(
  libraryRoot: string,
  limitPerCollection: number
): Record<string, CardIndexRow[]> {
  const db = openLibraryDb(libraryRoot);
  const collections = db.prepare('SELECT id FROM collections').all() as Array<{ id: string }>;
  const limit = Math.max(1, Math.min(limitPerCollection, 20));
  const out: Record<string, CardIndexRow[]> = {};
  for (const col of collections) {
    out[col.id] = [];
  }
  const stmt = db.prepare(
    `SELECT c.* FROM cards c
     WHERE COALESCE(c.is_deleted, 0) = 0
       AND c.id IN (
         SELECT card_id FROM card_collections
         WHERE collection_id = ?
            OR collection_id IN (SELECT id FROM collections WHERE parent_id = ?)
       )
     ORDER BY c.added_at DESC
     LIMIT ?`
  );
  for (const col of collections) {
    const rows = stmt.all(col.id, col.id, limit) as Record<string, unknown>[];
    out[col.id] = indexCardRowsWithRelations(db, rows);
  }
  return out;
}

export function getCollectionStats(libraryRoot: string, collectionId: string): CollectionStatsRow | null {
  const db = openLibraryDb(libraryRoot);
  const col = db.prepare('SELECT created_at FROM collections WHERE id = ?').get(collectionId) as
    | { created_at: string }
    | undefined;
  if (!col) return null;
  const agg = db
    .prepare(
      `SELECT COUNT(DISTINCT c.id) AS card_count, COALESCE(SUM(c.file_size), 0) AS total_size
       FROM card_collections cc
       INNER JOIN cards c ON c.id = cc.card_id AND COALESCE(c.is_deleted, 0) = 0
       WHERE cc.collection_id = ?
          OR cc.collection_id IN (SELECT id FROM collections WHERE parent_id = ?)`
    )
    .get(collectionId, collectionId) as { card_count: number; total_size: number };
  const totalBytes = Number(agg?.total_size) || 0;
  return {
    cardCount: Number(agg?.card_count) || 0,
    totalSizeMb: Math.round((totalBytes / (1024 * 1024)) * 100) / 100,
    createdAt: String(col.created_at)
  };
}

// --- Moodboard & system ---
export async function getMoodboardData(libraryRoot: string): Promise<ArcMoodboardV1> {
  await ensureLibraryReady(libraryRoot);
  return readMoodboard(libraryRoot);
}

export async function saveMoodboardData(libraryRoot: string, data: ArcMoodboardV1): Promise<void> {
  await ensureLibraryReady(libraryRoot);
  await writeMoodboard(libraryRoot, data);
}

export async function getSystemData(libraryRoot: string): Promise<ArcSystemV1> {
  await ensureLibraryReady(libraryRoot);
  return readSystem(libraryRoot);
}

export async function saveSystemData(libraryRoot: string, data: ArcSystemV1): Promise<void> {
  await ensureLibraryReady(libraryRoot);
  await writeSystem(libraryRoot, data);
}

function isGifVideoCard(cardJson: CardJsonV1): boolean {
  return (cardJson.format ?? '').toLowerCase() === 'gif';
}

export async function setVideoPreviewFrame(
  libraryRoot: string,
  cardId: string,
  frameMs: number
): Promise<CardIndexRow> {
  const root = path.resolve(libraryRoot);
  const db = await ensureLibraryReady(root);
  const cardJson = await readCardJson(root, cardId);
  if (!cardJson) throw new Error('Карточка не найдена');
  if (cardJson.type !== 'video') throw new Error('Выбор кадра доступен только для видео');
  if (isGifVideoCard(cardJson)) throw new Error('Выбор кадра недоступен для GIF');

  const row = loadCardRow(db, cardId);
  if (!row?.originalRel) throw new Error('Карточка не найдена');

  const durationMs =
    cardJson.durationMs ?? row.durationMs ?? (await probeVideoDurationMs(path.join(root, row.originalRel.replace(/\//g, path.sep)))) ?? 0;
  const clampedMs = Math.max(0, Math.min(Math.round(frameMs), Math.max(0, durationMs)));

  if (!cardJson.videoWidth || !cardJson.videoHeight) {
    const originalAbs = path.join(root, row.originalRel.replace(/\//g, path.sep));
    const dims = await probeVideoDimensions(originalAbs);
    if (dims) {
      cardJson.videoWidth = dims.width;
      cardJson.videoHeight = dims.height;
    } else if (row.width && row.height) {
      cardJson.videoWidth = row.width;
      cardJson.videoHeight = row.height;
    }
  }

  const dir = cardDirAbs(root, cardId);
  const originalAbs = path.join(root, row.originalRel.replace(/\//g, path.sep));
  const thumbSAbs = path.join(dir, 'thumb_s.webp');
  const thumbMAbs = path.join(dir, 'thumb_m.webp');
  const thumbLAbs = path.join(dir, 'thumb_l.webp');
  const frameTmp = path.join(dir, '_preview_frame.jpg');

  try {
    await extractVideoFrameToJpeg(originalAbs, frameTmp, {
      atMs: clampedMs > 0 ? clampedMs : undefined
    });
    const thumbRes = await generateVideoThumbnailsFromFrame(frameTmp, thumbSAbs, thumbMAbs, thumbLAbs);
    const modified = new Date().toISOString();

    cardJson.previewFrameMs = clampedMs;
    cardJson.width = thumbRes.width || cardJson.width;
    cardJson.height = thumbRes.height || cardJson.height;
    cardJson.dominantColorHex = thumbRes.dominantColorHex;
    cardJson.dateModified = modified;

    await writeCardJson(root, cardJson);

    db.prepare(
      `UPDATE cards SET width = ?, height = ?, dominant_color = ?, palette_json = ?, date_modified = ? WHERE id = ?`
    ).run(
      cardJson.width ?? null,
      cardJson.height ?? null,
      thumbRes.dominantColorHex,
      JSON.stringify(thumbRes.palette),
      modified,
      cardId
    );

    const updated = loadCardRow(db, cardId);
    if (!updated) throw new Error('Карточка не найдена');
    return updated;
  } finally {
    try {
      await unlink(frameTmp);
    } catch {
      /* ignore */
    }
  }
}

async function clampVideoFrameMs(
  root: string,
  cardId: string,
  cardJson: Awaited<ReturnType<typeof readCardJson>>,
  row: CardIndexRow,
  frameMs: number
): Promise<{ clampedMs: number; originalAbs: string }> {
  if (!cardJson || cardJson.type !== 'video') throw new Error('Кадр доступен только для видео');
  if (isGifVideoCard(cardJson)) throw new Error('Кадр недоступен для GIF');
  if (!row?.originalRel) throw new Error('Карточка не найдена');

  const originalAbs = path.join(root, row.originalRel.replace(/\//g, path.sep));
  const durationMs =
    cardJson.durationMs ??
    row.durationMs ??
    (await probeVideoDurationMs(originalAbs)) ??
    0;
  const clampedMs = Math.max(0, Math.min(Math.round(frameMs), Math.max(0, durationMs)));
  return { clampedMs, originalAbs };
}

export async function saveVideoFrameToCardFolder(
  libraryRoot: string,
  cardId: string,
  frameMs: number
): Promise<{ relativePath: string }> {
  const root = path.resolve(libraryRoot);
  const db = await ensureLibraryReady(root);
  const cardJson = await readCardJson(root, cardId);
  if (!cardJson) throw new Error('Карточка не найдена');
  const row = loadCardRow(db, cardId);
  if (!row?.originalRel) throw new Error('Карточка не найдена');

  const { clampedMs, originalAbs } = await clampVideoFrameMs(root, cardId, cardJson, row, frameMs);
  const framesDir = path.join(cardDirAbs(root, cardId), 'frames');
  await mkdir(framesDir, { recursive: true });
  const fileName = `frame-${clampedMs}.png`;
  const outputAbs = path.join(framesDir, fileName);
  await extractVideoFrameToPng(originalAbs, outputAbs, {
    atMs: clampedMs > 0 ? clampedMs : undefined
  });
  const relativePath = `${CARDS_DIR}/${cardId}/frames/${fileName}`;
  return { relativePath };
}

export async function copyVideoFrameToClipboard(
  libraryRoot: string,
  cardId: string,
  frameMs: number,
  writeImage: (imagePath: string) => void
): Promise<void> {
  const root = path.resolve(libraryRoot);
  const db = await ensureLibraryReady(root);
  const cardJson = await readCardJson(root, cardId);
  if (!cardJson) throw new Error('Карточка не найдена');
  const row = loadCardRow(db, cardId);
  if (!row?.originalRel) throw new Error('Карточка не найдена');

  const { clampedMs, originalAbs } = await clampVideoFrameMs(root, cardId, cardJson, row, frameMs);
  const frameTmp = path.join(cardDirAbs(root, cardId), `_clipboard_frame_${process.pid}.png`);
  try {
    await extractVideoFrameToPng(originalAbs, frameTmp, {
      atMs: clampedMs > 0 ? clampedMs : undefined
    });
    writeImage(frameTmp);
  } finally {
    try {
      await unlink(frameTmp);
    } catch {
      /* ignore */
    }
  }
}

export async function replaceCardOriginalFromFile(
  libraryRoot: string,
  cardId: string,
  sourceAbs: string
): Promise<void> {
  const root = path.resolve(libraryRoot);
  const db = await ensureLibraryReady(root);
  const cardJson = await readCardJson(root, cardId);
  if (!cardJson) throw new Error('Карточка не найдена');
  if (cardJson.type !== 'image') throw new Error('Замена исходника поддерживается только для изображений');

  const resolved = path.resolve(sourceAbs);
  const ext = path.extname(resolved);
  const dir = cardDirAbs(root, cardId);

  const row = db.prepare('SELECT original_rel FROM cards WHERE id = ?').get(cardId) as
    | { original_rel: string }
    | undefined;
  if (row?.original_rel) {
    const oldAbs = path.join(root, row.original_rel.replace(/\//g, path.sep));
    try {
      await unlink(oldAbs);
    } catch {
      /* ignore */
    }
  }

  const thumbSAbs = path.join(dir, 'thumb_s.webp');
  const thumbMAbs = path.join(dir, 'thumb_m.webp');
  const thumbLAbs = path.join(dir, 'thumb_l.webp');
  for (const thumb of [thumbSAbs, thumbMAbs, thumbLAbs]) {
    try {
      await unlink(thumb);
    } catch {
      /* ignore */
    }
  }

  const st = await stat(resolved);
  const { originalAbs, originalRel } = await copyOriginalToCard(root, cardId, resolved, ext);
  const thumbRes = await generateImageThumbnails(originalAbs, thumbSAbs, thumbMAbs, thumbLAbs, true);

  const modified = new Date().toISOString();
  cardJson.format = ext.slice(1).toLowerCase();
  cardJson.width = thumbRes.width || undefined;
  cardJson.height = thumbRes.height || undefined;
  cardJson.fileSize = st.size;
  cardJson.dateModified = modified;
  cardJson.originalFileName = path.basename(resolved);
  if (thumbRes.phash) cardJson.phash = thumbRes.phash;
  else delete cardJson.phash;
  if (thumbRes.dominantColorHex) cardJson.dominantColorHex = thumbRes.dominantColorHex;

  try {
    cardJson.mediaMeta = await extractMediaFileMeta(originalAbs, 'image');
  } catch {
    delete cardJson.mediaMeta;
  }

  await writeCardJson(root, cardJson);

  db.prepare(
    `UPDATE cards SET format = ?, width = ?, height = ?, file_size = ?, dominant_color = ?, palette_json = ?,
      phash_json = ?, original_rel = ?, date_modified = ? WHERE id = ?`
  ).run(
    cardJson.format ?? null,
    cardJson.width ?? null,
    cardJson.height ?? null,
    cardJson.fileSize ?? null,
    thumbRes.dominantColorHex,
    JSON.stringify(thumbRes.palette),
    thumbRes.phash ? JSON.stringify(thumbRes.phash) : null,
    originalRel,
    modified,
    cardId
  );
}

export async function mergeDuplicateCards(
  libraryRoot: string,
  primaryId: string,
  secondaryId: string
): Promise<void> {
  if (primaryId === secondaryId) throw new Error('Нельзя объединить карточку с собой');
  const root = path.resolve(libraryRoot);
  await ensureLibraryReady(root);

  const primaryJson = await readCardJson(root, primaryId);
  const secondaryJson = await readCardJson(root, secondaryId);
  if (!primaryJson || !secondaryJson) throw new Error('Карточка не найдена');

  const tagSet = new Set([...primaryJson.tagIds, ...secondaryJson.tagIds]);
  const colSet = new Set([...primaryJson.collectionIds, ...secondaryJson.collectionIds]);

  primaryJson.tagIds = [...tagSet];
  primaryJson.collectionIds = [...colSet];

  if (!primaryJson.name?.trim() && secondaryJson.name?.trim()) {
    primaryJson.name = secondaryJson.name.trim();
  }
  if (!primaryJson.linkUrl?.trim() && secondaryJson.linkUrl?.trim()) {
    primaryJson.linkUrl = secondaryJson.linkUrl.trim();
  }
  if (!primaryJson.description?.trim() && secondaryJson.description?.trim()) {
    primaryJson.description = secondaryJson.description.trim();
  }

  const modified = new Date().toISOString();
  primaryJson.dateModified = modified;
  await writeCardJson(root, primaryJson);

  const db = openLibraryDb(root);
  const applyPrimaryDb = db.transaction(() => {
    db.prepare(
      'UPDATE cards SET name = ?, link_url = ?, description = ?, date_modified = ? WHERE id = ?'
    ).run(
      primaryJson.name ?? null,
      primaryJson.linkUrl ?? null,
      primaryJson.description ?? null,
      modified,
      primaryId
    );
    syncCardRelations(db, primaryId, primaryJson.tagIds, primaryJson.collectionIds);
    recomputeTagUsage(db);
    const minId = primaryId < secondaryId ? primaryId : secondaryId;
    const maxId = primaryId < secondaryId ? secondaryId : primaryId;
    db.prepare('INSERT OR IGNORE INTO skipped_duplicate_pairs (min_id, max_id) VALUES (?, ?)').run(
      minId,
      maxId
    );
  });
  applyPrimaryDb();

  await softDeleteCardFromStorage(root, secondaryId);
}

function skippedPairRowsFromDb(db: Database.Database): [string, string][] {
  return db
    .prepare('SELECT min_id, max_id FROM skipped_duplicate_pairs')
    .all()
    .map((r) => {
      const row = r as { min_id: string; max_id: string };
      return [row.min_id, row.max_id] as [string, string];
    });
}

export function listSkippedDuplicatePairs(libraryRoot: string): [string, string][] {
  const db = openLibraryDb(libraryRoot);
  return skippedPairRowsFromDb(db);
}

export function listSkippedDuplicatePairsReadonly(libraryRoot: string): [string, string][] {
  return withLibraryDbReadonly(libraryRoot, skippedPairRowsFromDb) ?? [];
}

export function getCardByIdIsolated(libraryRoot: string, cardId: string): CardIndexRow | null {
  return withLibraryDbReadonly(libraryRoot, (db) => loadCardRow(db, cardId)) ?? null;
}

export function addSkippedDuplicatePair(libraryRoot: string, idA: string, idB: string): void {
  const db = openLibraryDb(libraryRoot);
  const minId = idA < idB ? idA : idB;
  const maxId = idA < idB ? idB : idA;
  db.prepare('INSERT OR IGNORE INTO skipped_duplicate_pairs (min_id, max_id) VALUES (?, ?)').run(minId, maxId);
}

/** Пишет игнор в указанную библиотеку, не переключая активный `openLibraryDb`. */
export function addSkippedDuplicatePairAtRoot(libraryRoot: string, idA: string, idB: string): void {
  const minId = idA < idB ? idA : idB;
  const maxId = idA < idB ? idB : idA;
  const wrote = withLibraryDb(libraryRoot, (db) => {
    db.prepare('INSERT OR IGNORE INTO skipped_duplicate_pairs (min_id, max_id) VALUES (?, ?)').run(minId, maxId);
    return true as const;
  });
  if (!wrote) addSkippedDuplicatePair(libraryRoot, idA, idB);
}

export function getCardsWithPhash(libraryRoot: string): Array<{ id: string; phash: ImageDupFingerprint }> {
  const db = openLibraryDb(libraryRoot);
  const rows = db
    .prepare(
      "SELECT id, phash_json FROM cards WHERE type = 'image' AND phash_json IS NOT NULL AND COALESCE(is_deleted, 0) = 0"
    )
    .all() as Array<{ id: string; phash_json: string }>;
  const out: Array<{ id: string; phash: ImageDupFingerprint }> = [];
  for (const r of rows) {
    try {
      out.push({ id: r.id, phash: JSON.parse(r.phash_json) as ImageDupFingerprint });
    } catch {
      /* skip */
    }
  }
  return out;
}

export async function rebuildIndexFromCardJson(libraryRoot: string): Promise<void> {
  const root = path.resolve(libraryRoot);
  const db = openLibraryDb(root);
  db.exec('DELETE FROM card_tags; DELETE FROM card_collections; DELETE FROM cards;');

  const cardsDir = path.join(root, CARDS_DIR);
  let entries: string[];
  try {
    entries = await readdir(cardsDir);
  } catch {
    return;
  }

  for (const cardId of entries) {
    const cardJson = await readCardJson(root, cardId);
    if (!cardJson) continue;
    const cardIdNorm = cardJson.id;
    const ext = cardJson.format ? `.${cardJson.format}` : path.extname(cardJson.originalFileName);
    const originalRel = `cards/${cardIdNorm}/original${ext.startsWith('.') ? ext : `.${ext}`}`;
    const thumbS = thumbSRelPath(cardIdNorm);
    const thumbM = thumbMRelPath(cardIdNorm);
    const thumbL = thumbLRelPath(cardIdNorm);

    const isDeleted = cardJson.deletedAt ? 1 : 0;
    const packed = serializeAnnotations(sanitizeCardAnnotations(cardJson.annotations ?? []));
    db.prepare(
      `INSERT INTO cards (
        id, type, added_at, date_modified, format, width, height, file_size, dominant_color, phash_json,
        original_rel, thumb_s_rel, thumb_m_rel, thumb_l_rel, description, rating, is_deleted, deleted_at,
        custom_fields_json, custom_fields_text, annotations_json, annotations_text
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      cardIdNorm,
      cardJson.type,
      cardJson.addedAt,
      cardJson.dateModified ?? null,
      cardJson.format ?? null,
      cardJson.width ?? null,
      cardJson.height ?? null,
      cardJson.fileSize ?? null,
      cardJson.dominantColorHex ?? null,
      cardJson.phash ? JSON.stringify(cardJson.phash) : null,
      originalRel,
      thumbS,
      thumbM,
      thumbL,
      cardJson.description ?? null,
      clampCardRating(cardJson.rating),
      isDeleted,
      cardJson.deletedAt ?? null,
      serializeCustomFieldsMap(sanitizeCustomFieldsMap(cardJson.customFields ?? {})),
      customFieldsMapToSearchText(sanitizeCustomFieldsMap(cardJson.customFields ?? {})),
      packed.json,
      packed.text
    );
    syncCardRelations(db, cardIdNorm, cardJson.tagIds, cardJson.collectionIds);
  }
  recomputeTagUsage(db);
}

export { rowToCardRecord, moveOriginalToCard, cardJsonExistsSync, indexDbPath, readAiCaptionFromDbRow };
