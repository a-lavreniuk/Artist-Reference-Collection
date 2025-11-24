/**
 * Утилита для парсинга и обработки URL в тексте
 */

/**
 * Интерфейс для части текста (обычный текст или ссылка)
 */
export interface TextPart {
  type: 'text' | 'link';
  content: string;
  url?: string;
}

/**
 * Регулярное выражение для поиска URL
 * Находит http:// и https:// ссылки
 */
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

/**
 * Парсит текст и находит все URL
 * @param text - Текст для парсинга
 * @returns Массив частей текста (обычный текст и ссылки)
 */
export function parseLinks(text: string): TextPart[] {
  if (!text) return [];

  const parts: TextPart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Сбрасываем lastIndex для нового поиска
  URL_REGEX.lastIndex = 0;

  while ((match = URL_REGEX.exec(text)) !== null) {
    // Добавляем текст до ссылки
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex, match.index)
      });
    }

    // Добавляем ссылку
    const url = match[0];
    parts.push({
      type: 'link',
      content: url,
      url: url
    });

    lastIndex = match.index + url.length;
  }

  // Добавляем оставшийся текст после последней ссылки
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.substring(lastIndex)
    });
  }

  // Если ссылок не найдено, возвращаем весь текст как обычный
  if (parts.length === 0) {
    parts.push({
      type: 'text',
      content: text
    });
  }

  return parts;
}

/**
 * Обрезает URL до разумной длины для отображения
 * @param url - URL для обрезки
 * @param maxLength - Максимальная длина (по умолчанию 50)
 * @returns Обрезанный URL с "..."
 */
export function truncateUrl(url: string, maxLength: number = 50): string {
  if (url.length <= maxLength) {
    return url;
  }

  // Пытаемся сохранить начало URL (протокол и домен)
  try {
    const urlObj = new URL(url);
    const domain = urlObj.origin;
    
    if (domain.length + 10 >= maxLength) {
      // Если домен слишком длинный, просто обрезаем
      return url.substring(0, maxLength - 3) + '...';
    }

    // Сохраняем домен и обрезаем путь
    const path = urlObj.pathname + urlObj.search;
    const availableLength = maxLength - domain.length - 3; // 3 для "..."
    
    if (path.length <= availableLength) {
      return url;
    }

    return domain + path.substring(0, availableLength) + '...';
  } catch {
    // Если не удалось распарсить URL, просто обрезаем
    return url.substring(0, maxLength - 3) + '...';
  }
}

/**
 * Извлекает домен из URL для отображения
 * @param url - URL
 * @returns Домен или обрезанный URL
 */
export function getUrlDisplayText(url: string): string {
  try {
    const urlObj = new URL(url);
    // Пытаемся использовать hostname без www
    let hostname = urlObj.hostname.replace(/^www\./, '');
    
    // Если есть путь, добавляем его (но обрезаем если слишком длинный)
    const path = urlObj.pathname;
    if (path && path !== '/') {
      const shortPath = path.length > 30 ? path.substring(0, 30) + '...' : path;
      return hostname + shortPath;
    }
    
    return hostname;
  } catch {
    // Если не удалось распарсить, обрезаем URL
    return truncateUrl(url, 50);
  }
}

