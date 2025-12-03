/**
 * Сервис для поиска дублей изображений
 * Сравнивает изображения по содержимому используя perceptual hash
 */

import type { Card } from '../types';

export interface DuplicatePair {
  card1: Card;
  card2: Card;
  similarity: number; // Процент схожести (0-100)
}

/**
 * Вычисляет perceptual hash изображения
 * Использует упрощенный алгоритм на основе средних значений пикселей
 */
async function calculateImageHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        // Создаем canvas для обработки изображения
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Не удалось получить контекст canvas'));
          return;
        }

        // Уменьшаем изображение до 8x8 для быстрого сравнения
        const size = 8;
        canvas.width = size;
        canvas.height = size;

        // Рисуем уменьшенное изображение
        ctx.drawImage(img, 0, 0, size, size);

        // Получаем данные пикселей
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;

        // Вычисляем среднее значение яркости
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) {
          // Используем формулу для вычисления яркости
          const brightness = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
          sum += brightness;
        }
        const average = sum / (data.length / 4);

        // Создаем битовую строку: 1 если пиксель ярче среднего, 0 если темнее
        let hash = '';
        for (let i = 0; i < data.length; i += 4) {
          const brightness = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
          hash += brightness > average ? '1' : '0';
        }

        resolve(hash);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Не удалось загрузить изображение'));
    };

    // Загружаем изображение через file:// URL
    if (window.electronAPI?.getFileURL) {
      window.electronAPI.getFileURL(filePath)
        .then((dataUrl: string) => {
          img.src = dataUrl;
        })
        .catch(reject);
    } else {
      // Fallback: используем прямой путь
      img.src = filePath;
    }
  });
}

/**
 * Вычисляет расстояние Хэмминга между двумя хэшами
 * Возвращает процент различия (0 = идентичны, 100 = полностью разные)
 */
function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    return 100; // Разная длина = разные изображения
  }

  let differences = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      differences++;
    }
  }

  // Возвращаем процент различия
  return (differences / hash1.length) * 100;
}

/**
 * Вычисляет процент схожести (обратный процент различия)
 */
function calculateSimilarity(hash1: string, hash2: string): number {
  const difference = hammingDistance(hash1, hash2);
  return Math.max(0, 100 - difference);
}

/**
 * Получить список пропущенных пар из localStorage
 */
function getSkippedPairs(): Set<string> {
  try {
    const stored = localStorage.getItem('skippedDuplicatePairs');
    if (stored) {
      const pairs = JSON.parse(stored) as string[];
      return new Set(pairs);
    }
  } catch (error) {
    console.error('[DuplicateService] Ошибка загрузки пропущенных пар:', error);
  }
  return new Set<string>();
}

/**
 * Создать ключ пары карточек (сортированный для консистентности)
 */
function createPairKey(id1: string, id2: string): string {
  // Сортируем ID чтобы ключ был одинаковый независимо от порядка
  return id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;
}

/**
 * Сохранить пропущенную пару в localStorage
 */
export function skipDuplicatePair(id1: string, id2: string): void {
  const skippedPairs = getSkippedPairs();
  const pairKey = createPairKey(id1, id2);
  skippedPairs.add(pairKey);
  
  try {
    localStorage.setItem('skippedDuplicatePairs', JSON.stringify(Array.from(skippedPairs)));
    console.log('[DuplicateService] Пара пропущена:', pairKey);
  } catch (error) {
    console.error('[DuplicateService] Ошибка сохранения пропущенной пары:', error);
  }
}

/**
 * Очистить список пропущенных пар
 */
export function clearSkippedPairs(): void {
  try {
    localStorage.removeItem('skippedDuplicatePairs');
    console.log('[DuplicateService] Список пропущенных пар очищен');
  } catch (error) {
    console.error('[DuplicateService] Ошибка очистки пропущенных пар:', error);
  }
}

/**
 * Находит дубликаты среди карточек
 * Порог схожести: 90% (можно настроить)
 * 
 * ПРИНЦИП ОПРЕДЕЛЕНИЯ ПОХОЖЕСТИ:
 * 1. Изображение уменьшается до 8×8 пикселей (64 пикселя)
 * 2. Вычисляется средняя яркость всех пикселей
 * 3. Для каждого пикселя создается бит: 1 если ярче среднего, 0 если темнее
 * 4. Получается 64-битный хэш (perceptual hash)
 * 5. Хэши двух изображений сравниваются побитово (расстояние Хэмминга)
 * 6. Схожесть = 100% - процент различающихся битов
 * 
 * Этот метод позволяет находить визуально похожие изображения, даже если они:
 * - Разного разрешения
 * - Немного отличаются по яркости/контрасту
 * - Обрезаны или повернуты незначительно
 */
export async function findDuplicates(
  cards: Card[],
  similarityThreshold: number = 90
): Promise<DuplicatePair[]> {
  if (cards.length < 2) {
    return [];
  }

  const duplicates: DuplicatePair[] = [];
  const processedPairs = new Set<string>();
  const skippedPairs = getSkippedPairs();

  // Вычисляем хэши для всех изображений
  console.log('[DuplicateService] Вычисление хэшей для', cards.length, 'изображений...');
  const hashMap = new Map<string, string>();

  for (const card of cards) {
    try {
      const hash = await calculateImageHash(card.filePath);
      hashMap.set(card.id, hash);
    } catch (error) {
      console.warn(`[DuplicateService] Не удалось вычислить хэш для ${card.fileName}:`, error);
    }
  }

  console.log('[DuplicateService] Хэши вычислены, поиск дублей...');
  console.log('[DuplicateService] Пропущенных пар:', skippedPairs.size);

  // Сравниваем все пары изображений
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const card1 = cards[i];
      const card2 = cards[j];

      // Создаем ключ пары
      const pairKey = createPairKey(card1.id, card2.id);

      // Пропускаем если уже обработали эту пару или она была пропущена пользователем
      if (processedPairs.has(pairKey) || skippedPairs.has(pairKey)) {
        continue;
      }

      const hash1 = hashMap.get(card1.id);
      const hash2 = hashMap.get(card2.id);

      if (!hash1 || !hash2) {
        continue; // Пропускаем если не удалось вычислить хэш
      }

      const similarity = calculateSimilarity(hash1, hash2);

      if (similarity >= similarityThreshold) {
        duplicates.push({
          card1,
          card2,
          similarity: Math.round(similarity)
        });
        processedPairs.add(pairKey);
        console.log(`[DuplicateService] Найден дубль: ${card1.fileName} и ${card2.fileName} (${similarity.toFixed(1)}%)`);
      }
    }
  }

  console.log(`[DuplicateService] Найдено дублей: ${duplicates.length}`);
  return duplicates;
}

