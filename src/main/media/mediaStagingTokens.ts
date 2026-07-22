import { randomBytes } from 'crypto';
import { stat } from 'fs/promises';
import os from 'os';
import path from 'path';

import { app } from 'electron';

import { isAllowedMediaExt, isInsideLibrary } from './arcMediaPath';
import { syncStagingTokenToMediaWorker } from './mediaServerHost';

const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_TOKENS = 512;
const ALLOWLIST_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_ALLOWLIST = 2048;

type StagingEntry = {
  absPath: string;
  expiresAt: number;
};

type AllowlistEntry = {
  expiresAt: number;
};

const stagingByToken = new Map<string, StagingEntry>();
/** Absolute paths the renderer may stage (user-picked import files, etc.). */
const stagingAllowlist = new Map<string, AllowlistEntry>();

function pruneExpiredStagingTokens(now = Date.now()): void {
  for (const [token, entry] of stagingByToken) {
    if (entry.expiresAt <= now) stagingByToken.delete(token);
  }
}

function pruneExpiredAllowlist(now = Date.now()): void {
  for (const [abs, entry] of stagingAllowlist) {
    if (entry.expiresAt <= now) stagingAllowlist.delete(abs);
  }
}

function isUnderDir(candidateAbs: string, rootAbs: string): boolean {
  const root = path.resolve(rootAbs);
  const cand = path.resolve(candidateAbs);
  const rel = path.relative(root, cand);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** Temp / userData roots where ARC may create staged media copies. */
export function isTrustedStagingRoot(absPath: string): boolean {
  const resolved = path.resolve(absPath);
  const roots: string[] = [os.tmpdir()];
  try {
    roots.push(app.getPath('temp'));
    roots.push(app.getPath('userData'));
  } catch {
    /* app may be unavailable in unit tests */
  }
  return roots.some((root) => isUnderDir(resolved, root));
}

/** Remember user-selected / import paths so staging tokens stay limited to known files. */
export function allowMediaStagingPaths(paths: readonly string[]): void {
  const now = Date.now();
  pruneExpiredAllowlist(now);
  const expiresAt = now + ALLOWLIST_TTL_MS;
  for (const raw of paths) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const resolved = path.resolve(raw.trim());
    stagingAllowlist.set(resolved, { expiresAt });
  }
  while (stagingAllowlist.size > MAX_ALLOWLIST) {
    const oldest = stagingAllowlist.keys().next().value;
    if (!oldest) break;
    stagingAllowlist.delete(oldest);
  }
}

export function isAllowedStagingAbsPath(absPath: string, libraryRoot: string | null): boolean {
  const resolved = path.resolve(absPath);
  if (libraryRoot && isInsideLibrary(libraryRoot, resolved)) return true;
  if (isTrustedStagingRoot(resolved)) return true;
  pruneExpiredAllowlist();
  const entry = stagingAllowlist.get(resolved);
  return Boolean(entry && entry.expiresAt > Date.now());
}

/** Регистрирует абсолютный путь для выдачи через media server по одноразовому токену (?stg=). */
export async function registerMediaStagingToken(
  absPath: string,
  libraryRoot: string | null = null
): Promise<string | null> {
  const resolved = path.resolve(absPath.trim());
  if (!resolved) return null;
  if (!isAllowedStagingAbsPath(resolved, libraryRoot)) return null;

  try {
    const st = await stat(resolved);
    if (!st.isFile()) return null;
  } catch {
    return null;
  }

  const ext = path.extname(resolved);
  if (!isAllowedMediaExt(ext)) return null;

  pruneExpiredStagingTokens();
  while (stagingByToken.size >= MAX_TOKENS) {
    const oldest = stagingByToken.keys().next().value;
    if (!oldest) break;
    stagingByToken.delete(oldest);
  }

  const token = randomBytes(16).toString('hex');
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  stagingByToken.set(token, { absPath: resolved, expiresAt });
  syncStagingTokenToMediaWorker(token, resolved, expiresAt);
  return token;
}

export function resolveMediaStagingToken(token: string): string | null {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const entry = stagingByToken.get(trimmed);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    stagingByToken.delete(trimmed);
    return null;
  }
  return entry.absPath;
}

export function clearMediaStagingTokens(): void {
  stagingByToken.clear();
  stagingAllowlist.clear();
}
