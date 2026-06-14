import { existsSync } from 'fs';
import { readFile, stat, writeFile } from 'fs/promises';
import path from 'path';

import type { ModelCatalogEntry, ModelTier } from './types';
import { MODEL_CATALOG } from './types';
import { llamaModelsDir, modelsRootDir, transformersCacheDir } from './modelManager';

export type ManifestFileEntry = {
  name: string;
  role: 'weights' | 'mmproj';
  bytes: number;
  sha256?: string;
};

export type TierManifestEntry = {
  modelId: string;
  catalogRevision: number;
  hfId: string;
  hfRevision?: string;
  installedAt: string;
  files: ManifestFileEntry[];
};

export type LlamaRuntimeManifestEntry = {
  installedAt: string;
  bytes: number;
};

export type LlamaRuntimeManifest = {
  release: string;
  cpu?: LlamaRuntimeManifestEntry;
  cuda?: LlamaRuntimeManifestEntry;
};

export type AiModelsManifest = {
  llamaRuntime?: LlamaRuntimeManifest;
} & Partial<Record<ModelTier, TierManifestEntry>>;

function manifestPath(userDataPath: string): string {
  return path.join(modelsRootDir(userDataPath), 'ai-models-manifest.json');
}

export async function readModelManifest(userDataPath: string): Promise<AiModelsManifest> {
  const filePath = manifestPath(userDataPath);
  if (!existsSync(filePath)) return {};
  try {
    const raw = JSON.parse(await readFile(filePath, 'utf8')) as AiModelsManifest;
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

export async function writeModelManifest(userDataPath: string, manifest: AiModelsManifest): Promise<void> {
  const filePath = manifestPath(userDataPath);
  await writeFile(filePath, JSON.stringify(manifest, null, 2), 'utf8');
}

export async function recordInstalledModel(
  userDataPath: string,
  tier: ModelTier,
  entry: ModelCatalogEntry,
  hfRevisionUsed: string
): Promise<void> {
  const manifest = await readModelManifest(userDataPath);
  const files: ManifestFileEntry[] = [];

  if (entry.stack === 'transformers') {
    const dir = path.join(transformersCacheDir(userDataPath), ...entry.hfId.split('/'));
    if (existsSync(dir)) {
      const s = await stat(dir);
      files.push({ name: entry.hfId, role: 'weights', bytes: s.size });
    }
  } else {
    const llamaDir = llamaModelsDir(userDataPath);
    for (const file of entry.files ?? []) {
      const filePath = path.join(llamaDir, file.name);
      if (!existsSync(filePath)) continue;
      const s = await stat(filePath);
      files.push({
        name: file.name,
        role: file.role,
        bytes: s.size,
        sha256: undefined
      });
    }
  }

  manifest[tier] = {
    modelId: entry.id,
    catalogRevision: entry.catalogRevision,
    hfId: entry.hfId,
    hfRevision: hfRevisionUsed,
    installedAt: new Date().toISOString(),
    files
  };

  await writeModelManifest(userDataPath, manifest);
}

export async function clearTierManifest(userDataPath: string, tier: ModelTier): Promise<void> {
  const manifest = await readModelManifest(userDataPath);
  delete manifest[tier];
  await writeModelManifest(userDataPath, manifest);
}

export function isModelUpdateAvailable(
  tier: ModelTier,
  entry: ModelCatalogEntry,
  manifestEntry: TierManifestEntry | undefined
): boolean {
  if (!manifestEntry) return false;
  if (manifestEntry.modelId !== entry.id) return true;
  if (manifestEntry.catalogRevision < entry.catalogRevision) return true;
  if (entry.hfRevision && manifestEntry.hfRevision !== entry.hfRevision) return true;
  return false;
}

export function getInstalledCatalogRevision(
  tier: ModelTier,
  manifest: AiModelsManifest
): number | undefined {
  return manifest[tier]?.catalogRevision;
}
