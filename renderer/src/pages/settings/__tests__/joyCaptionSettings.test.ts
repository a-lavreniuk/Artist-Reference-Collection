import { describe, expect, it } from 'vitest';

import {
  sanitizeJoyCaptionExtraIds,
  sanitizeJoyCaptionLengthLevel,
  sanitizeJoyCaptionType
} from '../../../services/appPreferences';
import {
  assertJoyCaptionCopyComplete,
  captionLengthHint,
  captionLengthLabel,
  JOY_CAPTION_EXTRA_OPTIONS,
  JOY_CAPTION_TYPE_OPTIONS
} from '../joyCaptionSettingsCopy';

describe('joyCaption settings copy and sanitize', () => {
  it('keeps UI copy lists complete', () => {
    expect(assertJoyCaptionCopyComplete()).toBe(true);
    expect(JOY_CAPTION_TYPE_OPTIONS).toHaveLength(8);
    expect(JOY_CAPTION_EXTRA_OPTIONS).toHaveLength(15);
  });

  it('formats length labels and hints', () => {
    expect(captionLengthLabel(0)).toBe('Без ограничения');
    expect(captionLengthHint(0)).toContain('модель сама выбирает');
    expect(captionLengthLabel(80)).toBe('Длинное');
    expect(captionLengthHint(100)).toContain('максимум подробностей');
  });

  it('sanitizes prefs in renderer mirror', () => {
    expect(sanitizeJoyCaptionType('danbooru')).toBe('danbooru');
    expect(sanitizeJoyCaptionType(null)).toBe('descriptive_casual');
    expect(sanitizeJoyCaptionLengthLevel(55)).toBe(60);
    expect(sanitizeJoyCaptionExtraIds(['composition', 'x'])).toEqual(['composition']);
  });
});
