/**
 * Страница категорий и меток
 */

import { Layout } from '../components/layout';
import { Button } from '../components/common';

export const TagsPage = () => {
  return (
    <Layout
      headerProps={{
        title: 'Категории и метки',
        actions: (
          <Button variant="primary" size="medium">
            Добавить категорию
          </Button>
        )
      }}
      showSearch={false}
    >
      <div className="layout__empty-state">
        <h3 className="layout__empty-title">Категорий и меток пока нет</h3>
        <p className="layout__empty-text text-m">
          Создайте первую категорию и добавьте метки для организации карточек
        </p>
      </div>
    </Layout>
  );
};

export default TagsPage;

