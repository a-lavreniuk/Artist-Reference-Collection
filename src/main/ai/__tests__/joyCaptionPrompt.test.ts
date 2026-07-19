import { describe, expect, it } from 'vitest';

import {
  JOY_CAPTION_EXTRA_IDS,
  JOY_CAPTION_LENGTH_LEVELS,
  JOY_CAPTION_TYPE_IDS,
  buildIndexCaptionPrompt,
  lengthTokenForLevel,
  sanitizeJoyCaptionExtraIds,
  sanitizeJoyCaptionLengthLevel,
  sanitizeJoyCaptionType
} from '../joyCaptionPrompt';

describe('joyCaptionPrompt sanitize', () => {
  it('falls back to descriptive_casual for unknown type', () => {
    expect(sanitizeJoyCaptionType('nope')).toBe('descriptive_casual');
    expect(sanitizeJoyCaptionType('midjourney')).toBe('midjourney');
  });

  it('snaps length to 0|20|40|60|80|100', () => {
    expect(sanitizeJoyCaptionLengthLevel(undefined)).toBe(80);
    expect(sanitizeJoyCaptionLengthLevel(37)).toBe(40);
    expect(sanitizeJoyCaptionLengthLevel(100)).toBe(100);
    expect(sanitizeJoyCaptionLengthLevel(-10)).toBe(0);
  });

  it('filters unknown and duplicate extras', () => {
    expect(sanitizeJoyCaptionExtraIds(['lighting', 'lighting', 'nope', 'ages'])).toEqual([
      'lighting',
      'ages'
    ]);
    expect(sanitizeJoyCaptionExtraIds('x')).toEqual([]);
  });
});

describe('buildIndexCaptionPrompt', () => {
  it('builds each caption type with Russian suffix', () => {
    for (const type of JOY_CAPTION_TYPE_IDS) {
      const prompt = buildIndexCaptionPrompt({
        aiCaptionType: type,
        aiCaptionLengthLevel: 80,
        aiCaptionExtraIds: []
      });
      expect(prompt).toContain('Write the caption in Russian.');
      expect(prompt.length).toBeGreaterThan(40);
    }
  });

  it('maps each length level into the template', () => {
    for (const level of JOY_CAPTION_LENGTH_LEVELS) {
      const token = lengthTokenForLevel(level);
      const prompt = buildIndexCaptionPrompt({
        aiCaptionType: 'descriptive_casual',
        aiCaptionLengthLevel: level,
        aiCaptionExtraIds: []
      });
      if (level === 0) {
        expect(prompt).toContain('Write a descriptive caption for this image in a casual tone.');
        expect(prompt).not.toContain('{length}');
      } else {
        expect(prompt).toContain(token);
      }
    }
  });

  it('appends every whitelist extra phrase', () => {
    const prompt = buildIndexCaptionPrompt({
      aiCaptionType: 'straightforward',
      aiCaptionLengthLevel: 40,
      aiCaptionExtraIds: [...JOY_CAPTION_EXTRA_IDS]
    });
    expect(prompt).toContain('Include information about lighting.');
    expect(prompt).toContain('Explicitly specify the vantage height');
    expect(prompt).toContain('Write the caption in Russian.');
  });

  it('ignores unknown prefs via sanitize', () => {
    const prompt = buildIndexCaptionPrompt({
      aiCaptionType: 'bogus',
      aiCaptionLengthLevel: 999,
      aiCaptionExtraIds: ['lighting', 'ghost']
    });
    expect(prompt).toContain('casual tone');
    expect(prompt).toContain('very long');
    expect(prompt).toContain('Include information about lighting.');
    expect(prompt).not.toContain('ghost');
  });
});
