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

const stubVideoCard: CardRecord = {
  id: 'smoke-video',
  type: 'video',
  addedAt: '2026-01-01T00:00:00.000Z',
  originalRelativePath: 'smoke/video.webm',
  thumbRelativePath: 'smoke/thumbs/video_s.webp',
  durationMs: 120_000,
  dominantColorHex: '#c2764e',
  width: 1920,
  height: 256,
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

  it('GalleryCardTile video card renders without throw', () => {
    const html = renderToString(
      <GalleryCardTile
        card={stubVideoCard}
        gridSize="m"
        onCardClick={() => undefined}
        onFindSimilar={() => undefined}
        moodboardEnabled
        onToggleMoodboard={() => undefined}
      />
    );
    expect(html).toContain('arc-gallery-card-video-timeline');
  });

  it('GalleryCardTile in moodboard renders overlay markup', () => {
    const html = renderToString(
      <GalleryCardTile
        card={stubCard}
        inMoodboard
        onCardClick={() => undefined}
        moodboardEnabled
        onToggleMoodboard={() => undefined}
      />
    );
    expect(html).toContain('arc-gallery-card-selection-ring');
    expect(html).toContain('arc-gallery-card-shade');
    expect(html).toContain('arc-gallery-card-overlay');
  });

  it('ToastAlert renders without throw', () => {
    expect(() =>
      renderToString(<ToastAlert message="Smoke test" onClose={() => undefined} />)
    ).not.toThrow();
  });
});
