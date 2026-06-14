import { app } from 'electron';
import { readFile } from 'fs/promises';
import path from 'path';

export type ReleaseNotesEntry = {
  buildDate: string;
  changes: string[];
};

export type ReleaseNotesFile = Record<string, ReleaseNotesEntry>;

function releaseNotesPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'release-notes.json');
  }
  return path.join(app.getAppPath(), 'release-notes.json');
}

export async function loadReleaseNotes(): Promise<ReleaseNotesFile> {
  try {
    const raw = await readFile(releaseNotesPath(), 'utf8');
    return JSON.parse(raw) as ReleaseNotesFile;
  } catch {
    return {};
  }
}

export async function getReleaseNotesForVersion(version: string): Promise<ReleaseNotesEntry | null> {
  const all = await loadReleaseNotes();
  return all[version] ?? null;
}

export type ReleaseNotesListItem = ReleaseNotesEntry & { version: string };

/** Сравнение semver-подобных строк по убыванию (major.minor.patch). */
export function compareSemverDesc(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return db - da;
  }
  return b.localeCompare(a);
}

export async function listReleaseNotes(): Promise<ReleaseNotesListItem[]> {
  const all = await loadReleaseNotes();
  return Object.entries(all)
    .map(([version, entry]) => ({ version, ...entry }))
    .sort((a, b) => compareSemverDesc(a.version, b.version));
}
