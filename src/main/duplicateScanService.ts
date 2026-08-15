import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import path from 'path';
import { stat } from 'fs/promises';

import {
  BACKGROUND_DUPLICATE_THRESHOLD_PCT,
  IMPORT_DUPLICATE_THRESHOLD_PCT,
  matchKindFromSimilarity,
  meetsImportThreshold,
  pairKey,
  scopedPairKey
} from './duplicateMatch';
import {
  collectDuplicatePairsFromIndex,
  FALLBACK_SCAN_LIBRARY_ID,
  similarityForPair,
  type DuplicatePairDto,
  type DuplicateScanIndexItem,
  type DuplicateScanLibrary
} from './duplicateScanPairs';
import { readAppPreferencesSync } from './appPreferences';
import { isVideoExt } from './ffmpeg';
import { readLibraryRootSync } from './libraryRootConfig';
import { openLibraryDb, withLibraryDbReadonly } from './storage/db';
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

export type {
  DuplicatePairDto,
  DuplicateScanIndexItem,
  DuplicateScanLibrary,
  DuplicateScanScope
} from './duplicateScanPairs';
export { collectDuplicatePairsFromIndex, FALLBACK_SCAN_LIBRARY_ID } from './duplicateScanPairs';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif']);

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

export function addSessionSkippedPair(
  idA: string,
  idB: string,
  libraryIdA?: string,
  libraryIdB?: string
): void {
  if (libraryIdA && libraryIdB) {
    sessionSkippedPairs.add(scopedPairKey(libraryIdA, idA, libraryIdB, idB));
  }
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

function isIndexPairSkipped(
  a: DuplicateScanIndexItem,
  b: DuplicateScanIndexItem,
  intraSkippedByLibrary: Map<string, Set<string>>,
  crossSkipped: Set<string>,
  session: Set<string>
): boolean {
  const scoped = scopedPairKey(a.libraryId, a.id, b.libraryId, b.id);
  if (crossSkipped.has(scoped) || session.has(scoped)) return true;
  if (a.libraryId === b.libraryId) {
    const intra = intraSkippedByLibrary.get(a.libraryId);
    if (intra?.has(pairKey(a.id, b.id))) return true;
    if (session.has(pairKey(a.id, b.id))) return true;
  }
  return false;
}

function parsePhashJson(raw: string | null): ImageDupFingerprint | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ImageDupFingerprint;
  } catch {
    return null;
  }
}

function buildScanIndexForLibrary(lib: DuplicateScanLibrary): DuplicateScanIndexItem[] {
  const rows = withLibraryDbReadonly(lib.path, (db) => {
    const images = db
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
    const videos = db
      .prepare(
        `SELECT id, original_rel AS originalRel, file_size AS fileSize
         FROM cards WHERE type = 'video' AND COALESCE(is_deleted, 0) = 0`
      )
      .all() as Array<{ id: string; originalRel: string; fileSize: number | null }>;
    return { images, videos };
  });
  if (!rows) return [];

  const out: DuplicateScanIndexItem[] = [];
  for (const row of rows.images) {
    const originalAbs = path.join(lib.path, row.originalRel.replace(/\//g, path.sep));
    out.push({
      libraryId: lib.id,
      libraryName: lib.name,
      libraryRoot: lib.path,
      id: row.id,
      type: 'image',
      originalAbs,
      phash: parsePhashJson(row.phashJson),
      sha256: null,
      fileSize: row.fileSize ?? undefined
    });
  }
  for (const row of rows.videos) {
    out.push({
      libraryId: lib.id,
      libraryName: lib.name,
      libraryRoot: lib.path,
      id: row.id,
      type: 'video',
      originalAbs: path.join(lib.path, row.originalRel.replace(/\//g, path.sep)),
      phash: null,
      sha256: null,
      fileSize: row.fileSize ?? undefined
    });
  }
  return out;
}

function normalizeScanLibraries(input: string | DuplicateScanLibrary[]): DuplicateScanLibrary[] {
  if (typeof input === 'string') {
    return [{ id: FALLBACK_SCAN_LIBRARY_ID, name: path.basename(input), path: input }];
  }
  return input.filter((lib) => typeof lib.path === 'string' && lib.path.trim().length > 0);
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
  libraryRootOrLibraries: string | DuplicateScanLibrary[],
  thresholdPct: number,
  options?: {
    excludeSessionSkipped?: boolean;
    onProgress?: (progress: DuplicateScanProgress) => void;
    yieldToNavigation?: boolean;
    intraSkippedByLibrary?: Map<string, Set<string>>;
    crossSkipped?: Set<string>;
  }
): Promise<DuplicateScanResult> {
  scanCancelRequested = false;
  const libraries = normalizeScanLibraries(libraryRootOrLibraries);
  const intraSkippedByLibrary = options?.intraSkippedByLibrary ?? new Map<string, Set<string>>();
  if (!options?.intraSkippedByLibrary && libraries.length === 1) {
    const only = libraries[0]!;
    intraSkippedByLibrary.set(
      only.id,
      new Set(listSkippedDuplicatePairs(only.path).map(([a, b]) => pairKey(a, b)))
    );
  }
  const crossSkipped = options?.crossSkipped ?? new Set<string>();
  const session = options?.excludeSessionSkipped === false ? new Set<string>() : sessionSkippedPairs;
  const yieldToNavigation = options?.yieldToNavigation !== false;

  const index: DuplicateScanIndexItem[] = [];
  for (const lib of libraries) {
    index.push(...buildScanIndexForLibrary(lib));
  }
  const totalCards = index.length;
  const sizeByKey = new Map<string, number>(
    index.map((c) => [`${c.libraryId}:${c.id}`, c.fileSize ?? 0])
  );
  const navSnap = captureNavigationEpoch();

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
    const item = index[i]!;
    item.sha256 = await sha256File(item.originalAbs);
    scannedCards = i + 1;
    options?.onProgress?.({ scannedCards, totalCards, duplicatesFound: 0 });
  }

  const pairs = cancelled
    ? []
    : collectDuplicatePairsFromIndex(index, thresholdPct, (a, b) =>
        isIndexPairSkipped(a, b, intraSkippedByLibrary, crossSkipped, session)
      );

  if (!cancelled) {
    options?.onProgress?.({ scannedCards: totalCards, totalCards, duplicatesFound: pairs.length });
    cachedScanPairs = pairs;
  }

  let spaceSavedBytes = 0;
  for (const pair of pairs) {
    const sizeA = sizeByKey.get(`${pair.libraryIdA}:${pair.cardIdA}`) ?? 0;
    const sizeB = sizeByKey.get(`${pair.libraryIdB}:${pair.cardIdB}`) ?? 0;
    spaceSavedBytes += Math.min(sizeA, sizeB);
  }

  return {
    pairs,
    scannedCards: cancelled ? scannedCards : totalCards,
    totalCards,
    spaceSavedBytes,
    cancelled
  };
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
