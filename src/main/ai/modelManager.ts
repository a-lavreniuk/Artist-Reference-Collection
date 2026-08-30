import { existsSync } from 'fs';
import { mkdir, readdir, rm, stat } from 'fs/promises';
import path from 'path';

import type {
  AiModelId,
  ModelCatalogEntry,
  ModelInstallStatus,
  ModelRole,
  SearchModelId
} from './types';
import {
  MODEL_CATALOG,
  MODEL_ROLES,
  SEARCH_ROLE_BY_ID,
  getEntryByModelId,
  getRoleForModelId,
  isSearchModelId
} from './types';
import {
  isModelUpdateAvailable,
  readModelManifest,
  type TierManifestEntry
} from './modelManifest';

export function modelsRootDir(userDataPath: string): string {
  return path.join(userDataPath, 'models');
}

export function transformersCacheDir(userDataPath: string): string {
  return path.join(modelsRootDir(userDataPath), 'transformers');
}

export function llamaModelsDir(userDataPath: string): string {
  return path.join(modelsRootDir(userDataPath), 'llama');
}

/** Leftover WD Tagger folder from abandoned catalog role — remove on startup. */
export function legacyTaggerModelsDir(userDataPath: string): string {
  return path.join(modelsRootDir(userDataPath), 'tagger');
}

export function getModelEntry(role: ModelRole): ModelCatalogEntry {
  return MODEL_CATALOG[role];
}

export function getModelEntryById(modelId: string): ModelCatalogEntry | null {
  return getEntryByModelId(modelId);
}

export function getModelIdForRole(role: ModelRole): AiModelId {
  return MODEL_CATALOG[role].id;
}

/** @deprecated use getModelIdForRole('search-clip') / caption */
export function getModelIdForTier(tier: 'light' | 'heavy'): string {
  return tier === 'heavy' ? MODEL_CATALOG.caption.id : MODEL_CATALOG['search-clip'].id;
}

export function roleForSearchModelId(modelId: SearchModelId): ModelRole {
  return SEARCH_ROLE_BY_ID[modelId];
}

export function transformersModelDir(userDataPath: string, entry: ModelCatalogEntry): string {
  return path.join(transformersCacheDir(userDataPath), ...entry.hfId.split('/'));
}

function catalogFiles(entry: ModelCatalogEntry): Array<{ name: string; role: string; hfId?: string }> {
  if (entry.files?.length) return entry.files;
  const files: Array<{ name: string; role: string }> = [];
  if (entry.ggufFile) files.push({ name: entry.ggufFile, role: 'weights' });
  if (entry.mmprojFile) files.push({ name: entry.mmprojFile, role: 'mmproj' });
  return files;
}

async function dirHasOnnxFiles(dir: string): Promise<boolean> {
  if (!existsSync(dir)) return false;
  try {
    const entries = await readdir(dir, { recursive: true });
    return entries.some((name) => String(name).endsWith('.onnx') || String(name).endsWith('.bin'));
  } catch {
    return false;
  }
}

async function transformersModelInstalled(userDataPath: string, entry: ModelCatalogEntry): Promise<boolean> {
  return dirHasOnnxFiles(transformersModelDir(userDataPath, entry));
}

async function llamaModelInstalled(userDataPath: string, entry: ModelCatalogEntry): Promise<boolean> {
  return catalogFilesInstalled(userDataPath, entry);
}

function catalogFilesDir(userDataPath: string, _entry: ModelCatalogEntry): string {
  return llamaModelsDir(userDataPath);
}

function minBytesForCatalogFile(_role: string): number {
  return 1024 * 1024;
}

export type ModelDiskFileSnapshot = {
  name: string;
  exists: boolean;
  sizeMb: number;
};

export async function snapshotLlamaModelFiles(
  userDataPath: string,
  role: ModelRole
): Promise<{ allPresent: boolean; files: ModelDiskFileSnapshot[] }> {
  const entry = getModelEntry(role);
  const dir = llamaModelsDir(userDataPath);
  const files: ModelDiskFileSnapshot[] = [];
  for (const file of catalogFiles(entry)) {
    const filePath = path.join(dir, file.name);
    const exists = existsSync(filePath);
    let sizeMb = 0;
    if (exists) {
      try {
        sizeMb = Math.round(((await stat(filePath)).size / (1024 * 1024)) * 10) / 10;
      } catch {
        sizeMb = 0;
      }
    }
    files.push({ name: file.name, exists, sizeMb });
  }
  const allPresent = files.length > 0 && files.every((f) => f.exists && f.sizeMb >= 1);
  return { allPresent, files };
}

async function catalogFilesInstalled(userDataPath: string, entry: ModelCatalogEntry): Promise<boolean> {
  const files = catalogFiles(entry);
  if (files.length === 0) return false;
  const dir = catalogFilesDir(userDataPath, entry);
  for (const file of files) {
    const filePath = path.join(dir, file.name);
    if (!existsSync(filePath)) return false;
    try {
      const s = await stat(filePath);
      if (s.size <= minBytesForCatalogFile(file.role)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

/** Файлы модели на диске (без manifest — для проверки сразу после загрузки). */
export async function hasModelArtifactsOnDisk(
  userDataPath: string,
  roleOrId: ModelRole | AiModelId
): Promise<boolean> {
  const role = resolveRole(roleOrId);
  if (!role) return false;
  const entry = getModelEntry(role);
  if (entry.stack === 'transformers') {
    return transformersModelInstalled(userDataPath, entry);
  }
  return catalogFilesInstalled(userDataPath, entry);
}

function resolveRole(roleOrId: ModelRole | AiModelId): ModelRole | null {
  if (MODEL_ROLES.includes(roleOrId as ModelRole)) return roleOrId as ModelRole;
  return getRoleForModelId(roleOrId);
}

/** Установлена только модель, явно помеченная в manifest после действия пользователя в настройках. */
export async function isModelInstalled(
  userDataPath: string,
  roleOrId: ModelRole | AiModelId
): Promise<boolean> {
  const role = resolveRole(roleOrId);
  if (!role) return false;

  const manifest = await readModelManifest(userDataPath);
  if (!manifest[role]) return false;

  const entry = getModelEntry(role);
  if (entry.stack === 'transformers') {
    return transformersModelInstalled(userDataPath, entry);
  }
  return catalogFilesInstalled(userDataPath, entry);
}

export async function isSearchModelInstalled(
  userDataPath: string,
  modelId: SearchModelId
): Promise<boolean> {
  return isModelInstalled(userDataPath, SEARCH_ROLE_BY_ID[modelId]);
}

export async function ensureModelsDirs(userDataPath: string): Promise<void> {
  await mkdir(transformersCacheDir(userDataPath), { recursive: true });
  await mkdir(llamaModelsDir(userDataPath), { recursive: true });
  const leftoverTagger = legacyTaggerModelsDir(userDataPath);
  if (existsSync(leftoverTagger)) {
    await rm(leftoverTagger, { recursive: true, force: true });
  }
}

const FILE_LOCK_CODES = new Set(['EBUSY', 'EPERM', 'EACCES']);

function isFileLockError(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException)?.code;
  return Boolean(code && FILE_LOCK_CODES.has(code));
}

async function rmWithLockRetry(
  target: string,
  options: { recursive?: boolean; force?: boolean },
  attempts = 8
): Promise<void> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      await rm(target, options);
      return;
    } catch (err) {
      lastErr = err;
      if (!isFileLockError(err)) throw err;
      await new Promise((resolve) => setTimeout(resolve, 50 * (i + 1)));
    }
  }
  throw lastErr;
}

export async function deleteInstalledModel(
  userDataPath: string,
  roleOrId: ModelRole | AiModelId
): Promise<void> {
  const role = resolveRole(roleOrId);
  if (!role) return;
  const entry = getModelEntry(role);
  if (entry.stack === 'transformers') {
    await rmWithLockRetry(transformersModelDir(userDataPath, entry), { recursive: true, force: true });
    return;
  }
  const files = catalogFiles(entry);
  for (const file of files) {
    await rmWithLockRetry(path.join(llamaModelsDir(userDataPath), file.name), { force: true });
  }
}

export function resolveModelFilePaths(
  userDataPath: string,
  entry: ModelCatalogEntry
): {
  weightsPath: string | null;
  mmprojPath: string | null;
} {
  const dir = llamaModelsDir(userDataPath);
  const files = catalogFiles(entry);
  let weightsPath: string | null = null;
  let mmprojPath: string | null = null;
  for (const file of files) {
    const p = path.join(dir, file.name);
    if (file.role === 'mmproj') mmprojPath = p;
    else weightsPath = p;
  }
  return { weightsPath, mmprojPath };
}

export async function listModelInstallStatuses(
  userDataPath: string,
  downloadingRole: ModelRole | null,
  downloadPercent: number | null
): Promise<ModelInstallStatus[]> {
  const manifest = await readModelManifest(userDataPath);
  const statuses: ModelInstallStatus[] = [];

  for (const role of MODEL_ROLES) {
    const entry = getModelEntry(role);
    const installed = await isModelInstalled(userDataPath, role);
    const manifestEntry = manifest[role] as TierManifestEntry | undefined;
    statuses.push({
      role,
      modelId: entry.id,
      tier: entry.tier,
      installed,
      downloading: downloadingRole === role,
      progressPercent:
        downloadingRole === role && downloadPercent != null
          ? Math.max(0, Math.min(100, Math.round(downloadPercent)))
          : null,
      updateAvailable: installed ? isModelUpdateAvailable(role, entry, manifestEntry) : false,
      installedCatalogRevision: manifestEntry?.catalogRevision,
      catalogRevision: entry.catalogRevision
    });
  }
  return statuses;
}

export async function hasAnyInstalledModel(userDataPath: string): Promise<boolean> {
  for (const role of MODEL_ROLES) {
    if (await isModelInstalled(userDataPath, role)) return true;
  }
  return false;
}

export async function hasAnyInstalledSearchModel(userDataPath: string): Promise<boolean> {
  for (const id of Object.keys(SEARCH_ROLE_BY_ID) as SearchModelId[]) {
    if (await isSearchModelInstalled(userDataPath, id)) return true;
  }
  return false;
}

export function sanitizeSearchModelId(raw: unknown, fallback: SearchModelId = 'clip-vit-base-patch32'): SearchModelId {
  if (isSearchModelId(raw)) return raw;
  return fallback;
}

export function sanitizeModelRole(raw: unknown): ModelRole | null {
  if (typeof raw === 'string' && MODEL_ROLES.includes(raw as ModelRole)) return raw as ModelRole;
  if (raw === 'light') return 'search-clip';
  if (raw === 'medium') return 'search-embed-2b';
  if (raw === 'heavy') return 'caption';
  if (isSearchModelId(raw)) return SEARCH_ROLE_BY_ID[raw];
  if (raw === 'joycaption-beta-one') return 'caption';
  return null;
}
