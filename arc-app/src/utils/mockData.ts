/**
 * Утилита для генерации тестовых данных
 * Помогает протестировать галерею и функционал без реальных файлов
 */

import type { Card, Tag, Category, Collection } from '../types';
import { addCard, addTag, addCategory, addCollection } from '../services/db';

/**
 * Генерация уникального ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Генерация случайного изображения через Unsplash
 */
function generateMockImageUrl(width: number, height: number, index: number): string {
  const topics = ['design', 'nature', 'architecture', 'art', 'technology', 'fashion', 'food', 'travel'];
  const topic = topics[index % topics.length];
  return `https://source.unsplash.com/random/${width}x${height}/?${topic},${index}`;
}

/**
 * Генерация случайного размера изображения
 */
function generateRandomDimensions(): { width: number; height: number } {
  const ratios = [
    { width: 800, height: 600 },   // 4:3
    { width: 1000, height: 667 },  // 3:2
    { width: 800, height: 1200 },  // 2:3 (портрет)
    { width: 1200, height: 800 },  // 3:2 (ландшафт)
    { width: 1080, height: 1080 }, // 1:1 (квадрат)
    { width: 1920, height: 1080 }, // 16:9
    { width: 1080, height: 1920 }, // 9:16 (вертикальный)
  ];
  
  return ratios[Math.floor(Math.random() * ratios.length)];
}

/**
 * Генерация тестовых категорий
 */
export async function generateMockCategories(): Promise<Category[]> {
  const categories: Category[] = [
    {
      id: generateId(),
      name: 'Стиль',
      color: '#F48683',
      dateCreated: new Date(),
      tagIds: []
    },
    {
      id: generateId(),
      name: 'Цвет',
      color: '#7ED6A8',
      dateCreated: new Date(),
      tagIds: []
    },
    {
      id: generateId(),
      name: 'Тип',
      color: '#F2D98D',
      dateCreated: new Date(),
      tagIds: []
    },
    {
      id: generateId(),
      name: 'Тема',
      color: '#93919A',
      dateCreated: new Date(),
      tagIds: []
    }
  ];

  for (const category of categories) {
    await addCategory(category);
  }

  return categories;
}

/**
 * Генерация тестовых меток
 */
export async function generateMockTags(categories: Category[]): Promise<Tag[]> {
  const tagsByCategory = {
    'Стиль': ['Минимализм', 'Модерн', 'Винтаж', 'Индастриал', 'Скандинавский'],
    'Цвет': ['Монохром', 'Пастель', 'Яркие', 'Тёмные', 'Нейтральные'],
    'Тип': ['Интерьер', 'Архитектура', 'Графика', 'Иллюстрация', 'Фотография'],
    'Тема': ['Природа', 'Город', 'Люди', 'Абстракция', 'Еда']
  };

  const tags: Tag[] = [];

  for (const category of categories) {
    const tagNames = tagsByCategory[category.name as keyof typeof tagsByCategory] || [];
    
    for (const tagName of tagNames) {
      const tag: Tag = {
        id: generateId(),
        name: tagName,
        categoryId: category.id,
        color: category.color,
        dateCreated: new Date(),
        cardCount: 0
      };
      
      await addTag(tag);
      tags.push(tag);
      
      // Добавляем ID метки в категорию
      category.tagIds.push(tag.id);
    }
  }

  return tags;
}

/**
 * Генерация тестовых карточек
 */
export async function generateMockCards(tags: Tag[], count: number = 50): Promise<Card[]> {
  const cards: Card[] = [];
  const imageFormats = ['jpg', 'png', 'webp'] as const;

  for (let i = 0; i < count; i++) {
    const dimensions = generateRandomDimensions();
    const format = imageFormats[Math.floor(Math.random() * imageFormats.length)];
    
    // Случайно выбираем 1-3 метки
    const cardTags: string[] = [];
    const tagCount = Math.floor(Math.random() * 3) + 1;
    for (let j = 0; j < tagCount; j++) {
      const randomTag = tags[Math.floor(Math.random() * tags.length)];
      if (!cardTags.includes(randomTag.id)) {
        cardTags.push(randomTag.id);
      }
    }

    const card: Card = {
      id: generateId(),
      fileName: `reference_${i + 1}.${format}`,
      filePath: `/mock/images/reference_${i + 1}.${format}`,
      type: 'image',
      format,
      dateAdded: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Последние 30 дней
      dateModified: new Date(),
      fileSize: Math.floor(Math.random() * 5000000) + 500000, // 500KB - 5MB
      width: dimensions.width,
      height: dimensions.height,
      thumbnailUrl: generateMockImageUrl(dimensions.width, dimensions.height, i),
      tags: cardTags,
      collections: [],
      inMoodboard: Math.random() > 0.8 // 20% шанс быть в мудборде
    };

    await addCard(card);
    cards.push(card);
    
    // Обновляем счётчики меток
    for (const tagId of cardTags) {
      const tag = tags.find(t => t.id === tagId);
      if (tag) {
        tag.cardCount++;
      }
    }
  }

  return cards;
}

/**
 * Генерация тестовых коллекций
 */
export async function generateMockCollections(cards: Card[]): Promise<Collection[]> {
  const collections: Collection[] = [
    {
      id: generateId(),
      name: 'Дизайн интерьеров',
      description: 'Референсы для проектов интерьеров',
      dateCreated: new Date(),
      dateModified: new Date(),
      cardIds: cards.slice(0, 12).map(c => c.id),
      thumbnails: cards.slice(0, 4).map(c => c.thumbnailUrl || '')
    },
    {
      id: generateId(),
      name: 'Цветовые палитры',
      description: 'Интересные цветовые сочетания',
      dateCreated: new Date(),
      dateModified: new Date(),
      cardIds: cards.slice(12, 24).map(c => c.id),
      thumbnails: cards.slice(12, 16).map(c => c.thumbnailUrl || '')
    },
    {
      id: generateId(),
      name: 'Типографика',
      description: 'Примеры работы со шрифтами',
      dateCreated: new Date(),
      dateModified: new Date(),
      cardIds: cards.slice(24, 36).map(c => c.id),
      thumbnails: cards.slice(24, 28).map(c => c.thumbnailUrl || '')
    }
  ];

  for (const collection of collections) {
    await addCollection(collection);
    
    // Добавляем ID коллекции в карточки
    for (const cardId of collection.cardIds) {
      const card = cards.find(c => c.id === cardId);
      if (card && !card.collections.includes(collection.id)) {
        card.collections.push(collection.id);
      }
    }
  }

  return collections;
}

/**
 * Инициализация всех тестовых данных
 */
export async function initializeMockData(cardCount: number = 50): Promise<void> {
  try {
    console.log('🎨 Генерация тестовых данных...');
    
    // 1. Создаём категории
    console.log('📁 Создание категорий...');
    const categories = await generateMockCategories();
    console.log(`✅ Создано ${categories.length} категорий`);
    
    // 2. Создаём метки
    console.log('🏷️ Создание меток...');
    const tags = await generateMockTags(categories);
    console.log(`✅ Создано ${tags.length} меток`);
    
    // 3. Создаём карточки
    console.log('🖼️ Создание карточек...');
    const cards = await generateMockCards(tags, cardCount);
    console.log(`✅ Создано ${cards.length} карточек`);
    
    // 4. Создаём коллекции
    console.log('📚 Создание коллекций...');
    const collections = await generateMockCollections(cards);
    console.log(`✅ Создано ${collections.length} коллекций`);
    
    console.log('🎉 Тестовые данные успешно созданы!');
    console.log(`
📊 Статистика:
- Категорий: ${categories.length}
- Меток: ${tags.length}
- Карточек: ${cards.length}
- Коллекций: ${collections.length}
- В мудборде: ${cards.filter(c => c.inMoodboard).length}
    `);
  } catch (error) {
    console.error('❌ Ошибка генерации тестовых данных:', error);
    throw error;
  }
}

export default {
  generateMockCategories,
  generateMockTags,
  generateMockCards,
  generateMockCollections,
  initializeMockData
};

