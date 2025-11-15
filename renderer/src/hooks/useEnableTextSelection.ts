/**
 * Хук для принудительного включения выделения текста в инпутах
 * Решает проблему с блокировкой выделения в Electron
 */

import { useEffect } from 'react';

export const useEnableTextSelection = () => {
  useEffect(() => {
    // Глобальный обработчик на document, который принудительно разрешает события на инпутах
    const handleDocumentPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('input, textarea'))) {
        // Это инпут - не блокируем событие
        return;
      }
    };

    const handleDocumentMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('input, textarea'))) {
        // Это инпут - не блокируем событие
        return;
      }
    };

    // Функция для принудительного включения выделения текста
    const enableTextSelection = () => {
      // Находим все инпуты и textarea
      const inputs = document.querySelectorAll('input, textarea');
      
      inputs.forEach((input) => {
        const element = input as HTMLInputElement | HTMLTextAreaElement;
        
        // Устанавливаем стили напрямую через JavaScript
        element.style.userSelect = 'text';
        element.style.webkitUserSelect = 'text';
        (element.style as any).MozUserSelect = 'text';
        (element.style as any).msUserSelect = 'text';
        element.style.cursor = 'text';
        element.style.pointerEvents = 'auto';
        
        // Убеждаемся, что инпут может получать фокус
        element.setAttribute('tabindex', '0');
      });
    };

    // Добавляем глобальные обработчики на document
    document.addEventListener('pointerdown', handleDocumentPointerDown, { capture: true });
    document.addEventListener('mousedown', handleDocumentMouseDown, { capture: true });

    // Запускаем при монтировании
    enableTextSelection();

    // Запускаем при изменении DOM (когда появляются новые инпуты)
    const observer = new MutationObserver(() => {
      // Небольшая задержка чтобы инпуты успели отрендериться
      setTimeout(enableTextSelection, 10);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown, { capture: true });
      document.removeEventListener('mousedown', handleDocumentMouseDown, { capture: true });
      observer.disconnect();
    };
  }, []);
};

export default useEnableTextSelection;

