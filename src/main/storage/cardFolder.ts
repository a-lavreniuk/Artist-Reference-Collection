import { copyFile, mkdir, readFile, rename, rm } from 'fs/promises';
import path from 'path';
import type { CardJsonV1 } from './types';
import { atomicWriteJsonFile } from './atomicWrite';

export const CARDS_DIR = 'cards';
export const CARD_JSON_FILENAME = 'card.json';
const MAX_CARD_ID_LENGTH = 128;

/** id карточки — один сегмент пути: без разделителей и переходов вверх. */
export function isPlainCardId(cardId: string): boolean {
  if (typeof cardId !== 'string') return false;
  if (cardId.length === 0 || cardId.length > MAX_CARD_ID_LENGTH) return false;
  if (cardId === '.' || cardId === '..') return false;
  if (/[\\/\0:]/.test(cardId)) return false;
  return true;
}

export function cardDirRelative(cardId: string): string {
  return `${CARDS_DIR}/${cardId}`;
}

export function cardDirAbs(libraryRoot: string, cardId: string): string {
  if (!isPlainCardId(cardId)) {
    throw new Error('Некорректный идентификатор карточки');
  }
  const root = path.resolve(libraryRoot);
  const cardsRoot = path.resolve(root, CARDS_DIR);
  const dir = path.resolve(cardsRoot, cardId);
  const rel = path.relative(cardsRoot, dir);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Некорректный идентификатор карточки');
  }
  return dir;
}

export function cardJsonAbs(libraryRoot: string, cardId: string): string {
  return path.join(cardDirAbs(libraryRoot, cardId), CARD_JSON_FILENAME);
}

export function originalRelPath(cardId: string, ext: string): string {
  const e = ext.startsWith('.') ? ext : `.${ext}`;
  return `${cardDirRelative(cardId)}/original${e}`;
}

export function thumbSRelPath(cardId: string): string {
  return `${cardDirRelative(cardId)}/thumb_s.webp`;
}

export function thumbMRelPath(cardId: string): string {
  return `${cardDirRelative(cardId)}/thumb_m.webp`;
}

export function thumbLRelPath(cardId: string): string {
  return `${cardDirRelative(cardId)}/thumb_l.webp`;
}

export async function ensureCardDir(libraryRoot: string, cardId: string): Promise<string> {
  const dir = cardDirAbs(libraryRoot, cardId);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function copyOriginalToCard(
  libraryRoot: string,
  cardId: string,
  sourceAbs: string,
  ext: string
): Promise<{ originalAbs: string; originalRel: string }> {
  const dir = await ensureCardDir(libraryRoot, cardId);
  const e = ext.startsWith('.') ? ext : `.${ext}`;
  const originalAbs = path.join(dir, `original${e}`);
  await copyFile(sourceAbs, originalAbs);
  const originalRel = originalRelPath(cardId, e);
  return { originalAbs, originalRel };
}

export async function moveOriginalToCard(
  libraryRoot: string,
  cardId: string,
  sourceAbs: string,
  ext: string
): Promise<{ originalAbs: string; originalRel: string }> {
  const dir = await ensureCardDir(libraryRoot, cardId);
  const e = ext.startsWith('.') ? ext : `.${ext}`;
  const originalAbs = path.join(dir, `original${e}`);
  await rename(sourceAbs, originalAbs);
  const originalRel = originalRelPath(cardId, e);
  return { originalAbs, originalRel };
}

export async function writeCardJson(libraryRoot: string, card: CardJsonV1): Promise<void> {
  await atomicWriteJsonFile(cardJsonAbs(libraryRoot, card.id), card);
}

export async function readCardJson(libraryRoot: string, cardId: string): Promise<CardJsonV1 | null> {
  try {
    const raw = await readFile(cardJsonAbs(libraryRoot, cardId), 'utf8');
    return JSON.parse(raw) as CardJsonV1;
  } catch {
    return null;
  }
}

export async function deleteCardFolder(libraryRoot: string, cardId: string): Promise<void> {
  const dir = cardDirAbs(libraryRoot, cardId);
  try {
    await rm(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

export function cardJsonExistsSync(libraryRoot: string, cardId: string): boolean {
  try {
    const fs = require('fs') as typeof import('fs');
    return fs.existsSync(cardJsonAbs(libraryRoot, cardId));
  } catch {
    return false;
  }
}
