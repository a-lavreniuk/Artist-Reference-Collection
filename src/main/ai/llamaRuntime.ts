import { createWriteStream, existsSync } from 'fs';
import { cp, mkdir, readdir, rm, stat } from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

import {
  githubReleaseAssetUrl,
  LLAMA_CPP_RELEASE,
  LLAMA_RUNTIME_CATALOG,
  resolvePlatformAssetKey,
  serverBinaryName,
  type LlamaRuntimeVariant
} from './llamaRuntimeCatalog';
import { modelsRootDir } from './modelManager';
import { readModelManifest, writeModelManifest, type LlamaRuntimeManifestEntry } from './modelManifest';

const execFileAsync = promisify(execFile);

export function llamaRuntimeRootDir(userDataPath: string): string {
  return path.join(modelsRootDir(userDataPath), 'llama-runtime');
}

export function llamaRuntimeVariantDir(userDataPath: string, variant: LlamaRuntimeVariant): string {
  return path.join(llamaRuntimeRootDir(userDataPath), variant);
}

export function llamaServerBinaryPath(userDataPath: string, variant: LlamaRuntimeVariant): string {
  return path.join(llamaRuntimeVariantDir(userDataPath, variant), serverBinaryName());
}

export async function isLlamaRuntimeInstalled(
  userDataPath: string,
  variant: LlamaRuntimeVariant
): Promise<boolean> {
  const binPath = llamaServerBinaryPath(userDataPath, variant);
  if (!existsSync(binPath)) return false;
  try {
    const s = await stat(binPath);
    return s.size > 1024;
  } catch {
    return false;
  }
}

export function resolveLlamaServerBinaryFromUserData(
  userDataPath: string,
  preferCuda: boolean
): string | null {
  if (preferCuda) {
    const cudaPath = llamaServerBinaryPath(userDataPath, 'cuda');
    if (existsSync(cudaPath)) return cudaPath;
  }
  const cpuPath = llamaServerBinaryPath(userDataPath, 'cpu');
  if (existsSync(cpuPath)) return cpuPath;
  return null;
}

async function downloadToFile(url: string, destPath: string, onProgress?: (percent: number) => void): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Не удалось скачать среду vision (${res.status})`);
  }

  const total = Number(res.headers.get('content-length') || 0);
  let received = 0;
  const reader = res.body.getReader();
  const fileStream = createWriteStream(destPath);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      fileStream.write(Buffer.from(value));
      if (total > 0 && onProgress) {
        onProgress(Math.max(0, Math.min(100, Math.round((received / total) * 100))));
      }
    }
  } finally {
    fileStream.end();
  }

  await new Promise<void>((resolve, reject) => {
    fileStream.on('finish', () => resolve());
    fileStream.on('error', reject);
  });
}

async function extractArchive(archivePath: string, destDir: string, format: 'zip' | 'tar.gz'): Promise<void> {
  await mkdir(destDir, { recursive: true });
  if (format === 'zip') {
    if (process.platform === 'win32') {
      await execFileAsync(
        'powershell',
        [
          '-NoProfile',
          '-Command',
          `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`
        ],
        { windowsHide: true }
      );
      return;
    }
    await execFileAsync('unzip', ['-o', archivePath, '-d', destDir]);
    return;
  }

  await execFileAsync('tar', ['-xzf', archivePath, '-C', destDir]);
}

async function findServerBinary(extractedRoot: string): Promise<string | null> {
  const target = serverBinaryName();
  const stack = [extractedRoot];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === target.toLowerCase()) {
        return full;
      }
      if (entry.isDirectory()) stack.push(full);
    }
  }
  return null;
}

async function copyRuntimePayload(sourceDir: string, targetDir: string): Promise<void> {
  await mkdir(targetDir, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const lower = entry.name.toLowerCase();
    const isServer = lower === serverBinaryName().toLowerCase();
    const isNativeLib =
      lower.endsWith('.dll') || lower.endsWith('.so') || lower.endsWith('.dylib') || lower.endsWith('.metal');
    if (!isServer && !isNativeLib) continue;
    await cp(path.join(sourceDir, entry.name), path.join(targetDir, entry.name), { force: true });
  }
}

async function recordRuntimeInstall(userDataPath: string, variant: LlamaRuntimeVariant): Promise<void> {
  const manifest = await readModelManifest(userDataPath);
  const binPath = llamaServerBinaryPath(userDataPath, variant);
  const bytes = (await stat(binPath)).size;
  const entry: LlamaRuntimeManifestEntry = {
    installedAt: new Date().toISOString(),
    bytes
  };
  manifest.llamaRuntime = {
    release: LLAMA_CPP_RELEASE,
    cpu: variant === 'cpu' ? entry : manifest.llamaRuntime?.cpu,
    cuda: variant === 'cuda' ? entry : manifest.llamaRuntime?.cuda
  };
  await writeModelManifest(userDataPath, manifest);
}

export async function ensureLlamaRuntime(
  userDataPath: string,
  variant: LlamaRuntimeVariant,
  onProgress?: (percent: number) => void
): Promise<void> {
  if (variant === 'cuda' && process.platform !== 'win32') {
    throw new Error('CUDA-среда vision доступна только на Windows.');
  }

  if (await isLlamaRuntimeInstalled(userDataPath, variant)) {
    const manifest = await readModelManifest(userDataPath);
    if (manifest.llamaRuntime?.release === LLAMA_CPP_RELEASE) {
      onProgress?.(100);
      return;
    }
    await rm(llamaRuntimeVariantDir(userDataPath, variant), { recursive: true, force: true });
  }

  const platformKey = resolvePlatformAssetKey();
  if (!platformKey) {
    throw new Error('Среда vision не поддерживается на этой платформе.');
  }

  const assets = LLAMA_RUNTIME_CATALOG[platformKey];
  const asset = variant === 'cuda' ? assets.cuda : assets.cpu;
  if (!asset) {
    throw new Error('Среда vision недоступна для этой платформы.');
  }

  const root = llamaRuntimeRootDir(userDataPath);
  const tempDir = path.join(root, '.tmp-extract');
  const archivePath = path.join(tempDir, asset.archive);
  const extractDir = path.join(tempDir, 'extract');
  const targetDir = llamaRuntimeVariantDir(userDataPath, variant);

  await rm(tempDir, { recursive: true, force: true });
  await mkdir(tempDir, { recursive: true });

  try {
    await downloadToFile(githubReleaseAssetUrl(asset.archive), archivePath, onProgress);
    onProgress?.(90);
    await extractArchive(archivePath, extractDir, asset.format);
    onProgress?.(95);

    const serverPath = await findServerBinary(extractDir);
    if (!serverPath) {
      throw new Error('llama-server не найден в архиве.');
    }

    await rm(targetDir, { recursive: true, force: true });
    await mkdir(targetDir, { recursive: true });
    await copyRuntimePayload(path.dirname(serverPath), targetDir);

    if (!(await isLlamaRuntimeInstalled(userDataPath, variant))) {
      throw new Error('Не удалось установить llama-server.');
    }

    await recordRuntimeInstall(userDataPath, variant);
    onProgress?.(100);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function deleteLlamaRuntimeIfUnused(userDataPath: string): Promise<void> {
  const { isModelInstalled } = await import('./modelManager');
  const heavy = await isModelInstalled(userDataPath, 'heavy');
  if (heavy) return;

  await rm(llamaRuntimeRootDir(userDataPath), { recursive: true, force: true });
  const manifest = await readModelManifest(userDataPath);
  delete manifest.llamaRuntime;
  await writeModelManifest(userDataPath, manifest);
}

export async function getLlamaRuntimeStatus(userDataPath: string): Promise<{
  cpuInstalled: boolean;
  cudaInstalled: boolean;
  release: string;
}> {
  return {
    cpuInstalled: await isLlamaRuntimeInstalled(userDataPath, 'cpu'),
    cudaInstalled: await isLlamaRuntimeInstalled(userDataPath, 'cuda'),
    release: LLAMA_CPP_RELEASE
  };
}

export async function needsLlamaRuntimeReleaseUpdate(userDataPath: string): Promise<boolean> {
  const manifest = await readModelManifest(userDataPath);
  if (!manifest.llamaRuntime) return false;
  return manifest.llamaRuntime.release !== LLAMA_CPP_RELEASE;
}
