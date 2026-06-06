import { webUtils } from 'electron';

type FileDropListener = (paths: string[]) => void;

const listeners = new Set<FileDropListener>();
let attached = false;

function isOsFileDrag(dt: DataTransfer): boolean {
  if (dt.files?.length) return true;
  const types = Array.from(dt.types);
  return types.includes('Files') || types.includes('application/x-moz-file');
}

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

export function pathsFromFileList(files: FileList): string[] {
  const paths: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files.item(i);
    if (!file) continue;
    const p = webUtils.getPathForFile(file);
    if (typeof p === 'string' && p.trim()) paths.push(p);
  }
  return paths;
}

export function pathsFromDroppedDataTransfer(dt: DataTransfer): string[] {
  const paths = pathsFromFileList(dt.files);
  if (paths.length) return paths;
  return pathsFromUriList(dt);
}

function emitFileDrop(paths: string[]): void {
  if (!paths.length) return;
  for (const cb of listeners) {
    try {
      cb(paths);
    } catch {
      /* ignore listener errors */
    }
  }
}

function attachFileDropListeners(): void {
  if (attached) return;
  attached = true;

  document.addEventListener(
    'dragover',
    (e) => {
      const dt = e.dataTransfer;
      if (!dt || !isOsFileDrag(dt)) return;
      e.preventDefault();
      dt.dropEffect = 'copy';
    },
    true
  );

  document.addEventListener(
    'drop',
    (e) => {
      const dt = e.dataTransfer;
      if (!dt) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const paths = pathsFromDroppedDataTransfer(dt);
      emitFileDrop(paths);
    },
    true
  );
}

export function registerFileDropListener(cb: FileDropListener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => attachFileDropListeners(), { once: true });
  } else {
    attachFileDropListeners();
  }
}
