/**
 * Страница настроек
 */

import { Layout } from '../components/layout';

export const SettingsPage = () => {
  return (
    <Layout
      headerProps={{
        title: 'Настройки'
      }}
      showSearch={false}
    >
      <div className="layout__empty-state">
        <h3 className="layout__empty-title">Настройки</h3>
        <p className="layout__empty-text text-m">
          Страница настроек будет реализована в следующих этапах
        </p>
      </div>
    </Layout>
  );
};

export default SettingsPage;

