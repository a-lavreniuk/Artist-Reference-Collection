/**
 * Компонент CreateCategoryModal - модальное окно создания категории
 */

import { useState } from 'react';
import { Modal, Button, Input } from '../common';
import type { Category } from '../../types';
import { addCategory } from '../../services/db';
import { logCreateCategory } from '../../services/history';

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
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Введите название категории');
      return;
    }

    try {
      setIsCreating(true);
      setError(null);

      const category: Category = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: name.trim(),
        dateCreated: new Date(),
        tagIds: []
      };

      await addCategory(category);
      
      // Логируем создание категории
      await logCreateCategory(category.name, category.tagIds.length);
      
      setName('');
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
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Создать категорию"
      size="medium"
    >
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Input
            label="Название категории"
            placeholder="Например: Стиль"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={error || undefined}
            fullWidth
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
              Создать категорию
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default CreateCategoryModal;

