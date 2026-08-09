import { describe, expect, it } from 'vitest';

import {
  VISIBLE_TEXT_MARKER,
  mergeCaptionWithVisibleText,
  normalizeVisibleText,
  stripVisibleTextBlock
} from '../visibleTextExtractCore';

describe('normalizeVisibleText', () => {
  it('returns empty for NONE / no-text replies', () => {
    expect(normalizeVisibleText('NONE')).toBe('');
    expect(normalizeVisibleText('no text')).toBe('');
    expect(normalizeVisibleText('Нет текста')).toBe('');
  });

  it('keeps UI lines and drops empty', () => {
    expect(normalizeVisibleText('Sign in\n\nСохранить\n')).toBe('Sign in\nСохранить');
  });
});

describe('mergeCaptionWithVisibleText', () => {
  it('appends visible text under a stable marker', () => {
    const merged = mergeCaptionWithVisibleText(
      'A login screen with a blue button.',
      'Sign in\nForgot password?'
    );
    expect(merged).toContain('A login screen with a blue button.');
    expect(merged).toContain(`${VISIBLE_TEXT_MARKER}\nSign in\nForgot password?`);
  });

  it('is idempotent when re-merging (no duplicated marker blocks)', () => {
    const once = mergeCaptionWithVisibleText('Descriptive caption.', 'Save');
    const twice = mergeCaptionWithVisibleText(once, 'Save\nCancel');
    expect(twice.match(new RegExp(VISIBLE_TEXT_MARKER, 'g'))?.length).toBe(1);
    expect(twice).toContain('Save\nCancel');
    expect(stripVisibleTextBlock(twice)).toBe('Descriptive caption.');
  });

  it('returns only marker block when descriptive caption is empty', () => {
    expect(mergeCaptionWithVisibleText('', 'OK')).toBe(`${VISIBLE_TEXT_MARKER}\nOK`);
  });

  it('returns base caption when visible text is empty', () => {
    expect(mergeCaptionWithVisibleText('Only description.', 'NONE')).toBe('Only description.');
  });
});
