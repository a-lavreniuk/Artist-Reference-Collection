import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../storage/db', () => ({
  openLibraryDb: vi.fn()
}));

vi.mock('../storage/libraryStorage', () => ({
  getCardsWithPhash: () => [],
  getSystemData: () => ({ duplicateSimilarityThresholdPct: 85 }),
  listSkippedDuplicatePairs: () => []
}));

import { openLibraryDb } from '../storage/db';
import { findExactDuplicateVideoCard, isExactDuplicateIncomingFile } from '../duplicateScanService';

describe('exact video duplicate detection', () => {
  const tempRoots: string[] = [];

  afterEach(async () => {
    vi.clearAllMocks();
    await Promise.all(tempRoots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function tempDir(prefix: string): Promise<string> {
    const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
    tempRoots.push(dir);
    return dir;
  }

  it('finds exact duplicate video by SHA-256', async () => {
    const libraryRoot = await tempDir('arc-video-dup-');
    const cardId = 'video-card-1';
    const cardDir = path.join(libraryRoot, 'cards', cardId);
    await mkdir(cardDir, { recursive: true });
    const originalAbs = path.join(cardDir, 'original.mp4');
    const bytes = Buffer.from('fake-mp4-bytes-for-duplicate-test');
    await writeFile(originalAbs, bytes);

    vi.mocked(openLibraryDb).mockReturnValue({
      prepare: () => ({
        all: () => [
          {
            id: cardId,
            originalRel: path.join('cards', cardId, 'original.mp4').replace(/\\/g, '/')
          }
        ]
      })
    } as never);

    const probeDir = await tempDir('arc-video-probe-');
    const probePath = path.join(probeDir, 'incoming.mp4');
    await writeFile(probePath, bytes);

    await expect(findExactDuplicateVideoCard(libraryRoot, probePath)).resolves.toBe(cardId);
    await expect(isExactDuplicateIncomingFile(libraryRoot, probePath)).resolves.toBe(true);
  });

  it('returns null when video bytes differ', async () => {
    const libraryRoot = await tempDir('arc-video-dup-');
    const cardId = 'video-card-1';
    const cardDir = path.join(libraryRoot, 'cards', cardId);
    await mkdir(cardDir, { recursive: true });
    await writeFile(path.join(cardDir, 'original.mp4'), Buffer.from('original-video'));

    vi.mocked(openLibraryDb).mockReturnValue({
      prepare: () => ({
        all: () => [
          {
            id: cardId,
            originalRel: path.join('cards', cardId, 'original.mp4').replace(/\\/g, '/')
          }
        ]
      })
    } as never);

    const probeDir = await tempDir('arc-video-probe-');
    const probePath = path.join(probeDir, 'incoming.mp4');
    await writeFile(probePath, Buffer.from('different-video-bytes'));

    await expect(findExactDuplicateVideoCard(libraryRoot, probePath)).resolves.toBeNull();
    await expect(isExactDuplicateIncomingFile(libraryRoot, probePath)).resolves.toBe(false);
  });
});
