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
import SettingsAutoTagPanel from '../pages/settings/panels/SettingsAutoTagPanel';
import SettingsAiSearchPanel from '../pages/settings/panels/SettingsAiSearchPanel';
import { patchAiSettingsSnapshotForTests } from '../pages/settings/settingsAiSession';
import GalleryTrashHeader from '../components/gallery/GalleryTrashHeader';
import NavbarSearchModes from '../components/layout/navbar-search/NavbarSearchModes';

function withBrowserWindowStub(run: () => void): void {
  const previous = (globalThis as { window?: unknown }).window;
  (globalThis as { window: { arc: Record<string, never> } }).window = { arc: {} };
  patchAiSettingsSnapshotForTests({ loading: false });
  try {
    run();
  } finally {
    patchAiSettingsSnapshotForTests({ loading: true });
    if (previous === undefined) {
      Reflect.deleteProperty(globalThis, 'window');
    } else {
      (globalThis as { window: unknown }).window = previous;
    }
  }
}

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
  it('GalleryTrashHeader renders without throw', () => {
    withBrowserWindowStub(() => {
      expect(() =>
        renderToString(
          <MemoryRouter initialEntries={['/gallery?lib=trash']}>
            <GalleryTrashHeader />
          </MemoryRouter>
        )
      ).not.toThrow();
    });
  });

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
    expect(html).toContain('Скопировать подробности');
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

  it('SettingsAutoTagPanel renders without throw', () => {
    withBrowserWindowStub(() => {
      expect(() => renderToString(<SettingsAutoTagPanel />)).not.toThrow();
    });
  });

  it('SettingsAiSearchPanel renders without throw', () => {
    withBrowserWindowStub(() => {
      patchAiSettingsSnapshotForTests({
        loading: false,
        status: {
          enabled: true,
          activeSearchModelId: null,
          activeTier: 'light',
          activeModelId: null,
          hardware: {
            platform: 'win32',
            cpuCores: 8,
            cpuModel: 'test',
            cpuFrequencyGhz: 3,
            totalMemoryMb: 16384,
            hasGpu: false,
            hasNvidiaGpu: false,
            gpuName: null,
            estimatedVramMb: null,
            recommendedTier: 'light',
            recommendedSearchModelId: 'clip-vit-base-patch32'
          },
          supportedSearchModelIds: ['clip-vit-base-patch32'],
          supportedTiers: ['light'],
          searchModelCards: [],
          captionModelCard: {
            role: 'caption',
            modelId: 'joycaption-beta-one',
            label: 'JoyCaption',
            description: '',
            sizeLabel: '',
            minRamMb: 0,
            supported: true
          },
          modelCards: [],
          resources: { threads: 4, gpuLayers: 0, maxRamMb: 4096 },
          resourcePreset: 50,
          searchStrictness: 50,
          autoTagEnabled: false,
          autoTagVolume: 50,
          autoTagCatalogMode: 'reuse',
          autoTagOnImport: false,
          index: {
            indexed: 0,
            total: 0,
            running: false,
            paused: false,
            currentCardId: null,
            currentCardProgress: null
          },
          models: [],
          llamaRuntime: { cpuInstalled: false, cudaInstalled: false, release: '' },
          download: null,
          lastError: null,
          setupReady: false
        }
      });
      expect(() =>
        renderToString(
          <MemoryRouter>
            <SettingsAiSearchPanel />
          </MemoryRouter>
        )
      ).not.toThrow();
    });
  });

  it('NavbarSearchModes renders all four tabs when AI is not ready', () => {
    withBrowserWindowStub(() => {
      const html = renderToString(
        <MemoryRouter>
          <NavbarSearchModes
            mode="tags"
            aiModesReady={false}
            onModeChange={() => undefined}
          />
        </MemoryRouter>
      );
      expect(html).toContain('aria-label="Режим поиска"');
      expect(html).toContain('Семантический поиск доступен после настройки умного поиска');
      expect(html).toContain('Поиск по совпадениям доступен после настройки умного поиска');
      expect(html).toContain('aria-disabled="true"');
      expect(html).not.toContain('в разработке');
    });
  });
});
