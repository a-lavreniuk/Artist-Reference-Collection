import { describe, expect, it } from 'vitest';
import {
  cardViewerContextFromScope,
  cardViewerScopeAllowsNavigation,
  resolveCardViewerOpenPayload,
  serializeCardViewerContext
} from './openCardsInNewWindow';
import { parseCardViewerLaunch } from './parseCardViewerLaunch';

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
    ).toEqual({ cardIds: ['b'], startIndex: 0, context: { kind: 'library' } });
  });

  it('opens collection feed for navigation', () => {
    expect(
      resolveCardViewerOpenPayload({
        scope: { kind: 'collection', collectionId: 'col-1' },
        feedOrder: feed,
        cardId: 'c',
        collectionName: 'Refs'
      })
    ).toEqual({
      cardIds: feed,
      startIndex: 2,
      context: { kind: 'collection', name: 'Refs' }
    });
  });

  it('opens selected subset in collection feed order', () => {
    expect(
      resolveCardViewerOpenPayload({
        scope: { kind: 'moodboard-cards' },
        feedOrder: feed,
        cardId: 'd',
        selectedIds: ['d', 'a', 'c']
      })
    ).toEqual({
      cardIds: ['a', 'c', 'd'],
      startIndex: 2,
      context: { kind: 'moodboard' }
    });
  });

  it('detects navigable scopes', () => {
    expect(cardViewerScopeAllowsNavigation({ kind: 'library' })).toBe(false);
    expect(cardViewerScopeAllowsNavigation({ kind: 'collection', collectionId: 'x' })).toBe(true);
    expect(cardViewerScopeAllowsNavigation({ kind: 'moodboard-cards' })).toBe(true);
  });
});

describe('cardViewer context serialization', () => {
  it('maps scope to context', () => {
    expect(cardViewerContextFromScope({ kind: 'moodboard-cards' })).toEqual({ kind: 'moodboard' });
    expect(
      cardViewerContextFromScope({ kind: 'collection', collectionId: 'c1' }, '  My set ')
    ).toEqual({ kind: 'collection', name: 'My set' });
  });

  it('serializes context for URL', () => {
    expect(serializeCardViewerContext({ kind: 'library' })).toEqual({ ctx: 'library' });
    expect(serializeCardViewerContext({ kind: 'moodboard' })).toEqual({ ctx: 'moodboard' });
    expect(serializeCardViewerContext({ kind: 'collection', name: 'Refs' })).toEqual({
      ctx: 'collection',
      ctxName: 'Refs'
    });
  });

  it('parses launch params with context', () => {
    expect(
      parseCardViewerLaunch('?cards=a,b&index=1&ctx=collection&ctxName=' + encodeURIComponent('Refs'))
    ).toEqual({
      cardIds: ['a', 'b'],
      startIndex: 1,
      context: { kind: 'collection', name: 'Refs' }
    });
  });
});
