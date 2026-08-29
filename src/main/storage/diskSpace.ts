import { statfs } from 'fs/promises';

/** Remaining free bytes on the volume that contains `dirAbs`. Null if unknown. */
export async function volumeFreeBytes(dirAbs: string): Promise<number | null> {
  try {
    const info = await statfs(dirAbs);
    const avail = Number(info.bavail);
    const size = Number(info.bsize);
    if (!Number.isFinite(avail) || !Number.isFinite(size) || avail < 0 || size <= 0) return null;
    return avail * size;
  } catch {
    return null;
  }
}

export async function assertEnoughDiskSpace(dirAbs: string, neededBytes: number): Promise<void> {
  if (neededBytes <= 0) return;
  const free = await volumeFreeBytes(dirAbs);
  if (free == null) return;
  const reserve = 64 * 1024 * 1024;
  if (free < neededBytes + reserve) {
    const needMb = Math.ceil(neededBytes / (1024 * 1024));
    const freeMb = Math.floor(free / (1024 * 1024));
    throw new Error(`Недостаточно места на диске (нужно ~${needMb} МБ, свободно ${freeMb} МБ)`);
  }
}
