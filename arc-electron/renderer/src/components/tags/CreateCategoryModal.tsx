/**
 * Компонент CreateCategoryModal - модальное окно создания категории
 */

import { useState } from 'react';
import { Modal, Button, Input } from '../common';
import type { Category } from '../../types';
import { addCategory } from '../../services/db';

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
  const [color, setColor] = useState('#93919A');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const colors = [
    { value: '#F48683', label: 'Красный' },
    { value: '#F2D98D', label: 'Жёлтый' },
    { value: '#7ED6A8', label: 'Зелёный' },
    { value: '#93919A', label: 'Серый' },
    { value: '#A9A7AF', label: 'Светло-серый' }
  ];

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
        color,
        dateCreated: new Date(),
        tagIds: []
      };

      await addCategory(category);
      
      setName('');
      setColor('#93919A');
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
    setColor('#93919A');
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

          <div>
            <label className="input-label" style={{ marginBottom: '12px', display: 'block' }}>
              Цвет категории
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {colors.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '8px',
                    border: color === c.value ? '3px solid var(--color-grayscale-900)' : '1px solid var(--border-default)',
                    backgroundColor: c.value,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

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

