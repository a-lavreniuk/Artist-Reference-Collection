import path from 'path';
import { THUMB_GENERATION_VERSION } from '../shared/thumbConstants';
import {
  cardTempAbs,
  ensureCardMetaDir,
  readCardJson,
  thumbLAbs,
  thumbLRelPath,
  thumbMAbs,
  thumbMRelPath,
  thumbSAbs,
  thumbSRelPath,
  writeCardJson
} from './cardFolder';
import { openLibraryDb } from './db';
import { extractVideoFrameToJpeg, isVideoExt } from '../ffmpeg';
import { captureNavigationEpoch, isNavigationEpochStale, waitForNavigationIpc } from '../ipcNavigationPriority';
import { readSystem, writeSystem } from './systemFiles';
import { generateImageThumbnails, generateVideoThumbnailsFromFrame } from './thumbnails';
import { unlink } from 'fs/promises';

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

export async function libraryNeedsThumbGenerationUpgrade(libraryRoot: string): Promise<boolean> {
  const sys = await readSystem(libraryRoot);
  return (sys.thumbGenerationVersion ?? 1) < THUMB_GENERATION_VERSION;
}

export async function ensureThumbGenerationBackfill(libraryRoot: string): Promise<void> {
  const root = path.resolve(libraryRoot);
  if (!(await libraryNeedsThumbGenerationUpgrade(root))) return;
  await backfillThumbGeneration(root);
}

export async function backfillThumbGeneration(
  libraryRoot: string
): Promise<{ updated: number; failed: number }> {
  const root = path.resolve(libraryRoot);
  const db = openLibraryDb(root);
  const rows = db
    .prepare(
      `SELECT id, type, original_rel FROM cards
       WHERE COALESCE(is_deleted, 0) = 0
       ORDER BY added_at ASC`
    )
    .all() as Array<{ id: string; type: 'image' | 'video'; original_rel: string }>;

  let updated = 0;
  let failed = 0;
  const navSnap = captureNavigationEpoch();

  for (const row of rows) {
    if (isNavigationEpochStale(navSnap)) break;
    await waitForNavigationIpc();

    await ensureCardMetaDir(root, row.id);
    const sAbs = thumbSAbs(root, row.id);
    const mAbs = thumbMAbs(root, row.id);
    const lAbs = thumbLAbs(root, row.id);
    const originalAbs = path.join(root, row.original_rel.replace(/\//g, path.sep));

    try {
      if (row.type === 'image') {
        await generateImageThumbnails(originalAbs, sAbs, mAbs, lAbs, false);
      } else {
        const cardJson = await readCardJson(root, row.id);
        const previewFrameMs =
          cardJson?.previewFrameMs && cardJson.previewFrameMs > 0 ? cardJson.previewFrameMs : undefined;
        const frameTmp = cardTempAbs(root, row.id, '_thumb_backfill_frame.jpg');
        try {
          await extractVideoFrameToJpeg(originalAbs, frameTmp, {
            atMs: previewFrameMs
          });
          const thumbRes = await generateVideoThumbnailsFromFrame(frameTmp, sAbs, mAbs, lAbs);
          if (cardJson && previewFrameMs != null) {
            cardJson.width = thumbRes.width || cardJson.width;
            cardJson.height = thumbRes.height || cardJson.height;
            cardJson.dominantColorHex = thumbRes.dominantColorHex;
            await writeCardJson(root, cardJson);
            db.prepare(
              `UPDATE cards SET width = ?, height = ?, dominant_color = ?, palette_json = ?, thumb_s_rel = ?, thumb_m_rel = ?, thumb_l_rel = ? WHERE id = ?`
            ).run(
              cardJson.width ?? null,
              cardJson.height ?? null,
              thumbRes.dominantColorHex,
              JSON.stringify(thumbRes.palette),
              thumbSRelPath(row.id),
              thumbMRelPath(row.id),
              thumbLRelPath(row.id),
              row.id
            );
            updated++;
            await yieldToEventLoop();
            continue;
          }
        } finally {
          try {
            await unlink(frameTmp);
          } catch {
            /* ignore */
          }
        }
      }

      const cardJson = await readCardJson(root, row.id);
      if (cardJson) {
        db.prepare(
          `UPDATE cards SET thumb_s_rel = ?, thumb_m_rel = ?, thumb_l_rel = ? WHERE id = ?`
        ).run(thumbSRelPath(row.id), thumbMRelPath(row.id), thumbLRelPath(row.id), row.id);
      }
      updated++;
    } catch {
      failed++;
    }

    await yieldToEventLoop();
  }

  const sys = await readSystem(root);
  await writeSystem(root, { ...sys, thumbGenerationVersion: THUMB_GENERATION_VERSION });
  return { updated, failed };
}
