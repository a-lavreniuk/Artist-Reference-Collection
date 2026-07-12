import { execFileSync } from 'child_process';
import path from 'path';

import type { WindowAtPoint } from './screenshotWindowBoundsTypes';

function scriptPath(): string {
  return path.resolve(__dirname, '..', 'scripts', 'screenshot-window-at-point.ps1');
}

function parseJson(raw: string): WindowAtPoint | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'null') return null;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const title = typeof parsed.title === 'string' ? parsed.title : '';
    const nativeId = typeof parsed.nativeId === 'number' ? parsed.nativeId : undefined;
    const x = typeof parsed.x === 'number' ? parsed.x : NaN;
    const y = typeof parsed.y === 'number' ? parsed.y : NaN;
    const width = typeof parsed.width === 'number' ? parsed.width : NaN;
    const height = typeof parsed.height === 'number' ? parsed.height : NaN;
    if (![x, y, width, height].every((n) => Number.isFinite(n))) return null;
    if (width < 1 || height < 1) return null;
    return { title, nativeId, x, y, width, height };
  } catch {
    return null;
  }
}

export function getWindowAtPointWin32(x: number, y: number): WindowAtPoint | null {
  try {
    const out = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath(), String(x), String(y)],
      { encoding: 'utf8', timeout: 2000, windowsHide: true }
    );
    return parseJson(out);
  } catch {
    return null;
  }
}
