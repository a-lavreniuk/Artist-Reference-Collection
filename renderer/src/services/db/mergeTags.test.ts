import { beforeEach, describe, expect, it, vi } from 'vitest';

const storageMergeTags = vi.fn();
const storageUndoMergeTags = vi.fn();
const invalidateTagsCache = vi.fn();
const notifyTagsChanged = vi.fn();
const notifyCardsChanged = vi.fn();
const tryAppendLibraryHistory = vi.fn();
const readTagsUnified = vi.fn();

vi.mock('../storageClient', () => ({
  storageMergeTags: (...args: unknown[]) => storageMergeTags(...args),
  storageUndoMergeTags: (...args: unknown[]) => storageUndoMergeTags(...args)
}));

vi.mock('./backend', () => ({
  invalidateTagsCache: () => invalidateTagsCache(),
  migrateCategoriesIfNeededLocal: vi.fn(),
  persistCategories: vi.fn(),
  persistTags: vi.fn(),
  readCategoriesUnified: vi.fn(async () => []),
  readTagsUnified: () => readTagsUnified(),
  resolveBackend: vi.fn(async () => 'sqlite'),
  tryAppendLibraryHistory: (...args: unknown[]) => tryAppendLibraryHistory(...args)
}));

vi.mock('./events', () => ({
  notifyCardsChanged: () => notifyCardsChanged(),
  notifyCategoriesChanged: vi.fn(),
  notifyTagsChanged: () => notifyTagsChanged()
}));

const { mergeTags, undoMergeTags } = await import('./categories');

const undoPayload = { sourceTags: [], targetBefore: null, cards: [] };

beforeEach(() => {
  vi.clearAllMocks();
  readTagsUnified.mockResolvedValue([
    { id: 'target', name: 'Портрет', categoryId: 'cat', sortIndex: 0 },
    { id: 'src-1', name: 'портреты', categoryId: 'cat', sortIndex: 1 }
  ]);
  storageMergeTags.mockResolvedValue(undoPayload);
});

describe('mergeTags', () => {
  it('исключает целевую метку и дубликаты из источников', async () => {
    await mergeTags('target', ['src-1', 'src-1', 'target'], { name: 'Портрет' });

    expect(storageMergeTags).toHaveBeenCalledWith(
      expect.objectContaining({ targetTagId: 'target', sourceTagIds: ['src-1'] })
    );
  });

  it('передаёт только заполненные метаданные', async () => {
    await mergeTags('target', ['src-1'], {
      name: '  Портрет  ',
      description: '   ',
      tooltipImageDataUrl: 'https://example.com/a.png'
    });

    expect(storageMergeTags).toHaveBeenCalledWith({
      targetTagId: 'target',
      sourceTagIds: ['src-1'],
      targetMetadata: { name: 'Портрет' }
    });
  });

  it('сохраняет описание и картинку-подсказку, когда они валидны', async () => {
    await mergeTags('target', ['src-1'], {
      name: 'Портрет',
      description: 'Описание',
      tooltipImageDataUrl: 'data:image/png;base64,AAA'
    });

    expect(storageMergeTags).toHaveBeenCalledWith({
      targetTagId: 'target',
      sourceTagIds: ['src-1'],
      targetMetadata: {
        name: 'Портрет',
        description: 'Описание',
        tooltipImage: 'data:image/png;base64,AAA'
      }
    });
  });

  it('сбрасывает кеш, шлёт события и пишет историю', async () => {
    const undo = await mergeTags('target', ['src-1'], { name: 'Портрет' });

    expect(undo).toBe(undoPayload);
    expect(invalidateTagsCache).toHaveBeenCalledTimes(1);
    expect(notifyTagsChanged).toHaveBeenCalledTimes(1);
    expect(notifyCardsChanged).toHaveBeenCalledTimes(1);
    expect(tryAppendLibraryHistory).toHaveBeenCalledTimes(1);
  });

  it('не трогает хранилище, если после фильтрации не осталось источников', async () => {
    await expect(mergeTags('target', ['target'], { name: 'Портрет' })).rejects.toThrow(
      'Нет меток для слияния'
    );
    expect(storageMergeTags).not.toHaveBeenCalled();
  });

  it('падает, если целевая метка не найдена', async () => {
    await expect(mergeTags('missing', ['src-1'], { name: 'Портрет' })).rejects.toThrow(
      'Целевая метка не найдена'
    );
    expect(storageMergeTags).not.toHaveBeenCalled();
  });
});

describe('undoMergeTags', () => {
  it('возвращает состояние и обновляет кеш с событиями', async () => {
    await undoMergeTags(undoPayload as never);

    expect(storageUndoMergeTags).toHaveBeenCalledWith(undoPayload);
    expect(invalidateTagsCache).toHaveBeenCalledTimes(1);
    expect(notifyTagsChanged).toHaveBeenCalledTimes(1);
    expect(notifyCardsChanged).toHaveBeenCalledTimes(1);
  });
});
