import { describe, expect, it } from 'vitest';

import { customDateAddedBounds, dateRangeForPreset } from '../galleryFilters';

describe('customDateAddedBounds', () => {
  it('treats date-only as local calendar day like presets (ISO strings)', () => {
    const now = new Date(2026, 6, 22, 15, 30, 0);
    const preset = dateRangeForPreset('today', now);
    const custom = customDateAddedBounds('2026-07-22', '2026-07-22');
    expect(custom.from).toBe(preset.from.toISOString());
    expect(custom.to).toBe(preset.to.toISOString());
  });

  it('uses full range when from/to differ', () => {
    const bounds = customDateAddedBounds('2026-07-01', '2026-07-03');
    expect(bounds.from).toBe(new Date(2026, 6, 1, 0, 0, 0, 0).toISOString());
    expect(bounds.to).toBe(new Date(2026, 6, 3, 23, 59, 59, 999).toISOString());
  });

  it('passes through already-ISO timestamps', () => {
    const from = '2026-07-22T00:00:00.000Z';
    const to = '2026-07-22T23:59:59.999Z';
    const bounds = customDateAddedBounds(from, to);
    expect(bounds.from).toBe(new Date(from).toISOString());
    expect(bounds.to).toBe(new Date(to).toISOString());
  });
});
