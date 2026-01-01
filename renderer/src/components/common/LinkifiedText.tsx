/**
 * Компонент LinkifiedText - отображает текст с кликабельными ссылками
 * Ссылки стилизуются как короткий текст вместо полного URL
 */

import { useCallback } from 'react';
import { parseLinks, getUrlDisplayText } from '../../utils/linkify';
import './LinkifiedText.css';

export interface LinkifiedTextProps {
  /** Текст для отображения */
  text: string;
  
  /** CSS класс для контейнера */
  className?: string;
}

/**
 * Компонент LinkifiedText
 */
export const LinkifiedText = ({ text, className = '' }: LinkifiedTextProps) => {
  const parts = parseLinks(text);

  /**
   * Обработчик клика по ссылке
   * Открывает ссылку в браузере по умолчанию через Electron API
   */
  const handleLinkClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    e.preventDefault();
    e.stopPropagation();

    console.log('[LinkifiedText] Клик по ссылке:', url);
    console.log('[LinkifiedText] window.electronAPI доступен:', !!window.electronAPI);
    console.log('[LinkifiedText] window.electronAPI.openExternal доступен:', !!window.electronAPI?.openExternal);

    // Открываем ссылку через Electron API
    if (window.electronAPI?.openExternal) {
      console.log('[LinkifiedText] Вызываем openExternal для URL:', url);
      window.electronAPI.openExternal(url)
        .then(() => {
          console.log('[LinkifiedText] Ссылка открыта успешно через Electron API');
        })
        .catch((error: any) => {
          console.error('[LinkifiedText] Ошибка открытия ссылки через Electron API:', error);
          // Fallback на window.open если Electron API не сработал
          console.log('[LinkifiedText] Используем fallback window.open');
          const opened = window.open(url, '_blank', 'noopener,noreferrer');
          if (!opened) {
            console.error('[LinkifiedText] Не удалось открыть ссылку через window.open (возможно, заблокирован popup blocker)');
          }
        });
    } else {
      console.warn('[LinkifiedText] openExternal не доступен, используем fallback window.open');
      // Fallback для веб-версии (если будет)
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (!opened) {
        console.error('[LinkifiedText] Не удалось открыть ссылку через window.open (возможно, заблокирован popup blocker)');
      }
    }
  }, []);

  if (parts.length === 0) {
    return null;
  }

  return (
    <div className={`linkified-text ${className}`} style={{ whiteSpace: 'pre-wrap' }}>
      {parts.map((part, index) => {
        if (part.type === 'link' && part.url) {
          const displayText = getUrlDisplayText(part.url);
          return (
            <a
              key={index}
              href={part.url}
              onClick={(e) => handleLinkClick(e, part.url!)}
              className="linkified-text__link"
              title={part.url}
              rel="noopener noreferrer"
              style={{ cursor: 'pointer' }}
            >
              {displayText}
            </a>
          );
        }
        return <span key={index}>{part.content}</span>;
      })}
    </div>
  );
};

export default LinkifiedText;

