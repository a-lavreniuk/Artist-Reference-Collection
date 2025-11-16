/**
 * Компонент CreateCategoryModal - модальное окно создания категории
 * Дубликат EditCategoryModal с измененным заголовком
 */

import { useState, useEffect, useRef } from 'react';
import { Modal, Button, Input } from '../common';
import { TagRow } from './TagRow';
import type { Category, Tag as TagType } from '../../types';
import { addCategory, addTag, getAllTags, getAllCategories, updateCategory } from '../../services/db';
import { logCreateCategory } from '../../services/history';
import { useAlert } from '../../hooks/useAlert';
import './CreateCategoryModal.css';
import './EditCategoryModal.css';

export interface CreateCategoryModalProps {
  /** Открыто ли модальное окно */
  isOpen: boolean;
  
  /** Обработчик закрытия */
  onClose: () => void;
  
  /** Обработчик создания категории */
  onCategoryCreated?: (category: Category) => void;
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
 * Компонент CreateCategoryModal
 */
export const CreateCategoryModal = ({
  isOpen,
  onClose,
  onCategoryCreated
}: CreateCategoryModalProps) => {
  const alert = useAlert();
  const [name, setName] = useState('');
  const [editableTags, setEditableTags] = useState<EditableTag[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagErrors, setTagErrors] = useState<Map<string, string>>(new Map());
  const tagsListRef = useRef<HTMLDivElement>(null);
  const validationTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Очистка формы при закрытии
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setEditableTags([]);
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
  }, [isOpen]);

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
    if (trimmedName) {
      const timeoutId = setTimeout(async () => {
        const allTags = await getAllTags();
        const allCategories = await getAllCategories();
        const currentTag = editableTags[index];
        
        // Ищем метку с таким же названием (игнорируя текущую метку)
        const duplicateTag = allTags.find(
          t => t.name.toLowerCase() === trimmedName.toLowerCase() && 
               t.id !== currentTag?.id
        );
        
        if (duplicateTag) {
          // Если метка найдена в другой категории (для нового модального окна всегда другая категория)
          const duplicateCategory = allCategories.find(c => c.id === duplicateTag.categoryId);
          const categoryName = duplicateCategory?.name || 'другой категории';
          alert.error(`Метка «${trimmedName}» уже используется в категории «${categoryName}»`);
          // Подсвечиваем инпут ошибкой
          setTagErrors(prev => {
            const newErrors = new Map(prev);
            newErrors.set(tagKey, 'Метка с таким названием уже существует');
            return newErrors;
          });
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

      // Проверка на пустое название (необязательно для новых категорий)
      if (!trimmedName) {
        // Пропускаем пустые метки при создании категории
        continue;
      }

      // Проверка на дубликаты в текущем списке
      if (nameSet.has(trimmedName.toLowerCase())) {
        errors.set(tagKey, 'Метка с таким названием уже добавлена');
        if (!hasDuplicate) {
          hasDuplicate = true;
          duplicateMessage = `Метка «${trimmedName}» уже добавлена в эту категорию`;
        }
        continue;
      }
      nameSet.add(trimmedName.toLowerCase());

      // Проверка на дубликаты в базе (КРИТИЧНО: метки должны быть уникальны во всей системе)
      const duplicate = allTags.find(
        t => t.name.toLowerCase() === trimmedName.toLowerCase()
      );
      
      if (duplicate) {
        // Показываем alert с информацией о категории
        const duplicateCategory = allCategories.find(c => c.id === duplicate.categoryId);
        const categoryName = duplicateCategory?.name || 'другой категории';
        if (!hasDuplicate) {
          hasDuplicate = true;
          duplicateMessage = `Метка «${trimmedName}» уже используется в категории «${categoryName}»`;
        }
        errors.set(tagKey, 'Метка с таким названием уже существует');
        continue;
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
   * Сохранение категории
   */
  const handleSave = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    
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

      // Создаём категорию
      const categoryId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const category: Category = {
        id: categoryId,
        name: trimmedName,
        dateCreated: new Date(),
        tagIds: []
      };

      await addCategory(category);

      // Фильтруем метки с заполненными названиями
      const tagsToCreate = editableTags.filter(tag => tag.name.trim());

      // Проверяем на дубликаты перед созданием (дополнительная проверка)
      const allTags = await getAllTags();
      const allCategories = await getAllCategories();
      const tagIds: string[] = [];
      
      for (const editableTag of tagsToCreate) {
        const trimmedTagName = editableTag.name.trim();
        if (!trimmedTagName) continue;

        // КРИТИЧНО: Проверяем на дубликаты во всей системе перед созданием
        const duplicate = allTags.find(
          t => t.name.toLowerCase() === trimmedTagName.toLowerCase()
        );
        
        if (duplicate) {
          const duplicateCategory = allCategories.find(c => c.id === duplicate.categoryId);
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
          categoryId: categoryId,
          dateCreated: new Date(),
          cardCount: 0
        };
        await addTag(tag);
        tagIds.push(tagId);
      }

      // Обновляем категорию с ID меток
      if (tagIds.length > 0) {
        await updateCategory(categoryId, { tagIds });
        category.tagIds = tagIds;
      }
      
      // Логируем создание категории
      await logCreateCategory(category.name, tagIds.length);
      
      // Показываем успешное уведомление
      alert.success(`Категория "${category.name}" создана`);
      
      onCategoryCreated?.(category);
      onClose();
    } catch (err) {
      console.error('Ошибка создания категории:', err);
      setError('Не удалось создать категорию');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Закрытие модального окна
   */
  const handleClose = () => {
    setName('');
    setEditableTags([]);
    setError(null);
    setTagErrors(new Map());
    onClose();
  };

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
            <h4 className="modal__title">Новая категория</h4>
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
              disabled={isSaving}
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
          <div className="create-category-modal__actions">
            <div style={{ display: 'flex', gap: 'var(--spacing-s)' }}>
              <Button
                type="button"
                variant="border"
                size="S"
                onClick={handleClose}
                disabled={isSaving}
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
                Создать
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default CreateCategoryModal;
