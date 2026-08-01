import { describe, expect, it } from 'vitest';

import { VISION_MAX_EDGE_PX } from '../ai/indexVisionImage';

describe('vision image prep', () => {
  it('caps long edge so Qwen VL embeds stay within a few batches', () => {
    expect(VISION_MAX_EDGE_PX).toBeLessThanOrEqual(1280);
    expect(VISION_MAX_EDGE_PX).toBeGreaterThanOrEqual(512);
  });
});
