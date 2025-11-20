/**
 * Сервис проверки целостности данных
 * Проверяет связность данных, существование файлов и синхронизацию
 */

import { getAllCards, getAllTags, getAllCollections, getAllCategories, getMoodboard, db } from './db';

export interface IntegrityIssue {
  type: 'missing_file' | 'orphaned_tag' | 'orphaned_collection' | 'orphaned_category' | 'moodboard_mismatch' | 'orphaned_tag_category';
  severity: 'error' | 'warning';
  description: string;
  cardId?: string;
  tagId?: string;
  collectionId?: string;
  categoryId?: string;
}

export interface IntegrityCheckResult {
  isValid: boolean;
  issues: IntegrityIssue[];
  fixedCount: number;
}

/**
 * Проверить целостность базы данных
 */
export async function validateDatabase(): Promise<IntegrityCheckResult> {
  console.log('[IntegrityCheck] Начало проверки целостности...');
  
  const issues: IntegrityIssue[] = [];
  let fixedCount = 0;

  try {
    // Получаем все данные
    const cards = await getAllCards();
    const tags = await getAllTags();
    const collections = await getAllCollections();
    const categories = await getAllCategories();
    const moodboard = await getMoodboard();

    // 1. Проверка существования файлов
    console.log('[IntegrityCheck] Проверка существования файлов...');
    for (const card of cards) {
      try {
        const exists = await window.electronAPI.fileExists(card.filePath);
        if (!exists) {
          issues.push({
            type: 'missing_file',
            severity: 'error',
            description: `Файл не найден: "${card.fileName}"\nID карточки: ${card.id}\nПуть: ${card.filePath}\n\nЧто делать:\n• Найти карточку по ID в поиске и удалить её\n• Восстановить файл из резервной копии\n• Игнорировать (карточка останется, но файл недоступен)`,
            cardId: card.id
          });
        }
      } catch (error) {
        console.warn(`[IntegrityCheck] Ошибка проверки файла ${card.fileName}:`, error);
      }
    }

    // 2. Проверка меток (orphaned tags - метки без карточек)
    console.log('[IntegrityCheck] Проверка меток...');
    for (const tag of tags) {
      const cardsWithTag = cards.filter(card => card.tags.includes(tag.id));
      if (cardsWithTag.length === 0 && tag.cardCount > 0) {
        issues.push({
          type: 'orphaned_tag',
          severity: 'warning',
          description: `Метка "${tag.name}" не используется ни в одной карточке, но имеет cardCount = ${tag.cardCount}\n\nЧто будет исправлено:\n• Счетчик использования метки будет обновлен до 0`,
          tagId: tag.id
        });
      }
    }

    // 2.5. Проверка меток с несуществующими категориями
    console.log('[IntegrityCheck] Проверка меток с несуществующими категориями...');
    const categoryIds = new Set(categories.map(c => c.id));
    for (const tag of tags) {
      if (tag.categoryId && !categoryIds.has(tag.categoryId)) {
        issues.push({
          type: 'orphaned_tag_category',
          severity: 'warning',
          description: `Метка "${tag.name}" ссылается на несуществующую категорию\n\nЧто будет исправлено:\n• Метка будет удалена из базы данных\n• Метка будет удалена из всех карточек`,
          tagId: tag.id
        });
      }
    }

    // 3. Проверка коллекций (orphaned collections)
    console.log('[IntegrityCheck] Проверка коллекций...');
    for (const collection of collections) {
      const existingCardIds = collection.cardIds.filter(cardId => 
        cards.some(card => card.id === cardId)
      );
      
      if (existingCardIds.length !== collection.cardIds.length) {
        const missingCount = collection.cardIds.length - existingCardIds.length;
        issues.push({
          type: 'orphaned_collection',
          severity: 'warning',
          description: `Коллекция "${collection.name}" содержит ${missingCount} несуществующих карточек (из ${collection.cardIds.length} всего)\n\nЧто будет исправлено:\n• Ссылки на несуществующие карточки будут удалены из коллекции`,
          collectionId: collection.id
        });
      }
    }

    // 4. Проверка категорий (orphaned categories)
    console.log('[IntegrityCheck] Проверка категорий...');
    for (const category of categories) {
      const existingTagIds = category.tagIds.filter(tagId => 
        tags.some(tag => tag.id === tagId)
      );
      
      if (existingTagIds.length !== category.tagIds.length) {
        const missingCount = category.tagIds.length - existingTagIds.length;
        issues.push({
          type: 'orphaned_category',
          severity: 'warning',
          description: `Категория "${category.name}" содержит ${missingCount} несуществующих меток (из ${category.tagIds.length} всего)\n\nЧто будет исправлено:\n• Ссылки на несуществующие метки будут удалены из категории`,
          categoryId: category.id
        });
      }
    }

    // 5. Проверка мудборда (карточки в мудборде должны существовать)
    console.log('[IntegrityCheck] Проверка мудборда...');
    const existingMoodboardCardIds = moodboard.cardIds.filter(cardId => 
      cards.some(card => card.id === cardId)
    );
    
    if (existingMoodboardCardIds.length !== moodboard.cardIds.length) {
      const missingCount = moodboard.cardIds.length - existingMoodboardCardIds.length;
      issues.push({
        type: 'moodboard_mismatch',
        severity: 'warning',
        description: `Мудборд содержит ${missingCount} несуществующих карточек (из ${moodboard.cardIds.length} всего)\n\nЧто будет исправлено:\n• Ссылки на несуществующие карточки будут удалены из мудборда`
      });
    }

    console.log(`[IntegrityCheck] Проверка завершена. Найдено проблем: ${issues.length}`);
    
    return {
      isValid: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      fixedCount
    };
  } catch (error) {
    console.error('[IntegrityCheck] Ошибка проверки целостности:', error);
    throw error;
  }
}

/**
 * Исправить найденные проблемы
 */
export async function fixIssues(issues: IntegrityIssue[]): Promise<number> {
  console.log('[IntegrityCheck] Начало исправления проблем...');
  let fixedCount = 0;

  try {
    for (const issue of issues) {
      try {
        switch (issue.type) {
          case 'orphaned_collection':
            if (issue.collectionId) {
              const collection = await db.collections.get(issue.collectionId);
              if (collection) {
                const allCards = await getAllCards();
                const existingCardIds = collection.cardIds.filter(cardId => 
                  allCards.some(card => card.id === cardId)
                );
                await db.collections.update(issue.collectionId, {
                  cardIds: existingCardIds,
                  dateModified: new Date()
                });
                fixedCount++;
                console.log(`[IntegrityCheck] Исправлена коллекция: ${issue.collectionId}`);
              }
            }
            break;

          case 'orphaned_category':
            if (issue.categoryId) {
              const category = await db.categories.get(issue.categoryId);
              if (category) {
                const allTags = await getAllTags();
                const existingTagIds = category.tagIds.filter(tagId => 
                  allTags.some(tag => tag.id === tagId)
                );
                await db.categories.update(issue.categoryId, {
                  tagIds: existingTagIds
                });
                fixedCount++;
                console.log(`[IntegrityCheck] Исправлена категория: ${issue.categoryId}`);
              }
            }
            break;

          case 'moodboard_mismatch':
            const moodboard = await getMoodboard();
            const allCards = await getAllCards();
            const existingCardIds = moodboard.cardIds.filter(cardId => 
              allCards.some(card => card.id === cardId)
            );
            await db.moodboard.update('default', {
              cardIds: existingCardIds,
              dateModified: new Date()
            });
            fixedCount++;
            console.log('[IntegrityCheck] Исправлен мудборд');
            break;

          case 'orphaned_tag':
            if (issue.tagId) {
              const tag = await db.tags.get(issue.tagId);
              if (tag) {
                const allCards = await getAllCards();
                const cardsWithTag = allCards.filter(card => card.tags.includes(issue.tagId!));
                await db.tags.update(issue.tagId, {
                  cardCount: cardsWithTag.length
                });
                fixedCount++;
                console.log(`[IntegrityCheck] Исправлена метка: ${issue.tagId}`);
              }
            }
            break;

          case 'orphaned_tag_category':
            if (issue.tagId) {
              const { cleanupOrphanTags } = await import('./db');
              const result = await cleanupOrphanTags();
              fixedCount += result.deleted;
              console.log(`[IntegrityCheck] Удалено меток с несуществующими категориями: ${result.deleted}`);
            }
            break;

          case 'missing_file':
            // Не исправляем автоматически - пользователь должен решить что делать
            console.log(`[IntegrityCheck] Пропущена проблема с файлом: ${issue.cardId} (требует ручного вмешательства)`);
            break;
        }
      } catch (error) {
        console.error(`[IntegrityCheck] Ошибка исправления проблемы ${issue.type}:`, error);
      }
    }

    console.log(`[IntegrityCheck] Исправлено проблем: ${fixedCount}`);
    return fixedCount;
  } catch (error) {
    console.error('[IntegrityCheck] Ошибка исправления проблем:', error);
    throw error;
  }
}

