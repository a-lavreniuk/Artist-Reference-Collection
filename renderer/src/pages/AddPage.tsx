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
import { useToast } from '../hooks/useToast';
import { useAlert } from '../hooks/useAlert';

export const AddPage = () => {
  const navigate = useNavigate();
  const { searchProps } = useSearch();
  const toast = useToast();
  const alert = useAlert();
  const [configuredCount, setConfiguredCount] = useState(0);
  const [hasQueue, setHasQueue] = useState(false);
  const finishHandlerRef = useRef<(() => void) | null>(null);
  const openFileDialogRef = useRef<(() => void) | null>(null);

  const handleComplete = (addedCount: number) => {
    // Показываем успешное уведомление
    alert.success(`Добавлено карточек: ${addedCount}`);
    navigate('/');
  };

  const handleCancel = () => {
    if (hasQueue && configuredCount > 0) {
      toast.showToast({
        title: 'Отменить добавление',
        message: 'Вы уверены что хотите отменить? Все несохранённые карточки будут удалены',
        type: 'error',
        onConfirm: () => {
          navigate('/');
        },
        confirmText: 'Отменить',
        cancelText: 'Продолжить редактирование'
      });
    } else {
      navigate('/');
    }
  };

  const handleAddClick = () => {
    if (finishHandlerRef.current) {
      finishHandlerRef.current();
    }
  };

  const handleOpenFileDialog = () => {
    if (openFileDialogRef.current) {
      openFileDialogRef.current();
    }
  };

  // Формируем actions для header
  const headerActions = hasQueue ? (
    // Когда есть очередь - кнопки Отмена и Добавить
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
        iconRight={<Icon name="plus" size={24} variant="border" />}
        counter={configuredCount}
        disabled={configuredCount === 0}
        onClick={handleAddClick}
      >
        Добавить
      </Button>
    </>
  ) : (
    // Когда нет очереди (drag-&-drop экран) - кнопка Добавить
    <Button 
      variant="primary" 
      size="L"
      iconRight={<Icon name="plus" size={24} variant="border" />}
      onClick={handleOpenFileDialog}
    >
      Добавить
    </Button>
  );

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
        onOpenFileDialogReady={(handler) => {
          openFileDialogRef.current = handler;
        }}
      />
    </Layout>
  );
};

export default AddPage;

