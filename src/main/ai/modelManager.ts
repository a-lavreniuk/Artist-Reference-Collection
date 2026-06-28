import { existsSync } from 'fs';
import { mkdir, readdir, rm, stat } from 'fs/promises';
import path from 'path';

import type { ModelCatalogEntry, ModelInstallStatus, ModelTier } from './types';
import { MODEL_CATALOG } from './types';
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

export function getModelEntry(tier: ModelTier): ModelCatalogEntry {
  return MODEL_CATALOG[tier];
}

export function getModelIdForTier(tier: ModelTier): string {
  return MODEL_CATALOG[tier].id;
}

export function transformersModelDir(userDataPath: string, entry: ModelCatalogEntry): string {
  return path.join(transformersCacheDir(userDataPath), ...entry.hfId.split('/'));
}

function catalogFiles(entry: ModelCatalogEntry): Array<{ name: string; role: string }> {
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
  const files = catalogFiles(entry);
  if (files.length === 0) return false;
  const dir = llamaModelsDir(userDataPath);
  for (const file of files) {
    const filePath = path.join(dir, file.name);
    if (!existsSync(filePath)) return false;
    try {
      const s = await stat(filePath);
      if (s.size <= 1024 * 1024) return false;
    } catch {
      return false;
    }
  }
  return true;
}

/** Установлена только модель, явно помеченная в manifest после действия пользователя в настройках. */
export async function isModelInstalled(userDataPath: string, tier: ModelTier): Promise<boolean> {
  const manifest = await readModelManifest(userDataPath);
  if (!manifest[tier]) return false;

  const entry = getModelEntry(tier);
  if (entry.stack === 'transformers') {
    return transformersModelInstalled(userDataPath, entry);
  }
  return llamaModelInstalled(userDataPath, entry);
}

export async function ensureModelsDirs(userDataPath: string): Promise<void> {
  await mkdir(transformersCacheDir(userDataPath), { recursive: true });
  await mkdir(llamaModelsDir(userDataPath), { recursive: true });
}

export async function deleteInstalledModel(userDataPath: string, tier: ModelTier): Promise<void> {
  const entry = getModelEntry(tier);
  if (entry.stack === 'transformers') {
    await rm(transformersModelDir(userDataPath, entry), { recursive: true, force: true });
    return;
  }
  const files = catalogFiles(entry);
  for (const file of files) {
    await rm(path.join(llamaModelsDir(userDataPath), file.name), { force: true });
  }
}

export function resolveModelFilePaths(userDataPath: string, entry: ModelCatalogEntry): {
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
  downloadingTier: ModelTier | null,
  downloadPercent: number | null
): Promise<ModelInstallStatus[]> {
  const manifest = await readModelManifest(userDataPath);
  const tiers: ModelTier[] = ['light', 'heavy'];
  const statuses: ModelInstallStatus[] = [];

  for (const tier of tiers) {
    const entry = getModelEntry(tier);
    const installed = await isModelInstalled(userDataPath, tier);
    const manifestEntry = manifest[tier] as TierManifestEntry | undefined;
    statuses.push({
      tier,
      installed,
      downloading: downloadingTier === tier,
      progressPercent:
        downloadingTier === tier && downloadPercent != null
          ? Math.max(0, Math.min(100, Math.round(downloadPercent)))
          : null,
      updateAvailable: installed ? isModelUpdateAvailable(tier, entry, manifestEntry) : false,
      installedCatalogRevision: manifestEntry?.catalogRevision,
      catalogRevision: entry.catalogRevision
    });
  }
  return statuses;
}

export async function hasAnyInstalledModel(userDataPath: string): Promise<boolean> {
  for (const tier of ['light', 'heavy'] as ModelTier[]) {
    if (await isModelInstalled(userDataPath, tier)) return true;
  }
  return false;
}
