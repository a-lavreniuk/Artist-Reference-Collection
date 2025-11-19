/**
 * Главный компонент приложения ARC
 * Artist Reference Collection
 */

import { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import {
  CardsPage,
  CollectionsPage,
  CollectionDetailPage,
  TagsPage,
  MoodboardPage,
  DuplicatesPage,
  SettingsPage,
  AddPage
} from './pages';
import { OnboardingScreen, UpdateNotification, ErrorBoundary, DialogProvider, AlertProvider, ToastProvider } from './components/common';
import { useFileSystem, useElectronUpdates, useToast } from './hooks';
import { SearchProvider } from './contexts';

/**
 * Компонент для обработки внешнего импорта (из браузера)
 * Использует window.location.hash для навигации, так как может рендериться до полной инициализации Router
 */
function ExternalImportListener() {
  const { showToast } = useToast();
  const { directoryPath } = useFileSystem();

  // Эффект для проверки файлов при фокусе окна
  useEffect(() => {
    const checkImportFiles = async () => {
      if (!directoryPath || !window.electronAPI) return;

      try {
        const files = await window.electronAPI.scanImportDirectory();
        
        if (files.length > 0) {
          console.log('[App] Найдены файлы для импорта:', files.length);
          
          showToast({
            title: 'Новые изображения',
            message: `Найдено ${files.length} новых изображений во временной папке. Хотите добавить их?`,
            type: 'info',
            duration: 10000, // Показываем подольше
            onConfirm: () => {
              // Сохраняем файлы в sessionStorage для передачи
              sessionStorage.setItem('importFiles', JSON.stringify(files));
              // Переходим на страницу добавления через HashRouter
              window.location.hash = '/add';
            },
            confirmText: 'Добавить',
            cancelText: 'Позже'
          });
        }
      } catch (error) {
        console.error('[App] Ошибка проверки импорта:', error);
      }
    };

    const handleFocus = () => {
      checkImportFiles();
    };

    // Проверяем при монтировании (старте приложения)
    // Небольшая задержка, чтобы Router успел инициализироваться
    const timeoutId = setTimeout(() => {
      checkImportFiles();
    }, 100);

    // Подписываемся на фокус окна
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [directoryPath, showToast]);

  return null;
}

/**
 * Компонент для обработки навигации от системного трея
 */
function NavigationListener() {
  const navigate = useNavigate();

  useEffect(() => {
    // Подписываемся на события навигации от main процесса
    if (window.electronAPI?.onNavigate) {
      window.electronAPI.onNavigate((path: string) => {
        console.log('[App] Навигация от трея:', path);
        navigate(path);
      });
    }
  }, [navigate]);

  return null;
}

function App() {
  const {
    directoryHandle,
    isLoading,
    hasPermission,
    isSupported,
    requestDirectory
  } = useFileSystem();

  const {
    needRefresh,
    updateServiceWorker
  } = useElectronUpdates();

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);


  // Проверяем нужно ли показать онбординг
  useEffect(() => {
    if (!isLoading) {
      // Показываем онбординг если нет handle или нет разрешений
      setShowOnboarding(!directoryHandle || !hasPermission);
    }
  }, [isLoading, directoryHandle, hasPermission]);

  // Обработчик успешного выбора папки
  const handleDirectorySelected = () => {
    setShowOnboarding(false);
  };

  // Обработчик восстановления резервной копии
  const handleRestoreBackup = async () => {
    console.log('[App] Восстановление резервной копии');
    // TODO: Реализовать логику восстановления
    // Пока просто скрываем онбординг
    setShowOnboarding(false);
  };

  // Показываем уведомление об обновлении
  useEffect(() => {
    setShowUpdateNotification(needRefresh);
  }, [needRefresh]);

  // Обработчик применения обновления
  const handleUpdate = async () => {
    await updateServiceWorker(true);
  };

  // Обработчик отмены обновления
  const handleDismissUpdate = () => {
    setShowUpdateNotification(false);
  };

  // Показываем загрузку пока проверяем рабочую папку
  if (isLoading) {
    return (
      <div className="layout__loading">
        <div className="layout__spinner" />
        <p className="layout__loading-text">Загрузка ARC...</p>
      </div>
    );
  }

  // Проверка доступности Electron API (на случай запуска в браузере)
  if (!isSupported) {
    return (
      <div className="layout__error">
        <div className="layout__error-icon">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <path d="M12 8V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="16" r="1" fill="currentColor" />
          </svg>
        </div>
        <h2 className="layout__error-title">Ошибка запуска</h2>
        <p className="layout__error-text text-m">
          ARC должен запускаться как Electron приложение.
          <br />
          Пожалуйста, используйте установленную версию приложения.
        </p>
      </div>
    );
  }

  // Показываем онбординг при первом запуске
  if (showOnboarding) {
    return (
      <OnboardingScreen
        onDirectorySelected={handleDirectorySelected}
        onRestoreBackup={handleRestoreBackup}
        requestDirectory={requestDirectory}
      />
    );
  }

  // Основное приложение
  return (
    <>
      <DialogProvider>
        <AlertProvider>
          <ToastProvider>
            <Router>
            <SearchProvider>
              <ErrorBoundary>
                <NavigationListener />
                <ExternalImportListener />
                <Routes>
                <Route path="/" element={<CardsPage />} />
                <Route path="/cards" element={<CardsPage />} />
                <Route path="/collections" element={<CollectionsPage />} />
                <Route path="/collections/:id" element={<CollectionDetailPage />} />
                <Route path="/tags" element={<TagsPage />} />
                <Route path="/moodboard" element={<MoodboardPage />} />
                <Route path="/duplicates" element={<DuplicatesPage />} />
                <Route path="/add" element={<AddPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </ErrorBoundary>
            </SearchProvider>
          </Router>

          {/* Уведомление об обновлении */}
          <UpdateNotification
            show={showUpdateNotification}
            onUpdate={handleUpdate}
            onDismiss={handleDismissUpdate}
          />
          </ToastProvider>
        </AlertProvider>
      </DialogProvider>
    </>
  );
}

export default App;