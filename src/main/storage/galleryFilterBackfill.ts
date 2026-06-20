import path from 'path';
import type Database from 'better-sqlite3';
import { openLibraryDb } from './db';
import { probeVideoDurationMs } from '../ffmpeg';
import { readCardJson, writeCardJson } from './cardFolder';
import { waitForNavigationIpc, captureNavigationEpoch, isNavigationEpochStale } from '../ipcNavigationPriority';

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

export function countVideosMissingDuration(db: Database.Database): number {
  const row = db
    .prepare(
      "SELECT COUNT(*) AS n FROM cards WHERE type = 'video' AND COALESCE(is_deleted,0)=0 AND (duration_ms IS NULL OR duration_ms = 0)"
    )
    .get() as { n: number };
  return row?.n ?? 0;
}

export async function ensureVideoDurationBackfill(libraryRoot: string): Promise<void> {
  const root = path.resolve(libraryRoot);
  const db = openLibraryDb(root);
  if (countVideosMissingDuration(db) > 0) {
    await backfillVideoDurationMs(root);
  }
}

export function countCardsMissingDimensions(db: Database.Database): number {
  const row = db
    .prepare(
      'SELECT COUNT(*) AS n FROM cards WHERE COALESCE(is_deleted,0)=0 AND (COALESCE(width,0)=0 OR COALESCE(height,0)=0)'
    )
    .get() as { n: number };
  return row?.n ?? 0;
}

export async function ensureDimensionsBackfill(libraryRoot: string): Promise<void> {
  const root = path.resolve(libraryRoot);
  const db = openLibraryDb(root);
  if (countCardsMissingDimensions(db) > 0) {
    await backfillCardDimensions(root);
  }
}

export async function backfillCardDimensions(
  libraryRoot: string
): Promise<{ updated: number; failed: number }> {
  const root = path.resolve(libraryRoot);
  const db = openLibraryDb(root);
  const rows = db
    .prepare(
      'SELECT id FROM cards WHERE COALESCE(is_deleted,0)=0 AND (COALESCE(width,0)=0 OR COALESCE(height,0)=0)'
    )
    .all() as Array<{ id: string }>;

  let updated = 0;
  let failed = 0;
  const navSnap = captureNavigationEpoch();
  for (const row of rows) {
    if (isNavigationEpochStale(navSnap)) break;
    await waitForNavigationIpc();
    const cardJson = await readCardJson(root, row.id);
    const width = cardJson?.width;
    const height = cardJson?.height;
    if (!width || !height || width <= 0 || height <= 0) {
      failed++;
      await yieldToEventLoop();
      continue;
    }
    db.prepare('UPDATE cards SET width = ?, height = ? WHERE id = ?').run(width, height, row.id);
    updated++;
    await yieldToEventLoop();
  }
  return { updated, failed };
}

export async function backfillVideoDurationMs(libraryRoot: string): Promise<{ updated: number; failed: number }> {
  const root = path.resolve(libraryRoot);
  const db = openLibraryDb(root);
  const rows = db
    .prepare(
      "SELECT id, original_rel FROM cards WHERE type = 'video' AND COALESCE(is_deleted,0)=0 AND (duration_ms IS NULL OR duration_ms = 0)"
    )
    .all() as Array<{ id: string; original_rel: string }>;

  let updated = 0;
  let failed = 0;
  const navSnap = captureNavigationEpoch();
  for (const row of rows) {
    if (isNavigationEpochStale(navSnap)) break;
    await waitForNavigationIpc();
    const abs = path.join(root, row.original_rel.replace(/\//g, path.sep));
    const cardJson = await readCardJson(root, row.id);
    let ms = cardJson?.durationMs && cardJson.durationMs > 0 ? cardJson.durationMs : null;
    if (ms == null) {
      ms = (await probeVideoDurationMs(abs)) ?? null;
    }
    if (ms == null || ms <= 0) {
      failed++;
      await yieldToEventLoop();
      continue;
    }
    db.prepare('UPDATE cards SET duration_ms = ? WHERE id = ?').run(ms, row.id);
    const cardJsonAfter = cardJson ?? (await readCardJson(root, row.id));
    if (cardJsonAfter) {
      cardJsonAfter.durationMs = ms;
      await writeCardJson(root, cardJsonAfter);
    }
    updated++;
    await yieldToEventLoop();
  }
  return { updated, failed };
}
