import { execFileSync } from 'child_process';
import path from 'path';

import type { WindowAtPoint } from './screenshotWindowBoundsTypes';

function scriptPath(): string {
  return path.resolve(__dirname, '..', 'scripts', 'screenshot-window-at-point.swift');
}

function parseJson(raw: string): WindowAtPoint | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'null') return null;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const title = typeof parsed.title === 'string' ? parsed.title : '';
    const owner = typeof parsed.owner === 'string' ? parsed.owner : undefined;
    const nativeId = typeof parsed.nativeId === 'number' ? parsed.nativeId : undefined;
    const x = typeof parsed.x === 'number' ? parsed.x : NaN;
    const y = typeof parsed.y === 'number' ? parsed.y : NaN;
    const width = typeof parsed.width === 'number' ? parsed.width : NaN;
    const height = typeof parsed.height === 'number' ? parsed.height : NaN;
    if (![x, y, width, height].every((n) => Number.isFinite(n))) return null;
    if (width < 1 || height < 1) return null;
    return { title, owner, nativeId, x, y, width, height };
  } catch {
    return null;
  }
}

export function getWindowAtPointDarwin(x: number, y: number): WindowAtPoint | null {
  try {
    const out = execFileSync('swift', [scriptPath(), String(x), String(y)], {
      encoding: 'utf8',
      timeout: 4000
    });
    return parseJson(out);
  } catch {
    return null;
  }
}
