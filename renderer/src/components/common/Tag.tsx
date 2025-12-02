/**
 * Компонент Tag - метка для категоризации карточек
 * 
 * Ключевой элемент для классификации и краткого описания контента.
 * Метки имеют три состояния (default, hover, active) и два стиля (default, blurred).
 * 
 * @example
 * // Обычная метка
 * <Tag variant="default" count={42}>Минимализм</Tag>
 * 
 * // Активная метка с кнопкой удаления
 * <Tag variant="active" removable onRemove={handleRemove}>Архитектура</Tag>
 * 
 * // Размытая метка поверх изображения
 * <Tag variant="blurred" count={150}>Пейзаж</Tag>
 */

import type { HTMLAttributes, ReactNode } from 'react';
import { Tooltip } from './Tooltip';
import './Tag.css';

export interface TagProps extends HTMLAttributes<HTMLDivElement> {
  /** 
   * Визуальный стиль метки
   * - default: обычная метка на монотонном фоне
   * - active: выбранная метка (обычно с иконкой закрытия)
   * - blurred: метка с размытием для размещения поверх изображений
   */
  variant?: 'default' | 'active' | 'blurred';
  
  /** Размер метки */
  size?: 'small' | 'medium';
  
  /** Можно ли удалить метку (показывает иконку закрытия) */
  removable?: boolean;
  
  /** Обработчик удаления метки */
  onRemove?: () => void;
  
  /** @deprecated Цвет метки больше не используется */
  color?: string;
  
  /** 
   * Счётчик карточек с этой меткой
   * - 0: скрыт
   * - 1-999: отображается как есть
   * - ≥1000: форматируется как 1.2K (одна десятичная)
   */
  count?: number;
  
  /** Иконка слева от текста (опционально) */
  icon?: ReactNode;
  
  /** Описание метки для tooltip (опционально) */
  description?: string;
  
  /** ID метки для drag-and-drop */
  tagId?: string;
  
  /** Обработчик начала перетаскивания */
  onDragStart?: (tagId: string, event: React.DragEvent) => void;
  
  /** Обработчик окончания перетаскивания */
  onDragEnd?: (tagId: string, event: React.DragEvent) => void;
  
  /** Текст метки */
  children: ReactNode;
}

/**
 * Компонент Tag
 */
export const Tag = ({
  variant = 'default',
  size = 'medium',
  removable = false,
  onRemove,
  color,
  count,
  icon,
  description,
  tagId,
  onDragStart,
  onDragEnd,
  className = '',
  children,
  style,
  ...props
}: TagProps) => {
  const classNames = [
    'tag',
    `tag--${variant}`,
    `tag--${size}`,
    className
  ].filter(Boolean).join(' ');

  const tagStyle = style;

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.();
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (!tagId) return;
    
    // Устанавливаем данные для передачи
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tagId);
    e.dataTransfer.setData('application/tag-id', tagId);
    
    // Визуальная обратная связь
    e.currentTarget.style.opacity = '0.5';
    e.currentTarget.style.cursor = 'grabbing';
    
    // Создаем кастомное изображение для drag
    const dragImage = e.currentTarget.cloneNode(true) as HTMLElement;
    dragImage.style.width = `${e.currentTarget.offsetWidth}px`;
    dragImage.style.opacity = '0.9';
    document.body.appendChild(dragImage);
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    
    // Удаляем временный элемент после небольшой задержки
    setTimeout(() => {
      if (document.body.contains(dragImage)) {
        document.body.removeChild(dragImage);
      }
    }, 0);
    
    onDragStart?.(tagId, e);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (!tagId) return;
    
    // Восстанавливаем визуальное состояние
    e.currentTarget.style.opacity = '1';
    e.currentTarget.style.cursor = style?.cursor || 'grab';
    
    onDragEnd?.(tagId, e);
  };

  const isDraggable = Boolean(tagId);
  const finalStyle = {
    ...tagStyle,
    cursor: isDraggable ? (tagStyle?.cursor || 'grab') : tagStyle?.cursor
  };

  const tagContent = (
    <div
      className={classNames}
      draggable={isDraggable}
      onDragStart={isDraggable ? handleDragStart : undefined}
      onDragEnd={isDraggable ? handleDragEnd : undefined}
      style={finalStyle}
      {...props}
    >
      {icon && (
        <span className="tag__icon">
          {icon}
        </span>
      )}
      
      <span className="tag__text">
        {children}
      </span>
      
      {count !== undefined && count > 0 && (
        <span className="tag__count">
          {count >= 1000 ? `${(count / 1000).toFixed(1)}K` : count}
        </span>
      )}
      
      {removable && (
        <button
          type="button"
          className="tag__remove"
          onClick={handleRemoveClick}
          aria-label="Удалить метку"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M9 3L3 9M3 3L9 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </div>
  );

  // Если есть описание, оборачиваем в Tooltip
  if (description && description.trim()) {
    return (
      <Tooltip content={description} delay={500} position="top">
        {tagContent}
      </Tooltip>
    );
  }

  return tagContent;
};

export default Tag;

