/**
 * Компонент CreateCollectionModal - модальное окно создания коллекции
 */

import { useState } from 'react';
import { Modal, Button, Input } from '../common';
import type { Collection } from '../../types';
import { addCollection } from '../../services/db';
import { logCreateCollection } from '../../services/history';

export interface CreateCollectionModalProps {
  /** Открыто ли модальное окно */
  isOpen: boolean;
  
  /** Обработчик закрытия */
  onClose: () => void;
  
  /** Обработчик создания коллекции */
  onCollectionCreated?: (collection: Collection) => void;
}

/**
 * Компонент CreateCollectionModal
 */
export const CreateCollectionModal = ({
  isOpen,
  onClose,
  onCollectionCreated
}: CreateCollectionModalProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Валидация
    if (!name.trim()) {
      setError('Введите название коллекции');
      return;
    }

    try {
      setIsCreating(true);
      setError(null);

      // Создаём коллекцию
      const collection: Collection = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: name.trim(),
        description: description.trim() || undefined,
        dateCreated: new Date(),
        dateModified: new Date(),
        cardIds: [],
        thumbnails: []
      };

      await addCollection(collection);
      
      // Логируем создание коллекции
      await logCreateCollection(collection.name, collection.cardIds.length);
      
      // Очищаем форму
      setName('');
      setDescription('');
      
      // Вызываем callback
      onCollectionCreated?.(collection);
      onClose();
    } catch (err) {
      console.error('Ошибка создания коллекции:', err);
      setError('Не удалось создать коллекцию');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Создать коллекцию"
      size="medium"
    >
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Название */}
          <Input
            label="Название коллекции"
            placeholder="Например: Проект интерьера гостиной"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={error || undefined}
            fullWidth
            autoFocus
          />

          {/* Описание */}
          <div>
            <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>
              Описание (опционально)
            </label>
            <textarea
              className="input"
              placeholder="Добавьте описание коллекции..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          {/* Кнопки */}
          <div className="modal__footer" style={{ padding: 0, border: 'none', marginTop: '8px' }}>
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
              Создать коллекцию
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default CreateCollectionModal;

