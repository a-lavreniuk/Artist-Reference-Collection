import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';
import {
  ensureLibraryFilenamesMigrated,
  fileExists,
  HISTORY_FILENAME,
  libraryMetaDirAbs,
  libraryMetaFileAbs
} from './libraryFilenames';

const MAX = 1000;

export type HistoryEntry = {
  /** Локальная строка времени по плану */
  time: string;
  message: string;
};

type HistoryFile = {
  version: 1;
  entries: HistoryEntry[];
};

function emptyFile(): HistoryFile {
  return { version: 1, entries: [] };
}

function formatLocalTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function historyPath(libraryRoot: string): Promise<string> {
  await ensureLibraryFilenamesMigrated(libraryRoot);
  const inMeta = libraryMetaFileAbs(libraryRoot, HISTORY_FILENAME);
  if (await fileExists(inMeta)) return inMeta;
  return path.join(path.resolve(libraryRoot), HISTORY_FILENAME);
}

export async function readHistory(libraryRoot: string): Promise<HistoryEntry[]> {
  const p = await historyPath(libraryRoot);
  try {
    const raw = await readFile(p, 'utf8');
    const j = JSON.parse(raw) as HistoryFile;
    if (!j || !Array.isArray(j.entries)) return [];
    return j.entries;
  } catch {
    return [];
  }
}

export async function appendHistory(libraryRoot: string, message: string): Promise<void> {
  await ensureLibraryFilenamesMigrated(libraryRoot);
  await mkdir(libraryMetaDirAbs(libraryRoot), { recursive: true });
  const p = libraryMetaFileAbs(libraryRoot, HISTORY_FILENAME);
  const file = emptyFile();
  try {
    const raw = await readFile(p, 'utf8');
    const j = JSON.parse(raw) as Partial<HistoryFile>;
    if (j && Array.isArray(j.entries)) {
      file.entries = j.entries.filter((e) => e && typeof e.message === 'string' && typeof e.time === 'string');
    }
  } catch {
    /* new or migrate from root on read below */
    const legacy = path.join(path.resolve(libraryRoot), HISTORY_FILENAME);
    try {
      const raw = await readFile(legacy, 'utf8');
      const j = JSON.parse(raw) as Partial<HistoryFile>;
      if (j && Array.isArray(j.entries)) {
        file.entries = j.entries.filter((e) => e && typeof e.message === 'string' && typeof e.time === 'string');
      }
    } catch {
      /* new */
    }
  }
  file.entries.unshift({ time: formatLocalTime(new Date()), message });
  if (file.entries.length > MAX) {
    file.entries = file.entries.slice(0, MAX);
  }
  const tmp = `${p}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(file, null, 2), 'utf8');
  await rename(tmp, p);
}
