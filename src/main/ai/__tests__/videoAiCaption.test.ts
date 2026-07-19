import { describe, expect, it } from 'vitest';

import { mergeFrameCaptions } from '../videoAiCaption';

describe('mergeFrameCaptions', () => {
  it('returns empty for blank input', () => {
    expect(mergeFrameCaptions([])).toBe('');
    expect(mergeFrameCaptions(['  ', 'x'])).toBe('');
  });

  it('keeps a single caption with trailing period', () => {
    expect(mergeFrameCaptions(['На кадре закат над морем'])).toBe('На кадре закат над морем.');
    expect(mergeFrameCaptions(['Уже с точкой.'])).toBe('Уже с точкой.');
  });

  it('joins three distinct captions into one description', () => {
    const merged = mergeFrameCaptions([
      'Широкий план города ночью.',
      'Крупный план неоновой вывески.',
      'Камера едет вдоль улицы под дождём.'
    ]);
    expect(merged).toContain('Широкий план города ночью');
    expect(merged).toContain('неоновой вывески');
    expect(merged).toContain('под дождём');
    expect(merged.split('.').filter((s) => s.trim()).length).toBe(3);
  });

  it('drops near-duplicate shorter captions', () => {
    const merged = mergeFrameCaptions([
      'Портрет женщины при мягком свете.',
      'Портрет женщины при мягком свете из окна.'
    ]);
    expect(merged).toBe('Портрет женщины при мягком свете из окна.');
  });
});
