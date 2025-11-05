/**
 * Компонент SectionHeader - меню разделов
 * Отображает заголовок раздела и кнопки действий
 */

import { ReactNode } from 'react';
import { Button } from '../common';
import type { ViewMode, ContentFilter } from '../../types';
import './SectionHeader.css';

export interface SectionHeaderProps {
  /** Заголовок раздела */
  title: string;
  
  /** Кнопка "Назад" */
  backButton?: {
    label: string;
    onClick: () => void;
  };
  
  /** Переключатель вида (стандартный/компактный) */
  viewMode?: {
    current: ViewMode;
    onChange: (mode: ViewMode) => void;
  };
  
  /** Фильтр контента (всё/изображения/видео) */
  contentFilter?: {
    current: ContentFilter;
    counts?: {
      all: number;
      images: number;
      videos: number;
    };
    onChange: (filter: ContentFilter) => void;
  };
  
  /** Дополнительные кнопки действий */
  actions?: ReactNode;
}

/**
 * Компонент SectionHeader
 */
export const SectionHeader = ({
  title,
  backButton,
  viewMode,
  contentFilter,
  actions
}: SectionHeaderProps) => {
  const formatCount = (count: number): string => {
    if (count === 0) return '';
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return String(count);
  };

  return (
    <header className="section-header">
      <div className="section-header__left">
        {/* Кнопка назад */}
        {backButton && (
          <Button
            variant="ghost"
            size="medium"
            onClick={backButton.onClick}
            iconLeft={
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M19 12H5M5 12L12 19M5 12L12 5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          >
            {backButton.label}
          </Button>
        )}
        
        {/* Заголовок */}
        <h1 className="section-header__title">{title}</h1>
      </div>

      <div className="section-header__right">
        {/* Переключатель вида */}
        {viewMode && (
          <div className="section-header__view-mode">
            <button
              className={`section-header__view-button ${
                viewMode.current === 'standard' ? 'section-header__view-button--active' : ''
              }`}
              onClick={() => viewMode.onChange('standard')}
              title="Стандартный вид"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="2" />
                <rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="2" />
                <rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="2" />
                <rect x="14" y="14" width="7" height="7" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
            <button
              className={`section-header__view-button ${
                viewMode.current === 'compact' ? 'section-header__view-button--active' : ''
              }`}
              onClick={() => viewMode.onChange('compact')}
              title="Компактный вид"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="4" height="4" stroke="currentColor" strokeWidth="2" />
                <rect x="10" y="3" width="4" height="4" stroke="currentColor" strokeWidth="2" />
                <rect x="17" y="3" width="4" height="4" stroke="currentColor" strokeWidth="2" />
                <rect x="3" y="10" width="4" height="4" stroke="currentColor" strokeWidth="2" />
                <rect x="10" y="10" width="4" height="4" stroke="currentColor" strokeWidth="2" />
                <rect x="17" y="10" width="4" height="4" stroke="currentColor" strokeWidth="2" />
                <rect x="3" y="17" width="4" height="4" stroke="currentColor" strokeWidth="2" />
                <rect x="10" y="17" width="4" height="4" stroke="currentColor" strokeWidth="2" />
                <rect x="17" y="17" width="4" height="4" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
          </div>
        )}

        {/* Разделитель */}
        {viewMode && contentFilter && (
          <div className="section-header__divider" />
        )}

        {/* Фильтр контента */}
        {contentFilter && (
          <div className="section-header__content-filter">
            <button
              className={`section-header__filter-button ${
                contentFilter.current === 'all' ? 'section-header__filter-button--active' : ''
              }`}
              onClick={() => contentFilter.onChange('all')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
              </svg>
              <span>Всё</span>
              {contentFilter.counts && contentFilter.counts.all > 0 && (
                <span className="section-header__filter-count">
                  {formatCount(contentFilter.counts.all)}
                </span>
              )}
            </button>
            <button
              className={`section-header__filter-button ${
                contentFilter.current === 'images' ? 'section-header__filter-button--active' : ''
              }`}
              onClick={() => contentFilter.onChange('images')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M21 19V5C21 3.9 20.1 3 19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19ZM8.5 13.5L11 16.51L14.5 12L19 18H5L8.5 13.5Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Изображения</span>
              {contentFilter.counts && contentFilter.counts.images > 0 && (
                <span className="section-header__filter-count">
                  {formatCount(contentFilter.counts.images)}
                </span>
              )}
            </button>
            <button
              className={`section-header__filter-button ${
                contentFilter.current === 'videos' ? 'section-header__filter-button--active' : ''
              }`}
              onClick={() => contentFilter.onChange('videos')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M8 5V19L19 12L8 5Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Видео</span>
              {contentFilter.counts && contentFilter.counts.videos > 0 && (
                <span className="section-header__filter-count">
                  {formatCount(contentFilter.counts.videos)}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Разделитель */}
        {(viewMode || contentFilter) && actions && (
          <div className="section-header__divider" />
        )}

        {/* Дополнительные действия */}
        {actions && (
          <div className="section-header__actions">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
};

export default SectionHeader;

