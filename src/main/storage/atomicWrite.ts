import crypto from 'crypto';
import { mkdir, rename, unlink, writeFile } from 'fs/promises';
import path from 'path';

/** Атомарная запись JSON; уникальный tmp-файл на каждый вызов (без гонок при параллельных IPC). */
export async function atomicWriteJsonFile(dest: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await rename(tmp, dest);
  } catch (err) {
    try {
      await unlink(tmp);
    } catch {
      /* ignore */
    }
    throw err;
  }
}
