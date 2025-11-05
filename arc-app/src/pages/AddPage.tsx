/**
 * Страница добавления карточек
 */

import { Layout } from '../components/layout';

export const AddPage = () => {
  return (
    <Layout
      headerProps={{
        title: 'Добавить карточку'
      }}
      showSearch={false}
    >
      <div className="layout__empty-state">
        <h3 className="layout__empty-title">Добавление карточек</h3>
        <p className="layout__empty-text text-m">
          Функционал добавления карточек будет реализован в следующих этапах
        </p>
      </div>
    </Layout>
  );
};

export default AddPage;

