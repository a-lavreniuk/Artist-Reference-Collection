import { describe, expect, it } from 'vitest';

import {
  matchCandidatesExact,
  normalizeTagCandidate,
  parseTagCandidates,
  tagMatchTexts,
  volumeParamsForAutoTag
} from '../suggestTagsCore';

describe('suggestTags parse and match', () => {
  it('normalizes candidate names', () => {
    expect(normalizeTagCandidate('  Портрет  Женщины ')).toBe('портрет женщины');
  });

  it('parses comma-separated JoyCaption output', () => {
    expect(parseTagCandidates('портрет, закат, плёнка, cinematic')).toEqual([
      'портрет',
      'закат',
      'плёнка',
      'cinematic'
    ]);
  });

  it('parses numbered and bulleted lists', () => {
    expect(parseTagCandidates('1. портрет\n2. студия\n- мягкий свет')).toEqual([
      'портрет',
      'студия',
      'мягкий свет'
    ]);
  });

  it('exact-matches catalog tags by name case-insensitively', () => {
    const { matched, unmatched } = matchCandidatesExact(
      ['Портрет', 'неизвестно', 'закат'],
      [
        { id: 't1', name: 'портрет' },
        { id: 't2', name: 'Закат' }
      ]
    );
    expect(matched.map((m) => m.tagId)).toEqual(['t1', 't2']);
    expect(unmatched).toEqual(['неизвестно']);
  });

  it('exact-matches by short and long description phrases', () => {
    const { matched, unmatched } = matchCandidatesExact(
      ['студийный свет', 'плёнка'],
      [
        {
          id: 't1',
          name: 'свет',
          description: 'Студийный свет. Мягкие тени и контровой акцент на лице модели.'
        },
        {
          id: 't2',
          name: 'film look',
          description: 'плёнка'
        }
      ]
    );
    expect(matched.map((m) => m.tagId).sort()).toEqual(['t1', 't2']);
    expect(unmatched).toEqual([]);
  });

  it('builds match texts from name and description variants', () => {
    const texts = tagMatchTexts({
      id: 't1',
      name: 'портрет',
      description: 'Женский портрет. Крупный план, мягкий свет.'
    });
    expect(texts.some((t) => /портрет/i.test(t))).toBe(true);
    expect(texts.some((t) => /Женский портрет/i.test(t))).toBe(true);
    expect(texts.some((t) => /Крупный план/i.test(t))).toBe(true);
  });

  it('exports auto-created category name', async () => {
    const { AUTO_CREATED_CATEGORY_NAME } = await import('../suggestTagsCore');
    expect(AUTO_CREATED_CATEGORY_NAME).toBe('Автоматически созданные метки');
  });

  it('maps volume to candidate limits', () => {
    expect(volumeParamsForAutoTag(10).maxCandidates).toBe(5);
    expect(volumeParamsForAutoTag(10).minSimilarity).toBe(0.84);
    expect(volumeParamsForAutoTag(50).maxCandidates).toBe(10);
    expect(volumeParamsForAutoTag(50).minSimilarity).toBe(0.76);
    expect(volumeParamsForAutoTag(90).maxCandidates).toBe(16);
    expect(volumeParamsForAutoTag(90).minSimilarity).toBe(0.68);
  });

  it('picks up to three video frame offsets', async () => {
    const { videoFrameOffsetsMs } = await import('../suggestTagsCore');
    expect(videoFrameOffsetsMs(800)).toEqual([0]);
    expect(videoFrameOffsetsMs(4000)).toEqual([0, 2000]);
    expect(videoFrameOffsetsMs(20_000)).toEqual([3000, 10_000, 17_000]);
    expect(videoFrameOffsetsMs(null).length).toBe(3);
  });
});
