import { describe, expect, it } from 'vitest';
import {
  advanceDownloadSpeed,
  computeDownloadUi,
  formatDownloadSpeedLabel,
  isCaptionModelInstalled,
  isCaptionModelRef,
  modelCardProgressTitle,
  resolveProgressModelRef,
  holdMonotonicDownloadPercent
} from '../settingsAiSession';
import type { AiStatus } from '../../../services/aiTypes';

describe('computeDownloadUi', () => {
  it('starts model download at 0% when runtime was skipped', () => {
    expect(computeDownloadUi('model', 0).overallPercent).toBe(0);
    expect(computeDownloadUi('model', 50).overallPercent).toBe(45);
    expect(computeDownloadUi('model', 100).overallPercent).toBe(90);
    expect(computeDownloadUi('finalize', 0).overallPercent).toBe(90);
    expect(computeDownloadUi('finalize', 100).overallPercent).toBe(100);
  });

  it('maps phases continuously when runtime band is reserved', () => {
    const opts = { reserveRuntimeBand: true };
    const runtimeEnd = computeDownloadUi('runtime', 100, opts).overallPercent;
    const modelStart = computeDownloadUi('model', 0, opts).overallPercent;
    const modelEnd = computeDownloadUi('model', 100, opts).overallPercent;
    const finalizeStart = computeDownloadUi('finalize', 0, opts).overallPercent;
    const finalizeEnd = computeDownloadUi('finalize', 100, opts).overallPercent;

    expect(runtimeEnd).toBe(40);
    expect(modelStart).toBe(40);
    expect(modelEnd).toBe(90);
    expect(finalizeStart).toBe(90);
    expect(finalizeEnd).toBe(100);

    expect(modelStart).toBeGreaterThanOrEqual(runtimeEnd);
    expect(finalizeStart).toBeGreaterThanOrEqual(modelEnd);
  });

  it('keeps mid-phase progress inside its band when runtime is reserved', () => {
    const opts = { reserveRuntimeBand: true };
    expect(computeDownloadUi('runtime', 50, opts).overallPercent).toBe(20);
    expect(computeDownloadUi('model', 50, opts).overallPercent).toBe(65);
    expect(computeDownloadUi('finalize', 50, opts).overallPercent).toBe(95);
  });

  it('does not drop the bar when runtime finished at 100% and model files start at 0%', () => {
    const opts = { reserveRuntimeBand: true };
    expect(computeDownloadUi('runtime', 100, opts).overallPercent).toBe(40);
    expect(computeDownloadUi('model', 0, opts).overallPercent).toBe(40);
  });
});

describe('modelCardProgressTitle', () => {
  it('uses stage labels for runtime / model / finalize', () => {
    expect(modelCardProgressTitle('runtime', false)).toBe('Настройка');
    expect(modelCardProgressTitle('model', false)).toBe('Идёт скачивание');
    expect(modelCardProgressTitle('model', true)).toBe('Скачивание на паузе');
    expect(modelCardProgressTitle('finalize', false)).toBe('Установка');
  });
});

describe('formatDownloadSpeedLabel', () => {
  it('formats kilobytes per second under 1 MB/s', () => {
    expect(formatDownloadSpeedLabel(0.5)).toBe('512 Кб/с');
  });

  it('formats megabytes per second from 1 MB/s', () => {
    expect(formatDownloadSpeedLabel(2.5)).toBe('2,5 Мб/с');
    expect(formatDownloadSpeedLabel(12.2)).toBe('12 Мб/с');
  });

  it('shows speed only while model files download', () => {
    expect(formatDownloadSpeedLabel(0.5, { phase: 'model' })).toBe('512 Кб/с');
    expect(formatDownloadSpeedLabel(0.5, { phase: 'runtime' })).toBeNull();
    expect(formatDownloadSpeedLabel(0.5, { paused: true })).toBeNull();
    expect(formatDownloadSpeedLabel(null)).toBeNull();
    expect(formatDownloadSpeedLabel(0.5, { phase: 'finalize' })).toBeNull();
  });
});

describe('advanceDownloadSpeed', () => {
  it('does not compute speed until the sample window is at least 0.4s', () => {
    const first = advanceDownloadSpeed({
      sample: null,
      speedMbps: null,
      now: 1000,
      bytesReceived: 0
    });
    const tooSoon = advanceDownloadSpeed({
      sample: first.sample,
      speedMbps: first.speedMbps,
      now: 1200,
      bytesReceived: 256 * 1024
    });
    expect(tooSoon.speedMbps).toBeNull();
    expect(tooSoon.sample).toEqual(first.sample);
  });

  it('computes live speed after the sample window', () => {
    const first = advanceDownloadSpeed({
      sample: null,
      speedMbps: null,
      now: 1000,
      bytesReceived: 0
    });
    const next = advanceDownloadSpeed({
      sample: first.sample,
      speedMbps: first.speedMbps,
      now: 1500,
      bytesReceived: 256 * 1024
    });
    expect(next.speedMbps).toBeCloseTo(0.5, 5);
    expect(formatDownloadSpeedLabel(next.speedMbps)).toBe('512 Кб/с');
  });

  it('resets the sample when a new file starts without dropping the last speed', () => {
    const next = advanceDownloadSpeed({
      sample: { at: 1000, bytes: 5_000_000 },
      speedMbps: 2,
      now: 1400,
      bytesReceived: 16_384
    });
    expect(next.speedMbps).toBe(2);
    expect(next.sample.bytes).toBe(16_384);
  });
});

describe('caption model detection', () => {
  it('does not treat search models or legacy heavy as JoyCaption', () => {
    expect(isCaptionModelRef('caption')).toBe(true);
    expect(isCaptionModelRef('joycaption-beta-one')).toBe(true);
    expect(isCaptionModelRef('heavy')).toBe(false);
    expect(isCaptionModelRef('search-embed-8b')).toBe(false);
    expect(isCaptionModelRef('qwen3-vl-embedding-2b')).toBe(false);
  });

  it('does not count a search model with legacy heavy tier as installed caption', () => {
    const status = {
      models: [
        {
          role: 'search-embed-8b',
          modelId: 'qwen3-vl-embedding-8b',
          tier: 'heavy',
          installed: true,
          downloading: false,
          progressPercent: null
        },
        {
          role: 'caption',
          modelId: 'joycaption-beta-one',
          installed: false,
          downloading: false,
          progressPercent: null
        }
      ]
    } as AiStatus;
    expect(isCaptionModelInstalled(status)).toBe(false);
  });
});

describe('resolveProgressModelRef', () => {
  it('prefers role over catalog tier heavy', () => {
    expect(resolveProgressModelRef({ role: 'caption', tier: 'heavy' })).toBe('caption');
    expect(resolveProgressModelRef({ role: 'search-embed-8b', tier: 'heavy' })).toBe('search-embed-8b');
    expect(resolveProgressModelRef({ modelId: 'joycaption-beta-one', tier: 'heavy' })).toBe(
      'joycaption-beta-one'
    );
  });

  it('does not treat a heavy-only payload as a download identity', () => {
    expect(resolveProgressModelRef({ tier: 'heavy' })).toBeNull();
  });
});

describe('holdMonotonicDownloadPercent', () => {
  it('ignores a drop inside the same phase', () => {
    expect(holdMonotonicDownloadPercent(40, 5, true)).toBe(40);
    expect(holdMonotonicDownloadPercent(40, 55, true)).toBe(55);
    expect(holdMonotonicDownloadPercent(90, 0, false)).toBe(0);
  });
});
