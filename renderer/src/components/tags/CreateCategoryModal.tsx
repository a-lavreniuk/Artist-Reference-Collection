/**
 * Компонент CreateCategoryModal - модальное окно создания категории
 */

import { useState } from 'react';
import { Modal, Button, Input } from '../common';
import type { Category, Tag } from '../../types';
import { addCategory, addTag, getAllTags, updateCategory } from '../../services/db';
import { logCreateCategory } from '../../services/history';
import './CreateCategoryModal.css';

export interface CreateCategoryModalProps {
  /** Открыто ли модальное окно */
  isOpen: boolean;
  
  /** Обработчик закрытия */
  onClose: () => void;
  
  /** Обработчик создания категории */
  onCategoryCreated?: (category: Category) => void;
}

/**
 * Компонент CreateCategoryModal
 */
export const CreateCategoryModal = ({
  isOpen,
  onClose,
  onCategoryCreated
}: CreateCategoryModalProps) => {
  const [name, setName] = useState('');
  const [tagName, setTagName] = useState('');
  const [tags, setTags] = useState<string[]>([]); // Массив названий меток
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagError, setTagError] = useState<string | null>(null);

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

    // Проверка на дубликат среди уже добавленных меток
    if (tags.some(t => t.toLowerCase() === trimmedTagName.toLowerCase())) {
      setTagError('Метка с таким названием уже добавлена');
      return;
    }

    // Проверка на дубликат среди существующих меток в базе
    try {
      const allTags = await getAllTags();
      const existingTag = allTags.find(
        t => t.name.toLowerCase() === trimmedTagName.toLowerCase()
      );
      
      if (existingTag) {
        setTagError('Метка с таким названием уже существует');
        return;
      }
    } catch (err) {
      console.error('Ошибка проверки метки:', err);
    }

    // Добавляем метку в список
    setTags([...tags, trimmedTagName]);
    setTagName('');
    setTagError(null);
  };

  /**
   * Удаление метки из списка
   */
  const handleRemoveTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Введите название категории');
      return;
    }

    try {
      setIsCreating(true);
      setError(null);
      setTagError(null);

      // Создаём категорию
      const categoryId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const category: Category = {
        id: categoryId,
        name: name.trim(),
        dateCreated: new Date(),
        tagIds: []
      };

      await addCategory(category);

      // Создаём метки и связываем их с категорией
      const tagIds: string[] = [];
      for (const tagNameItem of tags) {
        const tagId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const tag: Tag = {
          id: tagId,
          name: tagNameItem,
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
      
      // Очищаем форму
      setName('');
      setTagName('');
      setTags([]);
      
      onCategoryCreated?.(category);
      onClose();
    } catch (err) {
      console.error('Ошибка создания категории:', err);
      setError('Не удалось создать категорию');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setName('');
    setTagName('');
    setTags([]);
    setError(null);
    setTagError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="medium"
      showCloseButton={false}
    >
      <form onSubmit={handleSubmit}>
        <div className="create-category-modal">
          {/* Заголовок и подзаголовок вместе */}
          <div className="create-category-modal__header">
            <h4 className="modal__title">Новая категория</h4>
            <p className="create-category-modal__subtitle">
              Придумайте название для новой категории
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
          />

          {/* Блок добавления меток */}
          <div className="create-category-modal__tags-section">
            <div className="create-category-modal__tags-header">
              <h4 className="modal__title">Добавить метки</h4>
              <p className="create-category-modal__subtitle">
                Придумайте названия для новых меток этой категории
              </p>
            </div>

            {/* Инпут для метки */}
            <Input
              placeholder="Название метки…"
              value={tagName}
              onChange={(e) => {
                setTagName(e.target.value);
                setTagError(null);
              }}
              onKeyDown={handleAddTag}
              error={tagError || undefined}
              fullWidth
              className="create-category-modal__input"
            />

            {/* Список добавленных меток */}
            {tags.length > 0 && (
              <div className="create-category-modal__tags-list">
                {tags.map((tag, index) => (
                  <div key={index} className="create-category-modal__tag">
                    <span className="create-category-modal__tag-name">{tag}</span>
                    <button
                      type="button"
                      className="create-category-modal__tag-remove"
                      onClick={() => handleRemoveTag(index)}
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
              variant="border"
              size="S"
              onClick={handleClose}
              disabled={isCreating}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              variant="success"
              size="S"
              loading={isCreating}
              disabled={!name.trim()}
              iconRight={
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M8 3V13M3 8H13"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              }
            >
              Создать
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default CreateCategoryModal;

