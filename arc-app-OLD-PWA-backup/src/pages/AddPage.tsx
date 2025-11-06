/**
 * Страница добавления карточек
 * Drag & Drop, настройка меток, коллекций
 */

import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout';
import { AddCardFlow } from '../components/gallery';

export const AddPage = () => {
  const navigate = useNavigate();

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
      showSearch={false}
    >
      <AddCardFlow
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    </Layout>
  );
};

export default AddPage;

