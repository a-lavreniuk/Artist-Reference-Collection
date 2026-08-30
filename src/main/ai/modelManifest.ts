import { existsSync } from 'fs';
import { readFile, stat, writeFile } from 'fs/promises';
import path from 'path';

import type { ModelCatalogEntry, ModelRole } from './types';
import { MODEL_ROLES } from './types';
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
  /** Pinned llama.cpp tag for this variant folder (cpu/cuda upgraded independently). */
  release?: string;
};

export type LlamaRuntimeManifest = {
  /** @deprecated Prefer per-entry `cpu.release` / `cuda.release` — shared field lied when only one variant upgraded. */
  release: string;
  cpu?: LlamaRuntimeManifestEntry;
  cuda?: LlamaRuntimeManifestEntry;
};

export type AiModelsManifest = {
  llamaRuntime?: LlamaRuntimeManifest;
} & Partial<Record<ModelRole, TierManifestEntry>> & {
    /** @deprecated migrated to search-clip */
    light?: TierManifestEntry;
    /** @deprecated migrated to caption */
    heavy?: TierManifestEntry;
  };

function manifestPath(userDataPath: string): string {
  return path.join(modelsRootDir(userDataPath), 'ai-models-manifest.json');
}

function migrateLegacyManifestKeys(raw: AiModelsManifest): AiModelsManifest {
  const next: AiModelsManifest = { ...raw };
  if (raw.light && !raw['search-clip']) {
    next['search-clip'] = raw.light;
  }
  if (raw.heavy && !raw.caption) {
    next.caption = raw.heavy;
  }
  // Drop abandoned WD Tagger role if present in older manifests.
  delete (next as Record<string, unknown>).tagger;
  return next;
}

export async function readModelManifest(userDataPath: string): Promise<AiModelsManifest> {
  const filePath = manifestPath(userDataPath);
  if (!existsSync(filePath)) return {};
  try {
    const raw = JSON.parse(await readFile(filePath, 'utf8')) as AiModelsManifest;
    if (!raw || typeof raw !== 'object') return {};
    return migrateLegacyManifestKeys(raw);
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
  role: ModelRole,
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
    const dir = llamaModelsDir(userDataPath);
    for (const file of entry.files ?? []) {
      const filePath = path.join(dir, file.name);
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

  manifest[role] = {
    modelId: entry.id,
    catalogRevision: entry.catalogRevision,
    hfId: entry.hfId,
    hfRevision: hfRevisionUsed,
    installedAt: new Date().toISOString(),
    files
  };

  // Drop legacy keys once role is recorded
  if (role === 'search-clip') delete manifest.light;
  if (role === 'caption') delete manifest.heavy;

  await writeModelManifest(userDataPath, manifest);
}

export async function clearRoleManifest(userDataPath: string, role: ModelRole): Promise<void> {
  const manifest = await readModelManifest(userDataPath);
  delete manifest[role];
  if (role === 'search-clip') delete manifest.light;
  if (role === 'caption') delete manifest.heavy;
  await writeModelManifest(userDataPath, manifest);
}

/** @deprecated use clearRoleManifest */
export async function clearTierManifest(
  userDataPath: string,
  tierOrRole: ModelRole | 'light' | 'heavy'
): Promise<void> {
  const role: ModelRole =
    tierOrRole === 'light' ? 'search-clip' : tierOrRole === 'heavy' ? 'caption' : tierOrRole;
  await clearRoleManifest(userDataPath, role);
}

export function isModelUpdateAvailable(
  _role: ModelRole,
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
  role: ModelRole,
  manifest: AiModelsManifest
): number | undefined {
  return manifest[role]?.catalogRevision;
}

export function listManifestRoles(manifest: AiModelsManifest): ModelRole[] {
  return MODEL_ROLES.filter((role) => Boolean(manifest[role]));
}
