import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

import { scopedPairKey } from '../duplicateMatch';
import { LIBRARY_META_DIR } from '../libraryFilenames';
import { getActiveLibraryEntry, readLibraryRootConfigSync } from '../librarySessionSnapshot';

const SKIPPED_CROSS_FILENAME = 'skipped-cross-duplicate-pairs.json';

type StoredCrossPair = {
  minLibId: string;
  minCardId: string;
  maxLibId: string;
  maxCardId: string;
};

function parseStored(raw: unknown): StoredCrossPair[] {
  if (!raw || typeof raw !== 'object') return [];
  const pairs = (raw as { pairs?: unknown }).pairs;
  if (!Array.isArray(pairs)) return [];
  const out: StoredCrossPair[] = [];
  for (const item of pairs) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (
      typeof row.minLibId === 'string' &&
      typeof row.minCardId === 'string' &&
      typeof row.maxLibId === 'string' &&
      typeof row.maxCardId === 'string'
    ) {
      out.push({
        minLibId: row.minLibId,
        minCardId: row.minCardId,
        maxLibId: row.maxLibId,
        maxCardId: row.maxCardId
      });
    }
  }
  return out;
}

export function resolveContainerPathForDuplicates(): string | null {
  const cfg = readLibraryRootConfigSync();
  if (cfg.parentPath?.trim()) return path.resolve(cfg.parentPath.trim());
  const active = getActiveLibraryEntry(cfg);
  if (active?.path) return path.dirname(path.resolve(active.path));
  return null;
}

export function crossSkippedFilePath(containerPath: string): string {
  return path.join(path.resolve(containerPath), LIBRARY_META_DIR, SKIPPED_CROSS_FILENAME);
}

function canonicalPair(
  libraryIdA: string,
  cardIdA: string,
  libraryIdB: string,
  cardIdB: string
): StoredCrossPair {
  const a = `${libraryIdA}:${cardIdA}`;
  const b = `${libraryIdB}:${cardIdB}`;
  if (a <= b) {
    return { minLibId: libraryIdA, minCardId: cardIdA, maxLibId: libraryIdB, maxCardId: cardIdB };
  }
  return { minLibId: libraryIdB, minCardId: cardIdB, maxLibId: libraryIdA, maxCardId: cardIdA };
}

export function loadCrossSkippedPairKeys(containerPath: string): Set<string> {
  const filePath = crossSkippedFilePath(containerPath);
  try {
    if (!existsSync(filePath)) return new Set();
    const parsed = parseStored(JSON.parse(readFileSync(filePath, 'utf8')));
    return new Set(
      parsed.map((p) => scopedPairKey(p.minLibId, p.minCardId, p.maxLibId, p.maxCardId))
    );
  } catch {
    return new Set();
  }
}

export function addCrossSkippedPair(
  containerPath: string,
  libraryIdA: string,
  cardIdA: string,
  libraryIdB: string,
  cardIdB: string
): void {
  const filePath = crossSkippedFilePath(containerPath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  let existing: StoredCrossPair[] = [];
  try {
    if (existsSync(filePath)) {
      existing = parseStored(JSON.parse(readFileSync(filePath, 'utf8')));
    }
  } catch {
    existing = [];
  }
  const next = canonicalPair(libraryIdA, cardIdA, libraryIdB, cardIdB);
  const key = scopedPairKey(next.minLibId, next.minCardId, next.maxLibId, next.maxCardId);
  if (existing.some((p) => scopedPairKey(p.minLibId, p.minCardId, p.maxLibId, p.maxCardId) === key)) {
    return;
  }
  existing.push(next);
  writeFileSync(filePath, JSON.stringify({ pairs: existing }, null, 2), 'utf8');
}
