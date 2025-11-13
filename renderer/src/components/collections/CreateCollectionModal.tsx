/**
 * Компонент CreateCollectionModal - модальное окно создания коллекции
 */

import { useState } from 'react';
import { Modal, Button, Input } from '../common';
import type { Collection } from '../../types';
import { addCollection } from '../../services/db';
import { logCreateCollection } from '../../services/history';
import { useAlert } from '../../hooks/useAlert';
import './CreateCollectionModal.css';

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
  const alert = useAlert();
  const [name, setName] = useState('');
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
        description: undefined,
        dateCreated: new Date(),
        dateModified: new Date(),
        cardIds: [],
        thumbnails: []
      };

      await addCollection(collection);
      
      // Логируем создание коллекции
      await logCreateCollection(collection.name, collection.cardIds.length);
      
      // Показываем успешное уведомление
      alert.success(`Коллекция "${collection.name}" создана`);
      
      // Очищаем форму
      setName('');
      
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
    setError(null);
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
        <div className="create-collection-modal">
          {/* Заголовок и подзаголовок вместе */}
          <div className="create-collection-modal__header">
            <h4 className="modal__title">Новая коллекция</h4>
            <p className="create-collection-modal__subtitle">
              Для новой коллекции нужно название
            </p>
          </div>

          {/* Инпут */}
          <Input
            placeholder="Название…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={error || undefined}
            fullWidth
            className="create-collection-modal__input"
            autoFocus
            clearable
            onClear={() => setName('')}
          />

          {/* Кнопки */}
          <div className="create-collection-modal__actions" style={{ justifyContent: 'flex-end' }}>
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

export default CreateCollectionModal;

