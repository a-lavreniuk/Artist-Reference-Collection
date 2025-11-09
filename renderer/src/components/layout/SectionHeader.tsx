/**
 * Компонент SectionHeader - меню разделов
 * Отображает заголовок раздела и кнопки действий
 */

import type { ReactNode } from 'react';
import { Button, Icon } from '../common';
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
            size="L"
            onClick={backButton.onClick}
            iconLeft={<Icon name="arrow-left" size={24} variant="border" />}
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
              <Icon 
                name="grid-default" 
                size={24} 
                variant={viewMode.current === 'standard' ? 'fill' : 'border'} 
              />
            </button>
            <button
              className={`section-header__view-button ${
                viewMode.current === 'compact' ? 'section-header__view-button--active' : ''
              }`}
              onClick={() => viewMode.onChange('compact')}
              title="Компактный вид"
            >
              <Icon 
                name="grid-small" 
                size={24} 
                variant={viewMode.current === 'compact' ? 'fill' : 'border'} 
              />
            </button>
          </div>
        )}

        {/* Дополнительные действия - идут сразу после переключателей вида */}
        {actions && (
          <div className="section-header__actions">
            {actions}
          </div>
        )}

        {/* Разделитель между actions и фильтрами */}
        {actions && contentFilter && (
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
              <Icon 
                name="images" 
                size={24} 
                variant={contentFilter.current === 'all' ? 'fill' : 'border'} 
              />
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
              <Icon 
                name="image" 
                size={24} 
                variant={contentFilter.current === 'images' ? 'fill' : 'border'} 
              />
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
              <Icon 
                name="play-circle" 
                size={24} 
                variant={contentFilter.current === 'videos' ? 'fill' : 'border'} 
              />
              <span>Видео</span>
              {contentFilter.counts && contentFilter.counts.videos > 0 && (
                <span className="section-header__filter-count">
                  {formatCount(contentFilter.counts.videos)}
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default SectionHeader;

