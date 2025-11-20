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
      cards: 'id, fileName, type, format, dateAdded, fileSize, *tags, *collections',
      tags: 'id, name, categoryId, dateCreated, cardCount',
      categories: 'id, name, dateCreated, *tagIds',
      collections: 'id, name, dateCreated, dateModified, *cardIds',
      moodboard: 'id, dateModified, *cardIds',
      settings: 'id',
      searchHistory: 'id, timestamp, *tagIds',
      viewHistory: 'id, cardId, timestamp',
      thumbnailCache: 'id, cardId, dateGenerated, expiresAt'
    });

    // Версия 2: добавление поля description к меткам
    this.version(2).stores({
      cards: 'id, fileName, type, format, dateAdded, fileSize, *tags, *collections',
      tags: 'id, name, categoryId, dateCreated, cardCount, description',
      categories: 'id, name, dateCreated, *tagIds',
      collections: 'id, name, dateCreated, dateModified, *cardIds',
      moodboard: 'id, dateModified, *cardIds',
      settings: 'id',
      searchHistory: 'id, timestamp, *tagIds',
      viewHistory: 'id, cardId, timestamp',
      thumbnailCache: 'id, cardId, dateGenerated, expiresAt'
    }).upgrade(async () => {
      // Автоматическая миграция: существующие метки получат description: undefined
      // Dexie автоматически обработает это при обновлении схемы
      console.log('[DB] Миграция версии 2: добавлено поле description к меткам');
    });

    // Версия 3: удаление поля inMoodboard из карточек (используем только moodboard.cardIds)
    this.version(3).stores({
      cards: 'id, fileName, type, format, dateAdded, fileSize, *tags, *collections',
      tags: 'id, name, categoryId, dateCreated, cardCount, description',
      categories: 'id, name, dateCreated, *tagIds',
      collections: 'id, name, dateCreated, dateModified, *cardIds',
      moodboard: 'id, dateModified, *cardIds',
      settings: 'id',
      searchHistory: 'id, timestamp, *tagIds',
      viewHistory: 'id, cardId, timestamp',
      thumbnailCache: 'id, cardId, dateGenerated, expiresAt'
    }).upgrade(async () => {
      // Автоматическая миграция: поле inMoodboard будет удалено из всех карточек
      // Dexie автоматически обработает это при обновлении схемы
      console.log('[DB] Миграция версии 3: удалено поле inMoodboard из карточек');
    });
  }
}

// Создание экземпляра базы данных
export const db = new ARCDatabase();

/**
 * Диагностика конкретной карточки (для отладки)
 */
export async function debugCard(cardId: string): Promise<void> {
  console.log('\n=== ДИАГНОСТИКА КАРТОЧКИ ===');
  console.log('ID:', cardId);
  
  const card = await db.cards.get(cardId);
  if (!card) {
    console.error('❌ Карточка НЕ НАЙДЕНА в базе данных!');
    return;
  }
  
  console.log('✅ Карточка найдена');
  console.log('FileName:', card.fileName);
  console.log('tags:', card.tags);
  console.log('collections:', card.collections);
  
  const moodboard = await getMoodboard();
  const isInMoodboardArray = moodboard.cardIds.includes(cardId);
  console.log('В массиве мудборда:', isInMoodboardArray);
  
  console.log('=== КОНЕЦ ДИАГНОСТИКИ ===\n');
}

// Делаем функцию доступной глобально для отладки
if (typeof window !== 'undefined') {
  (window as any).debugCard = debugCard;
  (window as any).db = db;
}

/**
 * Проверить находится ли карточка в мудборде
 * Использует только массив moodboard.cardIds (единственный источник истины)
 */
export async function isCardInMoodboard(cardId: string): Promise<boolean> {
  const moodboard = await getMoodboard();
  return moodboard.cardIds.includes(cardId);
}

// ========== CRUD ОПЕРАЦИИ ДЛЯ КАРТОЧЕК ==========

/**
 * Добавить карточку
 */
export async function addCard(card: Card): Promise<string> {
  const cardId = await db.cards.add(card);
  
  // Обновляем счётчик использования для всех меток карточки
  if (card.tags && card.tags.length > 0) {
    for (const tagId of card.tags) {
      const tag = await db.tags.get(tagId);
      if (tag) {
        await db.tags.update(tagId, {
          cardCount: (tag.cardCount || 0) + 1
        });
      }
    }
  }
  
  return cardId;
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
  console.log('[updateCard] Обновление карточки:', id, 'изменения:', changes);
  
  // Проверяем существует ли карточка
  const existingCard = await db.cards.get(id);
  if (!existingCard) {
    console.error('[updateCard] Карточка не найдена:', id);
    return 0;
  }
  
  // Если изменяются метки, обновляем счётчики
  if (changes.tags) {
    const oldCard = await db.cards.get(id);
    if (oldCard && oldCard.tags) {
      // Уменьшаем счётчик для старых меток
      for (const tagId of oldCard.tags) {
        const tag = await db.tags.get(tagId);
        if (tag && tag.cardCount > 0) {
          await db.tags.update(tagId, {
            cardCount: tag.cardCount - 1
          });
        }
      }
      
      // Увеличиваем счётчик для новых меток
      for (const tagId of changes.tags) {
        const tag = await db.tags.get(tagId);
        if (tag) {
          await db.tags.update(tagId, {
            cardCount: (tag.cardCount || 0) + 1
          });
        }
      }
    }
  }
  
  const result = await db.cards.update(id, changes);
  console.log('[updateCard] Результат обновления:', result, result === 0 ? '(ОШИБКА: карточка не обновлена!)' : '(успех)');
  
  return result;
}

/**
 * Удалить карточку
 * Удаляет запись из БД + физические файлы (исходник и превью)
 */
export async function deleteCard(id: string): Promise<void> {
  // Получаем карточку для доступа к путям файлов
  const card = await db.cards.get(id);
  
  if (card) {
    // Уменьшаем счётчик для всех меток карточки
    if (card.tags) {
      for (const tagId of card.tags) {
        const tag = await db.tags.get(tagId);
        if (tag && tag.cardCount > 0) {
          await db.tags.update(tagId, {
            cardCount: tag.cardCount - 1
          });
        }
      }
    }

    // Удаляем физические файлы через Electron API
    if (window.electronAPI?.deleteFile) {
      try {
        // Удаляем исходник
        await window.electronAPI.deleteFile(card.filePath);
        console.log('[DB] Удалён исходник:', card.filePath);
        
        // Удаляем превью (извлекаем путь из thumbnailUrl если это не Data URL)
        if (card.thumbnailUrl && !card.thumbnailUrl.startsWith('data:')) {
          await window.electronAPI.deleteFile(card.thumbnailUrl);
          console.log('[DB] Удалено превью:', card.thumbnailUrl);
        } else {
          // Если thumbnailUrl это Data URL, ищем файл превью по имени
          const fileName = card.filePath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '');
          if (fileName) {
            const thumbName = `${fileName}_thumb.jpg`;
            // Путь к превью: рабочая_папка/_cache/thumbs/имя_thumb.jpg
            const workingDir = await window.electronAPI.getSetting('workingDirectory');
            if (workingDir) {
              // Используем правильные разделители для кроссплатформенности
              const thumbPath = workingDir.replace(/[\/\\]$/, '') + '\\_cache\\thumbs\\' + thumbName;
              await window.electronAPI.deleteFile(thumbPath);
              console.log('[DB] Удалено превью:', thumbPath);
            }
          }
        }
      } catch (error) {
        console.error('[DB] Ошибка удаления файлов:', error);
        // Продолжаем удаление из БД даже если не удалось удалить файлы
      }
    }
  }
  
  // Удаляем запись из БД
  await db.cards.delete(id);
  // Также удаляем превью из кеша БД
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
    const moodboard = await getMoodboard();
    const cards = await query.toArray();
    return cards.filter(card => moodboard.cardIds.includes(card.id) === filters.inMoodboard);
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
  // Получаем метку для доступа к categoryId
  const tag = await db.tags.get(id);
  
  // Удаляем метку из всех карточек
  const allCards = await db.cards.toArray();
  const cardsWithTag = allCards.filter(card => card.tags && card.tags.includes(id));
  
  for (const card of cardsWithTag) {
    await updateCard(card.id, {
      tags: card.tags.filter(tagId => tagId !== id)
    });
  }
  
  // Удаляем метку из массива tagIds категории
  if (tag && tag.categoryId) {
    const category = await db.categories.get(tag.categoryId);
    if (category) {
      await updateCategory(tag.categoryId, {
        tagIds: category.tagIds.filter(tagId => tagId !== id)
      });
    }
  }
  
  // Удаляем саму метку
  await db.tags.delete(id);
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
    // Сохраняем список ID меток перед удалением категории
    const tagIdsToDelete = [...category.tagIds];
    
    // Сначала удаляем саму категорию, чтобы deleteTag не пытался обновить уже удаленную категорию
    await db.categories.delete(id);
    
    // Затем удаляем все метки в категории
    // Теперь deleteTag не будет пытаться обновить категорию (она уже удалена)
    for (const tagId of tagIdsToDelete) {
      // Получаем метку для проверки существования
      const tag = await db.tags.get(tagId);
      if (tag) {
        // Удаляем метку из всех карточек
        const allCards = await db.cards.toArray();
        const cardsWithTag = allCards.filter(card => card.tags && card.tags.includes(tagId));
        
        for (const card of cardsWithTag) {
          await updateCard(card.id, {
            tags: card.tags.filter(t => t !== tagId)
          });
        }
        
        // Удаляем саму метку (без обновления категории, так как она уже удалена)
        await db.tags.delete(tagId);
      }
    }
  } else {
    // Если категория не найдена, все равно пытаемся удалить
    await db.categories.delete(id);
  }
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
  console.log('[addToMoodboard] Начало добавления карточки:', cardId);
  
  const moodboard = await getMoodboard();
  console.log('[addToMoodboard] Текущий мудборд содержит карточек:', moodboard.cardIds.length);
  
  // Добавляем в массив если еще нет
  if (!moodboard.cardIds.includes(cardId)) {
    console.log('[addToMoodboard] Добавляем карточку в массив мудборда');
    
    await db.moodboard.update('default', {
      cardIds: [...moodboard.cardIds, cardId],
      dateModified: new Date()
    });
    console.log('[addToMoodboard] Мудборд обновлен');
  } else {
    console.log('[addToMoodboard] Карточка уже в массиве мудборда');
  }
}

/**
 * Удалить карточку из мудборда
 */
export async function removeFromMoodboard(cardId: string): Promise<void> {
  console.log('[removeFromMoodboard] Начало удаления карточки:', cardId);
  
  const moodboard = await getMoodboard();
  console.log('[removeFromMoodboard] Текущий мудборд содержит карточек:', moodboard.cardIds.length);
  
  // Удаляем из массива
  await db.moodboard.update('default', {
    cardIds: moodboard.cardIds.filter(id => id !== cardId),
    dateModified: new Date()
  });
  console.log('[removeFromMoodboard] Мудборд обновлен');
}

/**
 * Очистить мудборд
 */
export async function clearMoodboard(): Promise<void> {
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
  const moodboard = await getMoodboard();

  return {
    totalCards: cards.length,
    imageCount: imageCards.length,
    videoCount: videoCards.length,
    totalSize,
    collectionCount: collections.length,
    tagCount: tags.length,
    categoryCount: categories.length,
    moodboardCount: moodboard.cardIds.length
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
 * Удаляет старые записи для той же карточки, чтобы избежать дубликатов
 */
export async function addViewHistory(cardId: string): Promise<void> {
  // Удаляем все старые записи для этой карточки
  await db.viewHistory.where('cardId').equals(cardId).delete();
  
  // Добавляем новую запись
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

// ========== ПОИСК КАРТОЧЕК ==========

/**
 * Поиск карточек по меткам, категориям и ID
 * @param query - Поисковый запрос
 * @returns Массив найденных карточек
 */
export async function searchCardsAdvanced(query: string): Promise<Card[]> {
  if (!query || query.trim().length === 0) {
    return await getAllCards();
  }

  const searchLower = query.toLowerCase().trim();
  const searchOriginal = query.trim();
  
  // 1. Поиск по ID (точное совпадение, без учета регистра)
  // Сначала пробуем точное совпадение в нижнем регистре
  let cardById = await db.cards.get(searchLower);
  
  // Если не найдено, пробуем оригинальный запрос (на случай если ID содержит заглавные буквы)
  if (!cardById && searchOriginal !== searchLower) {
    cardById = await db.cards.get(searchOriginal);
  }
  
  // Если не найдено, ищем по части ID (если запрос похож на ID - содержит дефис или длинный)
  if (!cardById && (searchLower.includes('-') || searchLower.length > 10)) {
    const allCards = await getAllCards();
    const matchingById = allCards.filter(card => 
      card.id.toLowerCase().includes(searchLower) || card.id.includes(searchOriginal)
    );
    if (matchingById.length > 0) {
      console.log(`[DB] Найдено карточек по части ID "${query}": ${matchingById.length}`);
      return matchingById;
    }
  }
  
  if (cardById) {
    console.log(`[DB] Найдена карточка по ID: ${cardById.id}`);
    return [cardById];
  }

  // 2. Поиск по меткам и категориям
  const allTags = await getAllTags();
  const allCategories = await getAllCategories();
  const allCards = await getAllCards();

  // Находим метки, соответствующие запросу (по названию или описанию)
  const matchingTags = allTags.filter(tag => {
    const nameMatch = tag.name.toLowerCase().includes(searchLower);
    const descriptionMatch = tag.description?.toLowerCase().includes(searchLower) || false;
    return nameMatch || descriptionMatch;
  });

  // Находим категории, соответствующие запросу
  const matchingCategories = allCategories.filter(cat =>
    cat.name.toLowerCase().includes(searchLower)
  );

  // Собираем ID всех меток (напрямую + через категории)
  const tagIds = new Set<string>();
  matchingTags.forEach(tag => tagIds.add(tag.id));
  matchingCategories.forEach(cat => {
    cat.tagIds.forEach(tagId => tagIds.add(tagId));
  });

  // Находим карточки с этими метками
  const results = allCards.filter(card =>
    card.tags.some(tagId => tagIds.has(tagId))
  );

  console.log(`[DB] Найдено карточек по запросу "${query}": ${results.length}`);
  return results;
}

// ========== ПОХОЖИЕ КАРТОЧКИ ==========

/**
 * Найти похожие карточки по совпадающим меткам
 * @param cardId - ID текущей карточки
 * @param minMatches - Минимальное количество совпадающих меток (по умолчанию 15)
 * @returns Массив похожих карточек, отсортированных по количеству совпадений
 */
export async function getSimilarCards(cardId: string, minMatches: number = 15): Promise<Array<Card & { matchCount: number }>> {
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
      if (card.thumbnailUrl && !card.thumbnailUrl.startsWith('data:')) {
        // Извлекаем относительный путь к превью из старого пути
        // Ищем структуру _cache/thumbs/имя_thumb.jpg
        const thumbMatch = card.thumbnailUrl.match(/(_cache[\\/]thumbs[\\/].+)$/);
        if (thumbMatch) {
          // Формируем новый путь с правильными разделителями
          const thumbRelativePath = thumbMatch[1].replace(/[\\/]/g, '\\');
          card.thumbnailUrl = `${newWorkingDir}\\${thumbRelativePath}`;
        }
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

/**
 * Получить топ самых используемых меток
 * @param limit - Количество меток (по умолчанию 10)
 */
export async function getTopTags(limit: number = 10) {
  const tags = await db.tags
    .orderBy('cardCount')
    .reverse()
    .limit(limit)
    .toArray();
  
  // Дополнительно получаем категории для каждой метки
  const tagsWithCategories = await Promise.all(
    tags.map(async (tag) => {
      const category = tag.categoryId 
        ? await db.categories.get(tag.categoryId)
        : null;
      
      return {
        ...tag,
        categoryName: category?.name || 'Без категории'
      };
    })
  );
  
  return tagsWithCategories;
}

/**
 * Получить самые большие коллекции
 * @param limit - Количество коллекций (по умолчанию 10)
 */
export async function getTopCollections(limit: number = 10) {
  const collections = await db.collections.toArray();
  
  // Сортируем по количеству карточек
  const sortedCollections = collections
    .map(collection => ({
      ...collection,
      cardCount: collection.cardIds?.length || 0
    }))
    .sort((a, b) => b.cardCount - a.cardCount)
    .slice(0, limit);
  
  return sortedCollections;
}

/**
 * Получить малоиспользуемые метки (с 0 или малым числом использований)
 * @param maxUsage - Максимальное количество использований (по умолчанию 3)
 * @param limit - Количество меток (по умолчанию 20)
 */
export async function getUnderusedTags(maxUsage: number = 3, limit: number = 20) {
  const tags = await db.tags
    .where('cardCount')
    .belowOrEqual(maxUsage)
    .sortBy('cardCount');
  
  // Получаем категории для каждой метки
  const tagsWithCategories = await Promise.all(
    tags.slice(0, limit).map(async (tag) => {
      const category = tag.categoryId 
        ? await db.categories.get(tag.categoryId)
        : null;
      
      return {
        ...tag,
        categoryName: category?.name || 'Без категории'
      };
    })
  );
  
  return tagsWithCategories;
}

/**
 * Пересчитать счётчики использования меток
 * Необходимо вызвать один раз для существующих баз данных
 * после обновления логики подсчёта
 */
export async function recalculateTagCounts(): Promise<void> {
  console.log('[DB] Начало пересчёта счётчиков меток...');
  
  // Получаем все метки и карточки
  const allTags = await db.tags.toArray();
  const allCards = await db.cards.toArray();
  
  // Создаём Map для подсчёта
  const tagCountMap = new Map<string, number>();
  
  // Инициализируем все метки с 0
  for (const tag of allTags) {
    tagCountMap.set(tag.id, 0);
  }
  
  // Подсчитываем использование по карточкам
  for (const card of allCards) {
    if (card.tags && card.tags.length > 0) {
      for (const tagId of card.tags) {
        const currentCount = tagCountMap.get(tagId) || 0;
        tagCountMap.set(tagId, currentCount + 1);
      }
    }
  }
  
  // Обновляем счётчики в базе
  for (const [tagId, count] of tagCountMap.entries()) {
    await db.tags.update(tagId, { cardCount: count });
  }
  
  console.log('[DB] Пересчёт завершён. Обновлено меток:', tagCountMap.size);
}

/**
 * Найти метки с несуществующими категориями
 * Возвращает список меток, которые привязаны к несуществующим категориям
 */
export async function findOrphanTags(): Promise<Array<Tag & { categoryExists: boolean; categoryName?: string }>> {
  const allTags = await db.tags.toArray();
  const allCategories = await db.categories.toArray();
  const categoryIds = new Set(allCategories.map(c => c.id));
  
  const orphanTags = allTags.map(tag => {
    const categoryExists = tag.categoryId ? categoryIds.has(tag.categoryId) : false;
    const category = tag.categoryId ? allCategories.find(c => c.id === tag.categoryId) : null;
    
    return {
      ...tag,
      categoryExists,
      categoryName: category?.name
    };
  }).filter(tag => !tag.categoryExists);
  
  return orphanTags;
}

/**
 * Удалить метки с несуществующими категориями
 * Также удаляет эти метки из всех карточек
 */
export async function cleanupOrphanTags(): Promise<{ deleted: number; removedFromCards: number }> {
  const orphanTags = await findOrphanTags();
  let removedFromCards = 0;
  
  // Удаляем метки из всех карточек
  const allCards = await db.cards.toArray();
  for (const orphanTag of orphanTags) {
    for (const card of allCards) {
      if (card.tags && card.tags.includes(orphanTag.id)) {
        await updateCard(card.id, {
          tags: card.tags.filter(tagId => tagId !== orphanTag.id)
        });
        removedFromCards++;
      }
    }
    
    // Удаляем саму метку
    await db.tags.delete(orphanTag.id);
  }
  
  return {
    deleted: orphanTags.length,
    removedFromCards
  };
}

export default db;

