import { readdir, stat, statfs } from 'fs/promises';
import path from 'path';

export type LibraryDiskStats = {
  driveLabel: string;
  diskTotalBytes: number;
  diskFreeBytes: number;
  libraryFolderBytes: number;
};

async function sumDirectoryBytes(absDir: string): Promise<number> {
  let total = 0;
  let entries: string[];
  try {
    entries = await readdir(absDir);
  } catch {
    return 0;
  }
  for (const name of entries) {
    const abs = path.join(absDir, name);
    let st;
    try {
      st = await stat(abs);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      total += await sumDirectoryBytes(abs);
    } else if (st.isFile()) {
      total += st.size;
    }
  }
  return total;
}

function formatDriveLabel(libraryRoot: string): string {
  const parsed = path.parse(libraryRoot);
  if (process.platform === 'win32') {
    const root = parsed.root || `${parsed.dir.slice(0, 3)}`;
    return root.replace(/\\$/, '\\');
  }
  return parsed.root || libraryRoot;
}

export async function readLibraryDiskStats(libraryRoot: string): Promise<LibraryDiskStats> {
  const resolved = path.resolve(libraryRoot);
  const driveLabel = formatDriveLabel(resolved);
  const statTarget = process.platform === 'win32' ? driveLabel : resolved;

  const [fsStats, libraryFolderBytes] = await Promise.all([
    statfs(statTarget),
    sumDirectoryBytes(resolved)
  ]);

  const diskTotalBytes = Number(fsStats.bsize) * Number(fsStats.blocks);
  const diskFreeBytes = Number(fsStats.bsize) * Number(fsStats.bavail);

  return {
    driveLabel,
    diskTotalBytes,
    diskFreeBytes,
    libraryFolderBytes
  };
}
