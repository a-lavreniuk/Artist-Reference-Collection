import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import path from 'path';
import { stat } from 'fs/promises';

import {
  BACKGROUND_DUPLICATE_THRESHOLD_PCT,
  IMPORT_DUPLICATE_THRESHOLD_PCT,
  matchKindFromSimilarity,
  meetsImportThreshold,
  meetsScanThreshold,
  pairKey,
  similarityCombined
} from './duplicateMatch';
import { readAppPreferencesSync } from './appPreferences';
import { isVideoExt } from './ffmpeg';
import { readLibraryRootSync } from './libraryRootConfig';
import { openLibraryDb } from './storage/db';
import {
  getCardsWithPhash,
  getSystemData,
  listSkippedDuplicatePairs
} from './storage/libraryStorage';
import { computeImagePhash } from './storage/thumbnails';
import type { ImageDupFingerprint } from './storage/types';
import {
  captureNavigationEpoch,
  isNavigationEpochStale,
  waitForNavigationIpc
} from './ipcNavigationPriority';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif']);

export type DuplicatePairDto = {
  cardIdA: string;
  cardIdB: string;
  similarity: number;
  matchKind: 'exact' | 'similar';
};

export type ImportDuplicateMatchDto = {
  path: string;
  existingCardId: string;
  similarity: number;
  matchKind: 'exact' | 'similar';
};

export type DuplicateScanProgress = {
  scannedCards: number;
  totalCards: number;
  duplicatesFound: number;
};

export type DuplicateScanResult = {
  pairs: DuplicatePairDto[];
  scannedCards: number;
  totalCards: number;
  spaceSavedBytes: number;
  cancelled: boolean;
};

let sessionSkippedPairs = new Set<string>();
let cachedScanPairs: DuplicatePairDto[] = [];
let duplicatesNotifiedThisSession = false;
let scanInFlight = false;
let scanCancelRequested = false;

export function resetDuplicateScanSession(): void {
  sessionSkippedPairs = new Set();
}

export function requestScanCancel(): void {
  scanCancelRequested = true;
}

export function addSessionSkippedPair(idA: string, idB: string): void {
  sessionSkippedPairs.add(pairKey(idA, idB));
}

export function getCachedDuplicatePairs(): DuplicatePairDto[] {
  return [...cachedScanPairs];
}

export async function sha256File(absPath: string): Promise<string | null> {
  return new Promise((resolve) => {
    const hash = createHash('sha256');
    const stream = createReadStream(absPath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', () => resolve(null));
  });
}

function isImagePath(absPath: string): boolean {
  return IMAGE_EXT.has(path.extname(absPath).toLowerCase());
}

function isVideoMediaPath(absPath: string): boolean {
  return isVideoExt(path.extname(absPath));
}

async function buildLibraryVideoIndex(
  libraryRoot: string
): Promise<Array<{ id: string; originalAbs: string }>> {
  const db = openLibraryDb(libraryRoot);
  const rows = db
    .prepare(
      `SELECT id, original_rel AS originalRel
       FROM cards WHERE type = 'video' AND COALESCE(is_deleted, 0) = 0`
    )
    .all() as Array<{ id: string; originalRel: string }>;

  return rows.map((row) => ({
    id: row.id,
    originalAbs: path.join(libraryRoot, row.originalRel.replace(/\//g, path.sep))
  }));
}

/**
 * Точный дубль видео/GIF по SHA-256 оригинала среди карточек type=video.
 * Визуальную «похожесть» для видео не считаем — только идентичный файл.
 */
export async function findExactDuplicateVideoCard(
  libraryRoot: string,
  absolutePath: string
): Promise<string | null> {
  if (!isVideoMediaPath(absolutePath)) return null;
  const incomingSha = await sha256File(absolutePath);
  if (!incomingSha) return null;

  const index = await buildLibraryVideoIndex(libraryRoot);
  for (const card of index) {
    const cardSha = await sha256File(card.originalAbs);
    if (cardSha && cardSha === incomingSha) return card.id;
  }
  return null;
}

function isPairSkipped(
  idA: string,
  idB: string,
  permanent: Set<string>,
  session: Set<string>
): boolean {
  const key = pairKey(idA, idB);
  return permanent.has(key) || session.has(key);
}

async function buildLibraryImageIndex(libraryRoot: string): Promise<
  Array<{
    id: string;
    originalAbs: string;
    phash: ImageDupFingerprint | null;
    sha256: string | null;
    width?: number;
    height?: number;
    fileSize?: number;
  }>
> {
  const db = openLibraryDb(libraryRoot);
  const rows = db
    .prepare(
      `SELECT id, original_rel AS originalRel, width, height, file_size AS fileSize, phash_json AS phashJson
       FROM cards WHERE type = 'image' AND COALESCE(is_deleted, 0) = 0`
    )
    .all() as Array<{
    id: string;
    originalRel: string;
    width: number | null;
    height: number | null;
    fileSize: number | null;
    phashJson: string | null;
  }>;

  const phashFromDb = new Map(getCardsWithPhash(libraryRoot).map((x) => [x.id, x.phash]));
  const out: Array<{
    id: string;
    originalAbs: string;
    phash: ImageDupFingerprint | null;
    sha256: string | null;
    width?: number;
    height?: number;
    fileSize?: number;
  }> = [];

  for (const row of rows) {
    const rel = row.originalRel.replace(/\//g, path.sep);
    const originalAbs = path.join(libraryRoot, rel);
    let phash: ImageDupFingerprint | null = phashFromDb.get(row.id) ?? null;
    if (!phash && row.phashJson) {
      try {
        phash = JSON.parse(row.phashJson) as ImageDupFingerprint;
      } catch {
        phash = null;
      }
    }
    out.push({
      id: row.id,
      originalAbs,
      phash,
      sha256: null,
      width: row.width ?? undefined,
      height: row.height ?? undefined,
      fileSize: row.fileSize ?? undefined
    });
  }
  return out;
}

function similarityForPair(
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

export async function checkImportDuplicates(
  libraryRoot: string,
  absolutePaths: string[]
): Promise<ImportDuplicateMatchDto[]> {
  const imagePaths = absolutePaths.filter(isImagePath);
  if (imagePaths.length === 0) return [];

  const index = await buildLibraryImageIndex(libraryRoot);
  if (index.length === 0) return [];

  const shaByCardId = new Map<string, string>();
  const matches: ImportDuplicateMatchDto[] = [];

  for (const incomingPath of imagePaths) {
    let st;
    try {
      st = await stat(incomingPath);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;

    const incomingSha = await sha256File(incomingPath);
    let incomingPhash: ImageDupFingerprint | null = null;
    try {
      incomingPhash = await computeImagePhash(incomingPath);
    } catch {
      incomingPhash = null;
    }

    let best: ImportDuplicateMatchDto | null = null;

    for (const card of index) {
      let cardSha = shaByCardId.get(card.id);
      if (cardSha === undefined) {
        cardSha = (await sha256File(card.originalAbs)) ?? '';
        shaByCardId.set(card.id, cardSha);
      }

      const { similarity, exactSha256 } = similarityForPair(
        incomingSha,
        cardSha || null,
        incomingPhash,
        card.phash
      );

      if (!meetsImportThreshold(similarity, exactSha256)) continue;

      const candidate: ImportDuplicateMatchDto = {
        path: incomingPath,
        existingCardId: card.id,
        similarity: exactSha256 ? 100 : Math.round(similarity * 10) / 10,
        matchKind: matchKindFromSimilarity(similarity, exactSha256)
      };

      if (!best || candidate.similarity > best.similarity) {
        best = candidate;
      }
    }

    if (best) matches.push(best);
  }

  return matches;
}

export async function isExactDuplicateIncomingFile(
  libraryRoot: string,
  absolutePath: string
): Promise<boolean> {
  if (isVideoMediaPath(absolutePath)) {
    return (await findExactDuplicateVideoCard(libraryRoot, absolutePath)) != null;
  }
  if (!isImagePath(absolutePath)) return false;
  const incomingSha = await sha256File(absolutePath);
  if (!incomingSha) return false;

  const index = await buildLibraryImageIndex(libraryRoot);
  for (const card of index) {
    const cardSha = await sha256File(card.originalAbs);
    if (cardSha && cardSha === incomingSha) return true;
  }
  return false;
}

/**
 * Полный проход поиска дублей с колбэком прогресса, поддержкой отмены и
 * подсчётом статистики (сколько карточек просканировано, сколько места
 * освободит слияние). Экономия оценивается как сумма меньшего файла в паре.
 */
export async function runDuplicateScan(
  libraryRoot: string,
  thresholdPct: number,
  options?: {
    excludeSessionSkipped?: boolean;
    onProgress?: (progress: DuplicateScanProgress) => void;
    yieldToNavigation?: boolean;
  }
): Promise<DuplicateScanResult> {
  scanCancelRequested = false;
  const permanentSkipped = new Set(
    listSkippedDuplicatePairs(libraryRoot).map(([a, b]) => pairKey(a, b))
  );
  const session = options?.excludeSessionSkipped === false ? new Set<string>() : sessionSkippedPairs;
  const yieldToNavigation = options?.yieldToNavigation !== false;

  const index = await buildLibraryImageIndex(libraryRoot);
  const totalCards = index.length;
  const sizeById = new Map<string, number>(index.map((c) => [c.id, c.fileSize ?? 0]));
  const pairs: DuplicatePairDto[] = [];
  const navSnap = captureNavigationEpoch();

  const shaCache = new Map<string, string | null>();
  const phashCache = new Map<string, ImageDupFingerprint | null>();

  let scannedCards = 0;
  let cancelled = false;

  options?.onProgress?.({ scannedCards: 0, totalCards, duplicatesFound: 0 });

  for (let i = 0; i < index.length; i++) {
    if (scanCancelRequested) {
      cancelled = true;
      break;
    }
    if (yieldToNavigation) {
      if (isNavigationEpochStale(navSnap)) break;
      await waitForNavigationIpc();
    }

    const a = index[i]!;
    if (!shaCache.has(a.id)) shaCache.set(a.id, await sha256File(a.originalAbs));
    if (!phashCache.has(a.id)) phashCache.set(a.id, a.phash);

    for (let j = i + 1; j < index.length; j++) {
      const b = index[j]!;
      if (isPairSkipped(a.id, b.id, permanentSkipped, session)) continue;

      if (!shaCache.has(b.id)) shaCache.set(b.id, await sha256File(b.originalAbs));
      if (!phashCache.has(b.id)) phashCache.set(b.id, b.phash);

      const { similarity, exactSha256 } = similarityForPair(
        shaCache.get(a.id) ?? null,
        shaCache.get(b.id) ?? null,
        phashCache.get(a.id) ?? null,
        phashCache.get(b.id) ?? null
      );

      if (!meetsScanThreshold(similarity, exactSha256, thresholdPct)) continue;

      pairs.push({
        cardIdA: a.id,
        cardIdB: b.id,
        similarity: exactSha256 ? 100 : Math.round(similarity * 10) / 10,
        matchKind: matchKindFromSimilarity(similarity, exactSha256)
      });
    }

    scannedCards = i + 1;
    options?.onProgress?.({ scannedCards, totalCards, duplicatesFound: pairs.length });
  }

  pairs.sort((x, y) => y.similarity - x.similarity);
  if (!cancelled) cachedScanPairs = pairs;

  let spaceSavedBytes = 0;
  for (const pair of pairs) {
    const sizeA = sizeById.get(pair.cardIdA) ?? 0;
    const sizeB = sizeById.get(pair.cardIdB) ?? 0;
    spaceSavedBytes += Math.min(sizeA, sizeB);
  }

  return { pairs, scannedCards: cancelled ? scannedCards : totalCards, totalCards, spaceSavedBytes, cancelled };
}

export async function scanDuplicatePairs(
  libraryRoot: string,
  thresholdPct: number,
  options?: { excludeSessionSkipped?: boolean }
): Promise<DuplicatePairDto[]> {
  const result = await runDuplicateScan(libraryRoot, thresholdPct, {
    excludeSessionSkipped: options?.excludeSessionSkipped
  });
  return result.pairs;
}

export async function probeIncomingFileMetadata(absolutePath: string): Promise<{
  format: string;
  width?: number;
  height?: number;
  fileSize?: number;
  fileCreatedAt?: string;
} | null> {
  if (!isImagePath(absolutePath)) return null;
  try {
    const st = await stat(absolutePath);
    if (!st.isFile()) return null;
    const ext = path.extname(absolutePath).slice(1).toLowerCase();
    let width: number | undefined;
    let height: number | undefined;
    try {
      const sharp = (await import('sharp')).default;
      const meta = await sharp(absolutePath).metadata();
      width = meta.width ?? undefined;
      height = meta.height ?? undefined;
    } catch {
      /* ignore */
    }
    const birthMs = st.birthtimeMs ?? st.birthtime.getTime();
    const fileCreatedAt =
      Number.isFinite(birthMs) && birthMs > 0 ? new Date(birthMs).toISOString() : st.mtime.toISOString();
    return {
      format: ext,
      width,
      height,
      fileSize: st.size,
      fileCreatedAt
    };
  } catch {
    return null;
  }
}

export async function scanForDuplicateFilesAfterImport(): Promise<boolean> {
  if (duplicatesNotifiedThisSession || scanInFlight) return false;

  const prefs = readAppPreferencesSync();
  if (!prefs.notifyDuplicatesFound) return false;

  const libraryRoot = readLibraryRootSync();
  if (!libraryRoot) return false;

  scanInFlight = true;
  try {
    const pairs = await scanDuplicatePairs(libraryRoot, BACKGROUND_DUPLICATE_THRESHOLD_PCT);
    const hasDuplicates = pairs.length > 0;
    if (hasDuplicates) {
      duplicatesNotifiedThisSession = true;
    }
    return hasDuplicates;
  } catch {
    return false;
  } finally {
    scanInFlight = false;
  }
}

export async function getDuplicateThresholdFromSystem(libraryRoot: string): Promise<number> {
  try {
    const sys = await getSystemData(libraryRoot);
    if (sys && typeof sys.duplicateSimilarityThresholdPct === 'number') {
      return Math.min(100, Math.max(50, sys.duplicateSimilarityThresholdPct));
    }
  } catch {
    /* ignore */
  }
  return 85;
}

export { IMPORT_DUPLICATE_THRESHOLD_PCT };
