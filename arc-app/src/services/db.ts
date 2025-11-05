/**
 * Сервис для работы с IndexedDB
 * Использует Dexie.js для упрощения работы с базой данных
 */

import Dexie, { Table } from 'dexie';
import type {
  Card,
  Tag,
  Category,
  Collection,
  Moodboard,
  AppSettings,
  SearchHistory,
  ViewHistory,
  ThumbnailCache,
  AppStatistics
} from '../types';

/**
 * Класс базы данных ARC
 */
export class ARCDatabase extends Dexie {
  // Таблицы
  cards!: Table<Card, string>;
  tags!: Table<Tag, string>;
  categories!: Table<Category, string>;
  collections!: Table<Collection, string>;
  moodboard!: Table<Moodboard, string>;
  settings!: Table<AppSettings, string>;
  searchHistory!: Table<SearchHistory, string>;
  viewHistory!: Table<ViewHistory, string>;
  thumbnailCache!: Table<ThumbnailCache, string>;

  constructor() {
    super('ARC_Database');

    // Определение схемы базы данных
    this.version(1).stores({
      cards: 'id, fileName, type, format, dateAdded, fileSize, *tags, *collections, inMoodboard',
      tags: 'id, name, categoryId, dateCreated, cardCount',
      categories: 'id, name, dateCreated, *tagIds',
      collections: 'id, name, dateCreated, dateModified, *cardIds',
      moodboard: 'id, dateModified, *cardIds',
      settings: 'id',
      searchHistory: 'id, timestamp, *tagIds',
      viewHistory: 'id, cardId, timestamp',
      thumbnailCache: 'id, cardId, dateGenerated, expiresAt'
    });
  }
}

// Создание экземпляра базы данных
export const db = new ARCDatabase();

// ========== CRUD ОПЕРАЦИИ ДЛЯ КАРТОЧЕК ==========

/**
 * Добавить карточку
 */
export async function addCard(card: Card): Promise<string> {
  return await db.cards.add(card);
}

/**
 * Получить карточку по ID
 */
export async function getCard(id: string): Promise<Card | undefined> {
  return await db.cards.get(id);
}

/**
 * Получить все карточки
 */
export async function getAllCards(): Promise<Card[]> {
  return await db.cards.toArray();
}

/**
 * Обновить карточку
 */
export async function updateCard(id: string, changes: Partial<Card>): Promise<number> {
  return await db.cards.update(id, changes);
}

/**
 * Удалить карточку
 */
export async function deleteCard(id: string): Promise<void> {
  await db.cards.delete(id);
  // Также удаляем превью из кеша
  await db.thumbnailCache.where('cardId').equals(id).delete();
}

/**
 * Поиск карточек по фильтрам
 */
export async function searchCards(filters: {
  type?: 'image' | 'video';
  tags?: string[];
  inMoodboard?: boolean;
  searchQuery?: string;
}): Promise<Card[]> {
  let query = db.cards.toCollection();

  // Фильтр по типу
  if (filters.type) {
    query = db.cards.where('type').equals(filters.type);
  }

  // Фильтр по меткам (карточка должна иметь ВСЕ указанные метки)
  if (filters.tags && filters.tags.length > 0) {
    const cards = await query.toArray();
    return cards.filter(card =>
      filters.tags!.every(tagId => card.tags.includes(tagId))
    );
  }

  // Фильтр по мудборду
  if (filters.inMoodboard !== undefined) {
    query = db.cards.where('inMoodboard').equals(filters.inMoodboard);
  }

  return await query.toArray();
}

// ========== CRUD ОПЕРАЦИИ ДЛЯ МЕТОК ==========

/**
 * Добавить метку
 */
export async function addTag(tag: Tag): Promise<string> {
  return await db.tags.add(tag);
}

/**
 * Получить все метки
 */
export async function getAllTags(): Promise<Tag[]> {
  return await db.tags.toArray();
}

/**
 * Обновить метку
 */
export async function updateTag(id: string, changes: Partial<Tag>): Promise<number> {
  return await db.tags.update(id, changes);
}

/**
 * Удалить метку
 */
export async function deleteTag(id: string): Promise<void> {
  await db.tags.delete(id);
  // Удаляем метку из всех карточек
  const cards = await db.cards.where('tags').equals(id).toArray();
  for (const card of cards) {
    await updateCard(card.id, {
      tags: card.tags.filter(tagId => tagId !== id)
    });
  }
}

// ========== CRUD ОПЕРАЦИИ ДЛЯ КАТЕГОРИЙ ==========

/**
 * Добавить категорию
 */
export async function addCategory(category: Category): Promise<string> {
  return await db.categories.add(category);
}

/**
 * Получить все категории
 */
export async function getAllCategories(): Promise<Category[]> {
  return await db.categories.toArray();
}

/**
 * Обновить категорию
 */
export async function updateCategory(id: string, changes: Partial<Category>): Promise<number> {
  return await db.categories.update(id, changes);
}

/**
 * Удалить категорию
 */
export async function deleteCategory(id: string): Promise<void> {
  const category = await db.categories.get(id);
  if (category) {
    // Удаляем все метки в категории
    for (const tagId of category.tagIds) {
      await deleteTag(tagId);
    }
  }
  await db.categories.delete(id);
}

// ========== CRUD ОПЕРАЦИИ ДЛЯ КОЛЛЕКЦИЙ ==========

/**
 * Добавить коллекцию
 */
export async function addCollection(collection: Collection): Promise<string> {
  return await db.collections.add(collection);
}

/**
 * Получить все коллекции
 */
export async function getAllCollections(): Promise<Collection[]> {
  return await db.collections.toArray();
}

/**
 * Получить коллекцию по ID
 */
export async function getCollection(id: string): Promise<Collection | undefined> {
  return await db.collections.get(id);
}

/**
 * Обновить коллекцию
 */
export async function updateCollection(id: string, changes: Partial<Collection>): Promise<number> {
  return await db.collections.update(id, {
    ...changes,
    dateModified: new Date()
  });
}

/**
 * Удалить коллекцию
 */
export async function deleteCollection(id: string): Promise<void> {
  await db.collections.delete(id);
  // Удаляем ссылки из карточек
  const cards = await db.cards.where('collections').equals(id).toArray();
  for (const card of cards) {
    await updateCard(card.id, {
      collections: card.collections.filter(collId => collId !== id)
    });
  }
}

// ========== ОПЕРАЦИИ С МУДБОРДОМ ==========

/**
 * Получить мудборд
 */
export async function getMoodboard(): Promise<Moodboard> {
  let moodboard = await db.moodboard.get('default');
  if (!moodboard) {
    // Создаем мудборд если его нет
    moodboard = {
      id: 'default',
      cardIds: [],
      dateModified: new Date()
    };
    await db.moodboard.add(moodboard);
  }
  return moodboard;
}

/**
 * Добавить карточку в мудборд
 */
export async function addToMoodboard(cardId: string): Promise<void> {
  const moodboard = await getMoodboard();
  if (!moodboard.cardIds.includes(cardId)) {
    moodboard.cardIds.push(cardId);
    moodboard.dateModified = new Date();
    await db.moodboard.update('default', moodboard);
    await updateCard(cardId, { inMoodboard: true });
  }
}

/**
 * Удалить карточку из мудборда
 */
export async function removeFromMoodboard(cardId: string): Promise<void> {
  const moodboard = await getMoodboard();
  moodboard.cardIds = moodboard.cardIds.filter(id => id !== cardId);
  moodboard.dateModified = new Date();
  await db.moodboard.update('default', moodboard);
  await updateCard(cardId, { inMoodboard: false });
}

/**
 * Очистить мудборд
 */
export async function clearMoodboard(): Promise<void> {
  const moodboard = await getMoodboard();
  // Обновляем все карточки
  for (const cardId of moodboard.cardIds) {
    await updateCard(cardId, { inMoodboard: false });
  }
  moodboard.cardIds = [];
  moodboard.dateModified = new Date();
  await db.moodboard.update('default', moodboard);
}

// ========== СТАТИСТИКА ==========

/**
 * Получить статистику приложения
 */
export async function getStatistics(): Promise<AppStatistics> {
  const cards = await getAllCards();
  const tags = await getAllTags();
  const categories = await getAllCategories();
  const collections = await getAllCollections();

  const imageCards = cards.filter(c => c.type === 'image');
  const videoCards = cards.filter(c => c.type === 'video');
  const totalSize = cards.reduce((sum, card) => sum + card.fileSize, 0);

  return {
    totalCards: cards.length,
    imageCount: imageCards.length,
    videoCount: videoCards.length,
    totalSize,
    collectionCount: collections.length,
    tagCount: tags.length,
    categoryCount: categories.length
  };
}

// ========== ИСТОРИЯ ==========

/**
 * Добавить запись в историю поиска
 */
export async function addSearchHistory(query: string, tagIds: string[]): Promise<void> {
  const history: SearchHistory = {
    id: `search_${Date.now()}`,
    query,
    tagIds,
    timestamp: new Date()
  };
  await db.searchHistory.add(history);

  // Ограничиваем историю последними 15 записями
  const allHistory = await db.searchHistory.orderBy('timestamp').reverse().toArray();
  if (allHistory.length > 15) {
    const toDelete = allHistory.slice(15);
    for (const item of toDelete) {
      await db.searchHistory.delete(item.id);
    }
  }
}

/**
 * Добавить запись в историю просмотров
 */
export async function addViewHistory(cardId: string): Promise<void> {
  const history: ViewHistory = {
    id: `view_${Date.now()}`,
    cardId,
    timestamp: new Date()
  };
  await db.viewHistory.add(history);

  // Ограничиваем историю последними 15 записями
  const allHistory = await db.viewHistory.orderBy('timestamp').reverse().toArray();
  if (allHistory.length > 15) {
    const toDelete = allHistory.slice(15);
    for (const item of toDelete) {
      await db.viewHistory.delete(item.id);
    }
  }
}

/**
 * Получить историю поиска
 */
export async function getSearchHistory(): Promise<SearchHistory[]> {
  return await db.searchHistory.orderBy('timestamp').reverse().limit(15).toArray();
}

/**
 * Получить историю просмотров
 */
export async function getViewHistory(): Promise<ViewHistory[]> {
  return await db.viewHistory.orderBy('timestamp').reverse().limit(15).toArray();
}

export default db;

