import fs from 'fs';
import { mkdir, readdir, rename, rm, stat } from 'fs/promises';
import path from 'path';
import { LIBRARY_CONTAINER_FOLDER_NAME, isLibraryContainerFolderName } from './libraryContainer';
import { LIBRARY_FOLDER_EXISTS_ERROR, validateLibraryName } from './libraryNameValidation';
import { isValidArcLibraryFolder } from './libraryValidate';
import {
  buildConfigWithActive,
  getActiveLibraryEntry,
  isMultiLibraryConfig,
  looksLikeContainerPath,
  newLibraryEntry,
  readLibraryRootConfigSync,
  replaceLibraryRootConfig,
  type LibraryRegistryEntry,
  type LibraryRootConfig
} from './librarySessionSnapshot';
import { invalidateLibraryRootCache } from './libraryRootConfig';
import { applyLibraryFolderIcon } from './libraryFolderIcon';

export type LibraryListItem = LibraryRegistryEntry & {
  active: boolean;
  cardCount?: number;
  sizeBytes?: number;
};

export type MigrationStatus =
  | { status: 'ok' }
  | { status: 'needs_wrap_name'; legacyPath: string }
  | { status: 'migrating' };

async function ensureDir(abs: string): Promise<void> {
  await mkdir(abs, { recursive: true });
}

async function pathExists(abs: string): Promise<boolean> {
  try {
    await stat(abs);
    return true;
  } catch {
    return false;
  }
}

const FLATTEN_TEMP_SUFFIX = '.__arc_flatten__';

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Windows часто держит lock на каталоге сразу после close SQLite / rename родителя.
 * Повторяем EPERM/EBUSY/EACCES, остальное — сразу наружу.
 */
async function renameDirWithRetry(from: string, to: string, attempts = 8): Promise<void> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      await rename(from, to);
      return;
    } catch (err) {
      lastErr = err;
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES') throw err;
      await sleepMs(30 * (i + 1));
    }
  }
  throw lastErr;
}

/** Ближайший предок с именем «Библиотека ARC», либо null. */
export function findLibraryContainerAncestor(abs: string): string | null {
  let cur = path.resolve(abs);
  for (let i = 0; i < 10; i++) {
    if (looksLikeContainerPath(cur)) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return null;
}

async function listImmediateValidLibraryDirs(
  dir: string
): Promise<Array<{ name: string; path: string }>> {
  const root = path.resolve(dir);
  let names: string[] = [];
  try {
    names = await readdir(root);
  } catch {
    return [];
  }
  const out: Array<{ name: string; path: string }> = [];
  for (const name of names) {
    if (name.endsWith(FLATTEN_TEMP_SUFFIX) || name === 'meta' || name === 'cards') continue;
    const child = path.join(root, name);
    try {
      const st = await stat(child);
      if (!st.isDirectory()) continue;
    } catch {
      continue;
    }
    if (!(await isValidArcLibraryFolder(child))) continue;
    out.push({ name, path: child });
  }
  return out;
}

async function libraryCardCountSafe(libraryRoot: string): Promise<number> {
  try {
    const { countCardsReadonly } = await import('./storage/libraryStorage');
    return countCardsReadonly(libraryRoot, 'all', 'all');
  } catch {
    return 0;
  }
}

async function libraryHasCardFiles(libraryRoot: string): Promise<boolean> {
  const cardsDir = path.join(path.resolve(libraryRoot), 'cards');
  try {
    const names = await readdir(cardsDir);
    return names.length > 0;
  } catch {
    return false;
  }
}

async function isEmptyLibraryShell(libraryRoot: string): Promise<boolean> {
  const cards = await libraryCardCountSafe(libraryRoot);
  if (cards > 0) return false;
  if (await libraryHasCardFiles(libraryRoot)) return false;
  return true;
}

async function resolveUnusedFolderName(parentDir: string, baseName: string): Promise<string> {
  const parent = path.resolve(parentDir);
  if (!(await pathExists(path.join(parent, baseName)))) return baseName;
  let n = 2;
  for (;;) {
    const candidate = `${baseName} (${n})`;
    if (!(await pathExists(path.join(parent, candidate)))) return candidate;
    n += 1;
    if (n > 999) return `${baseName} (${Date.now()})`;
  }
}

/**
 * В контейнере должны лежать только дочерние библиотеки (плоско).
 * Если внутри «библиотеки» оказались ещё библиотеки — поднимаем их на уровень контейнера.
 * Пустую оболочку без карточек удаляем после переноса.
 */
export async function flattenNestedLibrariesInContainer(containerPath: string): Promise<{
  changed: boolean;
  pathMap: Map<string, string>;
}> {
  const container = path.resolve(containerPath);
  const pathMap = new Map<string, string>();
  let names: string[] = [];
  try {
    names = await readdir(container);
  } catch {
    return { changed: false, pathMap };
  }

  type ShellJob = {
    name: string;
    shellPath: string;
    nested: Array<{ name: string; path: string }>;
    emptyShell: boolean;
  };
  const jobs: ShellJob[] = [];
  for (const name of names) {
    if (name.endsWith(FLATTEN_TEMP_SUFFIX)) continue;
    const shellPath = path.join(container, name);
    try {
      const st = await stat(shellPath);
      if (!st.isDirectory()) continue;
    } catch {
      continue;
    }
    const nested = await listImmediateValidLibraryDirs(shellPath);
    if (nested.length === 0) continue;
    jobs.push({
      name,
      shellPath,
      nested,
      emptyShell: await isEmptyLibraryShell(shellPath)
    });
  }

  if (jobs.length === 0) return { changed: false, pathMap };

  const { resetLibraryStorageCache } = await import('./storage/libraryStorage');
  resetLibraryStorageCache();

  let changed = false;
  for (const job of jobs) {
    if (job.emptyShell) {
      const tempName = `${job.name}${FLATTEN_TEMP_SUFFIX}`;
      let tempShell = path.join(container, tempName);
      if (await pathExists(tempShell)) {
        tempShell = path.join(container, `${job.name}${FLATTEN_TEMP_SUFFIX}_${Date.now()}`);
      }
      try {
        await renameDirWithRetry(job.shellPath, tempShell);
      } catch (err) {
        console.error('[ARC] flatten: rename shell failed', job.shellPath, err);
        continue;
      }
      changed = true;

      for (const nested of job.nested) {
        const from = path.join(tempShell, nested.name);
        if (!(await pathExists(from))) continue;
        const destName = await resolveUnusedFolderName(container, nested.name);
        const dest = path.join(container, destName);
        try {
          await renameDirWithRetry(from, dest);
          pathMap.set(path.resolve(nested.path), dest);
          pathMap.set(path.resolve(job.shellPath, nested.name), dest);
        } catch (err) {
          console.error('[ARC] flatten: move nested failed', from, err);
        }
      }

      try {
        await rm(tempShell, { recursive: true, force: true });
      } catch (err) {
        console.error('[ARC] flatten: remove empty shell failed', tempShell, err);
      }
      continue;
    }

    // Оболочка сама с карточками — оставляем её, вложенные поднимаем рядом.
    for (const nested of job.nested) {
      if (!(await pathExists(nested.path))) continue;
      const destName = await resolveUnusedFolderName(container, nested.name);
      const dest = path.join(container, destName);
      try {
        await renameDirWithRetry(nested.path, dest);
        pathMap.set(path.resolve(nested.path), dest);
        changed = true;
      } catch (err) {
        console.error('[ARC] flatten: lift nested failed', nested.path, err);
      }
    }
  }

  return { changed, pathMap };
}

async function scanContainerLibraries(parentPath: string): Promise<LibraryRegistryEntry[]> {
  const parent = path.resolve(parentPath);
  // Сначала выровнять ошибочную вложенность (библиотека внутри библиотеки).
  await flattenNestedLibrariesInContainer(parent);

  let names: string[] = [];
  try {
    names = await readdir(parent);
  } catch {
    return [];
  }
  const out: LibraryRegistryEntry[] = [];
  for (const name of names) {
    if (name.endsWith(FLATTEN_TEMP_SUFFIX)) continue;
    const child = path.join(parent, name);
    try {
      const st = await stat(child);
      if (!st.isDirectory()) continue;
    } catch {
      continue;
    }
    // Не считать «библиотекой» папку, внутри которой ещё лежат библиотеки
    // (на случай если flatten не смог перенести из‑за блокировки файлов).
    const nested = await listImmediateValidLibraryDirs(child);
    if (nested.length > 0) continue;
    if (!(await isValidArcLibraryFolder(child))) continue;
    out.push(newLibraryEntry(name, child));
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

async function pickPreferredLibraryId(
  libs: LibraryRegistryEntry[],
  opts?: { preferredPath?: string | null; previousId?: string | null }
): Promise<string> {
  if (libs.length === 0) throw new Error('No libraries');
  const preferredPath = opts?.preferredPath ? path.resolve(opts.preferredPath) : null;
  if (preferredPath) {
    const hit = libs.find((l) => path.resolve(l.path) === preferredPath);
    if (hit) return hit.id;
  }
  const previousId = opts?.previousId ?? null;
  if (previousId && libs.some((l) => l.id === previousId)) return previousId;

  let best = libs[0]!;
  let bestCount = -1;
  for (const lib of libs) {
    const n = await libraryCardCountSafe(lib.path);
    if (n > bestCount) {
      bestCount = n;
      best = lib;
    }
  }
  return best.id;
}

export function listLibrariesFromConfig(): LibraryListItem[] {
  const cfg = readLibraryRootConfigSync();
  const libs = cfg.libraries ?? [];
  const active = getActiveLibraryEntry(cfg);
  return libs.map((l) => ({ ...l, active: active?.id === l.id }));
}

export async function getMigrationStatus(): Promise<MigrationStatus> {
  const cfg = readLibraryRootConfigSync();
  if (cfg.pendingWrapMigrationPath) {
    return { status: 'needs_wrap_name', legacyPath: cfg.pendingWrapMigrationPath };
  }
  if (isMultiLibraryConfig(cfg)) return { status: 'ok' };
  if (!cfg.path?.trim()) return { status: 'ok' };

  const legacyPath = path.resolve(cfg.path.trim());
  if (!(await pathExists(legacyPath))) return { status: 'ok' };

  const base = path.basename(legacyPath);
  const parentDir = path.dirname(legacyPath);

  // Already inside container
  if (isLibraryContainerFolderName(path.basename(parentDir)) && (await isValidArcLibraryFolder(legacyPath))) {
    await adoptExistingContainer(parentDir, legacyPath);
    return { status: 'ok' };
  }

  // Self-named container that is actually a library → need wrap name
  if (isLibraryContainerFolderName(base) && (await isValidArcLibraryFolder(legacyPath))) {
    await replaceLibraryRootConfig({
      ...cfg,
      pendingWrapMigrationPath: legacyPath
    });
    invalidateLibraryRootCache();
    return { status: 'needs_wrap_name', legacyPath };
  }

  // Move-aside into new container with same folder name
  await migrateMoveAside(legacyPath);
  return { status: 'ok' };
}

async function adoptExistingContainer(parentPath: string, preferredActivePath: string): Promise<void> {
  const libs = await scanContainerLibraries(parentPath);
  if (libs.length === 0) return;
  const preferred = libs.find((l) => path.resolve(l.path) === path.resolve(preferredActivePath));
  const active = preferred ?? libs[0]!;
  const cfg = readLibraryRootConfigSync();
  await replaceLibraryRootConfig(
    buildConfigWithActive(parentPath, libs, active.id, {
      lastKnownCardCount: cfg.lastKnownCardCount,
      snapshotAt: cfg.snapshotAt,
      pendingWrapMigrationPath: undefined
    })
  );
  invalidateLibraryRootCache();
  void applyLibraryFolderIcon(parentPath);
}

async function migrateMoveAside(legacyPath: string): Promise<void> {
  const resolved = path.resolve(legacyPath);
  const parentDir = path.dirname(resolved);
  const libName = path.basename(resolved);
  const containerPath = path.join(parentDir, LIBRARY_CONTAINER_FOLDER_NAME);

  await ensureDir(containerPath);
  const dest = path.join(containerPath, libName);
  if (path.resolve(dest) !== resolved) {
    if (await pathExists(dest)) {
      throw new Error(`Папка уже существует: ${dest}`);
    }
    await rename(resolved, dest);
  }

  const entry = newLibraryEntry(libName, dest);
  const cfg = readLibraryRootConfigSync();
  await replaceLibraryRootConfig(
    buildConfigWithActive(containerPath, [entry], entry.id, {
      lastKnownCardCount: cfg.lastKnownCardCount,
      snapshotAt: cfg.snapshotAt,
      pendingWrapMigrationPath: undefined
    })
  );
  invalidateLibraryRootCache();
  void applyLibraryFolderIcon(containerPath);
}

/** Wrap self-named «Библиотека ARC» library into container / {childName}. */
export async function completeWrapMigration(childNameRaw: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const validated = validateLibraryName(childNameRaw);
  if (!validated.ok) {
    return { ok: false, error: 'Некорректное имя библиотеки' };
  }
  const cfg = readLibraryRootConfigSync();
  const legacyPath = cfg.pendingWrapMigrationPath
    ? path.resolve(cfg.pendingWrapMigrationPath)
    : cfg.path
      ? path.resolve(cfg.path)
      : null;
  if (!legacyPath || !(await pathExists(legacyPath))) {
    return { ok: false, error: 'Исходная библиотека не найдена' };
  }

  // Release SQLite / catalog handles before renaming the folder (Windows EBUSY otherwise).
  const { resetLibraryStorageCache } = await import('./storage/libraryStorage');
  resetLibraryStorageCache();
  try {
    const { syncArcMediaServerLibraryRoot } = await import('./media/mediaServerHost');
    syncArcMediaServerLibraryRoot(null);
  } catch {
    /* optional at early startup */
  }

  const parentDir = path.dirname(legacyPath);
  const tempName = `${LIBRARY_CONTAINER_FOLDER_NAME}__migrating_${Date.now()}`;
  const tempPath = path.join(parentDir, tempName);
  try {
    await rename(legacyPath, tempPath);
    const containerPath = path.join(parentDir, LIBRARY_CONTAINER_FOLDER_NAME);
    await ensureDir(containerPath);
    const dest = path.join(containerPath, validated.name);
    if (await pathExists(dest)) {
      await rename(tempPath, legacyPath);
      return { ok: false, error: 'Библиотека с таким именем уже есть' };
    }
    await rename(tempPath, dest);
    const entry = newLibraryEntry(validated.name, dest);
    await replaceLibraryRootConfig(
      buildConfigWithActive(containerPath, [entry], entry.id, {
        lastKnownCardCount: cfg.lastKnownCardCount,
        snapshotAt: cfg.snapshotAt,
        pendingWrapMigrationPath: undefined
      })
    );
    invalidateLibraryRootCache();
    void applyLibraryFolderIcon(containerPath);
    return { ok: true };
  } catch (err) {
    try {
      if (await pathExists(tempPath) && !(await pathExists(legacyPath))) {
        await rename(tempPath, legacyPath);
      }
    } catch {
      /* best-effort rollback */
    }
    return { ok: false, error: err instanceof Error ? err.message : 'Не удалось выполнить миграцию' };
  }
}

export async function createLibraryInContainer(
  nameRaw: string,
  parentHint?: string | null
): Promise<{ ok: true; library: LibraryRegistryEntry } | { ok: false; error: string; fieldError?: boolean }> {
  const validated = validateLibraryName(nameRaw);
  if (!validated.ok) {
    return { ok: false, error: 'Некорректное имя библиотеки', fieldError: true };
  }

  const cfg = readLibraryRootConfigSync();
  let parentPath = cfg.parentPath ? path.resolve(cfg.parentPath) : null;

  if (!parentPath) {
    const hint = parentHint?.trim() ? path.resolve(parentHint.trim()) : null;
    if (!hint) {
      return { ok: false, error: 'Сначала выберите папку для «Библиотека ARC»' };
    }
    parentPath = isLibraryContainerFolderName(path.basename(hint))
      ? hint
      : path.join(hint, LIBRARY_CONTAINER_FOLDER_NAME);
  }

  await ensureDir(parentPath);
  const libPath = path.join(parentPath, validated.name);
  if (await pathExists(libPath)) {
    return { ok: false, error: LIBRARY_FOLDER_EXISTS_ERROR, fieldError: true };
  }

  // Подтянуть с диска уже существующие библиотеки, если реестр пуст или устарел.
  const existing = await mergeRegistryWithDisk(parentPath, cfg);
  if (existing.some((l) => l.name.toLowerCase() === validated.name.toLowerCase())) {
    return { ok: false, error: LIBRARY_FOLDER_EXISTS_ERROR, fieldError: true };
  }
  await ensureDir(libPath);

  const entry = newLibraryEntry(validated.name, libPath);
  const nextLibs = [...existing, entry];
  const previousActiveId = getActiveLibraryEntry(cfg)?.id ?? existing[0]?.id ?? entry.id;

  await replaceLibraryRootConfig(
    buildConfigWithActive(parentPath, nextLibs, previousActiveId, {
      lastKnownCardCount: cfg.lastKnownCardCount,
      snapshotAt: cfg.snapshotAt ?? new Date().toISOString(),
      pendingWrapMigrationPath: undefined
    })
  );
  invalidateLibraryRootCache();

  try {
    const { ensureLibraryReady } = await import('./storage/libraryStorage');
    await ensureLibraryReady(libPath);
  } catch (err) {
    console.error('[ARC] ensureLibraryReady for new library:', err);
  }

  void applyLibraryFolderIcon(parentPath);
  return { ok: true, library: entry };
}

/**
 * Сверить libraries с диском.
 * По умолчанию реестр в конфиге авторитетен (отвязанные папки не возвращаются).
 * `discoverUnregistered: true` — подхватить все папки на диске (открытие контейнера / пустой реестр).
 */
async function mergeRegistryWithDisk(
  parentPath: string,
  cfg: LibraryRootConfig,
  opts?: { discoverUnregistered?: boolean }
): Promise<LibraryRegistryEntry[]> {
  const scanned = await scanContainerLibraries(parentPath);
  const cfgLibs = cfg.libraries ?? [];
  const discover = opts?.discoverUnregistered === true || cfgLibs.length === 0;
  const byResolved = new Map<string, LibraryRegistryEntry>();
  const parentResolved = path.resolve(parentPath);

  if (discover) {
    for (const lib of scanned) {
      byResolved.set(path.resolve(lib.path), lib);
    }
  }

  for (const lib of cfgLibs) {
    const resolved = path.resolve(lib.path);
    if (!(await pathExists(resolved))) continue;
    if (path.dirname(resolved) !== parentResolved) continue;
    const disk = byResolved.get(resolved);
    if (disk) {
      byResolved.set(resolved, { ...disk, id: lib.id, name: lib.name || disk.name });
    } else {
      // Папка есть, но scan не признал «валидной» — всё равно держим в реестре.
      byResolved.set(resolved, { ...lib, path: resolved, name: lib.name || path.basename(resolved) });
    }
  }

  // path активной библиотеки может ещё не попасть в scan (пустая только что созданная).
  if (cfg.path?.trim()) {
    const resolved = path.resolve(cfg.path.trim());
    if (path.dirname(resolved) === parentResolved && (await pathExists(resolved)) && !byResolved.has(resolved)) {
      const fromCfg = cfgLibs.find((l) => path.resolve(l.path) === resolved);
      // Не возвращаем «активный» path, если его уже нет в реестре и discover выключен
      // (иначе отвязка откатывается). При пустом реестре / discover — можно.
      if (fromCfg || discover) {
        byResolved.set(resolved, fromCfg ?? newLibraryEntry(path.basename(resolved), resolved));
      }
    }
  }

  // Порядок: сначала как в конфиге, затем новые с диска (между собой по имени).
  const ordered: LibraryRegistryEntry[] = [];
  const seen = new Set<string>();
  for (const lib of cfgLibs) {
    const resolved = path.resolve(lib.path);
    const entry = byResolved.get(resolved);
    if (!entry || seen.has(resolved)) continue;
    ordered.push(entry);
    seen.add(resolved);
  }
  const extras = [...byResolved.entries()]
    .filter(([resolved]) => !seen.has(resolved))
    .map(([, entry]) => entry)
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  for (const entry of extras) {
    ordered.push(entry);
  }
  return ordered;
}

function registryPathsEqual(a: LibraryRegistryEntry[], b: LibraryRegistryEntry[]): boolean {
  if (a.length !== b.length) return false;
  const aPaths = new Set(a.map((l) => path.resolve(l.path)));
  const bPaths = new Set(b.map((l) => path.resolve(l.path)));
  if (aPaths.size !== bPaths.size) return false;
  for (const p of aPaths) {
    if (!bPaths.has(p)) return false;
  }
  return true;
}

function registryIdsMatchByPath(cfgLibs: LibraryRegistryEntry[], merged: LibraryRegistryEntry[]): boolean {
  const byPath = new Map(cfgLibs.map((l) => [path.resolve(l.path), l.id]));
  for (const lib of merged) {
    const prev = byPath.get(path.resolve(lib.path));
    if (prev && prev !== lib.id) return false;
  }
  return true;
}

/**
 * Если реестр пуст/неполный, а контейнер на диске есть — дописать папки.
 * Не переписывает конфиг, если набор путей и id уже совпадает (без лишней смены id).
 */
export async function repairLibraryRegistryIfNeeded(): Promise<boolean> {
  const cfg = readLibraryRootConfigSync();
  if (!cfg.parentPath?.trim() || !(await pathExists(cfg.parentPath))) return false;

  const parentPath = path.resolve(cfg.parentPath);
  const merged = await mergeRegistryWithDisk(parentPath, cfg);
  if (merged.length === 0) return false;

  const cfgLibs = cfg.libraries ?? [];
  if (
    cfgLibs.length > 0 &&
    registryPathsEqual(cfgLibs, merged) &&
    registryIdsMatchByPath(cfgLibs, merged) &&
    Boolean(cfg.activeLibraryId && merged.some((l) => l.id === cfg.activeLibraryId))
  ) {
    return false;
  }

  const preferredId =
    (cfg.activeLibraryId && merged.some((l) => l.id === cfg.activeLibraryId) && cfg.activeLibraryId) ||
    (cfg.path && merged.find((l) => path.resolve(l.path) === path.resolve(cfg.path!))?.id) ||
    merged[0]!.id;

  await replaceLibraryRootConfig(
    buildConfigWithActive(parentPath, merged, preferredId, {
      lastKnownCardCount: cfg.lastKnownCardCount,
      snapshotAt: cfg.snapshotAt,
      pendingWrapMigrationPath: undefined
    })
  );
  invalidateLibraryRootCache();
  return true;
}

export async function switchActiveLibrary(
  libraryId: string
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  let cfg = readLibraryRootConfigSync();
  let libs = cfg.libraries ?? [];
  let target = libs.find((l) => l.id === libraryId);
  if (!target) {
    try {
      await repairLibraryRegistryIfNeeded();
    } catch {
      /* ignore */
    }
    cfg = readLibraryRootConfigSync();
    libs = cfg.libraries ?? [];
    target = libs.find((l) => l.id === libraryId);
  }
  if (!target) return { ok: false, error: 'Библиотека не найдена' };
  if (!(await pathExists(target.path))) {
    return { ok: false, error: 'Папка библиотеки не найдена' };
  }
  if (!cfg.parentPath) return { ok: false, error: 'Контейнер библиотек не настроен' };

  await replaceLibraryRootConfig(
    buildConfigWithActive(cfg.parentPath, libs, target.id, {
      lastKnownCardCount: cfg.lastKnownCardCount,
      snapshotAt: cfg.snapshotAt,
      pendingWrapMigrationPath: undefined
    })
  );
  invalidateLibraryRootCache();
  return { ok: true, path: target.path };
}

export type OpenLibraryResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

/** Open container, a child library, or a folder that contains «Библиотека ARC». */
export async function openLibraryOrContainer(pickedAbs: string): Promise<OpenLibraryResult> {
  const resolved = path.resolve(pickedAbs);
  if (!(await pathExists(resolved))) {
    return { ok: false, error: 'Папка не найдена' };
  }

  // Parent of container: Documents/… → Documents/Библиотека ARC
  if (!looksLikeContainerPath(resolved)) {
    const nestedContainer = path.join(resolved, LIBRARY_CONTAINER_FOLDER_NAME);
    if ((await pathExists(nestedContainer)) && looksLikeContainerPath(nestedContainer)) {
      return openLibraryOrContainer(nestedContainer);
    }
  }

  const containerAncestor = findLibraryContainerAncestor(resolved);
  const isContainer = looksLikeContainerPath(resolved);

  if (isContainer) {
    const { pathMap } = await flattenNestedLibrariesInContainer(resolved);
    const prev = readLibraryRootConfigSync();
    const libs = await mergeRegistryWithDisk(
      resolved,
      {
        ...prev,
        parentPath: resolved,
        libraries: prev.parentPath && path.resolve(prev.parentPath) === resolved ? prev.libraries : []
      },
      { discoverUnregistered: true }
    );
    if (libs.length === 0) {
      return { ok: false, error: 'В «Библиотека ARC» нет библиотек' };
    }
    const mappedPrev =
      prev.path && pathMap.has(path.resolve(prev.path))
        ? pathMap.get(path.resolve(prev.path))!
        : prev.path;
    const preferredId = await pickPreferredLibraryId(libs, {
      preferredPath: mappedPrev,
      previousId: prev.activeLibraryId
    });
    await replaceLibraryRootConfig(
      buildConfigWithActive(resolved, libs, preferredId, {
        lastKnownCardCount: prev.lastKnownCardCount ?? 0,
        snapshotAt: new Date().toISOString(),
        pendingWrapMigrationPath: undefined
      })
    );
    invalidateLibraryRootCache();
    void applyLibraryFolderIcon(resolved);
    const active = libs.find((l) => l.id === preferredId) ?? libs[0]!;
    return { ok: true, path: active.path };
  }

  // Выбрана дочерняя (или ошибочно вложенная) библиотека — нужен контейнер-предок.
  const parent = path.dirname(resolved);
  const container = looksLikeContainerPath(parent)
    ? parent
    : containerAncestor && path.resolve(containerAncestor) !== resolved
      ? containerAncestor
      : null;

  if (!container) {
    return { ok: false, error: 'Укажите папку «Библиотека ARC» или одну из библиотек внутри неё' };
  }

  const { pathMap } = await flattenNestedLibrariesInContainer(container);
  let targetPath = pathMap.get(resolved) ?? resolved;

  // Выбрали пустую оболочку, которую flatten удалил — активируем библиотеку с данными.
  if (!(await pathExists(targetPath)) || !(await isValidArcLibraryFolder(targetPath))) {
    targetPath = '';
  }

  const prev = readLibraryRootConfigSync();
  const libs = await mergeRegistryWithDisk(
    container,
    {
      ...prev,
      parentPath: container,
      libraries: prev.parentPath && path.resolve(prev.parentPath) === path.resolve(container) ? prev.libraries : []
    },
    { discoverUnregistered: true }
  );

  if (targetPath && (await isValidArcLibraryFolder(targetPath))) {
    let active = libs.find((l) => path.resolve(l.path) === path.resolve(targetPath));
    if (!active) {
      active = newLibraryEntry(path.basename(targetPath), targetPath);
      libs.push(active);
    }
    await replaceLibraryRootConfig(
      buildConfigWithActive(container, libs, active.id, {
        lastKnownCardCount: prev.lastKnownCardCount ?? 0,
        snapshotAt: new Date().toISOString(),
        pendingWrapMigrationPath: undefined
      })
    );
    invalidateLibraryRootCache();
    void applyLibraryFolderIcon(container);
    return { ok: true, path: active.path };
  }

  if (libs.length === 0) {
    return { ok: false, error: 'Выбранная папка не является библиотекой ARC' };
  }

  const preferredId = await pickPreferredLibraryId(libs, {
    previousId: prev.activeLibraryId
  });
  await replaceLibraryRootConfig(
    buildConfigWithActive(container, libs, preferredId, {
      lastKnownCardCount: prev.lastKnownCardCount ?? 0,
      snapshotAt: new Date().toISOString(),
      pendingWrapMigrationPath: undefined
    })
  );
  invalidateLibraryRootCache();
  void applyLibraryFolderIcon(container);
  const active = libs.find((l) => l.id === preferredId) ?? libs[0]!;
  return { ok: true, path: active.path };
}

export async function renameLibrary(
  libraryId: string,
  newNameRaw: string
): Promise<{ ok: true; library: LibraryRegistryEntry } | { ok: false; error: string; fieldError?: boolean }> {
  const validated = validateLibraryName(newNameRaw);
  if (!validated.ok) {
    return { ok: false, error: 'Некорректное имя библиотеки', fieldError: true };
  }
  const cfg = readLibraryRootConfigSync();
  if (!cfg.parentPath) return { ok: false, error: 'Контейнер не настроен' };
  const libs = [...(cfg.libraries ?? [])];
  const idx = libs.findIndex((l) => l.id === libraryId);
  if (idx < 0) return { ok: false, error: 'Библиотека не найдена' };
  const current = libs[idx]!;
  if (current.name === validated.name) {
    return { ok: true, library: current };
  }
  if (libs.some((l) => l.id !== libraryId && l.name.toLowerCase() === validated.name.toLowerCase())) {
    return { ok: false, error: 'Библиотека с таким именем уже есть', fieldError: true };
  }
  const dest = path.join(cfg.parentPath, validated.name);
  if (await pathExists(dest)) {
    return { ok: false, error: 'Библиотека с таким именем уже есть', fieldError: true };
  }
  try {
    await rename(current.path, dest);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Не удалось переименовать папку'
    };
  }
  const updated: LibraryRegistryEntry = { ...current, name: validated.name, path: dest };
  libs[idx] = updated;
  const activeId = cfg.activeLibraryId === libraryId ? libraryId : (cfg.activeLibraryId ?? libraryId);
  try {
    await replaceLibraryRootConfig(
      buildConfigWithActive(cfg.parentPath, libs, activeId, {
        lastKnownCardCount: cfg.lastKnownCardCount,
        snapshotAt: cfg.snapshotAt
      })
    );
  } catch (err) {
    try {
      await rename(dest, current.path);
    } catch {
      /* best-effort rollback */
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Не удалось сохранить конфиг'
    };
  }
  invalidateLibraryRootCache();
  return { ok: true, library: updated };
}

export async function deleteLibrary(
  libraryId: string,
  mode: 'disk' | 'unlink'
): Promise<{ ok: true; switchedToId: string | null } | { ok: false; error: string }> {
  const cfg = readLibraryRootConfigSync();
  if (!cfg.parentPath) return { ok: false, error: 'Контейнер не настроен' };
  const libs = [...(cfg.libraries ?? [])];
  if (libs.length <= 1) {
    return { ok: false, error: 'Нельзя удалить единственную библиотеку' };
  }
  const idx = libs.findIndex((l) => l.id === libraryId);
  if (idx < 0) return { ok: false, error: 'Библиотека не найдена' };
  const removing = libs[idx]!;
  const wasActive = (cfg.activeLibraryId ?? getActiveLibraryEntry(cfg)?.id) === libraryId;

  // Neighbor preference: previous, else next
  const neighbor = libs[idx - 1] ?? libs[idx + 1] ?? null;
  libs.splice(idx, 1);

  const nextActive = wasActive ? neighbor : getActiveLibraryEntry({ ...cfg, libraries: libs });
  if (!nextActive) {
    return { ok: false, error: 'Не осталось библиотек' };
  }

  // Сначала конфиг, потом диск — чтобы не потерять файлы при сбое записи JSON
  await replaceLibraryRootConfig(
    buildConfigWithActive(cfg.parentPath, libs, nextActive.id, {
      lastKnownCardCount: cfg.lastKnownCardCount,
      snapshotAt: cfg.snapshotAt
    })
  );
  invalidateLibraryRootCache();

  if (mode === 'disk') {
    try {
      await rm(removing.path, { recursive: true, force: true });
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? `Библиотека отвязана, но папку не удалось удалить: ${err.message}`
            : 'Библиотека отвязана, но папку не удалось удалить'
      };
    }
  }

  const { removeAutoImportForLibraryId } = await import('./appPreferences');
  await removeAutoImportForLibraryId(libraryId);

  try {
    const { pruneLibraryFromCategoryVisibility } = await import('./storage/tagCatalog');
    pruneLibraryFromCategoryVisibility(libraryId);
  } catch {
    /* catalog optional */
  }

  return { ok: true, switchedToId: wasActive ? nextActive.id : null };
}

/**
 * Переставить библиотеки в порядке `orderedIds` (тот же набор id).
 * Порядок массива в конфиге = порядок во всех списках UI.
 */
export async function reorderLibraries(
  orderedIds: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return { ok: false, error: 'Некорректный порядок' };
  }
  const cfg = readLibraryRootConfigSync();
  if (!cfg.parentPath) return { ok: false, error: 'Контейнер не настроен' };
  const libs = cfg.libraries ?? [];
  if (libs.length === 0) return { ok: false, error: 'Нет библиотек' };
  if (orderedIds.length !== libs.length) {
    return { ok: false, error: 'Несовпадение списка библиотек' };
  }
  const byId = new Map(libs.map((l) => [l.id, l]));
  if (new Set(orderedIds).size !== orderedIds.length) {
    return { ok: false, error: 'Дубликаты в порядке' };
  }
  const next: LibraryRegistryEntry[] = [];
  for (const id of orderedIds) {
    const entry = byId.get(id);
    if (!entry) return { ok: false, error: 'Неизвестный id библиотеки' };
    next.push(entry);
  }
  const activeId = getActiveLibraryEntry(cfg)?.id ?? next[0]!.id;
  await replaceLibraryRootConfig(
    buildConfigWithActive(cfg.parentPath, next, activeId, {
      lastKnownCardCount: cfg.lastKnownCardCount,
      snapshotAt: cfg.snapshotAt
    })
  );
  invalidateLibraryRootCache();
  return { ok: true };
}

export function getLibraryConfigSnapshot(): LibraryRootConfig {
  return readLibraryRootConfigSync();
}

/** Ensure fs exists — used by tests / diagnostics. */
export function containerFolderName(): string {
  return LIBRARY_CONTAINER_FOLDER_NAME;
}

export async function libraryFolderExists(abs: string): Promise<boolean> {
  return pathExists(abs);
}
