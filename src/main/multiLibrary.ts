import fs from 'fs';
import { mkdir, readdir, rename, rm, stat } from 'fs/promises';
import path from 'path';
import { LIBRARY_CONTAINER_FOLDER_NAME, isLibraryContainerFolderName } from './libraryContainer';
import { validateLibraryName } from './libraryNameValidation';
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

async function scanContainerLibraries(parentPath: string): Promise<LibraryRegistryEntry[]> {
  const parent = path.resolve(parentPath);
  let names: string[] = [];
  try {
    names = await readdir(parent);
  } catch {
    return [];
  }
  const out: LibraryRegistryEntry[] = [];
  for (const name of names) {
    const child = path.join(parent, name);
    try {
      const st = await stat(child);
      if (!st.isDirectory()) continue;
    } catch {
      continue;
    }
    if (!(await isValidArcLibraryFolder(child))) continue;
    out.push(newLibraryEntry(name, child));
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export function listLibrariesFromConfig(): LibraryListItem[] {
  const cfg = readLibraryRootConfigSync();
  const libs = cfg.libraries ?? [];
  const active = getActiveLibraryEntry(cfg);
  return [...libs]
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    .map((l) => ({ ...l, active: active?.id === l.id }));
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
    return { ok: false, error: 'Библиотека с таким именем уже есть', fieldError: true };
  }
  await ensureDir(libPath);

  const entry = newLibraryEntry(validated.name, libPath);
  const existing = cfg.libraries ?? [];
  const nextLibs = [...existing, entry];
  await replaceLibraryRootConfig(
    buildConfigWithActive(parentPath, nextLibs, entry.id, {
      lastKnownCardCount: 0,
      snapshotAt: new Date().toISOString(),
      pendingWrapMigrationPath: undefined
    })
  );
  invalidateLibraryRootCache();
  void applyLibraryFolderIcon(parentPath);
  return { ok: true, library: entry };
}

export async function switchActiveLibrary(
  libraryId: string
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const cfg = readLibraryRootConfigSync();
  const libs = cfg.libraries ?? [];
  const target = libs.find((l) => l.id === libraryId);
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

/** Open container or a child library inside container. */
export async function openLibraryOrContainer(pickedAbs: string): Promise<OpenLibraryResult> {
  const resolved = path.resolve(pickedAbs);
  if (!(await pathExists(resolved))) {
    return { ok: false, error: 'Папка не найдена' };
  }

  if (looksLikeContainerPath(resolved)) {
    const libs = await scanContainerLibraries(resolved);
    if (libs.length === 0) {
      return { ok: false, error: 'В «Библиотека ARC» нет библиотек' };
    }
    const active = libs[0]!; // already sorted А→Я
    await replaceLibraryRootConfig(
      buildConfigWithActive(resolved, libs, active.id, {
        lastKnownCardCount: 0,
        snapshotAt: new Date().toISOString(),
        pendingWrapMigrationPath: undefined
      })
    );
    invalidateLibraryRootCache();
    void applyLibraryFolderIcon(resolved);
    return { ok: true, path: active.path };
  }

  const parent = path.dirname(resolved);
  if (!looksLikeContainerPath(parent)) {
    return { ok: false, error: 'Библиотека должна находиться внутри папки «Библиотека ARC»' };
  }
  if (!(await isValidArcLibraryFolder(resolved))) {
    return { ok: false, error: 'Выбранная папка не является библиотекой ARC' };
  }

  const libs = await scanContainerLibraries(parent);
  let active = libs.find((l) => path.resolve(l.path) === resolved);
  if (!active) {
    active = newLibraryEntry(path.basename(resolved), resolved);
    libs.push(active);
  }
  await replaceLibraryRootConfig(
    buildConfigWithActive(parent, libs, active.id, {
      lastKnownCardCount: 0,
      snapshotAt: new Date().toISOString(),
      pendingWrapMigrationPath: undefined
    })
  );
  invalidateLibraryRootCache();
  void applyLibraryFolderIcon(parent);
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
  await rename(current.path, dest);
  const updated: LibraryRegistryEntry = { ...current, name: validated.name, path: dest };
  libs[idx] = updated;
  const activeId = cfg.activeLibraryId === libraryId ? libraryId : (cfg.activeLibraryId ?? libraryId);
  await replaceLibraryRootConfig(
    buildConfigWithActive(cfg.parentPath, libs, activeId, {
      lastKnownCardCount: cfg.lastKnownCardCount,
      snapshotAt: cfg.snapshotAt
    })
  );
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

  if (mode === 'disk') {
    try {
      await rm(removing.path, { recursive: true, force: true });
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Не удалось удалить папку' };
    }
  }

  const nextActive = wasActive ? neighbor : getActiveLibraryEntry({ ...cfg, libraries: libs });
  if (!nextActive) {
    return { ok: false, error: 'Не осталось библиотек' };
  }

  await replaceLibraryRootConfig(
    buildConfigWithActive(cfg.parentPath, libs, nextActive.id, {
      lastKnownCardCount: cfg.lastKnownCardCount,
      snapshotAt: cfg.snapshotAt
    })
  );
  invalidateLibraryRootCache();
  return { ok: true, switchedToId: wasActive ? nextActive.id : null };
}

export async function migrateParentContainer(
  destParentDir: string
): Promise<{ ok: true; parentPath: string } | { ok: false; error: string }> {
  const cfg = readLibraryRootConfigSync();
  if (!cfg.parentPath || !(cfg.libraries?.length)) {
    return { ok: false, error: 'Контейнер не настроен' };
  }
  const src = path.resolve(cfg.parentPath);
  const destContainer = path.join(path.resolve(destParentDir), LIBRARY_CONTAINER_FOLDER_NAME);
  if (path.resolve(destContainer) === src) {
    return { ok: true, parentPath: src };
  }
  if (await pathExists(destContainer)) {
    const entries = await readdir(destContainer);
    if (entries.length > 0) {
      return { ok: false, error: 'В выбранном месте уже есть «Библиотека ARC»' };
    }
  }
  await ensureDir(path.dirname(destContainer));
  await rename(src, destContainer);

  const libs = (cfg.libraries ?? []).map((l) => ({
    ...l,
    path: path.join(destContainer, l.name)
  }));
  const active = getActiveLibraryEntry({ ...cfg, libraries: libs, parentPath: destContainer });
  if (!active) return { ok: false, error: 'Нет активной библиотеки' };

  await replaceLibraryRootConfig(
    buildConfigWithActive(destContainer, libs, active.id, {
      lastKnownCardCount: cfg.lastKnownCardCount,
      snapshotAt: cfg.snapshotAt
    })
  );
  invalidateLibraryRootCache();
  void applyLibraryFolderIcon(destContainer);
  return { ok: true, parentPath: destContainer };
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
