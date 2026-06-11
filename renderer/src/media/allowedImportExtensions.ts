/**
 * Whitelist расширений при добавлении в очередь (синхронизирован с main: IMAGE_EXT + VIDEO_EXT).
 * Точка с опусканием: `src/main/ffmpeg.ts` и `src/main/ipc.ts`.
 */
const IMAGE = new Set(['jpg', 'jpeg', 'png', 'webp', 'bmp']);
const VIDEO = new Set([
  'gif',
  'mp4',
  'webm',
  'mov',
  'avi',
  'mkv',
  'flv',
  'wmv',
  'mpeg',
  'mpg',
  'm2v',
  '3gp',
  'ts',
  'mts',
  'm4v',
  'ogv',
  'vob',
  'rmvb',
  'swf'
]);

const ALL = new Set([...IMAGE, ...VIDEO]);

export function extractExtLower(pathLike: string): string | null {
  const i = pathLike.lastIndexOf('.');
  if (i < 0 || i === pathLike.length - 1) return null;
  return pathLike.slice(i + 1).trim().toLowerCase() || null;
}

export function isImportableMediaPath(pathLike: string): boolean {
  const ext = extractExtLower(pathLike);
  if (!ext) return false;
  return ALL.has(ext);
}

export function isVideoPath(pathLike: string): boolean {
  const ext = extractExtLower(pathLike);
  if (!ext) return false;
  return VIDEO.has(ext);
}
