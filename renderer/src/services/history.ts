/**
 * Сервис для логирования действий пользователя
 * Записывает важные действия в файл history.json через IPC
 */

import type { HistoryActionType } from '../types';

/**
 * Базовая функция для добавления записи в историю
 */
async function logAction(
  action: HistoryActionType,
  description: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    if (window.electronAPI?.addHistoryEntry) {
      await window.electronAPI.addHistoryEntry({
        action,
        description,
        metadata
      });
      console.log('[History] Записано:', description);
    }
  } catch (error) {
    console.error('[History] Ошибка записи в историю:', error);
  }
}

/**
 * Форматирование размера файла для отображения
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} ГБ`;
}

// ========== ПУБЛИЧНЫЕ ФУНКЦИИ ЛОГИРОВАНИЯ ==========

/**
 * Импорт файлов
 */
export async function logImportFiles(count: number): Promise<void> {
  await logAction(
    'import_files',
    `Импорт: ${count} ${count === 1 ? 'файл' : count < 5 ? 'файла' : 'файлов'}`,
    { count }
  );
}

/**
 * Удаление карточек
 */
export async function logDeleteCards(count: number, collectionName?: string): Promise<void> {
  const description = collectionName
    ? `Удалено ${count} ${count === 1 ? 'элемент' : count < 5 ? 'элемента' : 'элементов'} из коллекции «${collectionName}»`
    : `Удалено ${count} ${count === 1 ? 'элемент' : count < 5 ? 'элемента' : 'элементов'}`;
  
  await logAction(
    'delete_cards',
    description,
    { count, collectionName }
  );
}

/**
 * Перенос хранилища
 */
export async function logMoveStorage(sizeBytes: number): Promise<void> {
  const sizeFormatted = formatSize(sizeBytes);
  await logAction(
    'move_storage',
    `Перенос хранилища ${sizeFormatted}`,
    { size: sizeBytes }
  );
}

/**
 * Создание коллекции
 */
export async function logCreateCollection(name: string, cardCount: number): Promise<void> {
  await logAction(
    'create_collection',
    `Создана коллекция «${name}». ${cardCount} ${cardCount === 1 ? 'элемент' : cardCount < 5 ? 'элемента' : 'элементов'}`,
    { name, count: cardCount }
  );
}

/**
 * Удаление коллекции
 */
export async function logDeleteCollection(name: string): Promise<void> {
  await logAction(
    'delete_collection',
    `Удалена коллекция «${name}»`,
    { name }
  );
}

/**
 * Создание категории
 */
export async function logCreateCategory(name: string, tagCount: number): Promise<void> {
  await logAction(
    'create_category',
    `Создана категория «${name}» с ${tagCount} ${tagCount === 1 ? 'меткой' : tagCount < 5 ? 'метками' : 'метками'}`,
    { name, count: tagCount }
  );
}

/**
 * Удаление категории
 */
export async function logDeleteCategory(name: string): Promise<void> {
  await logAction(
    'delete_category',
    `Удалена категория «${name}»`,
    { name }
  );
}

/**
 * Создание бэкапа
 */
export async function logCreateBackup(sizeBytes: number, parts: number): Promise<void> {
  const sizeFormatted = formatSize(sizeBytes);
  await logAction(
    'create_backup',
    `Бэкап создан ${sizeFormatted}. ${parts} ${parts === 1 ? 'часть' : parts < 5 ? 'части' : 'частей'}`,
    { size: sizeBytes, parts }
  );
}

/**
 * Очистка кэша
 */
export async function logClearCache(sizeBytes: number): Promise<void> {
  const sizeFormatted = formatSize(sizeBytes);
  await logAction(
    'clear_cache',
    `Очистка кэша −${sizeFormatted}`,
    { size: sizeBytes }
  );
}

/**
 * Очистка мудборда
 */
export async function logClearMoodboard(name?: string): Promise<void> {
  const description = name
    ? `Очистка мудборда «${name}»`
    : 'Очистка мудборда';
  
  await logAction(
    'clear_moodboard',
    description,
    { name }
  );
}

/**
 * Переименование метки
 */
export async function logRenameTag(oldName: string, newName: string): Promise<void> {
  await logAction(
    'rename_tag',
    `Переименована метка «${oldName}» → «${newName}»`,
    { oldName, newName }
  );
}

/**
 * Получить всю историю
 */
export async function getHistory(): Promise<Array<{
  id: string;
  timestamp: string;
  action: string;
  description: string;
  metadata?: any;
}>> {
  try {
    if (window.electronAPI?.getHistory) {
      return await window.electronAPI.getHistory();
    }
    return [];
  } catch (error) {
    console.error('[History] Ошибка получения истории:', error);
    return [];
  }
}

/**
 * Очистить всю историю
 */
export async function clearHistory(): Promise<void> {
  try {
    if (window.electronAPI?.clearHistory) {
      await window.electronAPI.clearHistory();
      console.log('[History] История очищена');
    }
  } catch (error) {
    console.error('[History] Ошибка очистки истории:', error);
    throw error;
  }
}

