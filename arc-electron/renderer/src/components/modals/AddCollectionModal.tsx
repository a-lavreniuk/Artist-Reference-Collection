/**
 * Модальное окно добавления новой коллекции
 */

import { useState } from 'react';
import { ButtonSmall } from '../common/ButtonSmall';
import './AddCollectionModal.css';

interface AddCollectionModalProps {
  /** Функция закрытия модального окна */
  onClose: () => void;
  /** Функция создания коллекции */
  onCreate: (name: string) => void;
}

/**
 * Компонент модального окна для добавления новой коллекции
 */
export function AddCollectionModal({ onClose, onCreate }: AddCollectionModalProps) {
  const [collectionName, setCollectionName] = useState('');

  /**
   * Обработчик создания коллекции
   */
  const handleCreate = () => {
    if (collectionName.trim()) {
      onCreate(collectionName.trim());
      setCollectionName('');
    }
  };

  /**
   * Обработчик нажатия Enter в инпуте
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && collectionName.trim()) {
      handleCreate();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="add-collection-modal" onClick={(e) => e.stopPropagation()}>
        {/* Заголовок и подзаголовок */}
        <div className="add-collection-modal__header">
          <h2 className="add-collection-modal__title">Новая коллекция</h2>
          <p className="add-collection-modal__subtitle">
            Для новой коллекции нужно название
          </p>
        </div>

        {/* Инпут для названия */}
        <input
          type="text"
          className="add-collection-modal__input"
          placeholder="Название…"
          value={collectionName}
          onChange={(e) => setCollectionName(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />

        {/* Кнопки действий */}
        <div className="add-collection-modal__actions">
          <ButtonSmall variant="secondary" onClick={onClose}>
            Отмена
          </ButtonSmall>
          <ButtonSmall
            variant="primary"
            onClick={handleCreate}
            disabled={!collectionName.trim()}
            icon={
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
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
          </ButtonSmall>
        </div>
      </div>
    </div>
  );
}

