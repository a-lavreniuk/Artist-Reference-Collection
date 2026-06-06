function fileUriToPath(uri: string): string | null {
  const line = uri.trim();
  if (!line || line.startsWith('#')) return null;
  try {
    const url = new URL(line);
    if (url.protocol !== 'file:') return null;
    let p = decodeURIComponent(url.pathname);
    if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1);
    return p || null;
  } catch {
    return null;
  }
}

function pathsFromUriList(dt: DataTransfer): string[] {
  const raw = dt.getData('text/uri-list') || dt.getData('URL') || dt.getData('text/plain') || '';
  if (!raw.trim()) return [];
  const paths: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const p = fileUriToPath(line);
    if (p) paths.push(p);
  }
  return paths;
}

/** Пути сброшенных файлов (fallback для renderer; основной канал — `window.arc.onFileDrop` в preload). */
export function extractDroppedFilePaths(dt: DataTransfer): string[] {
  if (!dt.files?.length) return pathsFromUriList(dt);
  if (window.arc?.getPathsForDroppedFiles) {
    const paths = window.arc.getPathsForDroppedFiles(dt.files);
    if (paths.length) return paths;
  }
  const paths: string[] = [];
  for (let i = 0; i < dt.files.length; i++) {
    const f = dt.files.item(i);
    if (!f) continue;
    const p = (f as File & { path?: string }).path;
    if (typeof p === 'string' && p.trim()) paths.push(p);
  }
  if (paths.length) return paths;
  return pathsFromUriList(dt);
}
