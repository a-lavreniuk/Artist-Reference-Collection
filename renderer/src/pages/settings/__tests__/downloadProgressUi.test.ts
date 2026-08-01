import { describe, expect, it } from 'vitest';
import {
  computeDownloadUi,
  modelCardProgressTitle
} from '../settingsAiSession';

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

  it('shows runtime progress in 0–40 even before the reserve flag is set', () => {
    expect(computeDownloadUi('runtime', 0).overallPercent).toBe(0);
    expect(computeDownloadUi('runtime', 50).overallPercent).toBe(20);
    expect(computeDownloadUi('runtime', 100).overallPercent).toBe(40);
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
