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
