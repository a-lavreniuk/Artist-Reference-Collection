/**
 * Модальное окно "Что нового?"
 * Показывает изменения в новой версии приложения
 */

import { Icon } from './Icon';
import { Button } from './Button';
import type { VersionChange } from '../../data/changelog';
import './WhatsNewModal.css';

export interface WhatsNewModalProps {
  /** Показывать ли модалку */
  isOpen: boolean;
  
  /** Обработчик закрытия */
  onClose: () => void;
  
  /** Массив изменений версий (от новых к старым) */
  versions: VersionChange[];
}

/**
 * Компонент WhatsNewModal
 */
export const WhatsNewModal = ({ isOpen, onClose, versions }: WhatsNewModalProps) => {
  if (!isOpen || versions.length === 0) {
    return null;
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="whats-new-modal__backdrop" onClick={handleBackdropClick}>
      <div className="whats-new-modal__container">
        {/* Заголовок */}
        <div className="whats-new-modal__header">
          <h2 className="h2">ЧТО НОВОГО?</h2>
          <button
            className="whats-new-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <Icon name="x" size={24} variant="border" />
          </button>
        </div>

        {/* Контент с версиями */}
        <div className="whats-new-modal__content">
          {versions.map((version, index) => (
            <div key={version.version} className="whats-new-modal__version">
              {/* Версия и дата */}
              <div className="whats-new-modal__version-header">
                <h3 className="h3">{version.version}</h3>
                <p className="text-s whats-new-modal__date">{version.date}</p>
              </div>

              {/* Список изменений */}
              <ul className="whats-new-modal__changes">
                {version.changes.map((change, changeIndex) => (
                  <li key={changeIndex} className="text-m">
                    {change}
                  </li>
                ))}
              </ul>

              {/* Разделитель между версиями */}
              {index < versions.length - 1 && (
                <div className="whats-new-modal__divider" />
              )}
            </div>
          ))}
        </div>

        {/* Кнопка закрытия внизу */}
        <div className="whats-new-modal__footer">
          <Button
            variant="primary"
            size="L"
            onClick={onClose}
            style={{ width: '100%' }}
          >
            Понятно
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WhatsNewModal;

