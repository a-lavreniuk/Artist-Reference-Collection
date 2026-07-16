import { readdir, stat } from 'fs/promises';
import path from 'path';
import { ZipStoreWriter } from './zipStore';
import { appendHistory } from './libraryHistory';
import {
  CARDS_DIR,
  ensureLibraryFilenamesMigrated,
  fileExists,
  INDEX_DB_FILENAME,
  LIBRARY_META_DIR,
  libraryMetaFileAbs,
  METADATA_FILENAME,
  resolveLegacyMetadataAbsPath
} from './libraryFilenames';
import { closeLibraryDb } from './storage/db';

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

function addUnique(map: Map<string, FileEntry>, entries: FileEntry[]): void {
  for (const entry of entries) {
    if (!map.has(entry.rel)) map.set(entry.rel, entry);
  }
}

async function fileEntryForAbs(root: string, abs: string, fallbackRel: string): Promise<FileEntry | null> {
  try {
    const st = await stat(abs);
    if (!st.isFile()) return null;
    const rel = abs.startsWith(root)
      ? abs.slice(root.length + 1).replace(/\\/g, '/')
      : fallbackRel;
    return { rel, abs, size: st.size };
  } catch {
    return null;
  }
}

/** Собирает файлы современной (meta/ + cards/) и legacy (media/ + arc-metadata.json) библиотеки. */
export async function collectBackupFiles(libraryRoot: string): Promise<FileEntry[]> {
  const root = path.resolve(libraryRoot);
  await ensureLibraryFilenamesMigrated(root);

  const byRel = new Map<string, FileEntry>();
  addUnique(byRel, await walkFiles(root, LIBRARY_META_DIR));
  addUnique(byRel, await walkFiles(root, CARDS_DIR));
  addUnique(byRel, await walkFiles(root, 'media'));

  const legacyMetaAbs = await resolveLegacyMetadataAbsPath(root);
  if (legacyMetaAbs) {
    const entry = await fileEntryForAbs(root, legacyMetaAbs, METADATA_FILENAME);
    if (entry) addUnique(byRel, [entry]);
  }

  const flatIndexAbs = path.join(root, INDEX_DB_FILENAME);
  if (await fileExists(flatIndexAbs)) {
    const entry = await fileEntryForAbs(root, flatIndexAbs, INDEX_DB_FILENAME);
    if (entry) addUnique(byRel, [entry]);
  }

  const hasIndexDb =
    (await fileExists(libraryMetaFileAbs(root, INDEX_DB_FILENAME))) || (await fileExists(flatIndexAbs));
  const hasCardsContent = [...byRel.keys()].some((rel) => rel === CARDS_DIR || rel.startsWith(`${CARDS_DIR}/`));
  const hasLegacyMeta = legacyMetaAbs !== null;

  if (!hasIndexDb && !hasCardsContent && !hasLegacyMeta) {
    throw new Error('Не удалось найти данные библиотеки для резервной копии.');
  }

  return [...byRel.values()];
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
    closeLibraryDb();
    const files = await collectBackupFiles(root);
    if (signal.aborted) throw new Error('Отменено');

    const totalBytes = files.reduce((s, f) => s + f.size, 0);
    const freeCheck = totalBytes * 1.1;
    /* точная проверка свободного места — упрощённо через statvfs нет в fs; пропускаем или пишем при ENOSPC */
    void freeCheck;

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
