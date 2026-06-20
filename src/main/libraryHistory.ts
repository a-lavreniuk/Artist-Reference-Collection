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

export type HistoryEntityType = 'card' | 'collection' | 'category' | 'tag';

export type HistorySegment =
  | { kind: 'text'; text: string }
  | { kind: 'entity'; entityType: HistoryEntityType; id: string; label: string };

export type HistoryEntry = {
  /** Локальная строка времени по плану */
  time: string;
  message: string;
  segments?: HistorySegment[];
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

function isValidSegment(seg: unknown): seg is HistorySegment {
  if (!seg || typeof seg !== 'object') return false;
  const s = seg as HistorySegment;
  if (s.kind === 'text') return typeof s.text === 'string';
  if (s.kind === 'entity') {
    return (
      typeof s.id === 'string' &&
      typeof s.label === 'string' &&
      (s.entityType === 'card' ||
        s.entityType === 'collection' ||
        s.entityType === 'category' ||
        s.entityType === 'tag')
    );
  }
  return false;
}

function normalizeEntry(raw: unknown): HistoryEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Partial<HistoryEntry>;
  if (typeof e.message !== 'string' || typeof e.time !== 'string') return null;
  const entry: HistoryEntry = { time: e.time, message: e.message };
  if (Array.isArray(e.segments)) {
    const segments = e.segments.filter(isValidSegment);
    if (segments.length > 0) entry.segments = segments;
  }
  return entry;
}

async function historyPath(libraryRoot: string): Promise<string> {
  await ensureLibraryFilenamesMigrated(libraryRoot);
  const inMeta = libraryMetaFileAbs(libraryRoot, HISTORY_FILENAME);
  if (await fileExists(inMeta)) return inMeta;
  return path.join(path.resolve(libraryRoot), HISTORY_FILENAME);
}

async function readHistoryFile(libraryRoot: string): Promise<HistoryFile> {
  await ensureLibraryFilenamesMigrated(libraryRoot);
  await mkdir(libraryMetaDirAbs(libraryRoot), { recursive: true });
  const p = libraryMetaFileAbs(libraryRoot, HISTORY_FILENAME);
  const file = emptyFile();
  try {
    const raw = await readFile(p, 'utf8');
    const j = JSON.parse(raw) as Partial<HistoryFile>;
    if (j && Array.isArray(j.entries)) {
      file.entries = j.entries.map(normalizeEntry).filter((e): e is HistoryEntry => e !== null);
    }
  } catch {
    const legacy = path.join(path.resolve(libraryRoot), HISTORY_FILENAME);
    try {
      const raw = await readFile(legacy, 'utf8');
      const j = JSON.parse(raw) as Partial<HistoryFile>;
      if (j && Array.isArray(j.entries)) {
        file.entries = j.entries.map(normalizeEntry).filter((e): e is HistoryEntry => e !== null);
      }
    } catch {
      /* new */
    }
  }
  return file;
}

async function writeHistoryFile(libraryRoot: string, file: HistoryFile): Promise<void> {
  await ensureLibraryFilenamesMigrated(libraryRoot);
  await mkdir(libraryMetaDirAbs(libraryRoot), { recursive: true });
  const p = libraryMetaFileAbs(libraryRoot, HISTORY_FILENAME);
  const tmp = `${p}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(file, null, 2), 'utf8');
  await rename(tmp, p);
}

export async function readHistory(libraryRoot: string): Promise<HistoryEntry[]> {
  const p = await historyPath(libraryRoot);
  try {
    const raw = await readFile(p, 'utf8');
    const j = JSON.parse(raw) as HistoryFile;
    if (!j || !Array.isArray(j.entries)) return [];
    return j.entries.map(normalizeEntry).filter((e): e is HistoryEntry => e !== null);
  } catch {
    return [];
  }
}

export async function appendHistory(
  libraryRoot: string,
  message: string,
  segments?: HistorySegment[]
): Promise<void> {
  const file = await readHistoryFile(libraryRoot);
  const entry: HistoryEntry = { time: formatLocalTime(new Date()), message };
  if (segments && segments.length > 0) {
    entry.segments = segments.filter(isValidSegment);
  }
  file.entries.unshift(entry);
  if (file.entries.length > MAX) {
    file.entries = file.entries.slice(0, MAX);
  }
  await writeHistoryFile(libraryRoot, file);
}

export async function clearHistory(libraryRoot: string): Promise<void> {
  await writeHistoryFile(libraryRoot, emptyFile());
}
