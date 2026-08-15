import { describe, expect, it } from 'vitest';

import {
  applyRatingSearchBoost,
  computeRatingSearchBoost,
  normalizeLowerIsBetter,
  rankMatchedHitsByLowerScoreAndRating,
  relevanceFromClampedDistance,
  RATING_SEARCH_BOOST_MAX
} from '../ratingSearchBoost';

describe('computeRatingSearchBoost', () => {
  it('gives no bonus for 0 stars or missing rating', () => {
    expect(computeRatingSearchBoost(0)).toBe(0);
    expect(computeRatingSearchBoost(undefined)).toBe(0);
    expect(computeRatingSearchBoost(null)).toBe(0);
  });

  it('gives caption-sized max bonus at 5 stars', () => {
    expect(computeRatingSearchBoost(5)).toBe(RATING_SEARCH_BOOST_MAX);
    expect(RATING_SEARCH_BOOST_MAX).toBe(0.18);
  });

  it('grows linearly from 1 to 5', () => {
    expect(computeRatingSearchBoost(1)).toBeCloseTo(0.036);
    expect(computeRatingSearchBoost(2)).toBeCloseTo(0.072);
    expect(computeRatingSearchBoost(3)).toBeCloseTo(0.108);
    expect(computeRatingSearchBoost(4)).toBeCloseTo(0.144);
  });
});

describe('applyRatingSearchBoost', () => {
  it('does not add ids that were not in the cutoff list', () => {
    const cutoff = [{ cardId: 'a', score: 0.3 }];
    const out = applyRatingSearchBoost(cutoff, new Map([['a', 5], ['ghost', 5]]));
    expect(out.map((item) => item.cardId)).toEqual(['a']);
  });

  it('lifts a 5-star card above a close unrated match', () => {
    const cutoff = [
      { cardId: 'unrated', score: 0.5 },
      { cardId: 'starred', score: 0.42 }
    ];
    const out = applyRatingSearchBoost(cutoff, new Map([['unrated', 0], ['starred', 5]]));
    expect(out.map((item) => item.cardId)).toEqual(['starred', 'unrated']);
  });

  it('keeps a strong 0-star match above a weak 5-star match', () => {
    const cutoff = [
      { cardId: 'strong', score: 0.5 },
      { cardId: 'weak', score: 0.2 }
    ];
    const out = applyRatingSearchBoost(cutoff, new Map([['strong', 0], ['weak', 5]]));
    expect(out.map((item) => item.cardId)).toEqual(['strong', 'weak']);
    expect(out[1].score).toBeCloseTo(0.38);
  });
});

describe('normalizeLowerIsBetter', () => {
  it('maps the lowest raw value to 1', () => {
    expect(normalizeLowerIsBetter([-10, -4, 0])).toEqual([1, 0.4, 0]);
  });

  it('gives 1 to every item when ranks are equal', () => {
    expect(normalizeLowerIsBetter([3, 3, 3])).toEqual([1, 1, 1]);
  });
});

describe('relevanceFromClampedDistance', () => {
  it('is 1 at zero distance and 0 at the cutoff', () => {
    expect(relevanceFromClampedDistance(0, 80)).toBe(1);
    expect(relevanceFromClampedDistance(80, 80)).toBe(0);
    expect(relevanceFromClampedDistance(40, 80)).toBe(0.5);
  });

  it('lets a 5-star card pass a slightly worse color match, but not a weak one', () => {
    const max = 80;
    const unratedPerfect =
      relevanceFromClampedDistance(0, max) + computeRatingSearchBoost(0);
    const starredClose =
      relevanceFromClampedDistance(10, max) + computeRatingSearchBoost(5);
    const starredFar =
      relevanceFromClampedDistance(40, max) + computeRatingSearchBoost(5);
    expect(starredClose).toBeGreaterThan(unratedPerfect);
    expect(unratedPerfect).toBeGreaterThan(starredFar);
  });
});

describe('rankMatchedHitsByLowerScoreAndRating', () => {
  it('lifts a 5-star hit when text ranks are equal', () => {
    expect(
      rankMatchedHitsByLowerScoreAndRating([
        { id: 'plain', rawScore: -2, rating: 0 },
        { id: 'starred', rawScore: -2, rating: 5 }
      ])
    ).toEqual(['starred', 'plain']);
  });

  it('keeps a much better text match above a 5-star weaker hit', () => {
    expect(
      rankMatchedHitsByLowerScoreAndRating([
        { id: 'strong', rawScore: -10, rating: 0 },
        { id: 'weak', rawScore: 0, rating: 5 }
      ])
    ).toEqual(['strong', 'weak']);
  });
});
