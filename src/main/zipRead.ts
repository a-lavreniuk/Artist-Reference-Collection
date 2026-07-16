import { writeFile, open } from 'fs/promises';
import path from 'path';
import { isInsideLibrary } from './media/arcMediaPath';
import { ensureParentDir } from './zipStore';

const EOCD_SIG = 0x06054b50;
const LOCAL_SIG = 0x04034b50;

type ZipEntry = {
  name: string;
  localOffset: number;
  uncompressedSize: number;
  method: number;
};

/** Разобрать имя записи ZIP в путь строго внутри destRoot (защита от Zip Slip). */
export function resolveZipEntryAbs(destRoot: string, entryName: string): string {
  const destResolved = path.resolve(destRoot);
  const normalized = entryName.replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
    throw new Error(`Небезопасный путь в архиве: ${entryName}`);
  }
  const segments = normalized.split('/').filter((s) => s.length > 0);
  if (segments.some((s) => s === '..')) {
    throw new Error(`Небезопасный путь в архиве: ${entryName}`);
  }
  const outAbs = path.resolve(destResolved, ...segments);
  if (!isInsideLibrary(destResolved, outAbs)) {
    throw new Error(`Небезопасный путь в архиве: ${entryName}`);
  }
  return outAbs;
}

/** Распаковать только Store (method 0) ZIP в destRoot. */
export async function extractZipStore(zipAbs: string, destRoot: string): Promise<void> {
  const fh = await open(zipAbs, 'r');
  try {
    const st = await fh.stat();
    const size = st.size;
    const tailSize = Math.min(70_000, size);
    const tail = Buffer.allocUnsafe(tailSize);
    await fh.read(tail, 0, tailSize, size - tailSize);
    let eocdOff = -1;
    for (let i = tail.length - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === EOCD_SIG) {
        eocdOff = size - tailSize + i;
        break;
      }
    }
    if (eocdOff < 0) throw new Error('Некорректный ZIP: не найден EOCD');

    const eocd = Buffer.allocUnsafe(22);
    await fh.read(eocd, 0, 22, eocdOff);
    const cdSize = eocd.readUInt32LE(12);
    const cdOffset = eocd.readUInt32LE(16);
    const cd = Buffer.allocUnsafe(cdSize);
    await fh.read(cd, 0, cdSize, cdOffset);

    const entries: ZipEntry[] = [];
    let p = 0;
    while (p < cdSize) {
      if (cd.readUInt32LE(p) !== 0x02014b50) break;
      const method = cd.readUInt16LE(p + 10);
      const uncomp = cd.readUInt32LE(p + 24);
      const nameLen = cd.readUInt16LE(p + 28);
      const extraLen = cd.readUInt16LE(p + 30);
      const commentLen = cd.readUInt16LE(p + 32);
      const localRel = cd.readUInt32LE(p + 42);
      const nameBuf = cd.subarray(p + 46, p + 46 + nameLen);
      const name = nameBuf.toString('utf8');
      entries.push({
        name,
        localOffset: localRel,
        uncompressedSize: uncomp,
        method
      });
      p += 46 + nameLen + extraLen + commentLen;
    }

    const destResolved = path.resolve(destRoot);
    for (const ent of entries) {
      if (ent.method !== 0) throw new Error(`Неподдерживаемое сжатие в ZIP: ${ent.name}`);
      const lh = Buffer.allocUnsafe(30);
      await fh.read(lh, 0, 30, ent.localOffset);
      if (lh.readUInt32LE(0) !== LOCAL_SIG) throw new Error('Битый локальный заголовок ZIP');
      const fnLen = lh.readUInt16LE(26);
      const exLen = lh.readUInt16LE(28);
      const dataStart = ent.localOffset + 30 + fnLen + exLen;
      const outAbs = resolveZipEntryAbs(destResolved, ent.name);
      await ensureParentDir(outAbs);
      const dataBuf = Buffer.allocUnsafe(ent.uncompressedSize);
      await fh.read(dataBuf, 0, ent.uncompressedSize, dataStart);
      await writeFile(outAbs, dataBuf);
    }
  } finally {
    await fh.close();
  }
}
