import { describe, expect, it } from 'vitest';

import { sanitizeModelRole } from '../ai/modelManager';
import { getSupportedSearchModelIds } from '../ai/hardware';
import type { HardwareInfo } from '../ai/types';

function hw(partial: Partial<HardwareInfo>): HardwareInfo {
  return {
    platform: 'win32',
    cpuCores: 8,
    cpuModel: 'test',
    cpuFrequencyGhz: 3,
    totalMemoryMb: 16384,
    hasGpu: true,
    hasNvidiaGpu: true,
    gpuName: 'RTX',
    estimatedVramMb: 12000,
    recommendedTier: 'heavy',
    recommendedSearchModelId: 'qwen3-vl-embedding-8b',
    ...partial
  };
}

describe('sanitizeModelRole', () => {
  it('maps legacy medium to search-embed-2b, not caption', () => {
    expect(sanitizeModelRole('medium')).toBe('search-embed-2b');
    expect(sanitizeModelRole('heavy')).toBe('caption');
    expect(sanitizeModelRole('light')).toBe('search-clip');
    expect(sanitizeModelRole('search-embed-8b')).toBe('search-embed-8b');
    expect(sanitizeModelRole('qwen3-vl-embedding-2b')).toBe('search-embed-2b');
    expect(sanitizeModelRole('wd-swinv2-tagger-v3')).toBeNull();
    expect(sanitizeModelRole('tagger')).toBeNull();
  });
});

describe('getSupportedSearchModelIds', () => {
  it('requires VRAM for Qwen models, matching recommendation gates', () => {
    expect(getSupportedSearchModelIds(hw({ totalMemoryMb: 16384, estimatedVramMb: null }))).toEqual([
      'clip-vit-base-patch32'
    ]);
    expect(getSupportedSearchModelIds(hw({ totalMemoryMb: 8192, estimatedVramMb: 4096 }))).toEqual([
      'clip-vit-base-patch32',
      'qwen3-vl-embedding-2b'
    ]);
    expect(getSupportedSearchModelIds(hw({ totalMemoryMb: 16384, estimatedVramMb: 10000 }))).toEqual([
      'clip-vit-base-patch32',
      'qwen3-vl-embedding-2b',
      'qwen3-vl-embedding-8b'
    ]);
  });
});
