import type { WindowAtPoint } from './screenshotWindowBoundsTypes';
import { getWindowAtPointDarwin } from './screenshotWindowBounds.darwin';
import { getWindowAtPointWin32 } from './screenshotWindowBounds.win32';

export type { WindowAtPoint } from './screenshotWindowBoundsTypes';
export { shouldExcludeWindowAtPoint } from './screenshotWindowBoundsTypes';

export function getWindowAtPoint(x: number, y: number): WindowAtPoint | null {
  if (process.platform === 'win32') return getWindowAtPointWin32(x, y);
  if (process.platform === 'darwin') return getWindowAtPointDarwin(x, y);
  return null;
}
