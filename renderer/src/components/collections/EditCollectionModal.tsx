/**
 * Компонент EditCollectionModal - модальное окно редактирования коллекции
 */

import { useState, useEffect } from 'react';
import { Modal, Button, Input } from '../common';
import type { Collection } from '../../types';
import { updateCollection } from '../../services/db';
import { logRenameCollection } from '../../services/history';
import { useAlert } from '../../hooks/useAlert';

export interface EditCollectionModalProps {
  /** Открыто ли модальное окно */
  isOpen: boolean;
  
  /** Коллекция для редактирования */
  collection: Collection | null;
  
  /** Обработчик закрытия */
  onClose: () => void;
  
  /** Обработчик успешного обновления */
  onCollectionUpdated?: () => void;
}

/**
 * Компонент EditCollectionModal
 */
export const EditCollectionModal = ({
  isOpen,
  collection,
  onClose,
  onCollectionUpdated
}: EditCollectionModalProps) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { showAlert } = useAlert();

  // Загружаем название коллекции при открытии
  useEffect(() => {
    if (isOpen && collection) {
      setName(collection.name);
      setError(null);
    }
  }, [isOpen, collection]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Введите название коллекции');
      return;
    }

    if (!collection) {
      setError('Коллекция не найдена');
      return;
    }

    // Если название не изменилось
    if (name.trim() === collection.name) {
      handleClose();
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const oldName = collection.name;
      
      // Обновляем коллекцию
      await updateCollection(collection.id, { name: name.trim() });
      
      // Логируем переименование
      await logRenameCollection(oldName, name.trim());
      
      // Уведомляем об успехе
      onCollectionUpdated?.();
      
      handleClose();
    } catch (err) {
      console.error('[EditCollectionModal] Ошибка сохранения:', err);
      setError('Не удалось сохранить изменения');
    } finally {
      setIsSaving(false);
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
            <h4 className="modal__title">Переименовать коллекцию</h4>
            <p className="create-collection-modal__subtitle">
              Введите новое название для коллекции
            </p>
          </div>

          {/* Инпут */}
          <Input
            placeholder="Название…"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            error={error || undefined}
            fullWidth
            className="create-collection-modal__input"
            autoFocus
            clearable
            onClear={() => {
              setName('');
              setError(null);
            }}
          />

          {/* Кнопки */}
          <div className="create-collection-modal__actions" style={{ justifyContent: 'flex-end' }}>
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
              Сохранить
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default EditCollectionModal;

