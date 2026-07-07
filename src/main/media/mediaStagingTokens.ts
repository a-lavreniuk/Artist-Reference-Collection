import { randomBytes } from 'crypto';
import { stat } from 'fs/promises';
import path from 'path';

import { isAllowedMediaExt } from './arcMediaPath';
import { syncStagingTokenToMediaWorker } from './mediaServerHost';

const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_TOKENS = 512;

type StagingEntry = {
  absPath: string;
  expiresAt: number;
};

const stagingByToken = new Map<string, StagingEntry>();

function pruneExpiredStagingTokens(now = Date.now()): void {
  for (const [token, entry] of stagingByToken) {
    if (entry.expiresAt <= now) stagingByToken.delete(token);
  }
}

/** Регистрирует абсолютный путь для выдачи через media server по одноразовому токену (?stg=). */
export async function registerMediaStagingToken(absPath: string): Promise<string | null> {
  const resolved = path.resolve(absPath.trim());
  if (!resolved) return null;

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
}
