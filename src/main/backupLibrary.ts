import { readdir, stat } from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { ZipStoreWriter } from './zipStore';
import { appendHistory } from './libraryHistory';
import { ensureLibraryFilenamesMigrated, METADATA_FILENAME } from './libraryFilenames';

export type BackupProgress = {
  phase: 'scan' | 'pack' | 'hash' | 'done' | 'error';
  percent: number;
  bytesPerSecond?: number;
  etaSeconds?: number;
  message?: string;
};

export type BackupOptions = {
  libraryRoot: string;
  destDir: string;
  partCount: 1 | 2 | 4 | 8;
  onProgress: (p: BackupProgress) => void;
  signal: AbortSignal;
};

type FileEntry = { rel: string; abs: string; size: number };

async function walkFiles(root: string, sub: string): Promise<FileEntry[]> {
  const base = path.join(root, sub);
  const out: FileEntry[] = [];
  let entries;
  try {
    entries = await readdir(base, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const relJoin = sub ? `${sub}/${ent.name}` : ent.name;
    const abs = path.join(root, relJoin.split('/').join(path.sep));
    if (ent.isDirectory()) {
      out.push(...(await walkFiles(root, relJoin)));
    } else if (ent.isFile()) {
      try {
        const st = await stat(abs);
        out.push({ rel: relJoin.replace(/\\/g, '/'), abs, size: st.size });
      } catch {
        /* skip */
      }
    }
  }
  return out;
}

async function collectBackupFiles(libraryRoot: string): Promise<FileEntry[]> {
  const root = path.resolve(libraryRoot);
  await ensureLibraryFilenamesMigrated(root);
  const metaAbs = path.join(root, METADATA_FILENAME);
  const list: FileEntry[] = [];
  try {
    const st = await stat(metaAbs);
    list.push({ rel: METADATA_FILENAME, abs: metaAbs, size: st.size });
  } catch {
    throw new Error('Нет файла arc-metadata.json в библиотеке.');
  }
  list.push(...(await walkFiles(root, 'media')));
  return list;
}

function partitionByParts(files: FileEntry[], partCount: number): FileEntry[][] {
  const sorted = [...files].sort((a, b) => a.rel.localeCompare(b.rel, 'en'));
  if (sorted.length === 0) return [[]];
  const n = Math.max(1, Math.min(partCount, sorted.length));
  if (n <= 1) return [sorted];
  const total = sorted.reduce((s, f) => s + f.size, 0);
  const target = total / n;
  const parts: FileEntry[][] = Array.from({ length: n }, () => []);
  let idx = 0;
  let acc = 0;
  for (const f of sorted) {
    if (idx < n - 1 && acc >= target && parts[idx].length > 0) {
      idx += 1;
      acc = 0;
    }
    parts[idx].push(f);
    acc += f.size;
  }
  return parts.filter((p) => p.length > 0);
}

function localDateYmd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function runBackup(opts: BackupOptions): Promise<{ ok: true } | { ok: false; error: string }> {
  const { libraryRoot, destDir, partCount, onProgress, signal } = opts;
  const root = path.resolve(libraryRoot);
  const dest = path.resolve(destDir);

  try {
    onProgress({ phase: 'scan', percent: 0 });
    const files = await collectBackupFiles(root);
    if (signal.aborted) throw new Error('Отменено');

    const totalBytes = files.reduce((s, f) => s + f.size, 0);
    const freeCheck = totalBytes * 1.1;
    /* точная проверка свободного места — упрощённо через statvfs нет в fs; пропускаем или пишем при ENOSPC */

    const dateStr = localDateYmd(new Date());
    const baseName = `ARC_${dateStr}`;
    const chunks = partitionByParts(files, partCount);

    type ManifestEntry = { path: string; sha256: string; size: number };
    const manifestEntries: ManifestEntry[] = [];
    const partBasenames: string[] = [];

    let doneBytes = 0;
    const t0 = Date.now();

    for (let pi = 0; pi < chunks.length; pi++) {
      if (signal.aborted) throw new Error('Отменено');
      const partLabel = chunks.length === 1 ? `${baseName}.arc` : `${baseName}.arc.part${String(pi + 1).padStart(2, '0')}`;
      partBasenames.push(partLabel);
      const tmpPath = path.join(dest, `${partLabel}.tmp`);
      const finalPath = path.join(dest, partLabel);
      const zip = await ZipStoreWriter.create(tmpPath);

      const chunk = chunks[pi];
      const isLast = pi === chunks.length - 1;

      for (const f of chunk) {
        if (signal.aborted) throw new Error('Отменено');
        const t1 = Date.now();
        const r = await zip.addFile(f.rel, f.abs);
        manifestEntries.push({ path: f.rel, sha256: r.sha256, size: r.size });
        doneBytes += f.size;
        const elapsed = (Date.now() - t0) / 1000;
        const pct = Math.min(99, Math.floor((doneBytes / Math.max(1, totalBytes)) * 100));
        const bps = elapsed > 0 ? doneBytes / elapsed : 0;
        const left = totalBytes - doneBytes;
        const eta = bps > 0 ? left / bps : undefined;
        onProgress({
          phase: 'pack',
          percent: pct,
          bytesPerSecond: bps,
          etaSeconds: eta !== undefined ? Math.ceil(eta) : undefined
        });
        void t1;
      }

      if (isLast) {
        const manifestObj = {
          backupFormatVersion: 1,
          createdLocalDate: dateStr,
          partFiles: partBasenames,
          files: manifestEntries
        };
        const manBuf = Buffer.from(JSON.stringify(manifestObj, null, 2), 'utf8');
        await zip.addBuffer('manifest.json', manBuf);
      }

      await zip.finalize();
      await import('fs/promises').then(({ rename }) => rename(tmpPath, finalPath));

    }

    onProgress({ phase: 'done', percent: 100 });
    try {
      const partWord = chunks.length === 1 ? 'один файл' : `${chunks.length} части`;
      await appendHistory(root, `Бэкап создан, ${partWord}`);
    } catch {
      /* ignore history */
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Ошибка бэкапа';
    onProgress({ phase: 'error', percent: 0, message: msg });
    return { ok: false, error: msg };
  }
}
