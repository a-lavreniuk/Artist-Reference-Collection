import { describe, expect, it } from 'vitest';

import {
  LLAMA_CTX_SIZE_CHAT,
  LLAMA_CTX_SIZE_EMBED,
  LLAMA_PARALLEL_SLOTS
} from '../ai/llamaServerLimits';
import { CUDA_CUDART_MARKER_DLL, LLAMA_RUNTIME_CATALOG } from '../ai/llamaRuntimeCatalog';

describe('llama server limits', () => {
  it('caps context well below model train sizes', () => {
    expect(LLAMA_CTX_SIZE_EMBED).toBe(4096);
    expect(LLAMA_CTX_SIZE_CHAT).toBe(8192);
    expect(LLAMA_CTX_SIZE_EMBED).toBeLessThan(65536);
    expect(LLAMA_CTX_SIZE_CHAT).toBeLessThan(65536);
    expect(LLAMA_PARALLEL_SLOTS).toBe(1);
  });
});

describe('llama runtime catalog', () => {
  it('pins Windows CUDA build with matching cudart redistributable', () => {
    const win = LLAMA_RUNTIME_CATALOG['win32-x64'];
    expect(win.cuda?.archive).toContain('b8466');
    expect(win.cuda?.archive).toContain('cuda-12.4');
    expect(win.cudart?.archive).toContain('cudart-llama-bin-win-cuda-12.4');
    expect(CUDA_CUDART_MARKER_DLL).toBe('cudart64_12.dll');
  });
});
