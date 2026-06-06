import type Database from 'better-sqlite3';
import { mkdir, readdir, readFile, stat, unlink } from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { extractVideoFrameToJpeg, isVideoExt, probeVideoDimensions } from '../ffmpeg';
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
import type {
  ArcMoodboardV1,
  ArcSystemV1,
  CardIndexRow,
  CardJsonV1,
  CardType,
  CategoryRow,
  CollectionRow,
  ImageDupFingerprint,
  ImportedMediaRow,
  LibraryScope,
  ListCardsParams,
  TagRow
} from './types';

// TODO(settings-overlay): deleteCardsSkipTrash — при true deleteCard вызывает permanentDelete сразу
export const DELETE_CARDS_SKIP_TRASH_DEFAULT = false;

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);

function isImageExt(ext: string): boolean {
  return IMAGE_EXT.has(ext.toLowerCase());
}

function rowToCardRecord(row: CardIndexRow): CardIndexRow & { thumbRelativePath: string } {
  return {
    ...row,
    thumbRelativePath: row.thumbSRel
  };
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
    phashJson: row.phash_json ? String(row.phash_json) : undefined,
    originalRel: String(row.original_rel),
    thumbSRel: String(row.thumb_s_rel),
    thumbMRel: String(row.thumb_m_rel),
    thumbLRel: String(row.thumb_l_rel),
    tagIds,
    collectionIds,
    description: row.description ? String(row.description) : undefined
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

function loadCardRow(db: Database.Database, cardId: string): CardIndexRow | null {
  const row = db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return dbRowToIndex(row, getCardTags(db, cardId), getCardCollections(db, cardId));
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

export function resetLibraryStorageCache(): void {
  readyPromises.clear();
  migrationPromise = null;
  currentRoot = null;
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

  currentRoot = root;
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

export async function importMediaFile(
  libraryRoot: string,
  sourceAbs: string
): Promise<{ ok: true; row: ImportedMediaRow } | { ok: false; error: string }> {
  const root = path.resolve(libraryRoot);
  const db = await ensureLibraryReady(root);
  const resolved = path.resolve(sourceAbs);
  const ext = path.extname(resolved);
  const baseName = path.basename(resolved);

  if (!isImageExt(ext) && !isVideoExt(ext)) {
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
  const cardId = id;
  const dir = cardDirAbs(root, cardId);
  await mkdir(dir, { recursive: true });

  const thumbSAbs = path.join(dir, 'thumb_s.webp');
  const thumbMAbs = path.join(dir, 'thumb_m.webp');
  const thumbLAbs = path.join(dir, 'thumb_l.webp');

  try {
    const { originalAbs, originalRel } = await copyOriginalToCard(root, cardId, resolved, ext);
    const type: CardType = isImageExt(ext) ? 'image' : 'video';
    let dominantColorHex = '#2a2a2a';
    let width: number | undefined;
    let height: number | undefined;
    let phash: ImageDupFingerprint | undefined;

    if (type === 'image') {
      const thumbRes = await generateImageThumbnails(originalAbs, thumbSAbs, thumbMAbs, thumbLAbs, true);
      dominantColorHex = thumbRes.dominantColorHex;
      width = thumbRes.width || undefined;
      height = thumbRes.height || undefined;
      phash = thumbRes.phash;
    } else {
      const frameTmp = path.join(dir, '_frame.jpg');
      try {
        await extractVideoFrameToJpeg(originalAbs, frameTmp);
        const thumbRes = await generateVideoThumbnailsFromFrame(frameTmp, thumbSAbs, thumbMAbs, thumbLAbs);
        dominantColorHex = thumbRes.dominantColorHex;
        width = thumbRes.width || undefined;
        height = thumbRes.height || undefined;
        const dims = await probeVideoDimensions(originalAbs);
        if (dims) {
          width = dims.width;
          height = dims.height;
        }
      } finally {
        try {
          await unlink(frameTmp);
        } catch {
          /* ignore */
        }
      }
    }

    const cardJson: CardJsonV1 = {
      version: 1,
      id: cardId,
      type,
      addedAt,
      originalFileName: baseName,
      format: ext.slice(1).toLowerCase(),
      width,
      height,
      fileSize: st.size,
      dominantColorHex,
      tagIds: [],
      collectionIds: [],
      ...(phash ? { phash } : {})
    };
    await writeCardJson(root, cardJson);

    const thumbSRel = thumbSRelPath(cardId);
    const thumbMRel = thumbMRelPath(cardId);
    const thumbLRel = thumbLRelPath(cardId);

    db.prepare(
      `INSERT INTO cards (
        id, type, added_at, format, width, height, file_size, dominant_color, phash_json,
        original_rel, thumb_s_rel, thumb_m_rel, thumb_l_rel
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      cardId,
      type,
      addedAt,
      cardJson.format ?? null,
      width ?? null,
      height ?? null,
      st.size,
      dominantColorHex,
      phash ? JSON.stringify(phash) : null,
      originalRel,
      thumbSRel,
      thumbMRel,
      thumbLRel
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
  const tagIds = (params.selectedTagIds ?? []).filter((t) => t.trim());
  const collectionId = params.collectionId?.trim() ?? '';

  let sql = 'SELECT c.* FROM cards c';
  const binds: unknown[] = [];

  if (tagIds.length > 0) {
    sql += ` INNER JOIN (
      SELECT card_id FROM card_tags WHERE tag_id IN (${tagIds.map(() => '?').join(',')})
      GROUP BY card_id HAVING COUNT(DISTINCT tag_id) = ?
    ) tf ON tf.card_id = c.id`;
    binds.push(...tagIds, tagIds.length);
  }

  if (collectionId) {
    sql += ' INNER JOIN card_collections cc ON cc.card_id = c.id AND cc.collection_id = ?';
    binds.push(collectionId);
  }

  const wh: string[] = [];
  if (params.filter === 'images') wh.push("c.type = 'image'");
  else if (params.filter === 'videos') wh.push("c.type = 'video'");

  const cardExact = params.cardIdExact?.trim() ?? '';
  if (cardExact) {
    wh.push('c.id = ?');
    binds.push(cardExact);
  }

  appendLibraryScopeConditions(params.libraryScope, wh);

  if (wh.length) sql += ` WHERE ${wh.join(' AND ')}`;
  sql += ' ORDER BY c.added_at DESC LIMIT ? OFFSET ?';
  binds.push(params.limit, params.offset);

  const rows = db.prepare(sql).all(...binds) as Record<string, unknown>[];
  return rows.map((r) => {
    const id = String(r.id);
    return dbRowToIndex(r, getCardTags(db, id), getCardCollections(db, id));
  });
}

export function getCardByIdFromDb(libraryRoot: string, cardId: string): CardIndexRow | null {
  const db = openLibraryDb(libraryRoot);
  return loadCardRow(db, cardId);
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

export async function updateCardInStorage(
  libraryRoot: string,
  cardId: string,
  patch: { tagIds?: string[]; collectionIds?: string[]; description?: string }
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
  cardJson.dateModified = new Date().toISOString();
  await writeCardJson(root, cardJson);

  if (patch.description !== undefined) {
    db.prepare('UPDATE cards SET description = ?, date_modified = ? WHERE id = ?').run(
      cardJson.description ?? null,
      cardJson.dateModified,
      cardId
    );
  } else {
    db.prepare('UPDATE cards SET date_modified = ? WHERE id = ?').run(cardJson.dateModified, cardId);
  }

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
        createdAt: String(row.created_at)
      };
    });
}

export function upsertCategory(libraryRoot: string, cat: CategoryRow): void {
  const db = openLibraryDb(libraryRoot);
  db.prepare(
    `INSERT INTO categories (id, name, color_hex, weight, sort_index, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, color_hex=excluded.color_hex,
       weight=excluded.weight, sort_index=excluded.sort_index`
  ).run(cat.id, cat.name, cat.colorHex, cat.weight, cat.sortIndex, cat.createdAt);
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
    .prepare('SELECT * FROM collections ORDER BY created_at ASC')
    .all()
    .map((r) => {
      const row = r as Record<string, unknown>;
      return { id: String(row.id), name: String(row.name), createdAt: String(row.created_at) };
    });
}

export function upsertCollection(libraryRoot: string, col: CollectionRow): void {
  const db = openLibraryDb(libraryRoot);
  db.prepare(
    `INSERT INTO collections (id, name, created_at) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name`
  ).run(col.id, col.name, col.createdAt);
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

export { rowToCardRecord, moveOriginalToCard, cardJsonExistsSync, indexDbPath };
