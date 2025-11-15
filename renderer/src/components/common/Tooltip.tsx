/**
 * Компонент Tooltip - подсказка при наведении
 * Используется для отображения описаний меток
 */

import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import './Tooltip.css';

export interface TooltipProps {
  /** Содержимое tooltip */
  content: string;
  
  /** Дочерний элемент, на который навешивается tooltip */
  children: React.ReactElement;
  
  /** Задержка показа в миллисекундах (по умолчанию 500) */
  delay?: number;
  
  /** Позиция tooltip относительно элемента */
  position?: 'top' | 'bottom' | 'left' | 'right';
  
  /** Дополнительный className */
  className?: string;
}

/**
 * Компонент Tooltip
 */
export const Tooltip = ({
  content,
  children,
  delay = 500,
  position = 'top',
  className = ''
}: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Обработчик входа мыши
  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  // Обработчик выхода мыши
  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
    setTooltipPosition(null);
  };

  // Обновление позиции tooltip
  const updateTooltipPosition = () => {
    if (!wrapperRef.current || !tooltipRef.current) return;

    const wrapperRect = wrapperRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    
    // Если tooltip еще не отрендерился (размеры равны 0), откладываем расчет
    if (tooltipRect.width === 0 || tooltipRect.height === 0) {
      requestAnimationFrame(updateTooltipPosition);
      return;
    }
    
    let top = 0;
    let left = 0;

    // Убеждаемся, что используем правильную позицию
    const actualPosition = position || 'top';
    
    switch (actualPosition) {
      case 'top':
        // Позиционируем над меткой на расстоянии 4px
        // top = верх метки - высота tooltip - 4px отступа
        top = wrapperRect.top - tooltipRect.height - 4;
        // Центрируем по горизонтали: центр метки = центр tooltip
        // Центр метки: wrapperRect.left + wrapperRect.width / 2
        // Центр tooltip: left + tooltipRect.width / 2
        // Решаем: left = wrapperRect.left + wrapperRect.width / 2 - tooltipRect.width / 2
        left = wrapperRect.left + (wrapperRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'bottom':
        top = wrapperRect.bottom + 4;
        left = wrapperRect.left + (wrapperRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = wrapperRect.top + (wrapperRect.height - tooltipRect.height) / 2;
        left = wrapperRect.left - tooltipRect.width - 4;
        break;
      case 'right':
        top = wrapperRect.top + (wrapperRect.height - tooltipRect.height) / 2;
        left = wrapperRect.right + 4;
        break;
      default:
        // По умолчанию сверху
        top = wrapperRect.top - tooltipRect.height - 4;
        left = wrapperRect.left + (wrapperRect.width - tooltipRect.width) / 2;
        break;
    }

    // Проверка границ экрана и корректировка позиции (только если tooltip выходит за границы)
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Корректируем только если tooltip действительно выходит за границы
    if (left < 8) {
      left = 8;
    } else if (left + tooltipRect.width > viewportWidth - 8) {
      left = viewportWidth - tooltipRect.width - 8;
    }
    
    if (top < 8) {
      // Если tooltip выходит за верхнюю границу, показываем его снизу
      if (actualPosition === 'top') {
        top = wrapperRect.bottom + 4;
      } else {
        top = 8;
      }
    } else if (top + tooltipRect.height > viewportHeight - 8) {
      top = viewportHeight - tooltipRect.height - 8;
    }

    setTooltipPosition({ top, left });
  };

  // Обновление позиции при изменении видимости
  // Используем useLayoutEffect для синхронного расчета позиции перед отрисовкой
  useLayoutEffect(() => {
    if (isVisible) {
      // Сначала скрываем tooltip, чтобы он не был виден в неправильной позиции
      setTooltipPosition(null);
      
      // Ждем, пока tooltip отрендерится в DOM (даже если скрыт)
      // Используем двойной requestAnimationFrame для гарантии, что DOM обновлен
      let rafId1: number;
      let rafId2: number;
      
      rafId1 = requestAnimationFrame(() => {
        rafId2 = requestAnimationFrame(() => {
          if (tooltipRef.current && wrapperRef.current) {
            updateTooltipPosition();
          }
        });
      });
      
      return () => {
        cancelAnimationFrame(rafId1);
        if (rafId2) cancelAnimationFrame(rafId2);
      };
    } else {
      // Сбрасываем позицию при скрытии
      setTooltipPosition(null);
    }
  }, [isVisible, position]);

  // Добавляем обработчики скролла и ресайза только после того, как позиция установлена
  useEffect(() => {
    if (isVisible && tooltipPosition) {
      window.addEventListener('scroll', updateTooltipPosition, true);
      window.addEventListener('resize', updateTooltipPosition);
      
      return () => {
        window.removeEventListener('scroll', updateTooltipPosition, true);
        window.removeEventListener('resize', updateTooltipPosition);
      };
    }
  }, [isVisible, tooltipPosition]);

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Клонируем дочерний элемент и добавляем обработчики
  const childWithHandlers = React.cloneElement(children, {
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    ref: (node: HTMLElement | null) => {
      wrapperRef.current = node;
      // Сохраняем оригинальный ref если он есть
      const originalRef = (children as any).ref;
      if (originalRef) {
        if (typeof originalRef === 'function') {
          originalRef(node);
        } else if (originalRef && 'current' in originalRef) {
          (originalRef as React.MutableRefObject<HTMLElement | null>).current = node;
        }
      }
    }
  } as any);

  return (
    <div className={`tooltip-wrapper ${className}`}>
      {childWithHandlers}
      {isVisible && content && (
        <div
          ref={tooltipRef}
          className={`tooltip tooltip--${position}`}
          style={{
            position: 'fixed',
            top: tooltipPosition ? `${tooltipPosition.top}px` : '-9999px',
            left: tooltipPosition ? `${tooltipPosition.left}px` : '-9999px',
            zIndex: 10000,
            visibility: tooltipPosition ? 'visible' : 'hidden',
            opacity: tooltipPosition ? 1 : 0,
            pointerEvents: 'none',
            transform: tooltipPosition ? 'none' : undefined,
            transition: tooltipPosition ? 'none' : undefined
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
};

export default Tooltip;

