/**
 * Страница мудборда
 */

import { useState } from 'react';
import { Layout } from '../components/layout';
import { Button } from '../components/common';
import type { ViewMode, ContentFilter } from '../types';

export const MoodboardPage = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('standard');
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');

  return (
    <Layout
      headerProps={{
        title: 'Мудборд',
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
        },
        actions: (
          <>
            <Button variant="secondary" size="medium">
              Выгрузить мудборд
            </Button>
            <Button variant="danger" size="medium">
              Удалить мудборд
            </Button>
          </>
        )
      }}
      showSearch={false}
    >
      <div className="layout__empty-state">
        <h3 className="layout__empty-title">Мудборд пуст</h3>
        <p className="layout__empty-text text-m">
          Добавьте карточки в мудборд для временного хранения референсов
        </p>
      </div>
    </Layout>
  );
};

export default MoodboardPage;

