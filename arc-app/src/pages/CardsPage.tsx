/**
 * Страница карточек - главная страница приложения
 */

import { useState } from 'react';
import { Layout } from '../components/layout';
import type { ViewMode, ContentFilter } from '../types';

export const CardsPage = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('standard');
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');
  const [searchValue, setSearchValue] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  return (
    <Layout
      headerProps={{
        title: 'Карточки',
        viewMode: {
          current: viewMode,
          onChange: setViewMode
        },
        contentFilter: {
          current: contentFilter,
          counts: {
            all: 0,
            images: 0,
            videos: 0
          },
          onChange: setContentFilter
        }
      }}
      searchProps={{
        value: searchValue,
        onChange: setSearchValue,
        selectedTags,
        onTagsChange: setSelectedTags
      }}
    >
      <div className="layout__empty-state">
        <div className="layout__empty-icon">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M4 4H10V10H4V4ZM14 4H20V10H14V4ZM14 14H20V20H14V14ZM4 14H10V20H4V14Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h3 className="layout__empty-title">Карточек пока нет</h3>
        <p className="layout__empty-text text-m">
          Добавьте первую карточку, чтобы начать работу с коллекцией референсов
        </p>
      </div>
    </Layout>
  );
};

export default CardsPage;

