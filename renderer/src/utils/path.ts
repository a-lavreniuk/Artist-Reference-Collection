/**
 * Утилиты для работы с путями в renderer процессе
 * Кроссплатформенная альтернатива Node.js path модулю
 */

/**
 * Соединить части пути в один путь
 * Работает кроссплатформенно (Windows/Unix)
 */
export function pathJoin(...parts: string[]): string {
  // Определяем разделитель пути на основе первого элемента
  const isWindows = parts.length > 0 && parts[0].includes('\\');
  const separator = isWindows ? '\\' : '/';
  
  // Фильтруем пустые части и соединяем
  const joined = parts
    .filter(part => part && part.length > 0)
    .join(separator);
  
  // Нормализуем путь (удаляем двойные разделители)
  const normalized = joined
    .replace(/[\/\\]+/g, separator)
    .replace(/[\/\\]$/, ''); // Удаляем конечный разделитель
  
  return normalized;
}

/**
 * Нормализовать путь (заменить разделители на системные)
 */
export function pathNormalize(filePath: string): string {
  // Определяем платформу на основе первого пути
  const isWindows = filePath.includes('\\') || filePath.match(/^[a-zA-Z]:/);
  const separator = isWindows ? '\\' : '/';
  
  return filePath
    .replace(/[\/\\]+/g, separator)
    .replace(/[\/\\]$/, '');
}

/**
 * Получить имя файла из пути
 */
export function pathBasename(filePath: string): string {
  return filePath.split(/[\/\\]/).pop() || '';
}

/**
 * Получить директорию из пути
 */
export function pathDirname(filePath: string): string {
  const parts = filePath.split(/[\/\\]/);
  parts.pop();
  return parts.join(filePath.includes('\\') ? '\\' : '/');
}

/**
 * Получить расширение файла
 */
export function pathExtname(filePath: string): string {
  const basename = pathBasename(filePath);
  const lastDot = basename.lastIndexOf('.');
  return lastDot === -1 ? '' : basename.slice(lastDot);
}

