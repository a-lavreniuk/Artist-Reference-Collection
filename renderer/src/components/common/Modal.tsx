/**
 * Компонент Modal - модальное окно
 * Базовый компонент для всех модальных окон приложения
 */

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './Modal.css';

export interface ModalProps {
  /** Открыто ли модальное окно */
  isOpen: boolean;
  
  /** Обработчик закрытия */
  onClose: () => void;
  
  /** Заголовок модального окна */
  title?: string;
  
  /** Размер модального окна */
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
  
  /** Закрывать ли при клике на overlay */
  closeOnOverlayClick?: boolean;
  
  /** Показывать ли кнопку закрытия */
  showCloseButton?: boolean;
  
  /** Дочерние элементы */
  children: ReactNode;
  
  /** Дополнительный className */
  className?: string;
  
  /** Класс для overlay */
  overlayClassName?: string;
}

/**
 * Компонент Modal
 */
export const Modal = ({
  isOpen,
  onClose,
  title,
  size = 'medium',
  closeOnOverlayClick = true,
  showCloseButton = true,
  children,
  className = '',
  overlayClassName = ''
}: ModalProps) => {
  // Блокируем скролл body когда модальное окно открыто
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Закрытие по Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      onClose();
    }
  };

  const modalClassNames = [
    'modal',
    `modal--${size}`,
    className
  ].filter(Boolean).join(' ');

  const overlayClassNames = [
    'modal-overlay',
    overlayClassName
  ].filter(Boolean).join(' ');

  // Для modal--medium не рендерим header через Modal, только через children
  const isMediumSize = size === 'medium';
  const shouldRenderHeader = !isMediumSize && (title || showCloseButton);

  return createPortal(
    <div className={overlayClassNames} onClick={handleOverlayClick}>
      <div 
        className={modalClassNames} 
        role="dialog" 
        aria-modal="true"
        style={isMediumSize ? {
          maxWidth: '822px',
          width: '822px',
          padding: '40px',
          gap: '16px'
        } : undefined}
      >
        {/* Шапка модального окна (только для не-medium размеров) */}
        {shouldRenderHeader && (
          <div className="modal__header">
            {title && (
              <h4 className="modal__title">{title}</h4>
            )}
            {showCloseButton && (
              <button
                type="button"
                className="modal__close"
                onClick={onClose}
                aria-label="Закрыть"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M18 6L6 18M6 6L18 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Содержимое модального окна */}
        <div className="modal__content">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;

