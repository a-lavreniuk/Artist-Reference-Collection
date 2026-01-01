/**
 * Утилита для кеширования изображений в памяти
 * Использует ImageBitmap API для эффективного хранения
 * LRU стратегия для управления размером кеша
 */

interface CacheEntry {
  bitmap: ImageBitmap;
  timestamp: number;
  url: string;
}

class ImageCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number = 100; // Максимум 100 изображений в кеше
  private accessOrder: string[] = []; // Порядок доступа для LRU

  /**
   * Получить изображение из кеша или загрузить и закешировать
   */
  async getImage(url: string): Promise<ImageBitmap | null> {
    // Проверяем кеш
    const cached = this.cache.get(url);
    if (cached) {
      // Обновляем порядок доступа (LRU)
      this.updateAccessOrder(url);
      return cached.bitmap;
    }

    // Загружаем изображение
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }

      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);

      // Добавляем в кеш
      this.addToCache(url, bitmap);

      return bitmap;
    } catch (error) {
      console.error('[ImageCache] Ошибка загрузки изображения:', error);
      return null;
    }
  }

  /**
   * Добавить изображение в кеш
   */
  private addToCache(url: string, bitmap: ImageBitmap): void {
    // Если кеш переполнен, удаляем самое старое изображение
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(url, {
      bitmap,
      timestamp: Date.now(),
      url
    });

    this.updateAccessOrder(url);
  }

  /**
   * Обновить порядок доступа (LRU)
   */
  private updateAccessOrder(url: string): void {
    // Удаляем из текущей позиции
    const index = this.accessOrder.indexOf(url);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }

    // Добавляем в конец (самое недавно использованное)
    this.accessOrder.push(url);
  }

  /**
   * Удалить самое старое изображение из кеша
   */
  private evictOldest(): void {
    if (this.accessOrder.length === 0) {
      return;
    }

    // Удаляем самое старое (первое в порядке доступа)
    const oldestUrl = this.accessOrder.shift();
    if (oldestUrl) {
      const entry = this.cache.get(oldestUrl);
      if (entry) {
        entry.bitmap.close(); // Освобождаем память
        this.cache.delete(oldestUrl);
      }
    }
  }

  /**
   * Очистить весь кеш
   */
  clear(): void {
    // Закрываем все ImageBitmap для освобождения памяти
    for (const entry of this.cache.values()) {
      entry.bitmap.close();
    }

    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Получить размер кеша
   */
  getSize(): number {
    return this.cache.size;
  }

  /**
   * Установить максимальный размер кеша
   */
  setMaxSize(size: number): void {
    this.maxSize = size;

    // Удаляем лишние элементы если нужно
    while (this.cache.size > this.maxSize) {
      this.evictOldest();
    }
  }
}

// Экспортируем singleton экземпляр
export const imageCache = new ImageCache();

