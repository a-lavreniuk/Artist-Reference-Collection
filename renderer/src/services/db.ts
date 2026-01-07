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
import { pathJoin } from '../utils/path';

// Кеш результатов поиска с TTL
interface SearchCacheEntry {
  query: string;
  results: Card[];
  timestamp: number;
}

const searchCache = new Map<string, SearchCacheEntry>();
const SEARCH_CACHE_TTL = 5 * 60 * 1000; // 5 минут
const MAX_CACHE_SIZE = 50; // Максимум 50 записей в кеше

/**
 * Очистить устаревшие записи из кеша поиска
 */
function cleanSearchCache(): void {
  const now = Date.now();
  for (const [key, entry] of searchCache.entries()) {
    if (now - entry.timestamp > SEARCH_CACHE_TTL) {
      searchCache.delete(key);
    }
  }
  
  // Если кеш все еще слишком большой, удаляем самые старые записи
  if (searchCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(searchCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toDelete = entries.slice(0, searchCache.size - MAX_CACHE_SIZE);
    toDelete.forEach(([key]) => searchCache.delete(key));
  }
}

/**
 * Инвалидировать кеш поиска (вызывать при изменении карточек/тегов)
 */
export function invalidateSearchCache(): void {
  searchCache.clear();
  console.log('[DB] Кеш поиска очищен');
}

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

    // Версия 4: добавление поля description к карточкам
    this.version(4).stores({
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
      // Автоматическая миграция: существующие карточки получат description: undefined
      // Dexie автоматически обработает это при обновлении схемы
      console.log('[DB] Миграция версии 4: добавлено поле description к карточкам');
    });

    // Версия 5: добавление поля order к категориям
    this.version(5).stores({
      cards: 'id, fileName, type, format, dateAdded, fileSize, *tags, *collections',
      tags: 'id, name, categoryId, dateCreated, cardCount, description',
      categories: 'id, name, dateCreated, *tagIds',
      collections: 'id, name, dateCreated, dateModified, *cardIds',
      moodboard: 'id, dateModified, *cardIds',
      settings: 'id',
      searchHistory: 'id, timestamp, *tagIds',
      viewHistory: 'id, cardId, timestamp',
      thumbnailCache: 'id, cardId, dateGenerated, expiresAt'
    }).upgrade(async (trans) => {
      // Автоматическая миграция: устанавливаем order для существующих категорий
      const categories = await trans.table('categories').toArray();
      for (let i = 0; i < categories.length; i++) {
        await trans.table('categories').update(categories[i].id, { order: i });
      }
      console.log('[DB] Миграция версии 5: добавлено поле order к категориям');
    });

    // Версия 6: исправление сохранения order (убираем из индексов, оставляем как обычное поле)
    this.version(6).stores({
      cards: 'id, fileName, type, format, dateAdded, fileSize, *tags, *collections',
      tags: 'id, name, categoryId, dateCreated, cardCount, description',
      categories: 'id, name, dateCreated, *tagIds',
      collections: 'id, name, dateCreated, dateModified, *cardIds',
      moodboard: 'id, dateModified, *cardIds',
      settings: 'id',
      searchHistory: 'id, timestamp, *tagIds',
      viewHistory: 'id, cardId, timestamp',
      thumbnailCache: 'id, cardId, dateGenerated, expiresAt'
    }).upgrade(async (trans) => {
      // Проверяем, что у всех категорий есть order
      const categories = await trans.table('categories').toArray();
      console.log('[DB] Миграция версии 6: проверка order у категорий');
      for (let i = 0; i < categories.length; i++) {
        if (categories[i].order === undefined) {
          await trans.table('categories').update(categories[i].id, { order: i });
          console.log(`[DB] Установлен order=${i} для категории ${categories[i].name}`);
        }
      }
      console.log('[DB] Миграция версии 6 завершена');
    });
  }
}

// Создание экземпляра базы данных с обработкой ошибок
export const db = new ARCDatabase();

/**
 * Инициализация базы данных с обработкой ошибок
 * Должна быть вызвана при старте приложения
 */
export async function initializeDatabase(): Promise<boolean> {
  try {
    // Пробуем открыть базу данных
    await db.open();
    console.log('[DB] База данных успешно инициализирована');
    return true;
  } catch (error: any) {
    console.error('[DB] Ошибка инициализации базы данных:', error);
    
    // Обработка специфичных ошибок
    if (error.name === 'QuotaExceededError') {
      console.error('[DB] Превышена квота IndexedDB. Необходимо освободить место.');
      alert('Недостаточно места для базы данных. Пожалуйста, очистите кеш браузера или освободите место на диске.');
    } else if (error.name === 'VersionError') {
      console.error('[DB] Ошибка версии базы данных. Попытка пересоздания...');
      // Можно попробовать удалить и пересоздать БД
      try {
        await db.delete();
        await db.open();
        console.log('[DB] База данных успешно пересоздана');
        return true;
      } catch (retryError) {
        console.error('[DB] Не удалось пересоздать базу данных:', retryError);
      }
    } else if (error.name === 'InvalidStateError') {
      console.error('[DB] IndexedDB находится в некорректном состоянии');
    }
    
    return false;
  }
}

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
  (window as any).initializeDatabase = initializeDatabase;
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
  try {
    console.log('[addCard] Добавление карточки:', card.fileName, 'размер:', card.fileSize);
    
    const cardId = await db.cards.add(card);
    console.log('[addCard] Карточка успешно добавлена, ID:', cardId);
    
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
    
    // Инвалидируем кеш поиска
    invalidateSearchCache();
    
    return cardId;
  } catch (error: any) {
    console.error('[addCard] ОШИБКА добавления карточки:', card.fileName, error);
    
    if (error.name === 'QuotaExceededError') {
      throw new Error('Недостаточно места в базе данных. Превышена квота IndexedDB.');
    } else if (error.name === 'ConstraintError') {
      throw new Error('Карточка с таким ID уже существует.');
    } else {
      throw new Error(`Ошибка добавления карточки: ${error.message}`);
    }
  }
}

/**
 * Получить карточку по ID
 */
export async function getCard(id: string): Promise<Card | undefined> {
  return await db.cards.get(id);
}

/**
 * Получить несколько карточек по массиву ID (оптимизированная загрузка)
 */
export async function getCardsByIds(ids: string[]): Promise<Card[]> {
  if (ids.length === 0) {
    return [];
  }
  const cards = await db.cards.bulkGet(ids);
  return cards.filter((card): card is Card => card !== undefined);
}

/**
 * Получить все карточки
 */
export async function getAllCards(): Promise<Card[]> {
  return await db.cards.toArray();
}

/**
 * Получить количество карточек
 */
export async function getCardsCount(): Promise<number> {
  return await db.cards.count();
}

/**
 * Получить количество карточек по типам
 * @returns Объект с количеством изображений и видео
 */
export async function getCardsCountByType(): Promise<{ images: number; videos: number; total: number }> {
  const total = await db.cards.count();
  const images = await db.cards.where('type').equals('image').count();
  const videos = await db.cards.where('type').equals('video').count();
  
  return {
    images,
    videos,
    total
  };
}

/**
 * Получить карточки с пагинацией
 * @param offset - Смещение (сколько пропустить)
 * @param limit - Лимит (сколько вернуть)
 * @param orderBy - Поле для сортировки (по умолчанию dateAdded)
 * @param reverse - Обратный порядок (по умолчанию true - новые сверху)
 */
export async function getCardsPaginated(
  offset: number = 0,
  limit: number = 100,
  orderBy: 'dateAdded' | 'fileName' = 'dateAdded',
  reverse: boolean = true
): Promise<Card[]> {
  try {
    let query = db.cards.orderBy(orderBy);
    
    if (reverse) {
      query = query.reverse();
    }
    
    return await query.offset(offset).limit(limit).toArray();
  } catch (error) {
    console.error('[DB] Ошибка пагинации:', error);
    // Fallback: загружаем все и делаем пагинацию в памяти
    const allCards = await db.cards.toArray();
    const sorted = allCards.sort((a, b) => {
      if (orderBy === 'dateAdded') {
        const aTime = new Date(a.dateAdded).getTime();
        const bTime = new Date(b.dateAdded).getTime();
        return reverse ? bTime - aTime : aTime - bTime;
      } else {
        return reverse 
          ? b.fileName.localeCompare(a.fileName)
          : a.fileName.localeCompare(b.fileName);
      }
    });
    return sorted.slice(offset, offset + limit);
  }
}

/**
 * Обновить карточку
 * Оптимизированная версия с батчингом операций
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
    const oldCard = existingCard;
    const oldTagIds = oldCard.tags || [];
    const newTagIds = changes.tags || [];
    
    // Находим теги для удаления и добавления
    const tagsToDecrement = oldTagIds.filter(tagId => !newTagIds.includes(tagId));
    const tagsToIncrement = newTagIds.filter(tagId => !oldTagIds.includes(tagId));
    
    // Загружаем все нужные теги одним запросом (батчинг)
    const allTagIds = [...new Set([...tagsToDecrement, ...tagsToIncrement])];
    const tags = await db.tags.bulkGet(allTagIds);
    
    // Подготавливаем обновления для батчинга
    const tagUpdates: Array<{ id: string; changes: Partial<Tag> }> = [];
    
    // Уменьшаем счётчик для старых меток
    for (const tag of tags) {
      if (tag && tagsToDecrement.includes(tag.id) && tag.cardCount > 0) {
        tagUpdates.push({
          id: tag.id,
          changes: { cardCount: tag.cardCount - 1 }
        });
      }
    }
    
    // Увеличиваем счётчик для новых меток
    for (const tag of tags) {
      if (tag && tagsToIncrement.includes(tag.id)) {
        tagUpdates.push({
          id: tag.id,
          changes: { cardCount: (tag.cardCount || 0) + 1 }
        });
      }
    }
    
    // Выполняем все обновления тегов батчем через bulkPut
    if (tagUpdates.length > 0) {
      const tagsToUpdate = await db.tags.bulkGet(tagUpdates.map(u => u.id));
      const updatedTags = tagsToUpdate.map((tag, index) => {
        if (tag && tagUpdates[index]) {
          return {
            ...tag,
            ...tagUpdates[index].changes
          };
        }
        return tag;
      }).filter((tag): tag is Tag => tag !== undefined);
      
      await db.tags.bulkPut(updatedTags);
    }
  }
  
  const result = await db.cards.update(id, changes);
  console.log('[updateCard] Результат обновления:', result, result === 0 ? '(ОШИБКА: карточка не обновлена!)' : '(успех)');
  
  // Инвалидируем кеш поиска при изменении карточки
  invalidateSearchCache();
  
  return result;
}

/**
 * Обновить карточку вместе с её привязками к коллекциям
 * Использует одну транзакцию для обновления карточки, счётчиков меток и коллекций
 */
export async function updateCardWithCollections(
  id: string,
  changes: Partial<Card> & { collections?: string[] }
): Promise<void> {
  console.log('[updateCardWithCollections] Старт обновления карточки и коллекций:', id, changes);

  // Загружаем текущую карточку для вычисления дельты коллекций
  const existingCard = await db.cards.get(id);
  if (!existingCard) {
    console.error('[updateCardWithCollections] Карточка не найдена:', id);
    return;
  }

  const oldCollections = existingCard.collections || [];
  const newCollections = changes.collections ?? oldCollections;

  // Вычисляем какие коллекции нужно обновить
  const collectionsToRemove = oldCollections.filter(collId => !newCollections.includes(collId));
  const collectionsToAdd = newCollections.filter(collId => !oldCollections.includes(collId));

  // Если коллекции не менялись, просто используем обычное обновление карточки
  if (collectionsToRemove.length === 0 && collectionsToAdd.length === 0) {
    await updateCard(id, changes);
    return;
  }

  // Одна транзакция для:
  // - обновления карточки (включая счётчики меток)
  // - синхронизации массивов cardIds в коллекциях
  await db.transaction('rw', db.cards, db.collections, db.tags, async () => {
    // 1. Обновляем карточку (в том числе теги и кеш поиска)
    await updateCard(id, changes);

    // 2. Обновляем коллекции
    // Сначала удаляем карточку из старых коллекций
    if (collectionsToRemove.length > 0) {
      const collections = await db.collections.bulkGet(collectionsToRemove);
      for (const collection of collections) {
        if (!collection) continue;
        await updateCollection(collection.id, {
          cardIds: collection.cardIds.filter(cardId => cardId !== id)
        });
      }
    }

    // Затем добавляем карточку в новые коллекции
    if (collectionsToAdd.length > 0) {
      const collections = await db.collections.bulkGet(collectionsToAdd);
      for (const collection of collections) {
        if (!collection) continue;
        const cardIds = collection.cardIds || [];
        // Защита от дубликатов
        if (!cardIds.includes(id)) {
          await updateCollection(collection.id, {
            cardIds: [...cardIds, id]
          });
        }
      }
    }
  });

  console.log('[updateCardWithCollections] Обновление завершено:', id);
}

/**
 * Удалить карточку
 * Удаляет запись из БД + физические файлы (исходник и превью)
 * Использует транзакцию для обеспечения атомарности операций БД
 */
export async function deleteCard(id: string): Promise<void> {
  // Получаем карточку для доступа к путям файлов
  const card = await db.cards.get(id);
  
  if (!card) {
    console.warn('[DB] Карточка не найдена:', id);
    return;
  }

  // Сначала удаляем физические файлы (если это не удастся, БД останется нетронутой)
  const filesToDelete: string[] = [];
  
  if (window.electronAPI?.deleteFile) {
    try {
      // Удаляем исходник
      filesToDelete.push(card.filePath);
      await window.electronAPI.deleteFile(card.filePath);
      console.log('[DB] Удалён исходник:', card.filePath);
      
      // Удаляем превью (извлекаем путь из thumbnailUrl если это не Data URL)
      if (card.thumbnailUrl && !card.thumbnailUrl.startsWith('data:')) {
        filesToDelete.push(card.thumbnailUrl);
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
            // Используем кроссплатформенный pathJoin
            const thumbPath = pathJoin(workingDir, '_cache', 'thumbs', thumbName);
            filesToDelete.push(thumbPath);
            await window.electronAPI.deleteFile(thumbPath);
            console.log('[DB] Удалено превью:', thumbPath);
          }
        }
      }
    } catch (error) {
      console.error('[DB] Ошибка удаления файлов:', error);
      // Продолжаем удаление из БД даже если не удалось удалить файлы
      // В будущем можно добавить механизм очистки orphan файлов
    }
  }
  
  // Используем транзакцию для атомарного обновления БД
  await db.transaction('rw', db.cards, db.tags, db.thumbnailCache, async () => {
    // Уменьшаем счётчик для всех меток карточки
    if (card.tags && card.tags.length > 0) {
      for (const tagId of card.tags) {
        const tag = await db.tags.get(tagId);
        if (tag && tag.cardCount > 0) {
          await db.tags.update(tagId, {
            cardCount: tag.cardCount - 1
          });
        }
      }
    }
    
    // Удаляем запись из БД
    await db.cards.delete(id);
    
    // Также удаляем превью из кеша БД
    await db.thumbnailCache.where('cardId').equals(id).delete();
  });
  
  console.log('[DB] Карточка успешно удалена:', id);
  
  // Инвалидируем кеш поиска
  invalidateSearchCache();
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

/**
 * Получить карточки по меткам (карточка должна иметь ВСЕ указанные метки)
 * Оптимизированная версия для работы с большими коллекциями
 * @param tagIds - Массив ID меток
 * @returns Массив карточек, содержащих все указанные метки
 */
export async function getCardsByTags(tagIds: string[]): Promise<Card[]> {
  if (tagIds.length === 0) {
    return [];
  }

  // Используем индекс для поиска карточек с первой меткой
  // Затем фильтруем по остальным меткам
  const cards = await db.cards
    .where('tags')
    .equals(tagIds[0])
    .toArray();

  // Если нужна только одна метка, возвращаем результат
  if (tagIds.length === 1) {
    return cards;
  }

  // Фильтруем по остальным меткам (карточка должна иметь ВСЕ указанные метки)
  return cards.filter(card =>
    tagIds.every(tagId => card.tags.includes(tagId))
  );
}

/**
 * Получить карточки по типу (изображения или видео)
 * @param type - Тип карточек ('image' или 'video')
 * @returns Массив карточек указанного типа
 */
export async function getCardsByType(type: 'image' | 'video'): Promise<Card[]> {
  return await db.cards
    .where('type')
    .equals(type)
    .reverse()
    .sortBy('dateAdded');
}

// ========== CRUD ОПЕРАЦИИ ДЛЯ МЕТОК ==========

/**
 * Добавить метку
 */
export async function addTag(tag: Tag): Promise<string> {
  const result = await db.tags.add(tag);
  invalidateSearchCache();
  return result;
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
  const result = await db.tags.update(id, changes);
  invalidateSearchCache();
  return result;
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
  
  // Инвалидируем кеш поиска (updateCard уже инвалидирует, но на всякий случай)
  invalidateSearchCache();
}

/**
 * Переместить метку из одной категории в другую
 * Автоматически синхронизирует массивы tagIds в категориях
 * Привязка к карточкам сохраняется (карточки хранят только ID меток)
 */
export async function moveTagToCategory(
  tagId: string, 
  newCategoryId: string
): Promise<void> {
  const tag = await db.tags.get(tagId);
  if (!tag) {
    throw new Error(`Метка с ID ${tagId} не найдена`);
  }

  const newCategory = await db.categories.get(newCategoryId);
  if (!newCategory) {
    throw new Error(`Категория с ID ${newCategoryId} не найдена`);
  }

  const oldCategoryId = tag.categoryId;
  
  // Если метка уже в этой категории, ничего не делаем
  if (oldCategoryId === newCategoryId) {
    return;
  }

  // Используем транзакцию для атомарности
  await db.transaction('rw', db.tags, db.categories, async () => {
    // 1. Обновляем categoryId у метки
    await db.tags.update(tagId, { categoryId: newCategoryId });

    // 2. Удаляем метку из старой категории (если она была)
    if (oldCategoryId) {
      const oldCategory = await db.categories.get(oldCategoryId);
      if (oldCategory) {
        await db.categories.update(oldCategoryId, {
          tagIds: oldCategory.tagIds.filter(id => id !== tagId)
        });
      }
    }

    // 3. Добавляем метку в новую категорию (если её там еще нет)
    if (!newCategory.tagIds.includes(tagId)) {
      await db.categories.update(newCategoryId, {
        tagIds: [...newCategory.tagIds, tagId]
      });
    }
  });
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
  const categories = await db.categories.toArray();
  console.log('[getAllCategories] Загружено категорий:', categories.length);
  console.log('[getAllCategories] Категории с order:', categories.map(c => ({ id: c.id, name: c.name, order: c.order })));
  
  // Сортируем по order, если он есть, иначе по dateCreated
  const sorted = categories.sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order;
    }
    if (a.order !== undefined) return -1;
    if (b.order !== undefined) return 1;
    return a.dateCreated.getTime() - b.dateCreated.getTime();
  });
  
  console.log('[getAllCategories] Отсортированные категории:', sorted.map(c => ({ id: c.id, name: c.name, order: c.order })));
  return sorted;
}

/**
 * Обновить категорию
 */
export async function updateCategory(id: string, changes: Partial<Category>): Promise<number> {
  console.log('[updateCategory] Обновление категории:', id, 'изменения:', changes);
  const result = await db.categories.update(id, changes);
  console.log('[updateCategory] Результат обновления:', result, 'изменено записей');
  
  // Проверяем, что обновление прошло успешно
  if (result === 0) {
    console.warn('[updateCategory] Категория не найдена или не была обновлена:', id);
  } else {
    // Проверяем результат после обновления
    const updated = await db.categories.get(id);
    console.log('[updateCategory] Категория после обновления:', updated);
  }
  
  return result;
}

/**
 * Исправить порядок всех категорий (присвоить уникальные последовательные значения order)
 */
export async function fixCategoriesOrder(): Promise<void> {
  console.log('[fixCategoriesOrder] Начало исправления порядка категорий');
  
  // Получаем все категории в текущем порядке
  const categories = await db.categories.toArray();
  
  // Сортируем по текущему order и dateCreated
  categories.sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      // Если order одинаковый, сортируем по dateCreated
      return a.dateCreated.getTime() - b.dateCreated.getTime();
    }
    if (a.order !== undefined) return -1;
    if (b.order !== undefined) return 1;
    return a.dateCreated.getTime() - b.dateCreated.getTime();
  });
  
  // Присваиваем новые уникальные значения order
  for (let i = 0; i < categories.length; i++) {
    await db.categories.update(categories[i].id, { order: i });
    console.log(`[fixCategoriesOrder] Категория "${categories[i].name}" получила order=${i}`);
  }
  
  console.log('[fixCategoriesOrder] Порядок исправлен для', categories.length, 'категорий');
}

/**
 * Найти файлы в рабочей папке, которые не имеют карточек в базе данных
 * Возвращает список путей к потерянным файлам
 */
export async function findOrphanedFiles(): Promise<string[]> {
  console.log('[findOrphanedFiles] Поиск потерянных файлов...');
  
  // Эта функция должна быть вызвана из main process через IPC
  // Пока возвращаем пустой массив, реализация будет в main process
  return [];
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
 * Использует транзакцию для атомарного удаления коллекции и очистки ссылок в карточках
 */
export async function deleteCollection(id: string): Promise<void> {
  // Используем транзакцию для атомарности
  await db.transaction('rw', db.collections, db.cards, async () => {
    // Получаем все карточки с этой коллекцией ДО удаления
    const cards = await db.cards.where('collections').equals(id).toArray();
    
    // Удаляем ссылки из карточек
    for (const card of cards) {
      await db.cards.update(card.id, {
        collections: card.collections.filter(collId => collId !== id)
      });
    }
    
    // Только после очистки ссылок удаляем саму коллекцию
    await db.collections.delete(id);
  });
  
  console.log('[DB] Коллекция удалена:', id);
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
 * Использует кеширование для оптимизации повторных запросов
 * @param query - Поисковый запрос
 * @returns Массив найденных карточек
 */
export async function searchCardsAdvanced(query: string): Promise<Card[]> {
  // Валидация: минимальная длина запроса
  const trimmedQuery = query?.trim() || '';
  
  if (trimmedQuery.length === 0) {
    console.log('[DB] Пустой поисковый запрос, возвращаем пустой массив');
    return [];
  }
  
  if (trimmedQuery.length < 2) {
    console.log('[DB] Слишком короткий поисковый запрос (минимум 2 символа)');
    return [];
  }

  // Очищаем устаревшие записи из кеша
  cleanSearchCache();

  // Проверяем кеш
  const cacheKey = trimmedQuery.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL) {
    console.log(`[DB] Результаты поиска взяты из кеша для "${query}"`);
    return cached.results;
  }

  const searchLower = trimmedQuery.toLowerCase();
  const searchOriginal = trimmedQuery;
  
  // 1. Поиск по ID (точное совпадение, без учета регистра)
  // Сначала пробуем точное совпадение в нижнем регистре
  let cardById = await db.cards.get(searchLower);
  
  // Если не найдено, пробуем оригинальный запрос (на случай если ID содержит заглавные буквы)
  if (!cardById && searchOriginal !== searchLower) {
    cardById = await db.cards.get(searchOriginal);
  }
  
  // Если не найдено, ищем по части ID (если запрос похож на ID - содержит дефис или длинный)
  // Используем курсор для оптимизации вместо загрузки всех карточек
  if (!cardById && (searchLower.includes('-') || searchLower.length > 10)) {
    const matchingById: Card[] = [];
    // Используем курсор для итерации по карточкам без загрузки всех в память
    await db.cards.each(card => {
      if (card.id.toLowerCase().includes(searchLower) || card.id.includes(searchOriginal)) {
        matchingById.push(card);
      }
      // Ограничиваем результаты для производительности
      if (matchingById.length >= 100) {
        return false; // Останавливаем итерацию
      }
    });
    
    if (matchingById.length > 0) {
      console.log(`[DB] Найдено карточек по части ID "${query}": ${matchingById.length}`);
      return matchingById;
    }
  }
  
  if (cardById) {
    console.log(`[DB] Найдена карточка по ID: ${cardById.id}`);
    return [cardById];
  }

  // 2. Поиск по меткам и категориям (оптимизированный через индексы)
  // Загружаем только теги и категории (намного меньше данных чем все карточки)
  const allTags = await getAllTags();
  const allCategories = await getAllCategories();

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

  // Если нет подходящих меток, возвращаем пустой массив
  if (tagIds.size === 0) {
    console.log(`[DB] Не найдено меток по запросу "${query}"`);
    return [];
  }

  // Используем индекс IndexedDB для поиска карточек с этими метками
  // Это намного быстрее чем загружать все карточки в память
  const tagIdsArray = Array.from(tagIds);
  const results = await db.cards
    .where('tags')
    .anyOf(tagIdsArray)
    .toArray();

  console.log(`[DB] Найдено карточек по запросу "${query}": ${results.length}`);
  
  // Сохраняем результаты в кеш
  searchCache.set(cacheKey, {
    query: trimmedQuery,
    results,
    timestamp: Date.now()
  });
  
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
        // Формируем новый путь кроссплатформенно
        const relativePath = match[1].replace(/[\\/]/g, '/'); // Нормализуем к Unix-стилю
        const pathParts = relativePath.split('/');
        card.filePath = pathJoin(newWorkingDir, ...pathParts);
      }
      
      // Обновляем путь к превью
      if (card.thumbnailUrl && !card.thumbnailUrl.startsWith('data:')) {
        // Извлекаем относительный путь к превью из старого пути
        // Ищем структуру _cache/thumbs/имя_thumb.jpg
        const thumbMatch = card.thumbnailUrl.match(/(_cache[\\/]thumbs[\\/].+)$/);
        if (thumbMatch) {
          // Формируем новый путь кроссплатформенно
          const thumbRelativePath = thumbMatch[1].replace(/[\\/]/g, '/'); // Нормализуем к Unix-стилю
          const thumbParts = thumbRelativePath.split('/');
          card.thumbnailUrl = pathJoin(newWorkingDir, ...thumbParts);
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

