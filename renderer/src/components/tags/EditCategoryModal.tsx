/**
 * Компонент EditCategoryModal - модальное окно редактирования категории
 * Повторяет структуру CreateCategoryModal, но с возможностью редактирования и удаления
 */

import { useState, useEffect } from 'react';
import { Modal, Button, Input } from '../common';
import type { Category, Tag as TagType } from '../../types';
import { updateCategory, deleteCategory, addTag, deleteTag, getAllTags } from '../../services/db';
import { logRenameCategory, logDeleteCategory } from '../../services/history';
import { useToast } from '../../hooks/useToast';
import { useAlert } from '../../hooks/useAlert';
import './CreateCategoryModal.css';

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
  const [tagName, setTagName] = useState('');
  // Храним ID существующих меток и названия новых меток
  const [existingTagIds, setExistingTagIds] = useState<string[]>([]);
  const [newTags, setNewTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagError, setTagError] = useState<string | null>(null);

  // Инициализация данных при открытии модального окна
  useEffect(() => {
    if (category && tags) {
      setName(category.name);
      setExistingTagIds(tags.map(t => t.id));
      setNewTags([]);
      setTagName('');
      setError(null);
      setTagError(null);
    }
  }, [category, tags, isOpen]);

  /**
   * Обработчик добавления метки по Enter
   */
  const handleAddTag = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    
    e.preventDefault();
    const trimmedTagName = tagName.trim();
    
    if (!trimmedTagName) {
      return;
    }

    // Проверка на дубликат среди существующих меток категории
    const existingTagNames = tags.map(t => t.name.toLowerCase());
    if (existingTagNames.includes(trimmedTagName.toLowerCase())) {
      setTagError('Метка с таким названием уже существует в категории');
      return;
    }

    // Проверка на дубликат среди новых меток
    if (newTags.some(t => t.toLowerCase() === trimmedTagName.toLowerCase())) {
      setTagError('Метка с таким названием уже добавлена');
      return;
    }

    // Проверка на дубликат среди существующих меток в базе (в других категориях)
    try {
      const allTags = await getAllTags();
      const existingTag = allTags.find(
        t => t.name.toLowerCase() === trimmedTagName.toLowerCase() && 
             t.categoryId !== category?.id
      );
      
      if (existingTag) {
        setTagError('Метка с таким названием уже существует в другой категории');
        return;
      }
    } catch (err) {
      console.error('Ошибка проверки метки:', err);
    }

    // Добавляем метку в список новых
    setNewTags([...newTags, trimmedTagName]);
    setTagName('');
    setTagError(null);
  };

  /**
   * Удаление новой метки из списка
   */
  const handleRemoveNewTag = (index: number) => {
    setNewTags(newTags.filter((_, i) => i !== index));
  };

  /**
   * Удаление существующей метки из категории
   */
  const handleRemoveExistingTag = (tagId: string) => {
    setExistingTagIds(existingTagIds.filter(id => id !== tagId));
  };

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

    try {
      setIsSaving(true);
      setError(null);
      setTagError(null);

      // Обновляем название категории если изменилось
      if (trimmedName !== category.name) {
        const oldName = category.name;
        await updateCategory(category.id, { name: trimmedName });
        await logRenameCategory(oldName, trimmedName);
      }

      // Удаляем метки, которые были удалены из категории
      const tagsToDelete = tags
        .filter(tag => !existingTagIds.includes(tag.id))
        .map(tag => tag.id);
      
      for (const tagId of tagsToDelete) {
        await deleteTag(tagId);
      }

      // Добавляем новые метки
      const newTagIds: string[] = [];
      for (const tagNameItem of newTags) {
        const tagId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const tag: TagType = {
          id: tagId,
          name: tagNameItem,
          categoryId: category.id,
          dateCreated: new Date(),
          cardCount: 0
        };
        await addTag(tag);
        newTagIds.push(tagId);
      }

      // Обновляем категорию с новым списком ID меток
      const updatedTagIds = [...existingTagIds, ...newTagIds];
      await updateCategory(category.id, { tagIds: updatedTagIds });
      
      onCategoryUpdated?.();
      onClose();
    } catch (err) {
      console.error('Ошибка обновления категории:', err);
      setError('Не удалось обновить категорию');
    } finally {
      setIsSaving(false);
    }
  };

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

  const handleClose = () => {
    if (category) {
      setName(category.name);
    }
    setNewTags([]);
    setTagName('');
    setError(null);
    setTagError(null);
    onClose();
  };

  if (!category) {
    return null;
  }

  // Получаем существующие метки для отображения
  const displayedExistingTags = tags.filter(tag => existingTagIds.includes(tag.id));

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="medium"
      showCloseButton={false}
    >
      <form onSubmit={handleSave}>
        <div className="create-category-modal">
          {/* Заголовок и подзаголовок вместе */}
          <div className="create-category-modal__header">
            <h4 className="modal__title">Редактирование категории</h4>
            <p className="create-category-modal__subtitle">
              Измените название и метки категории
            </p>
          </div>

          {/* Инпут названия категории */}
          <Input
            placeholder="Название…"
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
                Придумайте названия для новых меток этой категории
              </p>
            </div>

            {/* Инпут для новой метки */}
            <Input
              placeholder="Добавить новую метку…"
              value={tagName}
              onChange={(e) => {
                setTagName(e.target.value);
                setTagError(null);
              }}
              onKeyDown={handleAddTag}
              error={tagError || undefined}
              fullWidth
              className="create-category-modal__input"
              clearable
              onClear={() => {
                setTagName('');
                setTagError(null);
              }}
            />

            {/* Объединенный список существующих и новых меток */}
            {(displayedExistingTags.length > 0 || newTags.length > 0) && (
              <div className="create-category-modal__tags-list">
                {/* Существующие метки */}
                {displayedExistingTags.map((tag) => (
                  <div key={tag.id} className="create-category-modal__tag">
                    <span className="create-category-modal__tag-name">{tag.name}</span>
                    <button
                      type="button"
                      className="create-category-modal__tag-remove"
                      onClick={() => handleRemoveExistingTag(tag.id)}
                      aria-label={`Удалить метку ${tag.name}`}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M12 4L4 12M4 4L12 12"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
                {/* Новые метки */}
                {newTags.map((tag, index) => (
                  <div key={`new-${index}`} className="create-category-modal__tag">
                    <span className="create-category-modal__tag-name">{tag}</span>
                    <button
                      type="button"
                      className="create-category-modal__tag-remove"
                      onClick={() => handleRemoveNewTag(index)}
                      aria-label={`Удалить метку ${tag}`}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M12 4L4 12M4 4L12 12"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Кнопки */}
          <div className="create-category-modal__actions">
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
