import { createHash } from 'crypto';
import { open, mkdir } from 'fs/promises';
import type { FileHandle } from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';

/** ZIP, метод Store (без сжатия). CRC и размеры дописываются после потока данных. */

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;

function crc32(buf: Buffer, prev = 0): number {
  let c = ~prev >>> 0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
  }
  return ~c >>> 0;
}

type EntryMeta = {
  name: string;
  crc: number;
  size: number;
  localHeaderOffset: number;
};

function dosTimeDate(d: Date): { time: number; date: number } {
  const year = Math.max(1980, d.getFullYear());
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const seconds = Math.floor(d.getSeconds() / 2);
  const date = ((year - 1980) << 9) | (month << 5) | day;
  const time = (hours << 11) | (minutes << 5) | seconds;
  return { time, date };
}

function buildLocalHeader(name: string, crc: number, size: number): Buffer {
  const nameBuf = Buffer.from(name, 'utf8');
  const { time, date } = dosTimeDate(new Date());
  const local = Buffer.allocUnsafe(30 + nameBuf.length);
  let p = 0;
  local.writeUInt32LE(LOCAL_SIG, p);
  p += 4;
  local.writeUInt16LE(20, p);
  p += 2;
  local.writeUInt16LE(0, p);
  p += 2;
  local.writeUInt16LE(0, p);
  p += 2;
  local.writeUInt16LE(time, p);
  p += 2;
  local.writeUInt16LE(date, p);
  p += 2;
  local.writeUInt32LE(crc >>> 0, p);
  p += 4;
  local.writeUInt32LE(size >>> 0, p);
  p += 4;
  local.writeUInt32LE(size >>> 0, p);
  p += 4;
  local.writeUInt16LE(nameBuf.length, p);
  p += 2;
  local.writeUInt16LE(0, p);
  p += 2;
  nameBuf.copy(local, p);
  return local;
}

/** Корень диска/ФС (`D:\`, `/`) — mkdir на него на Windows даёт EPERM. */
export function isFilesystemRoot(absDir: string, pathApi: typeof path = path): boolean {
  const resolved = pathApi.resolve(absDir);
  return resolved === pathApi.parse(resolved).root;
}

/** Создаёт родительскую папку файла; пропускает корень диска. */
export async function ensureParentDir(filePath: string): Promise<void> {
  const dir = path.dirname(path.resolve(filePath));
  if (isFilesystemRoot(dir)) return;
  await mkdir(dir, { recursive: true });
}

export class ZipStoreWriter {
  private fh: FileHandle | null = null;
  private pos = 0;
  private readonly entries: EntryMeta[] = [];

  static async create(absOutPath: string): Promise<ZipStoreWriter> {
    await ensureParentDir(absOutPath);
    const w = new ZipStoreWriter();
    w.fh = await open(absOutPath, 'w');
    return w;
  }

  private async write(buf: Buffer): Promise<void> {
    if (!this.fh) throw new Error('ZIP closed');
    const { bytesWritten } = await this.fh.write(buf, 0, buf.length, this.pos);
    this.pos += bytesWritten;
  }

  async addBuffer(relPath: string, data: Buffer): Promise<{ sha256: string }> {
    const name = relPath.replace(/\\/g, '/');
    const sha256 = createHash('sha256').update(data).digest('hex');
    const crc = crc32(data);
    const localHeaderOffset = this.pos;
    const header = buildLocalHeader(name, crc, data.length);
    await this.write(header);
    await this.write(data);
    this.entries.push({ name, crc, size: data.length, localHeaderOffset });
    return { sha256 };
  }

  async addFile(relPath: string, absPath: string): Promise<{ sha256: string; size: number }> {
    const name = relPath.replace(/\\/g, '/');
    const localHeaderOffset = this.pos;
    const placeholder = buildLocalHeader(name, 0, 0);
    await this.write(placeholder);

    const hash = createHash('sha256');
    let crc = 0;
    let size = 0;

    const stream = createReadStream(absPath, { highWaterMark: 1024 * 1024 });
    for await (const chunk of stream) {
      const buf = chunk as Buffer;
      hash.update(buf);
      crc = crc32(buf, crc);
      size += buf.length;
      await this.write(buf);
    }

    const crcFinal = crc >>> 0;
    const patch = Buffer.allocUnsafe(12);
    patch.writeUInt32LE(crcFinal, 0);
    patch.writeUInt32LE(size >>> 0, 4);
    patch.writeUInt32LE(size >>> 0, 8);
    if (!this.fh) throw new Error('ZIP closed');
    await this.fh.write(patch, 0, 12, localHeaderOffset + 14);

    this.entries.push({ name, crc: crcFinal, size, localHeaderOffset });
    return { sha256: hash.digest('hex'), size };
  }

  async finalize(): Promise<void> {
    if (!this.fh) return;
    const centralStart = this.pos;
    for (const e of this.entries) {
      const nameBuf = Buffer.from(e.name, 'utf8');
      const central = Buffer.allocUnsafe(46 + nameBuf.length);
      let p = 0;
      central.writeUInt32LE(CENTRAL_SIG, p);
      p += 4;
      central.writeUInt16LE(0x0314, p);
      p += 2;
      central.writeUInt16LE(20, p);
      p += 2;
      central.writeUInt16LE(0, p);
      p += 2;
      central.writeUInt16LE(0, p);
      p += 2;
      const { time, date } = dosTimeDate(new Date());
      central.writeUInt16LE(time, p);
      p += 2;
      central.writeUInt16LE(date, p);
      p += 2;
      central.writeUInt32LE(e.crc >>> 0, p);
      p += 4;
      central.writeUInt32LE(e.size >>> 0, p);
      p += 4;
      central.writeUInt32LE(e.size >>> 0, p);
      p += 4;
      central.writeUInt16LE(nameBuf.length, p);
      p += 2;
      central.writeUInt16LE(0, p);
      p += 2;
      central.writeUInt16LE(0, p);
      p += 2;
      central.writeUInt16LE(0, p);
      p += 2;
      central.writeUInt16LE(0, p);
      p += 2;
      central.writeUInt32LE(0, p);
      p += 4;
      central.writeUInt32LE(e.localHeaderOffset >>> 0, p);
      p += 4;
      nameBuf.copy(central, p);
      await this.write(central);
    }

    const centralSize = this.pos - centralStart;
    const eocd = Buffer.allocUnsafe(22);
    let p = 0;
    eocd.writeUInt32LE(EOCD_SIG, p);
    p += 4;
    eocd.writeUInt16LE(0, p);
    p += 2;
    eocd.writeUInt16LE(0, p);
    p += 2;
    eocd.writeUInt16LE(this.entries.length, p);
    p += 2;
    eocd.writeUInt16LE(this.entries.length, p);
    p += 2;
    eocd.writeUInt32LE(centralSize >>> 0, p);
    p += 4;
    eocd.writeUInt32LE(centralStart >>> 0, p);
    p += 4;
    eocd.writeUInt16LE(0, p);
    p += 2;
    await this.write(eocd);

    await this.fh.close();
    this.fh = null;
  }
}

