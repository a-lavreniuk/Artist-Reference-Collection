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
import { closeLibraryDb, indexDbPath, libraryUsesNewStorage, openLibraryDb } from './db';
import { ensureLibraryMetaDirLayout } from './libraryMetaLayout';
import { pruneLegacyTimestampedMetadataBackups } from './metadataBackup';
import { removeEmptyLegacyMediaDir } from './libraryCleanup';
import { defaultMoodboard, defaultSystem, readMoodboard, readSystem, writeMoodboard, writeSystem } from './systemFiles';
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
    durationMs: typeof row.duration_ms === 'number' ? row.duration_ms : undefined
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

function recomputeTagUsage(db: Database.Database): void {
  db.prepare(
    `UPDATE tags SET usage_count = (
      SELECT COUNT(*) FROM card_tags ct
      INNER JOIN cards c ON c.id = ct.card_id AND COALESCE(c.is_deleted, 0) = 0
      WHERE ct.tag_id = tags.id
    )`
  ).run();
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

  readyRoots.add(root);
  currentRoot = root;
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
    openLibraryDb(root);
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

export function listCardsFromDb(libraryRoot: string, params: ListCardsParams): CardIndexRow[] {
  const db = openLibraryDb(libraryRoot);
  const sort = params.sort ?? DEFAULT_GALLERY_SORT;
  const filters = params.advancedFilters ?? emptyGalleryAdvancedFilters();
  const boundaries = getGalleryFilterBoundaries(db, filters);
  const { wh, binds } = buildGalleryFilterWhere(
    {
      libraryScope: params.libraryScope,
      selectedTagIds: params.selectedTagIds,
      cardIdExact: params.cardIdExact,
      collectionId: params.collectionId,
      moodboardCardIds: params.moodboardCardIds,
      filters,
      sort
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

  sql += ` ${buildGallerySortSql(sort, 'c')} LIMIT ? OFFSET ?`;
  binds.push(params.limit, params.offset);

  const rows = db.prepare(sql).all(...binds) as Record<string, unknown>[];
  return indexCardRowsWithRelations(db, rows);
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
  patch: { tagIds?: string[]; collectionIds?: string[]; description?: string; name?: string; linkUrl?: string }
): Promise<void> {
  const root = path.resolve(libraryRoot);
  const db = await ensureLibraryReady(root);
  const cardJson = await readCardJson(root, cardId);
  if (!cardJson) throw new Error('Карточка не найдена');

  if (patch.tagIds) cardJson.tagIds = [...patch.tagIds];
  if (patch.collectionIds) cardJson.collectionIds = [...patch.collectionIds];
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
  vals.push(cardId);
  db.prepare(`UPDATE cards SET ${sets.join(', ')} WHERE id = ?`).run(...vals);

  if (patch.tagIds || patch.collectionIds) {
    syncCardRelations(db, cardId, cardJson.tagIds, cardJson.collectionIds);
    recomputeTagUsage(db);
  }
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

// --- Categories ---
export function listCategories(libraryRoot: string): CategoryRow[] {
  const db = openLibraryDb(libraryRoot);
  return db
    .prepare('SELECT * FROM categories ORDER BY sort_index ASC, created_at ASC')
    .all()
    .map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: String(row.id),
        name: String(row.name),
        colorHex: String(row.color_hex),
        weight: row.weight as CategoryRow['weight'],
        sortIndex: Number(row.sort_index),
        createdAt: String(row.created_at),
        ...(row.description ? { description: String(row.description) } : {})
      };
    });
}

export function upsertCategory(libraryRoot: string, cat: CategoryRow): void {
  const db = openLibraryDb(libraryRoot);
  db.prepare(
    `INSERT INTO categories (id, name, color_hex, weight, sort_index, created_at, description)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, color_hex=excluded.color_hex,
       weight=excluded.weight, sort_index=excluded.sort_index, description=excluded.description`
  ).run(
    cat.id,
    cat.name,
    cat.colorHex,
    cat.weight,
    cat.sortIndex,
    cat.createdAt,
    cat.description ?? null
  );
}

export async function deleteCategoryFromDb(libraryRoot: string, id: string): Promise<void> {
  const root = path.resolve(libraryRoot);
  const db = openLibraryDb(root);
  const tagIds = db
    .prepare('SELECT id FROM tags WHERE category_id = ?')
    .all(id)
    .map((r) => String((r as { id: string }).id));
  for (const tagId of tagIds) {
    await deleteTagFromDb(root, tagId);
  }
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
}

// --- Tags ---
export function listTagsByCategory(libraryRoot: string, categoryId: string): TagRow[] {
  const db = openLibraryDb(libraryRoot);
  return db
    .prepare('SELECT * FROM tags WHERE category_id = ? ORDER BY name ASC')
    .all(categoryId)
    .map(mapTagRow);
}

export function listAllTags(libraryRoot: string): TagRow[] {
  const db = openLibraryDb(libraryRoot);
  return db.prepare('SELECT * FROM tags ORDER BY name ASC').all().map(mapTagRow);
}

function mapTagRow(r: unknown): TagRow {
  const row = r as Record<string, unknown>;
  return {
    id: String(row.id),
    categoryId: String(row.category_id),
    name: String(row.name),
    usageCount: Number(row.usage_count ?? 0),
    description: row.description ? String(row.description) : undefined,
    tooltipImage: row.tooltip_image ? String(row.tooltip_image) : undefined
  };
}

export function upsertTag(libraryRoot: string, tag: TagRow): void {
  const db = openLibraryDb(libraryRoot);
  db.prepare(
    `INSERT INTO tags (id, category_id, name, usage_count, description, tooltip_image)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET category_id=excluded.category_id, name=excluded.name,
       usage_count=excluded.usage_count, description=excluded.description, tooltip_image=excluded.tooltip_image`
  ).run(tag.id, tag.categoryId, tag.name, tag.usageCount, tag.description ?? null, tag.tooltipImage ?? null);
}

export async function deleteTagFromDb(libraryRoot: string, tagId: string): Promise<void> {
  const root = path.resolve(libraryRoot);
  const db = openLibraryDb(root);
  const cardIds = db
    .prepare('SELECT card_id FROM card_tags WHERE tag_id = ?')
    .all(tagId)
    .map((r) => String((r as { card_id: string }).card_id));
  for (const cardId of cardIds) {
    const cardJson = await readCardJson(root, cardId);
    if (!cardJson) continue;
    cardJson.tagIds = cardJson.tagIds.filter((tid) => tid !== tagId);
    await writeCardJson(root, cardJson);
  }
  db.prepare('DELETE FROM card_tags WHERE tag_id = ?').run(tagId);
  db.prepare('DELETE FROM tags WHERE id = ?').run(tagId);
  recomputeTagUsage(db);
}

// --- Collections ---
export function listCollections(libraryRoot: string): CollectionRow[] {
  const db = openLibraryDb(libraryRoot);
  return db
    .prepare('SELECT * FROM collections ORDER BY sort_index ASC, name ASC')
    .all()
    .map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: String(row.id),
        name: String(row.name),
        createdAt: String(row.created_at),
        sortIndex: typeof row.sort_index === 'number' ? row.sort_index : Number(row.sort_index) || 0,
        ...(typeof row.description === 'string' && row.description.trim()
          ? { description: row.description.trim() }
          : {})
      };
    });
}

export function upsertCollection(libraryRoot: string, col: CollectionRow): void {
  const db = openLibraryDb(libraryRoot);
  db.prepare(
    `INSERT INTO collections (id, name, created_at, sort_index, description) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name,
       sort_index=excluded.sort_index,
       description=excluded.description`
  ).run(col.id, col.name, col.createdAt, col.sortIndex, col.description ?? null);
}

export async function deleteCollectionFromDb(libraryRoot: string, id: string): Promise<void> {
  const root = path.resolve(libraryRoot);
  const db = openLibraryDb(root);
  const cardIds = db
    .prepare('SELECT card_id FROM card_collections WHERE collection_id = ?')
    .all(id)
    .map((r) => String((r as { card_id: string }).card_id));
  for (const cardId of cardIds) {
    const cardJson = await readCardJson(root, cardId);
    if (!cardJson) continue;
    cardJson.collectionIds = cardJson.collectionIds.filter((cid) => cid !== id);
    await writeCardJson(root, cardJson);
  }
  db.prepare('DELETE FROM card_collections WHERE collection_id = ?').run(id);
  db.prepare('DELETE FROM collections WHERE id = ?').run(id);
}

export function getCollectionCardCounts(libraryRoot: string): Record<string, number> {
  const db = openLibraryDb(libraryRoot);
  const rows = db
    .prepare(
      `SELECT cc.collection_id, COUNT(*) AS n FROM card_collections cc
       INNER JOIN cards c ON c.id = cc.card_id AND COALESCE(c.is_deleted, 0) = 0
       GROUP BY cc.collection_id`
    )
    .all() as Array<{ collection_id: string; n: number }>;
  const m: Record<string, number> = {};
  for (const r of rows) m[r.collection_id] = r.n;
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
     INNER JOIN card_collections cc ON cc.card_id = c.id
     WHERE cc.collection_id = ? AND COALESCE(c.is_deleted, 0) = 0
     ORDER BY c.added_at DESC
     LIMIT ?`
  );
  for (const col of collections) {
    const rows = stmt.all(col.id, limit) as Record<string, unknown>[];
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
      `SELECT COUNT(*) AS card_count, COALESCE(SUM(c.file_size), 0) AS total_size
       FROM card_collections cc
       INNER JOIN cards c ON c.id = cc.card_id AND COALESCE(c.is_deleted, 0) = 0
       WHERE cc.collection_id = ?`
    )
    .get(collectionId) as { card_count: number; total_size: number };
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

export function listSkippedDuplicatePairs(libraryRoot: string): [string, string][] {
  const db = openLibraryDb(libraryRoot);
  return db
    .prepare('SELECT min_id, max_id FROM skipped_duplicate_pairs')
    .all()
    .map((r) => {
      const row = r as { min_id: string; max_id: string };
      return [row.min_id, row.max_id] as [string, string];
    });
}

export function addSkippedDuplicatePair(libraryRoot: string, idA: string, idB: string): void {
  const db = openLibraryDb(libraryRoot);
  const minId = idA < idB ? idA : idB;
  const maxId = idA < idB ? idB : idA;
  db.prepare('INSERT OR IGNORE INTO skipped_duplicate_pairs (min_id, max_id) VALUES (?, ?)').run(minId, maxId);
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
    db.prepare(
      `INSERT INTO cards (
        id, type, added_at, date_modified, format, width, height, file_size, dominant_color, phash_json,
        original_rel, thumb_s_rel, thumb_m_rel, thumb_l_rel, description, is_deleted, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      isDeleted,
      cardJson.deletedAt ?? null
    );
    syncCardRelations(db, cardIdNorm, cardJson.tagIds, cardJson.collectionIds);
  }
  recomputeTagUsage(db);
}

export { rowToCardRecord, moveOriginalToCard, cardJsonExistsSync, indexDbPath, readAiCaptionFromDbRow };
