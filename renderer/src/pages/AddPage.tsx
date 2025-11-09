/**
 * Страница добавления карточек
 * Drag & Drop, настройка меток, коллекций
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout';
import { Button, Icon } from '../components/common';
import { AddCardFlow } from '../components/gallery';
import { useSearch } from '../contexts';

export const AddPage = () => {
  const navigate = useNavigate();
  const { searchProps } = useSearch();
  const [navigationCallbacks, setNavigationCallbacks] = useState<{
    onPrevious?: () => void;
    onNext?: () => void;
    onFinish?: () => void;
    canGoPrevious?: boolean;
    canGoNext?: boolean;
    isLastItem?: boolean;
  }>({});

  const handleComplete = () => {
    navigate('/');
  };

  const handleCancel = () => {
    if (confirm('Отменить добавление карточек? Все данные будут потеряны.')) {
      navigate('/');
    }
  };

  // Формируем actions для header на основе текущего состояния
  const headerActions = navigationCallbacks.onPrevious || navigationCallbacks.onNext || navigationCallbacks.onFinish ? (
    <>
      <Button 
        variant="ghost" 
        size="L"
        onClick={handleCancel}
      >
        Отмена
      </Button>
      
      <Button 
        variant="border" 
        size="L"
        iconOnly
        iconLeft={<Icon name="arrow-left" size={24} variant="border" />}
        onClick={navigationCallbacks.onPrevious}
        disabled={!navigationCallbacks.canGoPrevious}
        title="Назад"
      />
      
      {navigationCallbacks.isLastItem ? (
        <Button 
          variant="success" 
          size="L"
          onClick={navigationCallbacks.onFinish}
        >
          Завершить
        </Button>
      ) : (
        <Button 
          variant="border" 
          size="L"
          iconOnly
          iconLeft={<Icon name="arrow-left" size={24} variant="border" style={{ transform: 'scaleX(-1)' }} />}
          onClick={navigationCallbacks.onNext}
          disabled={!navigationCallbacks.canGoNext}
          title="Далее"
        />
      )}
    </>
  ) : null;

  return (
    <Layout
      headerProps={{
        title: 'Добавить карточки',
        actions: headerActions
      }}
      searchProps={searchProps}
    >
      <AddCardFlow
        onComplete={handleComplete}
        onCancel={handleCancel}
        onNavigationChange={setNavigationCallbacks}
      />
    </Layout>
  );
};

export default AddPage;

