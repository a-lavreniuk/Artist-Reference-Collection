/**
 * Smoke: монтирует критичные UI-модули через renderToString.
 * Ловит ReferenceError (пропущенный import хука) до ручного теста в Electron.
 */
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CardRecord } from '../services/db';
import MasonryGrid from '../components/masonry/MasonryGrid';
import GalleryCardTile from '../components/gallery/GalleryCardTile';
import ToastAlert from '../components/alert/ToastAlert';

const stubCard: CardRecord = {
  id: 'smoke-card',
  type: 'image',
  addedAt: '2026-01-01T00:00:00.000Z',
  originalRelativePath: 'smoke/card.png',
  thumbRelativePath: 'smoke/thumbs/card_s.webp',
  tagIds: [],
  collectionIds: []
};

describe('renderer UI smoke', () => {
  it('MasonryGrid renders without throw', () => {
    expect(() =>
      renderToString(<MasonryGrid items={[]} renderItem={() => null} />)
    ).not.toThrow();
  });

  it('GalleryCardTile renders without throw', () => {
    expect(() =>
      renderToString(<GalleryCardTile card={stubCard} onCardClick={() => undefined} />)
    ).not.toThrow();
  });

  it('ToastAlert renders without throw', () => {
    expect(() =>
      renderToString(<ToastAlert message="Smoke test" onClose={() => undefined} />)
    ).not.toThrow();
  });
});
