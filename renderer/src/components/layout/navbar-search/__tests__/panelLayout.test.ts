import { describe, expect, it } from 'vitest';
import { computePanelLayout } from '../utils/panelLayout';

describe('computePanelLayout', () => {
  it('anchors panel below island with gap', () => {
    const layout = computePanelLayout(
      { top: 56, bottom: 112, left: 100, width: 840 },
      8
    );
    expect(layout).toEqual({ top: 120, left: 100, width: 840 });
  });
});
