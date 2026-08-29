import { describe, expect, it } from 'vitest';
import { llamaCtxSizeForRam, llamaFitTargetMib, LLAMA_CTX_SIZE_CHAT } from '../llamaServerLimits';
import { isPlainCardId } from '../../storage/cardFolder';
import { cardIdSchema } from '../../mcp/mcpSchemas';

describe('llamaCtxSizeForRam', () => {
  it('shrinks context on low RAM cap', () => {
    expect(llamaCtxSizeForRam(1024, 'chat')).toBeLessThan(LLAMA_CTX_SIZE_CHAT);
    expect(llamaFitTargetMib(1024)).toBeLessThanOrEqual(2048);
  });
});

describe('cardIdSchema', () => {
  it('rejects path traversal', () => {
    expect(cardIdSchema.safeParse('../meta').success).toBe(false);
    expect(cardIdSchema.safeParse('ok-id').success).toBe(isPlainCardId('ok-id'));
  });
});
