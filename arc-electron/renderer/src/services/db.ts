/**
 * Сервис для работы с IndexedDB
 * Использует Dexie.js для упрощения работы с базой данных
 */

import Dexie from 'dexie';
import type { Table } from 'dexie';
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
    const cards = await query.toArray();
    return cards.filter(card => card.inMoodboard === filters.inMoodboard);
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
    await db.moodboard.update('default', {
      cardIds: [...moodboard.cardIds, cardId],
      dateModified: new Date()
    });
    await updateCard(cardId, { inMoodboard: true });
  }
}

/**
 * Удалить карточку из мудборда
 */
export async function removeFromMoodboard(cardId: string): Promise<void> {
  const moodboard = await getMoodboard();
  await db.moodboard.update('default', {
    cardIds: moodboard.cardIds.filter(id => id !== cardId),
    dateModified: new Date()
  });
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
  await db.moodboard.update('default', {
    cardIds: [],
    dateModified: new Date()
  });
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

// ========== ПОХОЖИЕ КАРТОЧКИ ==========

/**
 * Найти похожие карточки по совпадающим меткам
 * @param cardId - ID текущей карточки
 * @param minMatches - Минимальное количество совпадающих меток (по умолчанию 5)
 * @returns Массив похожих карточек, отсортированных по количеству совпадений
 */
export async function getSimilarCards(cardId: string, minMatches: number = 5): Promise<Array<Card & { matchCount: number }>> {
  // Получаем текущую карточку
  const currentCard = await getCard(cardId);
  if (!currentCard || currentCard.tags.length === 0) {
    return [];
  }

  // Получаем все карточки кроме текущей
  const allCards = await db.cards.where('id').notEqual(cardId).toArray();
  
  // Находим карточки с совпадающими метками
  const similarCards = allCards
    .map(card => {
      // Считаем количество совпадающих меток
      const matchCount = card.tags.filter(tagId => currentCard.tags.includes(tagId)).length;
      return {
        ...card,
        matchCount
      };
    })
    .filter(card => card.matchCount >= minMatches) // Минимум N совпадений
    .sort((a, b) => b.matchCount - a.matchCount); // Сортировка по убыванию

  console.log(`[DB] Найдено ${similarCards.length} похожих карточек для ${cardId}`);
  
  return similarCards;
}

// ========== ЭКСПОРТ/ИМПОРТ БАЗЫ ДАННЫХ ==========

/**
 * Экспортировать всю базу данных в JSON
 * Для резервного копирования
 */
export async function exportDatabase(): Promise<string> {
  const data = {
    cards: await db.cards.toArray(),
    tags: await db.tags.toArray(),
    categories: await db.categories.toArray(),
    collections: await db.collections.toArray(),
    moodboard: await db.moodboard.toArray(),
    settings: await db.settings.toArray(),
    searchHistory: await db.searchHistory.toArray(),
    viewHistory: await db.viewHistory.toArray(),
    thumbnailCache: await db.thumbnailCache.toArray(),
    exportDate: new Date().toISOString(),
    version: '1.0'
  };
  
  return JSON.stringify(data, null, 2);
}

/**
 * Импортировать базу данных из JSON
 * Для восстановления из резервной копии
 * @param jsonData - JSON строка с данными
 * @param newWorkingDir - Новая рабочая папка (для обновления путей)
 */
export async function importDatabase(jsonData: string, newWorkingDir?: string): Promise<void> {
  const data = JSON.parse(jsonData);
  
  // Очищаем текущую базу
  await db.cards.clear();
  await db.tags.clear();
  await db.categories.clear();
  await db.collections.clear();
  await db.moodboard.clear();
  await db.settings.clear();
  await db.searchHistory.clear();
  await db.viewHistory.clear();
  await db.thumbnailCache.clear();
  
  // Обновляем пути если указана новая рабочая папка
  if (newWorkingDir && data.cards) {
    for (const card of data.cards) {
      // Извлекаем относительный путь из старого пути
      // Ищем структуру год/месяц/день
      const match = card.filePath.match(/(\d{4}[\\/]\d{2}[\\/]\d{2}[\\/].+)$/);
      if (match) {
        // Формируем новый путь
        card.filePath = newWorkingDir + '\\' + match[1].replace(/\//g, '\\');
      }
      
      // Обновляем путь к превью
      if (card.thumbnailUrl && card.thumbnailUrl.startsWith('data:')) {
        // Data URL не требует обновления
      } else if (card.thumbnailUrl) {
        // Обновляем путь к превью тоже не нужно, так как это Data URL
      }
    }
    
    console.log('[DB] Пути к файлам обновлены для новой рабочей папки');
  }
  
  // Импортируем данные
  if (data.cards) await db.cards.bulkAdd(data.cards);
  if (data.tags) await db.tags.bulkAdd(data.tags);
  if (data.categories) await db.categories.bulkAdd(data.categories);
  if (data.collections) await db.collections.bulkAdd(data.collections);
  if (data.moodboard) await db.moodboard.bulkAdd(data.moodboard);
  if (data.settings) await db.settings.bulkAdd(data.settings);
  if (data.searchHistory) await db.searchHistory.bulkAdd(data.searchHistory);
  if (data.viewHistory) await db.viewHistory.bulkAdd(data.viewHistory);
  if (data.thumbnailCache) await db.thumbnailCache.bulkAdd(data.thumbnailCache);
  
  console.log('[DB] База данных импортирована:', {
    cards: data.cards?.length,
    tags: data.tags?.length,
    collections: data.collections?.length
  });
}

export default db;

