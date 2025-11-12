/**
 * Тестовая страница для демонстрации Alert и Toast компонентов
 * Временная страница для разработки системы уведомлений
 */

import { useState } from 'react';
import { Layout } from '../components/layout';
import { Button, Icon } from '../components/common';
import { useDialog, useAlert } from '../hooks';
import { useToast } from '../hooks/useToast';
import type { SearchProps } from '../components/layout/SearchBar';

export const TestNotificationsPage = () => {
  const dialog = useDialog();
  const alert = useAlert();
  const toast = useToast();
  const [lastResult, setLastResult] = useState<string>('');

  // Пустые props для SearchBar (не используем на этой странице)
  const searchProps: SearchProps = {
    value: '',
    onChange: () => {},
    selectedTags: [],
    onTagsChange: () => {},
    onCardClick: () => {},
    onSearchAction: () => {},
    isMenuOpen: false,
    setIsMenuOpen: () => {}
  };

  // ========== ALERT TESTS ==========

  const handleConfirmDefault = async () => {
    const result = await dialog.confirm({
      title: 'Подтвердите действие',
      description: 'Вы уверены, что хотите выполнить это действие?',
      confirmText: 'Подтвердить',
      cancelText: 'Отмена'
    });
    setLastResult(result ? '✅ Подтверждено' : '❌ Отменено');
  };

  const handleConfirmDestructive = async () => {
    const result = await dialog.confirm({
      title: 'Удалить карточку?',
      description: 'Это действие нельзя отменить. Карточка будет удалена безвозвратно.',
      icon: 'trash-3',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      variant: 'destructive'
    });
    setLastResult(result ? '🗑️ Удалено' : '❌ Отменено');
  };

  const handleConfirmWithIcon = async () => {
    const result = await dialog.confirm({
      title: 'Сменить местоположение хранилища?',
      description: 'Смена папки сохранения приведёт к тому что потеряются все настроенные связи.',
      icon: 'folder-output',
      confirmText: 'Перенести',
      cancelText: 'Отмена',
      variant: 'destructive'
    });
    setLastResult(result ? '📦 Перенесено' : '❌ Отменено');
  };

  const handleInfoDialog = async () => {
    await dialog.info({
      title: 'Информация',
      description: 'Это информационное окно. Оно показывает важную информацию пользователю и требует только подтверждения.',
      confirmText: 'Понятно'
    });
    setLastResult('ℹ️ Информация прочитана');
  };

  const handlePromptDialog = async () => {
    const result = await dialog.prompt({
      title: 'Введите название',
      description: 'Создание новой коллекции. Введите название для новой коллекции.',
      defaultValue: 'Без названия',
      placeholder: 'Название коллекции...',
      confirmText: 'Создать',
      cancelText: 'Отмена'
    });
    
    if (result !== null) {
      setLastResult(`📝 Введено: "${result}"`);
    } else {
      setLastResult('❌ Отменено');
    }
  };

  const handleLongTextDialog = async () => {
    await dialog.info({
      title: 'Очень длинный текст',
      description: `Это пример диалога с очень длинным текстом.
      
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 

Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.

Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.`,
      confirmText: 'OK'
    });
    setLastResult('📄 Длинный текст прочитан');
  };

  // ========== TOAST TESTS ==========

  const handleToastSuccess = () => {
    toast.success('Карточка успешно добавлена!');
    setLastResult('✅ Success toast показан');
  };

  const handleToastError = () => {
    toast.error('Ошибка загрузки файла. Попробуйте снова.');
    setLastResult('❌ Error toast показан');
  };

  const handleToastInfo = () => {
    toast.info('Настройки сохранены');
    setLastResult('ℹ️ Info toast показан');
  };

  const handleMultipleToasts = () => {
    toast.success('Первый toast');
    setTimeout(() => toast.error('Второй toast'), 200);
    setTimeout(() => toast.info('Третий toast'), 400);
    setTimeout(() => toast.success('Четвертый toast'), 600);
    setLastResult('📚 Показано 4 toast');
  };

  // ========== ALERT TESTS ==========

  const handleAlertSuccess = () => {
    alert.success('Complited');
    setLastResult('✅ Success alert показан');
  };

  const handleAlertError = () => {
    alert.error('An error occurred!');
    setLastResult('❌ Error alert показан');
  };

  const handleAlertWarning = () => {
    alert.warning('Some information is missing!');
    setLastResult('⚠️ Warning alert показан');
  };

  const handleAlertInfo = () => {
    alert.info('Are you sure?');
    setLastResult('ℹ️ Info alert показан');
  };

  return (
    <Layout
      title="Тестирование уведомлений"
      subtitle="Демонстрация Alert и Toast компонентов"
      searchProps={searchProps}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-2xl)',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%'
      }}>
        
        {/* Результат последнего действия */}
        {lastResult && (
          <div style={{
            padding: 'var(--spacing-xl)',
            backgroundColor: 'var(--color-grayscale-100)',
            borderRadius: 'var(--radius-m)',
            border: '2px solid var(--border-default)'
          }}>
            <p className="text-m" style={{
              fontWeight: 'var(--font-weight-regular)',
              color: 'var(--text-primary)'
            }}>
              Последний результат: {lastResult}
            </p>
          </div>
        )}

        {/* Секция: Dialogs */}
        <section>
          <h2 className="h2" style={{ marginBottom: 'var(--spacing-l)' }}>
            Dialog Windows (модальные окна)
          </h2>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--spacing-l)'
          }}>
            {/* Confirm Default */}
            <div style={{
              padding: 'var(--spacing-xl)',
              backgroundColor: 'var(--bg-primary)',
              border: '2px solid var(--border-default)',
              borderRadius: 'var(--radius-l)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-m)'
            }}>
              <h4 className="h4">Confirm (Default)</h4>
              <p className="text-s" style={{ color: 'var(--text-secondary)' }}>
                Стандартное подтверждение действия
              </p>
              <Button
                variant="primary"
                size="L"
                onClick={handleConfirmDefault}
                iconRight={<Icon name="check" size={24} variant="border" />}
              >
                Показать
              </Button>
            </div>

            {/* Confirm Destructive */}
            <div style={{
              padding: 'var(--spacing-xl)',
              backgroundColor: 'var(--bg-primary)',
              border: '2px solid var(--border-default)',
              borderRadius: 'var(--radius-l)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-m)'
            }}>
              <h4 className="h4">Confirm (Destructive)</h4>
              <p className="text-s" style={{ color: 'var(--text-secondary)' }}>
                Подтверждение удаления
              </p>
              <Button
                variant="error"
                size="L"
                onClick={handleConfirmDestructive}
                iconRight={<Icon name="trash-3" size={24} variant="fill" />}
              >
                Показать
              </Button>
            </div>

            {/* Confirm with Icon */}
            <div style={{
              padding: 'var(--spacing-xl)',
              backgroundColor: 'var(--bg-primary)',
              border: '2px solid var(--border-default)',
              borderRadius: 'var(--radius-l)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-m)'
            }}>
              <h4 className="h4">Confirm (с иконкой)</h4>
              <p className="text-s" style={{ color: 'var(--text-secondary)' }}>
                С иконкой предупреждения
              </p>
              <Button
                variant="primary"
                size="L"
                onClick={handleConfirmWithIcon}
              >
                Показать
              </Button>
            </div>

            {/* Info Dialog */}
            <div style={{
              padding: 'var(--spacing-xl)',
              backgroundColor: 'var(--bg-primary)',
              border: '2px solid var(--border-default)',
              borderRadius: 'var(--radius-l)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-m)'
            }}>
              <h4 className="h4">Info Dialog</h4>
              <p className="text-s" style={{ color: 'var(--text-secondary)' }}>
                Информационное окно
              </p>
              <Button
                variant="secondary"
                size="L"
                onClick={handleInfoDialog}
              >
                Показать
              </Button>
            </div>

            {/* Prompt Dialog */}
            <div style={{
              padding: 'var(--spacing-xl)',
              backgroundColor: 'var(--bg-primary)',
              border: '2px solid var(--border-default)',
              borderRadius: 'var(--radius-l)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-m)'
            }}>
              <h4 className="h4">Prompt Dialog</h4>
              <p className="text-s" style={{ color: 'var(--text-secondary)' }}>
                Ввод текста
              </p>
              <Button
                variant="primary"
                size="L"
                onClick={handlePromptDialog}
                iconRight={<Icon name="pencil" size={24} variant="border" />}
              >
                Показать
              </Button>
            </div>

            {/* Long Text Dialog */}
            <div style={{
              padding: 'var(--spacing-xl)',
              backgroundColor: 'var(--bg-primary)',
              border: '2px solid var(--border-default)',
              borderRadius: 'var(--radius-l)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-m)'
            }}>
              <h4 className="h4">Длинный текст</h4>
              <p className="text-s" style={{ color: 'var(--text-secondary)' }}>
                Диалог с большим объемом текста
              </p>
              <Button
                variant="secondary"
                size="L"
                onClick={handleLongTextDialog}
              >
                Показать
              </Button>
            </div>
          </div>
        </section>

        {/* Секция: Toast Notifications */}
        <section>
          <h2 className="h2" style={{ marginBottom: 'var(--spacing-l)' }}>
            Toast Notifications
          </h2>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--spacing-l)'
          }}>
            {/* Success Toast */}
            <div style={{
              padding: 'var(--spacing-xl)',
              backgroundColor: 'var(--color-green-100)',
              border: '2px solid var(--color-green-600)',
              borderRadius: 'var(--radius-l)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-m)'
            }}>
              <h4 className="h4">Success Toast</h4>
              <p className="text-s" style={{ color: 'var(--text-secondary)' }}>
                Успешное выполнение
              </p>
              <Button
                variant="success"
                size="L"
                onClick={handleToastSuccess}
                iconRight={<Icon name="check" size={24} variant="border" />}
              >
                Показать
              </Button>
            </div>

            {/* Error Toast */}
            <div style={{
              padding: 'var(--spacing-xl)',
              backgroundColor: 'var(--color-red-100)',
              border: '2px solid var(--color-red-600)',
              borderRadius: 'var(--radius-l)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-m)'
            }}>
              <h4 className="h4">Error Toast</h4>
              <p className="text-s" style={{ color: 'var(--text-secondary)' }}>
                Сообщение об ошибке
              </p>
              <Button
                variant="error"
                size="L"
                onClick={handleToastError}
                iconRight={<Icon name="x" size={24} variant="border" />}
              >
                Показать
              </Button>
            </div>

            {/* Info Toast */}
            <div style={{
              padding: 'var(--spacing-xl)',
              backgroundColor: 'var(--color-grayscale-100)',
              border: '2px solid var(--color-grayscale-500)',
              borderRadius: 'var(--radius-l)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-m)'
            }}>
              <h4 className="h4">Info Toast</h4>
              <p className="text-s" style={{ color: 'var(--text-secondary)' }}>
                Информационное сообщение
              </p>
              <Button
                variant="secondary"
                size="L"
                onClick={handleToastInfo}
              >
                Показать
              </Button>
            </div>

            {/* Multiple Toasts */}
            <div style={{
              padding: 'var(--spacing-xl)',
              backgroundColor: 'var(--color-yellow-100)',
              border: '2px solid var(--color-yellow-600)',
              borderRadius: 'var(--radius-l)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-m)'
            }}>
              <h4 className="h4">Множественные Toast</h4>
              <p className="text-s" style={{ color: 'var(--text-secondary)' }}>
                Показать несколько подряд
              </p>
              <Button
                variant="warning"
                size="L"
                onClick={handleMultipleToasts}
              >
                Показать
              </Button>
            </div>
          </div>
        </section>

        {/* Секция: Alert Banners */}
        <section>
          <h2 className="h2" style={{ marginBottom: 'var(--spacing-l)' }}>
            Alert Banners (баннеры внизу экрана)
          </h2>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--spacing-l)'
          }}>
            {/* Success Alert */}
            <div style={{
              padding: 'var(--spacing-xl)',
              backgroundColor: 'var(--color-green-100)',
              border: '2px solid var(--color-green-600)',
              borderRadius: 'var(--radius-l)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-m)'
            }}>
              <h4 className="h4">Success Alert</h4>
              <p className="text-s" style={{ color: 'var(--text-secondary)' }}>
                Баннер успеха внизу экрана
              </p>
              <Button
                variant="success"
                size="L"
                onClick={handleAlertSuccess}
                iconRight={<Icon name="check" size={24} variant="border" />}
              >
                Показать
              </Button>
            </div>

            {/* Error Alert */}
            <div style={{
              padding: 'var(--spacing-xl)',
              backgroundColor: 'var(--color-red-100)',
              border: '2px solid var(--color-red-600)',
              borderRadius: 'var(--radius-l)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-m)'
            }}>
              <h4 className="h4">Error Alert</h4>
              <p className="text-s" style={{ color: 'var(--text-secondary)' }}>
                Баннер ошибки внизу экрана
              </p>
              <Button
                variant="error"
                size="L"
                onClick={handleAlertError}
                iconRight={<Icon name="x" size={24} variant="border" />}
              >
                Показать
              </Button>
            </div>

            {/* Warning Alert */}
            <div style={{
              padding: 'var(--spacing-xl)',
              backgroundColor: 'var(--color-yellow-100)',
              border: '2px solid var(--color-yellow-600)',
              borderRadius: 'var(--radius-l)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-m)'
            }}>
              <h4 className="h4">Warning Alert</h4>
              <p className="text-s" style={{ color: 'var(--text-secondary)' }}>
                Баннер предупреждения
              </p>
              <Button
                variant="warning"
                size="L"
                onClick={handleAlertWarning}
              >
                Показать
              </Button>
            </div>

            {/* Info Alert */}
            <div style={{
              padding: 'var(--spacing-xl)',
              backgroundColor: 'var(--color-grayscale-100)',
              border: '2px solid var(--color-grayscale-500)',
              borderRadius: 'var(--radius-l)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-m)'
            }}>
              <h4 className="h4">Info Alert</h4>
              <p className="text-s" style={{ color: 'var(--text-secondary)' }}>
                Информационный баннер
              </p>
              <Button
                variant="secondary"
                size="L"
                onClick={handleAlertInfo}
              >
                Показать
              </Button>
            </div>
          </div>
        </section>

        {/* Примечание */}
        <div style={{
          padding: 'var(--spacing-xl)',
          backgroundColor: 'var(--color-yellow-100)',
          borderRadius: 'var(--radius-m)',
          border: '2px solid var(--color-yellow-600)'
        }}>
          <p className="text-m" style={{ fontWeight: 'var(--font-weight-regular)' }}>
            ⚠️ <strong>Примечание:</strong> Это тестовая страница для разработки системы уведомлений. 
            После завершения тестирования она будет удалена.
          </p>
          <p className="text-s" style={{ marginTop: 'var(--spacing-m)', color: 'var(--text-secondary)' }}>
            <strong>Правильная терминология:</strong><br/>
            • Dialog = модальное окно по центру<br/>
            • Toast = уведомления в правом нижнем углу<br/>
            • Alert = горизонтальный баннер внизу экрана
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default TestNotificationsPage;

