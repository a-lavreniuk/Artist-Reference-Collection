export type WindowAtPoint = {
  title: string;
  owner?: string;
  nativeId?: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export function shouldExcludeWindowAtPoint(win: WindowAtPoint): boolean {
  const title = win.title.trim().toLowerCase();
  const owner = (win.owner ?? '').trim().toLowerCase();
  if (!title && !owner) return true;
  if (title.includes('arc screenshot area picker')) return true;
  if (title.includes('arc screenshot window picker')) return true;
  if (title.includes('artist reference collection') && owner.includes('electron')) return true;
  if (owner === 'electron' && title.includes('arc')) return true;
  return false;
}
