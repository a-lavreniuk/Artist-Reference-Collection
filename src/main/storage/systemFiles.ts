import { readFile } from 'fs/promises';
import type { ArcMoodboardV1, ArcSystemV1 } from './types';
import { STORAGE_SCHEMA_VERSION } from './types';
import { atomicWriteJsonFile } from './atomicWrite';
import { libraryMetaFileAbs, MOODBOARD_FILENAME, SYSTEM_FILENAME } from '../libraryFilenames';

export { MOODBOARD_FILENAME, SYSTEM_FILENAME };

function systemPath(libraryRoot: string): string {
  return libraryMetaFileAbs(libraryRoot, SYSTEM_FILENAME);
}

function moodboardPath(libraryRoot: string): string {
  return libraryMetaFileAbs(libraryRoot, MOODBOARD_FILENAME);
}

export function defaultSystem(appVersion?: string): ArcSystemV1 {
  return {
    version: 1,
    schemaVersion: STORAGE_SCHEMA_VERSION,
    appVersion,
    duplicateSimilarityThresholdPct: 85
  };
}

export function defaultMoodboard(): ArcMoodboardV1 {
  return { version: 1, moodboardCardIds: [] };
}

export async function readSystem(libraryRoot: string): Promise<ArcSystemV1> {
  try {
    const raw = await readFile(systemPath(libraryRoot), 'utf8');
    const j = JSON.parse(raw) as Partial<ArcSystemV1>;
    const pct = j.duplicateSimilarityThresholdPct;
    return {
      version: 1,
      schemaVersion: j.schemaVersion ?? STORAGE_SCHEMA_VERSION,
      appVersion: j.appVersion,
      duplicateSimilarityThresholdPct:
        typeof pct === 'number' && Number.isFinite(pct) ? Math.min(100, Math.max(50, pct)) : 85
    };
  } catch {
    return defaultSystem();
  }
}

export async function writeSystem(libraryRoot: string, data: ArcSystemV1): Promise<void> {
  await atomicWriteJsonFile(systemPath(libraryRoot), data);
}

export async function readMoodboard(libraryRoot: string): Promise<ArcMoodboardV1> {
  try {
    const raw = await readFile(moodboardPath(libraryRoot), 'utf8');
    const j = JSON.parse(raw) as Partial<ArcMoodboardV1>;
    return {
      version: 1,
      moodboardCardIds: Array.isArray(j.moodboardCardIds)
        ? j.moodboardCardIds.filter((x): x is string => typeof x === 'string')
        : [],
      moodboardBoard: j.moodboardBoard
    };
  } catch {
    return defaultMoodboard();
  }
}

export async function writeMoodboard(libraryRoot: string, data: ArcMoodboardV1): Promise<void> {
  await atomicWriteJsonFile(moodboardPath(libraryRoot), data);
}
