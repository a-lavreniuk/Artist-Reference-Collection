import { describe, expect, it, vi } from 'vitest';
import { buildCardContextMenuRows } from './buildCardContextMenuRows';
import type { BuildCardContextMenuRowsInput } from './cardContextMenuTypes';

function baseActions() {
  return {
    onOpen: vi.fn(),
    onOpenInNewWindow: vi.fn(),
    onToggleMoodboard: vi.fn(),
    onOpenCollections: vi.fn(),
    onFindSimilar: vi.fn(),
    onOpenSourceFolder: vi.fn(),
    onSendToTrash: vi.fn(),
    onToggleCardSelection: vi.fn()
  };
}

function rowLabels(rows: ReturnType<typeof buildCardContextMenuRows>): string[] {
  return rows
    .filter((row): row is Extract<typeof row, { type: 'item' }> => row.type === 'item')
    .map((row) => row.label);
}

describe('buildCardContextMenuRows — selection mode', () => {
  const base: Omit<BuildCardContextMenuRowsInput, 'actions'> = {
    scope: { kind: 'library' },
    inMoodboard: false,
    hasSourcePath: true,
    selectionModeActive: true,
    bulkSelectionCount: 2
  };

  it('shows deselect + bulk actions for selected card in library', () => {
    const labels = rowLabels(
      buildCardContextMenuRows({
        ...base,
        menuCardIsSelected: true,
        actions: baseActions()
      })
    );
    expect(labels).toEqual([
      'Снять выбор с карточки',
      'Открыть в новом окне',
      'Добавить в мудборд',
      'Добавить в коллекцию',
      'Отправить в корзину'
    ]);
  });

  it('shows select + bulk actions for unselected card in library', () => {
    const labels = rowLabels(
      buildCardContextMenuRows({
        ...base,
        menuCardIsSelected: false,
        actions: baseActions()
      })
    );
    expect(labels).toEqual([
      'Выбрать карточку',
      'Открыть в новом окне',
      'Добавить в мудборд',
      'Добавить в коллекцию',
      'Отправить в корзину'
    ]);
  });

  it('uses moodboard remove label when all selected are in moodboard', () => {
    const labels = rowLabels(
      buildCardContextMenuRows({
        ...base,
        inMoodboard: true,
        menuCardIsSelected: true,
        actions: baseActions()
      })
    );
    expect(labels[2]).toBe('Убрать из мудборда');
  });

  it('shows trash selection menu with restore and permanent delete', () => {
    const labels = rowLabels(
      buildCardContextMenuRows({
        ...base,
        scope: { kind: 'trash' },
        menuCardIsSelected: true,
        actions: { ...baseActions(), onRestore: vi.fn(), onPermanentDelete: vi.fn() }
      })
    );
    expect(labels).toEqual([
      'Снять выбор с карточки',
      'Восстановить',
      'Удалить навсегда'
    ]);
  });
});

describe('buildCardContextMenuRows — normal mode', () => {
  it('keeps full library menu when selection mode is off', () => {
    const labels = rowLabels(
      buildCardContextMenuRows({
        scope: { kind: 'library' },
        inMoodboard: false,
        hasSourcePath: true,
        selectionModeActive: false,
        onStartMultiSelect: vi.fn(),
        actions: baseActions()
      })
    );
    expect(labels).toContain('Открыть');
    expect(labels).toContain('Открыть в новом окне');
    expect(labels).toContain('Выбрать несколько');
    expect(labels).toContain('Найти похожее');
  });

  it('shows preview frame picker only for video cards', () => {
    const videoLabels = rowLabels(
      buildCardContextMenuRows({
        scope: { kind: 'library' },
        inMoodboard: false,
        hasSourcePath: true,
        cardType: 'video',
        cardFormat: 'mp4',
        selectionModeActive: false,
        actions: { ...baseActions(), onPickPreviewFrame: vi.fn() }
      })
    );
    expect(videoLabels).toContain('Выбрать кадр превью');

    const imageLabels = rowLabels(
      buildCardContextMenuRows({
        scope: { kind: 'library' },
        inMoodboard: false,
        hasSourcePath: true,
        cardType: 'image',
        selectionModeActive: false,
        actions: { ...baseActions(), onPickPreviewFrame: vi.fn() }
      })
    );
    expect(imageLabels).not.toContain('Выбрать кадр превью');

    const gifLabels = rowLabels(
      buildCardContextMenuRows({
        scope: { kind: 'library' },
        inMoodboard: false,
        hasSourcePath: true,
        cardType: 'video',
        cardFormat: 'gif',
        selectionModeActive: false,
        actions: { ...baseActions(), onPickPreviewFrame: vi.fn() }
      })
    );
    expect(gifLabels).not.toContain('Выбрать кадр превью');
  });
});
