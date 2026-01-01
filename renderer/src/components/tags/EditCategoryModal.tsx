/**
 * Компонент EditCategoryModal - модальное окно редактирования категории
 * Переработан для поддержки редактирования меток с описаниями
 */

import { useState, useEffect, useRef } from 'react';
import { Modal, Button, Input } from '../common';
import { TagRow } from './TagRow';
import type { Category, Tag as TagType } from '../../types';
import { updateCategory, deleteCategory, addTag, deleteTag, updateTag, getAllTags, getAllCategories } from '../../services/db';
import { logRenameCategory, logDeleteCategory, logRenameTag } from '../../services/history';
import { useToast } from '../../hooks/useToast';
import { useAlert } from '../../hooks/useAlert';
import './CreateCategoryModal.css';
import './EditCategoryModal.css';

export interface EditCategoryModalProps {
  /** Открыто ли модальное окно */
  isOpen: boolean;
  
  /** Категория для редактирования */
  category: Category | null;
  
  /** Метки в категории */
  tags: TagType[];
  
  /** Обработчик закрытия */
  onClose: () => void;
  
  /** Обработчик обновления категории */
  onCategoryUpdated?: () => void;
  
  /** Обработчик удаления категории */
  onCategoryDeleted?: () => void;
}

// Тип для хранения состояния редактируемых меток
interface EditableTag {
  id: string;
  name: string;
  description: string;
  isNew: boolean;
  originalName?: string; // Для отслеживания изменений названия
}

/**
 * Компонент EditCategoryModal
 */
export const EditCategoryModal = ({
  isOpen,
  category,
  tags,
  onClose,
  onCategoryUpdated,
  onCategoryDeleted
}: EditCategoryModalProps) => {
  const toast = useToast();
  const alert = useAlert();
  const [name, setName] = useState(category?.name || '');
  const [editableTags, setEditableTags] = useState<EditableTag[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagErrors, setTagErrors] = useState<Map<string, string>>(new Map());
  const tagsListRef = useRef<HTMLDivElement>(null);
  const validationTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Инициализация данных при открытии модального окна
  useEffect(() => {
    if (category && tags && isOpen) {
      setName(category.name);
      // Преобразуем существующие метки в редактируемый формат
      const initialTags: EditableTag[] = tags.map(tag => ({
        id: tag.id,
        name: tag.name,
        description: tag.description || '',
        isNew: false,
        originalName: tag.name
      }));
      setEditableTags(initialTags);
      setError(null);
      setTagErrors(new Map());
      
      // Очищаем таймеры валидации при закрытии
      validationTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      validationTimeoutsRef.current.clear();
    }
    
    // Очистка таймеров при размонтировании
    return () => {
      validationTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      validationTimeoutsRef.current.clear();
    };
  }, [category, tags, isOpen]);

  /**
   * Обработчик изменения метки
   */
  const handleTagChange = (index: number, newName: string, newDescription: string) => {
    // Обновляем состояние сразу
    setEditableTags(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        name: newName,
        description: newDescription
      };
      return updated;
    });
    
    // Очищаем ошибку для этой метки
    setTagErrors(prev => {
      const newErrors = new Map(prev);
      const tag = editableTags[index];
      if (tag) {
        newErrors.delete(tag.id || `new-${index}`);
      }
      return newErrors;
    });

    // Отменяем предыдущий таймер валидации для этой метки
    const tag = editableTags[index];
    const tagKey = tag?.id || `new-${index}`;
    const existingTimeout = validationTimeoutsRef.current.get(tagKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Устанавливаем новый таймер для валидации (через 500мс после последнего ввода)
    const trimmedName = newName.trim();
    if (trimmedName && category) {
      const timeoutId = setTimeout(async () => {
        const allTags = await getAllTags();
        const allCategories = await getAllCategories();
        const currentTag = editableTags[index];
        
        // Ищем метку с таким же названием (игнорируя текущую метку)
        // Важно: проверяем, что категория метки существует (метка не была удалена вместе с категорией)
        const duplicateTag = allTags.find(t => {
          const tagCategoryExists = allCategories.some(c => c.id === t.categoryId);
          return tagCategoryExists &&
                 t.name.toLowerCase() === trimmedName.toLowerCase() && 
                 t.id !== currentTag?.id;
        });
        
        if (duplicateTag) {
          // Если метка найдена в той же категории
          if (duplicateTag.categoryId === category.id) {
            // Показываем alert и подсвечиваем инпут ошибкой
            alert.error(`Метка «${trimmedName}» уже используется в этой категории`);
            setTagErrors(prev => {
              const newErrors = new Map(prev);
              newErrors.set(tagKey, 'Метка с таким названием уже существует в этой категории');
              return newErrors;
            });
          } else {
            // Если метка найдена в другой категории
            const duplicateCategory = allCategories.find(c => c.id === duplicateTag.categoryId);
            const categoryName = duplicateCategory?.name || 'другой категории';
            alert.error(`Метка «${trimmedName}» уже используется в категории «${categoryName}»`);
            setTagErrors(prev => {
              const newErrors = new Map(prev);
              newErrors.set(tagKey, 'Метка с таким названием уже существует');
              return newErrors;
            });
          }
        }
        
        validationTimeoutsRef.current.delete(tagKey);
      }, 500);
      
      validationTimeoutsRef.current.set(tagKey, timeoutId);
    }
  };

  /**
   * Обработчик удаления метки
   */
  const handleTagRemove = (index: number) => {
    setEditableTags(prev => prev.filter((_, i) => i !== index));
    
    // Очищаем ошибку для удаленной метки
    setTagErrors(prev => {
      const newErrors = new Map(prev);
      const tag = editableTags[index];
      if (tag) {
        newErrors.delete(tag.id || `new-${index}`);
      }
      return newErrors;
    });
  };

  /**
   * Добавление новой пустой строки метки
   */
  const handleAddTag = () => {
    const newTag: EditableTag = {
      id: `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: '',
      description: '',
      isNew: true
    };
    setEditableTags(prev => [...prev, newTag]);
    
    // Прокручиваем к новой строке
    setTimeout(() => {
      if (tagsListRef.current) {
        tagsListRef.current.scrollTop = tagsListRef.current.scrollHeight;
      }
    }, 100);
  };

  /**
   * Валидация меток перед сохранением
   */
  const validateTags = async (): Promise<boolean> => {
    const errors = new Map<string, string>();
    const allTags = await getAllTags();
    const allCategories = await getAllCategories();
    const nameSet = new Set<string>();
    let hasDuplicate = false;
    let duplicateMessage = '';

    for (let i = 0; i < editableTags.length; i++) {
      const tag = editableTags[i];
      const trimmedName = tag.name.trim();
      const tagKey = tag.id;

      // Проверка на пустое название
      if (!trimmedName) {
        errors.set(tagKey, 'Введите название метки');
        continue;
      }

      // Проверка на дубликаты в текущем списке
      if (nameSet.has(trimmedName.toLowerCase())) {
        errors.set(tagKey, 'Метка с таким названием уже добавлена');
        if (!hasDuplicate) {
          hasDuplicate = true;
          duplicateMessage = 'Метка с таким названием уже добавлена';
        }
        continue;
      }
      nameSet.add(trimmedName.toLowerCase());

      // Проверка на дубликаты в базе (КРИТИЧНО: метки должны быть уникальны во всей системе)
      // Проверяем для новых меток или при изменении названия
      if (tag.isNew || (tag.originalName && tag.originalName.toLowerCase() !== trimmedName.toLowerCase())) {
        // Важно: проверяем, что категория метки существует (метка не была удалена вместе с категорией)
        const duplicate = allTags.find(t => {
          const tagCategoryExists = allCategories.some(c => c.id === t.categoryId);
          return tagCategoryExists &&
                 t.name.toLowerCase() === trimmedName.toLowerCase() && 
                 t.id !== tag.id;
        });
        
        if (duplicate) {
          // Если метка найдена в той же категории
          if (duplicate.categoryId === category?.id) {
            if (!hasDuplicate) {
              hasDuplicate = true;
              duplicateMessage = `Метка «${trimmedName}» уже используется в этой категории`;
            }
            errors.set(tagKey, 'Метка с таким названием уже существует в этой категории');
          } else {
            // Если метка найдена в другой категории
            const duplicateCategory = allCategories.find(c => c.id === duplicate.categoryId);
            const categoryName = duplicateCategory?.name || 'другой категории';
            if (!hasDuplicate) {
              hasDuplicate = true;
              duplicateMessage = `Метка «${trimmedName}» уже используется в категории «${categoryName}»`;
            }
            errors.set(tagKey, 'Метка с таким названием уже существует');
          }
          continue;
        }
      }
    }

    // Показываем alert если есть дубликаты (синхронно, чтобы alert точно показался)
    if (hasDuplicate && duplicateMessage) {
      // Используем setTimeout(0) чтобы alert показался после обновления состояния
      setTimeout(() => {
        alert.error(duplicateMessage);
      }, 0);
    }

    if (errors.size > 0) {
      setTagErrors(errors);
      return false;
    }

    return true;
  };

  /**
   * Сохранение изменений
   */
  const handleSave = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    
    if (!category) return;
    
    const trimmedName = name.trim();
    
    if (!trimmedName) {
      setError('Введите название категории');
      return;
    }

    // Валидация меток
    if (!(await validateTags())) {
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      // Обновляем название категории если изменилось
      if (trimmedName !== category.name) {
        const oldName = category.name;
        await updateCategory(category.id, { name: trimmedName });
        await logRenameCategory(oldName, trimmedName);
      }

      // Разделяем метки на существующие и новые
      const existingTags = editableTags.filter(t => !t.isNew);
      const newTags = editableTags.filter(t => t.isNew && t.name.trim());

      // Проверяем на дубликаты перед обновлением/созданием (дополнительная проверка)
      const allTagsCheck = await getAllTags();
      const allCategoriesCheck = await getAllCategories();

      // Обновляем существующие метки
      const updatedTagIds: string[] = [];
      for (const editableTag of existingTags) {
        const originalTag = tags.find(t => t.id === editableTag.id);
        if (!originalTag) continue;

        const changes: Partial<TagType> = {};
        let nameChanged = false;

        // Проверяем изменения названия
        if (editableTag.name.trim() !== originalTag.name) {
          const newName = editableTag.name.trim();
          
          // КРИТИЧНО: Проверяем на дубликаты во всей системе перед переименованием
          // Важно: проверяем, что категория метки существует (метка не была удалена вместе с категорией)
          const duplicate = allTagsCheck.find(t => {
            const tagCategoryExists = allCategoriesCheck.some(c => c.id === t.categoryId);
            return tagCategoryExists &&
                   t.name.toLowerCase() === newName.toLowerCase() && 
                   t.id !== editableTag.id;
          });
          
          if (duplicate) {
            const duplicateCategory = allCategoriesCheck.find(c => c.id === duplicate.categoryId);
            const categoryName = duplicateCategory?.name || 'другой категории';
            alert.error(`Метка «${newName}» уже используется в категории «${categoryName}»`);
            setIsSaving(false);
            return;
          }
          
          changes.name = newName;
          nameChanged = true;
        }

        // Проверяем изменения описания
        if (editableTag.description.trim() !== (originalTag.description || '')) {
          changes.description = editableTag.description.trim() || undefined;
        }

        // Обновляем метку если есть изменения
        if (Object.keys(changes).length > 0) {
          await updateTag(editableTag.id, changes);
          
          // Логируем переименование
          if (nameChanged && originalTag.name) {
            await logRenameTag(originalTag.name, editableTag.name.trim());
          }
        }

        updatedTagIds.push(editableTag.id);
      }

      // Добавляем новые метки
      const newTagIds: string[] = [];
      for (const editableTag of newTags) {
        const trimmedTagName = editableTag.name.trim();
        if (!trimmedTagName) continue;

        // КРИТИЧНО: Проверяем на дубликаты во всей системе перед созданием
        // Важно: проверяем, что категория метки существует (метка не была удалена вместе с категорией)
        const duplicate = allTagsCheck.find(t => {
          const tagCategoryExists = allCategoriesCheck.some(c => c.id === t.categoryId);
          return tagCategoryExists &&
                 t.name.toLowerCase() === trimmedTagName.toLowerCase();
        });
        
        if (duplicate) {
          const duplicateCategory = allCategoriesCheck.find(c => c.id === duplicate.categoryId);
          const categoryName = duplicateCategory?.name || 'другой категории';
          alert.error(`Метка «${trimmedTagName}» уже используется в категории «${categoryName}»`);
          setIsSaving(false);
          return;
        }

        const tagId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const tag: TagType = {
          id: tagId,
          name: trimmedTagName,
          description: editableTag.description.trim() || undefined,
          categoryId: category.id,
          dateCreated: new Date(),
          cardCount: 0
        };
        await addTag(tag);
        newTagIds.push(tagId);
      }

      // Обновляем категорию с новым списком ID меток
      const allTagIds = [...updatedTagIds, ...newTagIds];
      await updateCategory(category.id, { tagIds: allTagIds });

      // Удаляем метки, которые были удалены из списка
      const tagsToDelete = tags
        .filter(tag => !editableTags.some(et => et.id === tag.id && !et.isNew))
        .map(tag => tag.id);
      
      for (const tagId of tagsToDelete) {
        await deleteTag(tagId);
      }
      
      onCategoryUpdated?.();
      onClose();
    } catch (err) {
      console.error('Ошибка обновления категории:', err);
      setError('Не удалось обновить категорию');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Удаление категории
   */
  const handleDelete = async () => {
    if (!category) return;

    toast.showToast({
      title: 'Удалить категорию',
      message: `Вы уверены что хотите удалить категорию "${category.name}" и все метки в ней? Это действие необратимо`,
      type: 'error',
      onConfirm: async () => {
        try {
          setIsDeleting(true);
          setError(null);

          await deleteCategory(category.id);
          
          // Логируем удаление категории
          await logDeleteCategory(category.name);
          
          // Показываем успешное уведомление
          alert.success(`Категория "${category.name}" удалена`);
          
          onCategoryDeleted?.();
          onClose();
        } catch (err) {
          console.error('Ошибка удаления категории:', err);
          setError('Не удалось удалить категорию');
        } finally {
          setIsDeleting(false);
        }
      },
      confirmText: 'Удалить',
      cancelText: 'Отмена'
    });
  };

  /**
   * Закрытие модального окна
   */
  const handleClose = () => {
    if (category) {
      setName(category.name);
    }
    setEditableTags([]);
    setError(null);
    setTagErrors(new Map());
    onClose();
  };

  if (!category) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="medium"
      showCloseButton={false}
    >
      <form onSubmit={handleSave}>
        <div className="create-category-modal">
          {/* Заголовок и подзаголовок */}
          <div className="create-category-modal__header">
            <h4 className="modal__title">Редактирование категории</h4>
            <p className="create-category-modal__subtitle">
              Измените название и метки категории
            </p>
          </div>

          {/* Инпут названия категории */}
          <Input
            placeholder="Название категории"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            error={error || undefined}
            fullWidth
            className="create-category-modal__input"
            autoFocus
            clearable
            onClear={() => {
              setName('');
              setError(null);
            }}
          />

          {/* Блок редактирования меток */}
          <div className="create-category-modal__tags-section">
            <div className="create-category-modal__tags-header">
              <h4 className="modal__title">Метки категории</h4>
              <p className="create-category-modal__subtitle">
                Придумайте названия для меток и описание
              </p>
            </div>

            {/* Список меток с прокруткой */}
            <div className="edit-category-modal__tags-list" ref={tagsListRef}>
              {editableTags.map((tag, index) => (
                <TagRow
                  key={tag.id}
                  tag={tag.isNew ? undefined : tags.find(t => t.id === tag.id)}
                  initialName={tag.name}
                  initialDescription={tag.description}
                  onChange={(name, description) => handleTagChange(index, name, description)}
                  onRemove={() => handleTagRemove(index)}
                  nameError={tagErrors.get(tag.id)}
                  autoFocus={tag.isNew && index === editableTags.length - 1}
                />
              ))}
            </div>

            {/* Кнопка добавления новой метки */}
            <Button
              type="button"
              variant="border"
              size="S"
              onClick={handleAddTag}
              disabled={isSaving || isDeleting}
              iconRight={
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M8 3V13M3 8H13"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
              className="edit-category-modal__add-button"
            >
              Добавить
            </Button>
          </div>

          {/* Кнопки */}
          <div className="create-category-modal__actions create-category-modal__actions--with-delete">
            <Button
              type="button"
              variant="error"
              size="S"
              onClick={handleDelete}
              disabled={isSaving || isDeleting}
              loading={isDeleting}
            >
              Удалить
            </Button>
            <div style={{ display: 'flex', gap: 'var(--spacing-s)' }}>
              <Button
                type="button"
                variant="border"
                size="S"
                onClick={handleClose}
                disabled={isSaving || isDeleting}
              >
                Отмена
              </Button>
              <Button
                type="submit"
                variant="success"
                size="S"
                loading={isSaving}
                disabled={!name.trim()}
                iconRight={
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M13 4L6 11L3 8"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                }
              >
                Сохранить
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default EditCategoryModal;
