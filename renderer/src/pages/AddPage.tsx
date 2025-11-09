/**
 * Страница добавления карточек
 * Drag & Drop, настройка меток, коллекций
 */

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout';
import { Button, Icon } from '../components/common';
import { AddCardFlow } from '../components/gallery';
import { useSearch } from '../contexts';

export const AddPage = () => {
  const navigate = useNavigate();
  const { searchProps } = useSearch();
  const [configuredCount, setConfiguredCount] = useState(0);
  const [hasQueue, setHasQueue] = useState(false);
  const finishHandlerRef = useRef<(() => void) | null>(null);

  const handleComplete = () => {
    navigate('/');
  };

  const handleCancel = () => {
    if (confirm('Отменить добавление карточек? Все данные будут потеряны.')) {
      navigate('/');
    }
  };

  const handleAddClick = () => {
    if (finishHandlerRef.current) {
      finishHandlerRef.current();
    }
  };

  // Формируем actions для header - только кнопки Отмена и Добавить
  const headerActions = hasQueue ? (
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
        variant="success" 
        size="L"
        iconLeft={<Icon name="plus" size={24} variant="border" />}
        counter={configuredCount}
        disabled={configuredCount === 0}
        onClick={handleAddClick}
      >
        Добавить
      </Button>
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
        onQueueStateChange={(hasQueue, configuredCount) => {
          setHasQueue(hasQueue);
          setConfiguredCount(configuredCount);
        }}
        onFinishHandlerReady={(handler) => {
          finishHandlerRef.current = handler;
        }}
      />
    </Layout>
  );
};

export default AddPage;

