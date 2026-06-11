import path from 'path';
import { openLibraryDb } from './db';
import { cardDirAbs } from './cardFolder';
import { probeVideoDurationMs } from '../ffmpeg';
import { readCardJson, writeCardJson } from './cardFolder';

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
  for (const row of rows) {
    const abs = path.join(root, row.original_rel.replace(/\//g, path.sep));
    const ms = await probeVideoDurationMs(abs);
    if (ms == null || ms <= 0) {
      failed++;
      continue;
    }
    db.prepare('UPDATE cards SET duration_ms = ? WHERE id = ?').run(ms, row.id);
    const cardJson = await readCardJson(root, row.id);
    if (cardJson) {
      cardJson.durationMs = ms;
      await writeCardJson(root, cardJson);
    }
    updated++;
  }
  return { updated, failed };
}
