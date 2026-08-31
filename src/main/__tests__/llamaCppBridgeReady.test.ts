import { describe, expect, it } from 'vitest';

import {
  buildLlamaServerConfigKey,
  buildLlamaServerLogicalKey,
  llamaServerOffloadKey,
  buildMultimodalEmbeddingInput,
  extractEmbeddingVector,
  formatLlamaServerExitError,
  isLlamaModelLoadingResponse,
  isRecoverableCudaLoadFailure
} from '../ai/llamaCppBridge';

describe('llama server readiness helpers', () => {
  it('detects 503 Loading model as still loading', () => {
    const body = '{"error":{"message":"Loading model","type":"unavailable_error","code":503}}';
    expect(isLlamaModelLoadingResponse(503, body)).toBe(true);
    expect(isLlamaModelLoadingResponse(200, '{"status":"ok"}')).toBe(false);
    expect(isLlamaModelLoadingResponse(500, 'boom')).toBe(false);
  });

  it('builds stable logical / config keys', () => {
    expect(buildLlamaServerLogicalKey('/m.gguf', '/mm.gguf', 'embed')).toBe(
      '/m.gguf::/mm.gguf::embed'
    );
    expect(buildLlamaServerConfigKey('/m.gguf', null, 'chat', 20)).toBe('/m.gguf::::chat::20');
  });

  it('uses the same offload key for gpuLayers 128 and spawn (999)', () => {
    expect(llamaServerOffloadKey(true)).toBe(999);
    expect(llamaServerOffloadKey(false)).toBe(0);
    expect(buildLlamaServerConfigKey('/m.gguf', '/mm.gguf', 'chat', llamaServerOffloadKey(true))).toBe(
      buildLlamaServerConfigKey('/m.gguf', '/mm.gguf', 'chat', 999)
    );
  });

  it('formats CUDA vs CPU crash messages differently', () => {
    const cudaMsg = formatLlamaServerExitError('GGML_ASSERT at ggml-cuda.cu', true);
    const cpuMsg = formatLlamaServerExitError('GGML_ASSERT at ggml.c', false);
    expect(cudaMsg).toMatch(/GPU|CUDA/i);
    expect(cpuMsg).toMatch(/RAM|модели/i);
    expect(cpuMsg).not.toMatch(/обновите CUDA/i);
  });

  it('marks CUDA-related load failures as recoverable for CPU fallback', () => {
    expect(
      isRecoverableCudaLoadFailure(
        'llama-server аварийно завершился при загрузке модели на GPU (обновите CUDA-среду'
      )
    ).toBe(true);
    expect(isRecoverableCudaLoadFailure('Не хватило памяти для модели')).toBe(false);
    expect(isRecoverableCudaLoadFailure('error: invalid argument: --embd-normalize')).toBe(false);
  });
});

describe('extractEmbeddingVector', () => {
  it('parses OpenAI /v1/embeddings shape', () => {
    expect(
      extractEmbeddingVector({
        data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }],
        model: 'x',
        object: 'list'
      })
    ).toEqual([0.1, 0.2, 0.3]);
  });

  it('parses legacy /embeddings array with nested pooled vector', () => {
    expect(
      extractEmbeddingVector([
        {
          index: 0,
          embedding: [[0.5, 0.6, 0.7]]
        }
      ])
    ).toEqual([0.5, 0.6, 0.7]);
  });

  it('takes last token row when embedding is token-wise', () => {
    expect(
      extractEmbeddingVector([
        {
          index: 0,
          embedding: [
            [1, 2],
            [3, 4]
          ]
        }
      ])
    ).toEqual([3, 4]);
  });
});

describe('buildMultimodalEmbeddingInput', () => {
  it('uses prompt_string + raw base64 multimodal_data', () => {
    expect(buildMultimodalEmbeddingInput('<__media__>', 'abc123')).toEqual([
      { prompt_string: '<__media__>', multimodal_data: ['abc123'] }
    ]);
    expect(
      buildMultimodalEmbeddingInput('<__media__>', 'data:image/png;base64,QQ==')
    ).toEqual([{ prompt_string: '<__media__>', multimodal_data: ['QQ=='] }]);
  });
});
