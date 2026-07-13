import { mkdir, readdir, readFile, rm, stat, unlink } from 'fs/promises';
import path from 'path';
import { libraryMetaDirAbs, resolveLegacyMetadataAbsPath } from '../libraryFilenames';
import {
  cardDirAbs,
  cardJsonExistsSync,
  moveOriginalToCard,
  readCardJson,
  thumbLRelPath,
  thumbMRelPath,
  thumbSRelPath,
  writeCardJson,
  CARDS_DIR
} from './cardFolder';
import { openLibraryDb } from './db';
import { removeEmptyLegacyMediaDir } from './libraryCleanup';
import { writeCanonicalMetadataBackup } from './metadataBackup';
import { defaultMoodboard, defaultSystem, writeMoodboard, writeSystem } from './systemFiles';
import { generateImageThumbnails, generateVideoThumbnailsFromFrame } from './thumbnails';
import type { CardJsonV1, CategoryRow, CollectionRow, ImageDupFingerprint, TagRow } from './types';
import { extractVideoFrameToJpeg, isVideoExt, probeVideoDimensions } from '../ffmpeg';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);

function isImageExt(ext: string): boolean {
  return IMAGE_EXT.has(ext.toLowerCase());
}

type LegacyCard = {
  id: string;
  type: 'image' | 'video';
  addedAt: string;
  dateModified?: string;
  originalRelativePath: string;
  thumbRelativePath: string;
  format?: string;
  width?: number;
  height?: number;
  tagIds: string[];
  collectionIds: string[];
  description?: string;
  fileSize?: number;
};

type LegacyMetadata = {
  version: 1;
  categories: unknown[];
  tags: unknown[];
  cards: LegacyCard[];
  collections: Array<{ id: string; name: string; createdAt: string }>;
  moodboardCardIds: string[];
  moodboardBoard?: unknown;
  duplicateSimilarityThresholdPct?: number;
  skippedDuplicatePairs?: [string, string][];
};

export type MigrationProgressCb = (p: {
  phase: string;
  current: number;
  total: number;
  message?: string;
}) => void;

function syncCardRelations(
  db: ReturnType<typeof openLibraryDb>,
  cardId: string,
  tagIds: string[],
  collectionIds: string[]
): void {
  db.prepare('DELETE FROM card_tags WHERE card_id = ?').run(cardId);
  db.prepare('DELETE FROM card_collections WHERE card_id = ?').run(cardId);
  const insTag = db.prepare('INSERT INTO card_tags (card_id, tag_id) VALUES (?, ?)');
  for (const tid of tagIds) insTag.run(cardId, tid);
  const insCol = db.prepare('INSERT INTO card_collections (card_id, collection_id) VALUES (?, ?)');
  for (const cid of collectionIds) insCol.run(cardId, cid);
}

export async function migrateLegacyLibrary(root: string, onProgress?: MigrationProgressCb): Promise<void> {
  const metaPath = await resolveLegacyMetadataAbsPath(root);
  if (!metaPath) {
    throw new Error('Нет arc-metadata.json для миграции');
  }
  await mkdir(libraryMetaDirAbs(root), { recursive: true });
  const raw = await readFile(metaPath, 'utf8');
  const legacy = JSON.parse(raw) as LegacyMetadata;

  await writeCanonicalMetadataBackup(root);

  await mkdir(path.join(root, CARDS_DIR), { recursive: true });
  const db = openLibraryDb(root);

  // Categories
  onProgress?.({ phase: 'categories', current: 0, total: 1, message: 'Категории…' });
  for (const rawCat of legacy.categories ?? []) {
    const c = rawCat as Record<string, unknown>;
    if (typeof c.id !== 'string') continue;
    const desc =
      typeof c.description === 'string' && c.description.trim() ? c.description.trim() : undefined;
    const cat: CategoryRow = {
      id: c.id,
      name: typeof c.name === 'string' ? c.name : '',
      colorHex: typeof c.colorHex === 'string' ? c.colorHex : '#888888',
      weight: (['neutral', 'low', 'medium', 'high'].includes(String(c.weight))
        ? c.weight
        : 'neutral') as CategoryRow['weight'],
      sortIndex: typeof c.sortIndex === 'number' ? c.sortIndex : 0,
      createdAt: typeof c.createdAt === 'string' ? c.createdAt : new Date().toISOString(),
      ...(desc ? { description: desc } : {})
    };
    db.prepare(
      `INSERT OR IGNORE INTO categories (id, name, color_hex, weight, sort_index, created_at, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(cat.id, cat.name, cat.colorHex, cat.weight, cat.sortIndex, cat.createdAt, cat.description ?? null);
  }

  // Tags
  for (const rawTag of legacy.tags ?? []) {
    const t = rawTag as Record<string, unknown>;
    if (typeof t.id !== 'string' || typeof t.categoryId !== 'string') continue;
    const tag: TagRow = {
      id: t.id,
      categoryId: t.categoryId,
      name: typeof t.name === 'string' ? t.name : '',
      usageCount: typeof t.usageCount === 'number' ? t.usageCount : 0,
      description: typeof t.description === 'string' ? t.description : undefined,
      tooltipImage: typeof t.tooltipImageDataUrl === 'string' ? t.tooltipImageDataUrl : undefined
    };
    db.prepare(
      `INSERT OR IGNORE INTO tags (id, category_id, name, usage_count, description, tooltip_image)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(tag.id, tag.categoryId, tag.name, tag.usageCount, tag.description ?? null, tag.tooltipImage ?? null);
  }

  // Collections
  for (const [index, col] of (legacy.collections ?? []).entries()) {
    db.prepare(
      'INSERT OR IGNORE INTO collections (id, name, created_at, sort_index) VALUES (?, ?, ?, ?)'
    ).run(col.id, col.name, col.createdAt, index);
  }

  // Skipped pairs
  for (const pair of legacy.skippedDuplicatePairs ?? []) {
    if (!Array.isArray(pair) || pair.length !== 2) continue;
    const [a, b] = pair;
    const minId = a < b ? a : b;
    const maxId = a < b ? b : a;
    db.prepare('INSERT OR IGNORE INTO skipped_duplicate_pairs (min_id, max_id) VALUES (?, ?)').run(minId, maxId);
  }

  const cards = legacy.cards ?? [];
  const total = cards.length;
  let current = 0;

  for (const card of cards) {
    current += 1;
    onProgress?.({
      phase: 'cards',
      current,
      total,
      message: `Карточка ${current} из ${total}…`
    });

    if (cardJsonExistsSync(root, card.id)) {
      const existing = await readCardJson(root, card.id);
      if (existing) {
        db.prepare('DELETE FROM cards WHERE id = ?').run(card.id);
        db.prepare(
          `INSERT INTO cards (
            id, type, added_at, date_modified, format, width, height, file_size, dominant_color, phash_json,
            original_rel, thumb_s_rel, thumb_m_rel, thumb_l_rel, description
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          card.id,
          card.type,
          card.addedAt,
          card.dateModified ?? null,
          card.format ?? null,
          card.width ?? null,
          card.height ?? null,
          card.fileSize ?? null,
          existing.dominantColorHex ?? null,
          existing.phash ? JSON.stringify(existing.phash) : null,
          `cards/${card.id}/original.${card.format ?? path.extname(card.originalRelativePath).slice(1)}`,
          thumbSRelPath(card.id),
          thumbMRelPath(card.id),
          thumbLRelPath(card.id),
          card.description ?? null
        );
        syncCardRelations(db, card.id, card.tagIds ?? [], card.collectionIds ?? []);
      }
      continue;
    }

    const origAbs = path.resolve(root, card.originalRelativePath.replace(/\//g, path.sep));
    let ext = path.extname(origAbs);
    if (!ext && card.format) ext = `.${card.format}`;

    try {
      await stat(origAbs);
    } catch {
      continue;
    }

    const dir = cardDirAbs(root, card.id);
    await mkdir(dir, { recursive: true });
    const thumbSAbs = path.join(dir, 'thumb_s.webp');
    const thumbMAbs = path.join(dir, 'thumb_m.webp');
    const thumbLAbs = path.join(dir, 'thumb_l.webp');

    const { originalAbs, originalRel } = await moveOriginalToCard(root, card.id, origAbs, ext);

    let dominantColorHex = '#2a2a2a';
    let width = card.width;
    let height = card.height;
    let phash: ImageDupFingerprint | undefined;
    let videoWidth: number | undefined;
    let videoHeight: number | undefined;

    if (card.type === 'image' || isImageExt(ext)) {
      const res = await generateImageThumbnails(originalAbs, thumbSAbs, thumbMAbs, thumbLAbs, true);
      dominantColorHex = res.dominantColorHex;
      width = res.width || width;
      height = res.height || height;
      phash = res.phash;
    } else if (isVideoExt(ext)) {
      const frameTmp = path.join(dir, '_frame.jpg');
      try {
        await extractVideoFrameToJpeg(originalAbs, frameTmp);
        const res = await generateVideoThumbnailsFromFrame(frameTmp, thumbSAbs, thumbMAbs, thumbLAbs);
        dominantColorHex = res.dominantColorHex;
        width = res.width || width;
        height = res.height || height;
        const dims = await probeVideoDimensions(originalAbs);
        if (dims) {
          width = dims.width;
          height = dims.height;
          videoWidth = dims.width;
          videoHeight = dims.height;
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
      id: card.id,
      type: card.type,
      addedAt: card.addedAt,
      dateModified: card.dateModified,
      originalFileName: path.basename(card.originalRelativePath),
      format: card.format ?? ext.slice(1),
      width,
      height,
      fileSize: card.fileSize,
      dominantColorHex,
      description: card.description,
      tagIds: card.tagIds ?? [],
      collectionIds: card.collectionIds ?? [],
      ...(phash ? { phash } : {}),
      ...(videoWidth ? { videoWidth } : {}),
      ...(videoHeight ? { videoHeight } : {})
    };
    await writeCardJson(root, cardJson);

    db.prepare(
      `INSERT INTO cards (
        id, type, added_at, date_modified, format, width, height, file_size, dominant_color, phash_json,
        original_rel, thumb_s_rel, thumb_m_rel, thumb_l_rel, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      card.id,
      card.type,
      card.addedAt,
      card.dateModified ?? null,
      cardJson.format ?? null,
      width ?? null,
      height ?? null,
      card.fileSize ?? null,
      dominantColorHex,
      phash ? JSON.stringify(phash) : null,
      originalRel,
      thumbSRelPath(card.id),
      thumbMRelPath(card.id),
      thumbLRelPath(card.id),
      card.description ?? null
    );
    syncCardRelations(db, card.id, card.tagIds ?? [], card.collectionIds ?? []);
  }

  db.prepare(
    `UPDATE tags SET usage_count = (
      SELECT COUNT(*) FROM card_tags ct
      INNER JOIN cards c ON c.id = ct.card_id AND COALESCE(c.is_deleted, 0) = 0
      WHERE ct.tag_id = tags.id
    )`
  ).run();

  await writeSystem(root, {
    ...defaultSystem(),
    duplicateSimilarityThresholdPct: legacy.duplicateSimilarityThresholdPct ?? 85
  });

  await writeMoodboard(root, {
    version: 1,
    moodboardCardIds: legacy.moodboardCardIds ?? [],
    moodboardBoard: legacy.moodboardBoard
  });

  onProgress?.({ phase: 'done', current: total, total, message: 'Миграция завершена' });

  try {
    await cleanupEmptyMediaTree(path.join(root, 'media'));
    await removeEmptyLegacyMediaDir(root);
  } catch {
    /* ignore */
  }
}

async function cleanupEmptyMediaTree(mediaRoot: string): Promise<void> {
  let entries;
  try {
    entries = await readdir(mediaRoot, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const sub = path.join(mediaRoot, ent.name);
    if (ent.isDirectory()) {
      await cleanupEmptyMediaTree(sub);
      try {
        const left = await readdir(sub);
        if (left.length === 0) await rm(sub, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }
}
