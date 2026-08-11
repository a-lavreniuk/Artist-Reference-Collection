import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Тесты идут в node-окружении: локальному хранилищу нужен минимальный стенд. */
const memoryStorage = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (key: string) => memoryStorage.get(key) ?? null,
    setItem: (key: string, value: string) => void memoryStorage.set(key, value),
    removeItem: (key: string) => void memoryStorage.delete(key),
    clear: () => memoryStorage.clear()
  }
};

const storageDeleteTags = vi.fn();
const storageUndoDeleteTags = vi.fn();
const invalidateTagsCache = vi.fn();
const notifyTagsChanged = vi.fn();
const notifyCardsChanged = vi.fn();
const tryAppendLibraryHistory = vi.fn();
const readTagsUnified = vi.fn();
const persistTags = vi.fn();
const resolveBackend = vi.fn();

vi.mock('../storageClient', () => ({
  storageDeleteTags: (...args: unknown[]) => storageDeleteTags(...args),
  storageUndoDeleteTags: (...args: unknown[]) => storageUndoDeleteTags(...args)
}));

vi.mock('./backend', () => ({
  invalidateTagsCache: () => invalidateTagsCache(),
  migrateCategoriesIfNeededLocal: vi.fn(),
  persistCategories: vi.fn(),
  persistTags: (...args: unknown[]) => persistTags(...args),
  readCategoriesUnified: vi.fn(async () => []),
  readTagsUnified: () => readTagsUnified(),
  resolveBackend: () => resolveBackend(),
  STORAGE_KEYS: { cards: 'arc.cards', tags: 'arc.tags' },
  tryAppendLibraryHistory: (...args: unknown[]) => tryAppendLibraryHistory(...args)
}));

vi.mock('./events', () => ({
  notifyCardsChanged: () => notifyCardsChanged(),
  notifyCategoriesChanged: vi.fn(),
  notifyTagsChanged: () => notifyTagsChanged()
}));

const { deleteTags, undoDeleteTags } = await import('./categories');

const tagA = { id: 'a', name: 'Портрет', categoryId: 'cat', sortIndex: 0 };
const tagB = { id: 'b', name: 'Пейзаж', categoryId: 'cat', sortIndex: 1 };
const storageUndo = { removedTags: [tagA], cards: [] };

const localCard = {
  id: 'card-1',
  type: 'image',
  addedAt: '2026-01-01T00:00:00.000Z',
  originalRelativePath: 'media/card-1.png',
  thumbRelativePath: 'media/card-1.png',
  tagIds: ['a', 'b'],
  collectionIds: []
};

function readLocalCards(): Array<{ id: string; tagIds: string[] }> {
  return JSON.parse(memoryStorage.get('arc.cards') ?? '[]');
}

beforeEach(() => {
  vi.clearAllMocks();
  memoryStorage.clear();
  readTagsUnified.mockResolvedValue([tagA, tagB]);
  resolveBackend.mockResolvedValue('file');
  storageDeleteTags.mockResolvedValue(storageUndo);
});

describe('deleteTags с выбранной библиотекой', () => {
  it('убирает дубликаты и неизвестные метки перед удалением', async () => {
    await deleteTags(['a', 'a', 'missing', 'b']);

    expect(storageDeleteTags).toHaveBeenCalledWith(['a', 'b']);
    expect(persistTags).not.toHaveBeenCalled();
  });

  it('возвращает снимок для отмены и обновляет кеш с событиями', async () => {
    const undo = await deleteTags(['a']);

    expect(undo).toBe(storageUndo);
    expect(invalidateTagsCache).toHaveBeenCalledTimes(1);
    expect(notifyTagsChanged).toHaveBeenCalledTimes(1);
    expect(notifyCardsChanged).toHaveBeenCalledTimes(1);
  });

  it('пишет в историю имя метки, когда она одна', async () => {
    await deleteTags(['a']);

    expect(tryAppendLibraryHistory).toHaveBeenCalledWith(
      expect.stringContaining('Удалена метка'),
      expect.anything()
    );
  });

  it('пишет в историю количество, когда меток несколько', async () => {
    await deleteTags(['a', 'b']);

    expect(tryAppendLibraryHistory).toHaveBeenCalledWith('Удалены метки (2)');
  });

  it('отказывается работать с пустым списком', async () => {
    await expect(deleteTags([])).rejects.toThrow('Нет меток для удаления');
    expect(storageDeleteTags).not.toHaveBeenCalled();
  });

  it('отказывается работать, если ни одна метка не найдена', async () => {
    await expect(deleteTags(['missing'])).rejects.toThrow('Метки не найдены');
    expect(storageDeleteTags).not.toHaveBeenCalled();
  });
});

describe('deleteTags без выбранной библиотеки', () => {
  beforeEach(() => {
    resolveBackend.mockResolvedValue('local');
  });

  it('удаляет метки локально, не обращаясь к main', async () => {
    const undo = await deleteTags(['a']);

    expect(storageDeleteTags).not.toHaveBeenCalled();
    expect(persistTags).toHaveBeenCalledWith([tagB]);
    expect(undo).toEqual({ removedTags: [tagA], cards: [], local: true });
  });

  it('возвращает метки на место при отмене', async () => {
    readTagsUnified.mockResolvedValue([tagB]);

    await undoDeleteTags({ removedTags: [tagA], cards: [], local: true });

    expect(storageUndoDeleteTags).not.toHaveBeenCalled();
    expect(persistTags).toHaveBeenCalledWith([tagB, tagA]);
  });

  it('снимает удалённые метки с локальных карточек', async () => {
    memoryStorage.set('arc.cards', JSON.stringify([localCard]));

    const undo = await deleteTags(['a']);

    expect(readLocalCards()[0].tagIds).toEqual(['b']);
    expect(undo.cards).toEqual([{ libraryPath: '', cardId: 'card-1', tagIds: ['a', 'b'] }]);
  });

  it('возвращает метки карточкам при отмене', async () => {
    memoryStorage.set('arc.cards', JSON.stringify([{ ...localCard, tagIds: ['b'] }]));
    readTagsUnified.mockResolvedValue([tagB]);

    await undoDeleteTags({
      removedTags: [tagA],
      cards: [{ libraryPath: '', cardId: 'card-1', tagIds: ['a', 'b'] }],
      local: true
    });

    expect(readLocalCards()[0].tagIds).toEqual(['a', 'b']);
  });

  it('не дублирует метку, если она уже вернулась', async () => {
    readTagsUnified.mockResolvedValue([tagA, tagB]);

    await undoDeleteTags({ removedTags: [tagA], cards: [], local: true });

    expect(persistTags).toHaveBeenCalledWith([tagA, tagB]);
  });
});

describe('undoDeleteTags с выбранной библиотекой', () => {
  it('передаёт снимок в main и обновляет кеш', async () => {
    await undoDeleteTags(storageUndo);

    expect(storageUndoDeleteTags).toHaveBeenCalledWith(storageUndo);
    expect(persistTags).not.toHaveBeenCalled();
    expect(invalidateTagsCache).toHaveBeenCalledTimes(1);
    expect(notifyTagsChanged).toHaveBeenCalledTimes(1);
    expect(notifyCardsChanged).toHaveBeenCalledTimes(1);
  });
});
