import { describe, expect, it } from 'vitest';

import { readAiCaptionFromDbRow } from '../libraryStorage';

describe('readAiCaptionFromDbRow', () => {
  it('maps ai_caption column to string', () => {
    expect(readAiCaptionFromDbRow({ ai_caption: 'На изображении закат над морем.' })).toBe(
      'На изображении закат над морем.'
    );
  });

  it('returns undefined when column is empty', () => {
    expect(readAiCaptionFromDbRow({ ai_caption: null })).toBeUndefined();
    expect(readAiCaptionFromDbRow({})).toBeUndefined();
  });
});
