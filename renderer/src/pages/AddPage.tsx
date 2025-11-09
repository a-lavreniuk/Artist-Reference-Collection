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
    totalCount?: number;
    currentIndex?: number;
  }>({});

  const handleComplete = () => {
    navigate('/');
  };

  const handleCancel = () => {
    if (confirm('Отменить добавление карточек? Все данные будут потеряны.')) {
      navigate('/');
    }
  };

  // Вычисляем количество оставшихся карточек
  const remainingCount = navigationCallbacks.totalCount 
    ? navigationCallbacks.totalCount - (navigationCallbacks.currentIndex || 0) - 1 
    : 0;

  // Формируем actions для header на основе текущего состояния
  const headerActions = navigationCallbacks.onPrevious || navigationCallbacks.onNext || navigationCallbacks.onFinish ? (
    <>
      <Button 
        variant="border" 
        size="L"
        iconOnly
        iconLeft={<Icon name="x" size={24} variant="border" />}
        onClick={handleCancel}
        title="Отмена"
      />
      
      <Button 
        variant="border" 
        size="L"
        iconLeft={<Icon name="arrow-left" size={24} variant="border" />}
        onClick={navigationCallbacks.onPrevious}
        disabled={!navigationCallbacks.canGoPrevious}
      >
        Назад
      </Button>
      
      {navigationCallbacks.isLastItem ? (
        <Button 
          variant="success" 
          size="L"
          iconLeft={<Icon name="plus" size={24} variant="border" />}
          onClick={navigationCallbacks.onFinish}
        >
          Добавить
        </Button>
      ) : (
        <Button 
          variant="primary" 
          size="L"
          iconRight={<Icon name="arrow-left" size={24} variant="border" style={{ transform: 'scaleX(-1)' }} />}
          onClick={navigationCallbacks.onNext}
          counter={remainingCount > 0 ? remainingCount : undefined}
        >
          Далее
        </Button>
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

