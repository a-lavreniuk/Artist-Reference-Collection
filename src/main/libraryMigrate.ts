import { copyFile, mkdir, readdir, readFile, realpath, stat } from 'fs/promises';
import path from 'path';
import fs from 'fs';
import {
  ensureLibraryFilenamesMigrated,
  HISTORY_FILENAME,
  libraryMetaFileRel,
  METADATA_FILENAME,
  resolveLegacyMetadataAbsPath
} from './libraryFilenames';

async function isDirEmpty(abs: string): Promise<boolean> {
  try {
    const names = await readdir(abs);
    return names.length === 0;
  } catch {
    return false;
  }
}

function pathsEqualNormalized(a: string, b: string): boolean {
  if (a === b) return true;
  if (process.platform === 'win32') {
    return a.replace(/\\/g, '/').toLowerCase() === b.replace(/\\/g, '/').toLowerCase();
  }
  return false;
}

/** Канонический путь для сравнения (symlink → цель). Если пути нет — возвращает resolve. */
async function toCanonicalIfExists(abs: string): Promise<string> {
  const r = path.resolve(abs);
  try {
    return await realpath(r);
  } catch {
    return r;
  }
}

/**
 * true, если `child` совпадает с `parent` или лежит строго внутри `parent`
 * (без ложных срабатываний вида `…\lib` vs `…\lib2` на Windows).
 */
function isSameOrInsideDir(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  if (rel === '' || rel === '.') return true;
  if (path.isAbsolute(rel)) return false;
  const segments = rel.split(path.sep).filter(Boolean);
  return !segments.some((s) => s === '..');
}

async function copyRecursive(srcRoot: string, dstRoot: string, rel = ''): Promise<void> {
  const srcDir = rel ? path.join(srcRoot, rel) : srcRoot;
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const ent of entries) {
    const relNext = rel ? `${rel}/${ent.name}` : ent.name;
    const srcPath = path.join(srcRoot, relNext.split('/').join(path.sep));
    const dstPath = path.join(dstRoot, relNext.split('/').join(path.sep));
    if (ent.isDirectory()) {
      await mkdir(dstPath, { recursive: true });
      await copyRecursive(srcRoot, dstRoot, relNext);
    } else if (ent.isFile()) {
      await mkdir(path.dirname(dstPath), { recursive: true });
      await copyFile(srcPath, dstPath);
    }
  }
}

export type MigrateLibraryResult = { ok: true } | { ok: false; error: string };

export async function migrateLibraryToFolder(oldRoot: string, newRoot: string): Promise<MigrateLibraryResult> {
  const resolvedOld = path.resolve(oldRoot.trim());
  const resolvedNew = path.resolve(newRoot.trim());

  try {
    await stat(resolvedOld);
  } catch {
    return { ok: false, error: 'Текущая папка библиотеки недоступна.' };
  }

  const canonOld = await toCanonicalIfExists(resolvedOld);

  let newExists = false;
  try {
    const st = await stat(resolvedNew);
    newExists = st.isDirectory();
  } catch {
    newExists = false;
  }

  const canonNew = newExists ? await toCanonicalIfExists(resolvedNew) : resolvedNew;

  if (pathsEqualNormalized(canonOld, canonNew)) {
    return { ok: false, error: 'Целевая папка совпадает с текущей библиотекой.' };
  }

  if (isSameOrInsideDir(canonOld, resolvedNew)) {
    return { ok: false, error: 'Нельзя перенести библиотеку внутрь самой себя.' };
  }
  if (isSameOrInsideDir(resolvedNew, canonOld)) {
    return { ok: false, error: 'Нельзя выбрать папку, внутри которой уже лежит текущая библиотека.' };
  }

  if (newExists) {
    const empty = await isDirEmpty(resolvedNew);
    if (!empty) {
      return { ok: false, error: 'Целевая папка должна быть пустой.' };
    }
  } else {
    await mkdir(resolvedNew, { recursive: true });
  }

  try {
    await copyRecursive(canonOld, resolvedNew);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Ошибка копирования файлов'
    };
  }

  return { ok: true };
}

export async function readMetadataFromRoot(root: string): Promise<unknown | null> {
  await ensureLibraryFilenamesMigrated(root);
  const metaAbs = await resolveLegacyMetadataAbsPath(root);
  if (!metaAbs) return null;
  try {
    const raw = await readFile(metaAbs, 'utf8');
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function metadataFilename(): string {
  return libraryMetaFileRel(METADATA_FILENAME);
}

export function historyFilename(): string {
  return libraryMetaFileRel(HISTORY_FILENAME);
}

/** Удалить каталог рекурсивно (без корзины) — только для отката копирования при необходимости. */
export async function rmRf(abs: string): Promise<void> {
  await fs.promises.rm(abs, { recursive: true, force: true });
}
