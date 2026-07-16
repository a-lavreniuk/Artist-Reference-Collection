import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import { collectBackupFiles, runBackup } from '../backupLibrary';
import { extractZipStore } from '../zipRead';

describe('collectBackupFiles / runBackup', () => {
  const temps: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true }).catch(() => undefined))
    );
  });

  async function tempDir(prefix: string): Promise<string> {
    const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
    temps.push(dir);
    return dir;
  }

  it('собирает meta/ и cards/ без arc-metadata.json', async () => {
    const root = await tempDir('arc-backup-modern-');
    await mkdir(path.join(root, 'meta'), { recursive: true });
    await mkdir(path.join(root, 'cards', 'card-1'), { recursive: true });
    await writeFile(path.join(root, 'meta', 'arc-index.db'), 'sqlite-placeholder');
    await writeFile(path.join(root, 'meta', 'arc-system.json'), '{"schemaVersion":2}');
    await writeFile(path.join(root, 'cards', 'card-1', 'original.jpg'), 'img');

    const files = await collectBackupFiles(root);
    const rels = files.map((f) => f.rel).sort();

    expect(rels).toContain('meta/arc-index.db');
    expect(rels).toContain('meta/arc-system.json');
    expect(rels).toContain('cards/card-1/original.jpg');
    expect(rels.some((r) => r.includes('arc-metadata.json'))).toBe(false);
  });

  it('падает с понятной ошибкой на пустой папке', async () => {
    const root = await tempDir('arc-backup-empty-');
    await expect(collectBackupFiles(root)).rejects.toThrow(
      'Не удалось найти данные библиотеки для резервной копии.'
    );
  });

  it('создаёт .arc с файлами современной библиотеки', async () => {
    const root = await tempDir('arc-backup-lib-');
    const dest = await tempDir('arc-backup-dest-');
    await mkdir(path.join(root, 'meta'), { recursive: true });
    await mkdir(path.join(root, 'cards', 'c1'), { recursive: true });
    await writeFile(path.join(root, 'meta', 'arc-index.db'), 'db-bytes');
    await writeFile(path.join(root, 'cards', 'c1', 'original.png'), 'png');

    const progress: string[] = [];
    const result = await runBackup({
      libraryRoot: root,
      destDir: dest,
      partCount: 1,
      signal: new AbortController().signal,
      onProgress(p) {
        progress.push(p.phase);
      }
    });

    expect(result).toEqual({ ok: true });
    expect(progress).toContain('done');

    const names = await readdir(dest);
    const arcName = names.find((n) => n.endsWith('.arc'));
    expect(arcName).toBeTruthy();

    const extractDir = await tempDir('arc-backup-extract-');
    await extractZipStore(path.join(dest, arcName!), extractDir);

    const manRaw = await readFile(path.join(extractDir, 'manifest.json'), 'utf8');
    const manifest = JSON.parse(manRaw) as { files: Array<{ path: string }> };
    const paths = manifest.files.map((f) => f.path).sort();
    expect(paths).toContain('meta/arc-index.db');
    expect(paths).toContain('cards/c1/original.png');
  });
});
