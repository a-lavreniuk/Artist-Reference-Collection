import { mkdir, readdir, rename, rm } from 'fs/promises';
import path from 'path';
import { fileExists } from '../libraryFilenames';
import {
  CARD_FRAMES_DIR,
  CARD_JSON_FILENAME,
  cardDirAbs,
  cardMetaDirAbs,
  thumbLRelPath,
  thumbMRelPath,
  thumbSRelPath
} from './cardFolder';
import { openLibraryDb } from './db';
import { readSystem, writeSystem } from './systemFiles';

export const CARD_META_LAYOUT_VERSION = 1;

const MOVE_FILES = [CARD_JSON_FILENAME, 'thumb_s.webp', 'thumb_m.webp', 'thumb_l.webp'] as const;

async function moveIfExists(fromAbs: string, toAbs: string): Promise<void> {
  if (!(await fileExists(fromAbs))) return;
  if (await fileExists(toAbs)) {
    try {
      await rm(fromAbs, { recursive: true, force: true });
    } catch {
      /* ignore leftover after dest already exists */
    }
    return;
  }
  await mkdir(path.dirname(toAbs), { recursive: true });
  await rename(fromAbs, toAbs);
}

/** Переносит служебные файлы карточки в Meta/ без перегенерации превью. Идемпотентно. */
export async function relocateCardFolderToMetaLayout(
  libraryRoot: string,
  cardId: string
): Promise<void> {
  const cardDir = cardDirAbs(libraryRoot, cardId);
  if (!(await fileExists(cardDir))) return;
  const metaDir = cardMetaDirAbs(libraryRoot, cardId);
  await mkdir(metaDir, { recursive: true });

  for (const name of MOVE_FILES) {
    await moveIfExists(path.join(cardDir, name), path.join(metaDir, name));
  }

  await moveIfExists(path.join(cardDir, CARD_FRAMES_DIR), path.join(metaDir, CARD_FRAMES_DIR));

  let names: string[];
  try {
    names = await readdir(cardDir);
  } catch {
    return;
  }
  for (const name of names) {
    if (!name.startsWith('_')) continue;
    await moveIfExists(path.join(cardDir, name), path.join(metaDir, name));
  }
}

function updateCardThumbRels(libraryRoot: string, cardId: string): void {
  const db = openLibraryDb(libraryRoot);
  db.prepare(`UPDATE cards SET thumb_s_rel = ?, thumb_m_rel = ?, thumb_l_rel = ? WHERE id = ?`).run(
    thumbSRelPath(cardId),
    thumbMRelPath(cardId),
    thumbLRelPath(cardId),
    cardId
  );
}

export async function ensureCardMetaLayout(libraryRoot: string): Promise<void> {
  const root = path.resolve(libraryRoot);
  const sys = await readSystem(root);
  if ((sys.cardMetaLayoutVersion ?? 0) >= CARD_META_LAYOUT_VERSION) return;

  const db = openLibraryDb(root);
  const rows = db.prepare(`SELECT id FROM cards`).all() as Array<{ id: string }>;
  let failed = 0;
  for (const row of rows) {
    try {
      await relocateCardFolderToMetaLayout(root, row.id);
      updateCardThumbRels(root, row.id);
    } catch {
      failed++;
    }
  }

  if (failed === 0) {
    await writeSystem(root, { ...sys, cardMetaLayoutVersion: CARD_META_LAYOUT_VERSION });
  }
}
