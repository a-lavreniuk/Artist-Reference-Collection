/** Pinned llama.cpp release for vision runtime (llama-server).
 * b8466+ required for Qwen3-VL-Embedding (n_embd_out pooling fix, #20840).
 */
export const LLAMA_CPP_RELEASE = 'b8466';

export type LlamaRuntimeVariant = 'cpu' | 'cuda';

export type PlatformAssetKey = 'win32-x64' | 'darwin-arm64' | 'darwin-x64';

type PlatformAssets = {
  cpu: { archive: string; format: 'zip' | 'tar.gz' };
  cuda?: { archive: string; format: 'zip' };
  /** Redistributable CUDA libs required by ggml-cuda.dll (Windows). */
  cudart?: { archive: string; format: 'zip' };
};

export const LLAMA_RUNTIME_CATALOG: Record<PlatformAssetKey, PlatformAssets> = {
  'win32-x64': {
    cpu: { archive: 'llama-b8466-bin-win-cpu-x64.zip', format: 'zip' },
    cuda: { archive: 'llama-b8466-bin-win-cuda-12.4-x64.zip', format: 'zip' },
    cudart: { archive: 'cudart-llama-bin-win-cuda-12.4-x64.zip', format: 'zip' }
  },
  'darwin-arm64': {
    cpu: { archive: 'llama-b8466-bin-macos-arm64.tar.gz', format: 'tar.gz' }
  },
  'darwin-x64': {
    cpu: { archive: 'llama-b8466-bin-macos-x64.tar.gz', format: 'tar.gz' }
  }
};

/** Marker DLL from cudart zip — without it ggml-cuda.dll fails to load. */
export const CUDA_CUDART_MARKER_DLL = 'cudart64_12.dll';

/** Approximate download size hints for UI (MB). CUDA includes cudart redistributable. */
export const LLAMA_RUNTIME_SIZE_HINT_MB: Record<LlamaRuntimeVariant, number> = {
  cpu: 80,
  cuda: 820
};

export function resolvePlatformAssetKey(): PlatformAssetKey | null {
  if (process.platform === 'win32') {
    return process.arch === 'arm64' ? null : 'win32-x64';
  }
  if (process.platform === 'darwin') {
    return process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  }
  return null;
}

export function githubReleaseAssetUrl(archiveName: string): string {
  return `https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_CPP_RELEASE}/${archiveName}`;
}

export function serverBinaryName(): string {
  return process.platform === 'win32' ? 'llama-server.exe' : 'llama-server';
}
