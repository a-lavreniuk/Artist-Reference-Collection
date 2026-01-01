/**
 * Компонент CreateTagModal - модальное окно создания метки
 */

import { useState } from 'react';
import { Modal, Button, Input } from '../common';
import type { Tag } from '../../types';
import { addTag, updateCategory } from '../../services/db';

export interface CreateTagModalProps {
  /** Открыто ли модальное окно */
  isOpen: boolean;
  
  /** ID категории */
  categoryId: string;
  
  /** Обработчик закрытия */
  onClose: () => void;
  
  /** Обработчик создания метки */
  onTagCreated?: (tag: Tag) => void;
}

export const CreateTagModal = ({
  isOpen,
  categoryId,
  onClose,
  onTagCreated
}: CreateTagModalProps) => {
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Введите название метки');
      return;
    }

    try {
      setIsCreating(true);
      setError(null);

      // Проверяем дубликаты
      const { getAllTags, getAllCategories } = await import('../../services/db');
      const existingTags = await getAllTags();
      const allCategories = await getAllCategories();
      
      // Проверяем метки с таким же названием, но только те, которые действительно существуют
      // (их категория должна существовать)
      const duplicate = existingTags.find(t => {
        const tagCategoryExists = allCategories.some(c => c.id === t.categoryId);
        return tagCategoryExists && 
               t.name.toLowerCase() === name.trim().toLowerCase() && 
               t.categoryId === categoryId;
      });
      
      if (duplicate) {
        setError('Метка с таким названием уже существует в этой категории');
        setIsCreating(false);
        return;
      }

      const tag: Tag = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: name.trim(),
        categoryId,
        dateCreated: new Date(),
        cardCount: 0
      };

      const tagId = await addTag(tag);
      
      // Добавляем ID метки в категорию
      const category = await import('../../services/db').then(m => m.db.categories.get(categoryId));
      if (category) {
        await updateCategory(categoryId, {
          tagIds: [...category.tagIds, tagId]
        });
      }
      
      setName('');
      onTagCreated?.(tag);
      onClose();
    } catch (err) {
      console.error('Ошибка создания метки:', err);
      setError('Не удалось создать метку');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setName('');
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Создать метку"
      size="small"
    >
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Input
            label="Название метки"
            placeholder="Например: Минимализм"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={error || undefined}
            fullWidth
            clearable
            onClear={() => setName('')}
          />

          <div className="modal__footer" style={{ padding: 0, border: 'none' }}>
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={isCreating}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isCreating}
            >
              Создать метку
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default CreateTagModal;

