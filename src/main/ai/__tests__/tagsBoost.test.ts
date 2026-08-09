import { describe, expect, it } from 'vitest';

import { computeCaptionTextBoost, computeTagsBoost } from '../tagsBoost';

describe('computeCaptionTextBoost', () => {
  it('returns 0 for empty query or caption', () => {
    expect(computeCaptionTextBoost('', 'Sign in', 0.18)).toBe(0);
    expect(computeCaptionTextBoost('Sign in', '', 0.18)).toBe(0);
    expect(computeCaptionTextBoost('Sign in', 'Sign in', 0)).toBe(0);
  });

  it('gives full boost for exact phrase match (EN)', () => {
    const caption = 'Login form.\n\nVisible text:\nSign in\nCancel';
    expect(computeCaptionTextBoost('Sign in', caption, 0.18)).toBe(0.18);
  });

  it('gives full boost for exact phrase match (RU)', () => {
    const caption = 'Visible text:\nСохранить\nОтмена';
    expect(computeCaptionTextBoost('Сохранить', caption, 0.18)).toBe(0.18);
  });

  it('gives partial boost when some tokens hit', () => {
    const caption = 'Visible text:\nSign in';
    const boost = computeCaptionTextBoost('Sign out', caption, 0.18);
    expect(boost).toBeGreaterThan(0);
    expect(boost).toBeLessThan(0.18);
  });

  it('is case-insensitive', () => {
    expect(computeCaptionTextBoost('sign in', 'Visible text:\nSign In', 0.2)).toBe(0.2);
  });
});

describe('computeTagsBoost (regression)', () => {
  it('still boosts matching tag tokens', () => {
    expect(computeTagsBoost('portrait soft', ['portrait', 'hard light'], 0.12)).toBeGreaterThan(0);
  });
});
