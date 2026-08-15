/**
 * Smoke: монтирует критичные UI-модули через renderToString.
 * Ловит ReferenceError (пропущенный import хука) до ручного теста в Electron.
 */
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { CardRecord } from '../services/db';
import MasonryGrid from '../components/masonry/MasonryGrid';
import GalleryCardTile from '../components/gallery/GalleryCardTile';
import ToastAlert from '../components/alert/ToastAlert';
import { ErrorBoundary, ErrorScreen } from '../components/error-boundary';
import SearchPanelColorControls from '../components/layout/SearchPanelColorControls';
import CardDetailPreviewOptionsBar from '../components/gallery/CardDetailPreviewOptionsBar';

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

  it('ErrorScreen renders crash copy and details', () => {
    const html = renderToString(
      <MemoryRouter>
        <ErrorScreen error={new Error('smoke-crash')} />
      </MemoryRouter>
    );
    expect(html).toContain('Что-то пошло не так');
    expect(html).toContain('Перезагрузить');
    expect(html).toContain('Сообщить о проблеме');
    expect(html).toContain('Подробности');
    expect(html).toContain('smoke-crash');
  });

  it('ErrorBoundary passes through healthy children', () => {
    const html = renderToString(
      <ErrorBoundary>
        <div data-ok="1">healthy</div>
      </ErrorBoundary>
    );
    expect(html).toContain('healthy');
    expect(html).not.toContain('Что-то пошло не так');
  });

  it('ErrorBoundary getDerivedStateFromError maps thrown error to state', () => {
    const state = ErrorBoundary.getDerivedStateFromError(new Error('boundary-smoke'));
    expect(state.error?.message).toBe('boundary-smoke');
  });

  it('SearchPanelColorControls renders Pantone nearest-match chips', () => {
    const html = renderToString(
      <SearchPanelColorControls
        colorHex="#E4002B"
        tolerance={20}
        onColorChange={() => undefined}
        onToleranceChange={() => undefined}
        pantoneMode
      />
    );
    expect(html).toContain('arc-pantone-chip');
    expect(html).toContain('Ближайшие совпадения');
    expect(html).toContain('Solid Coated');
  });

  it('SearchPanelColorControls renders eyedropper control', () => {
    const html = renderToString(
      <SearchPanelColorControls
        colorHex="#E3B81A"
        tolerance={20}
        onColorChange={() => undefined}
        onToleranceChange={() => undefined}
        onEyedropper={() => undefined}
      />
    );
    expect(html).toContain('arc-icon-eyedropper');
    expect(html).toContain('Пипетка');
  });

  it('CardDetailPreviewOptionsBar renders queue toggle and zoom controls', () => {
    const html = renderToString(
      <CardDetailPreviewOptionsBar
        card={stubCard}
        naturalSize={{ width: 1920, height: 1080 }}
        displayScalePct={100}
        isFitActive
        isActualActive={false}
        showQueueToggle
        queueOpen={false}
        onQueueToggle={() => undefined}
        onInfoClick={() => undefined}
        onFitClick={() => undefined}
        onActualClick={() => undefined}
        onZoomOut={() => undefined}
        onZoomIn={() => undefined}
        onDisplayPctChange={() => undefined}
      />
    );
    expect(html).toContain('arc-card-detail-preview-options');
    expect(html).toContain('arc-icon-gallery-thumbnails');
    expect(html).toContain('Показать очередь');
    expect(html).toContain('btn-group btn-group-ds');
    expect(html).toContain('arc-icon-aspect-ratio');
    expect(html).toContain('arc-icon-actual-size');
    expect(html).toContain('aria-label="Уменьшить"');
  });
});
