/**
 * Страница добавления карточек
 * Drag & Drop, настройка меток, коллекций
 */

import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout';
import { AddCardFlow } from '../components/gallery';
import { useSearch } from '../contexts';

export const AddPage = () => {
  const navigate = useNavigate();
  const { searchProps } = useSearch();

  const handleComplete = () => {
    navigate('/');
  };

  const handleCancel = () => {
    if (confirm('Отменить добавление карточек? Все данные будут потеряны.')) {
      navigate('/');
    }
  };

  return (
    <Layout
      headerProps={{
        title: 'Добавить карточки'
      }}
      searchProps={searchProps}
    >
      <AddCardFlow
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    </Layout>
  );
};

export default AddPage;

