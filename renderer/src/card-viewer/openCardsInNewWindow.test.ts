import { describe, expect, it } from 'vitest';
import {
  cardViewerScopeAllowsNavigation,
  resolveCardViewerOpenPayload
} from './openCardsInNewWindow';

describe('resolveCardViewerOpenPayload', () => {
  const feed = ['a', 'b', 'c', 'd'];

  it('opens a single card from library without navigation', () => {
    expect(
      resolveCardViewerOpenPayload({
        scope: { kind: 'library' },
        feedOrder: feed,
        cardId: 'b',
        selectedIds: ['a', 'b', 'c']
      })
    ).toEqual({ cardIds: ['b'], startIndex: 0 });
  });

  it('opens collection feed for navigation', () => {
    expect(
      resolveCardViewerOpenPayload({
        scope: { kind: 'collection', collectionId: 'col-1' },
        feedOrder: feed,
        cardId: 'c'
      })
    ).toEqual({ cardIds: feed, startIndex: 2 });
  });

  it('opens selected subset in collection feed order', () => {
    expect(
      resolveCardViewerOpenPayload({
        scope: { kind: 'moodboard-cards' },
        feedOrder: feed,
        cardId: 'd',
        selectedIds: ['d', 'a', 'c']
      })
    ).toEqual({ cardIds: ['a', 'c', 'd'], startIndex: 2 });
  });

  it('detects navigable scopes', () => {
    expect(cardViewerScopeAllowsNavigation({ kind: 'library' })).toBe(false);
    expect(cardViewerScopeAllowsNavigation({ kind: 'collection', collectionId: 'x' })).toBe(true);
    expect(cardViewerScopeAllowsNavigation({ kind: 'moodboard-cards' })).toBe(true);
  });
});
