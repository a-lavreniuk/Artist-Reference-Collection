/**
 * Модальное окно выбора папки
 * Стилизованная альтернатива системному dialog
 */

import { useState, useEffect } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { Input } from './Input';
import './FolderPickerModal.css';

export interface FolderPickerModalProps {
  /** Показывать ли модалку */
  isOpen: boolean;
  
  /** Заголовок */
  title: string;
  
  /** Описание */
  description?: string;
  
  /** Текущая папка (опционально) */
  currentPath?: string;
  
  /** Обработчик подтверждения */
  onConfirm: (path: string) => void;
  
  /** Обработчик отмены */
  onCancel: () => void;
}

/**
 * Компонент FolderPickerModal
 */
export const FolderPickerModal = ({
  isOpen,
  title,
  description,
  currentPath,
  onConfirm,
  onCancel
}: FolderPickerModalProps) => {
  const [selectedPath, setSelectedPath] = useState(currentPath || '');
  const [isSelecting, setIsSelecting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedPath(currentPath || '');
    }
  }, [isOpen, currentPath]);

  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  const handleSelectFolder = async () => {
    setIsSelecting(true);
    try {
      // Открываем системный диалог
      const path = await window.electronAPI.selectWorkingDirectory();
      if (path) {
        setSelectedPath(path);
      }
    } catch (error) {
      console.error('[FolderPicker] Ошибка выбора папки:', error);
    } finally {
      setIsSelecting(false);
    }
  };

  const handleConfirm = () => {
    if (selectedPath) {
      onConfirm(selectedPath);
    }
  };

  return (
    <div className="folder-picker-modal__backdrop" onClick={handleBackdropClick}>
      <div className="folder-picker-modal__container">
        {/* Заголовок */}
        <div className="folder-picker-modal__header">
          <h2>{title}</h2>
          <button
            className="folder-picker-modal__close"
            onClick={onCancel}
            aria-label="Закрыть"
          >
            <Icon name="x" size={24} variant="border" />
          </button>
        </div>

        {/* Описание */}
        {description && (
          <p className="folder-picker-modal__description">{description}</p>
        )}

        {/* Выбор папки */}
        <div className="folder-picker-modal__picker">
          <Input
            value={selectedPath}
            readOnly
            placeholder="Выберите папку..."
            style={{ flex: 1 }}
          />
          <Button
            variant="secondary"
            size="L"
            onClick={handleSelectFolder}
            disabled={isSelecting}
          >
            <Icon name="folder-open" size={16} variant="border" />
            {isSelecting ? 'Выбор...' : 'Обзор'}
          </Button>
        </div>

        {/* Текущая папка (если есть) */}
        {currentPath && currentPath !== selectedPath && (
          <div className="folder-picker-modal__current">
            <Icon name="folder" size={16} variant="border" />
            <span className="text-s">Текущая: {currentPath}</span>
          </div>
        )}

        {/* Действия */}
        <div className="folder-picker-modal__actions">
          <Button
            variant="secondary"
            size="L"
            onClick={onCancel}
          >
            Отмена
          </Button>
          <Button
            variant="primary"
            size="L"
            onClick={handleConfirm}
            disabled={!selectedPath}
          >
            Выбрать
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FolderPickerModal;

