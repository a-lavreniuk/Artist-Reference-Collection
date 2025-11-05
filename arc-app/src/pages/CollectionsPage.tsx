/**
 * Страница коллекций
 */

import { Layout } from '../components/layout';
import { Button } from '../components/common';

export const CollectionsPage = () => {
  return (
    <Layout
      headerProps={{
        title: 'Коллекции',
        actions: (
          <Button variant="primary" size="medium">
            Добавить коллекцию
          </Button>
        )
      }}
    >
      <div className="layout__empty-state">
        <h3 className="layout__empty-title">Коллекций пока нет</h3>
        <p className="layout__empty-text text-m">
          Создайте первую коллекцию для организации карточек
        </p>
      </div>
    </Layout>
  );
};

export default CollectionsPage;

