/**
 * Главный компонент приложения ARC
 * Artist Reference Collection
 */

import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import {
  CardsPage,
  CollectionsPage,
  CollectionDetailPage,
  TagsPage,
  MoodboardPage,
  SettingsPage,
  AddPage
} from './pages';
import { OnboardingScreen, UpdateNotification, ErrorBoundary } from './components/common';
import { useFileSystem, usePWA } from './hooks';

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
  } = usePWA();

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

  // Обработчик пропуска (можно настроить позже в настройках)
  const handleSkip = () => {
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
        onSkip={handleSkip}
        requestDirectory={requestDirectory}
      />
    );
  }

  // Основное приложение
  return (
    <>
      <Router>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<CardsPage />} />
            <Route path="/collections" element={<CollectionsPage />} />
            <Route path="/collections/:id" element={<CollectionDetailPage />} />
            <Route path="/tags" element={<TagsPage />} />
            <Route path="/moodboard" element={<MoodboardPage />} />
            <Route path="/add" element={<AddPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </ErrorBoundary>
      </Router>

      {/* Уведомление об обновлении */}
      <UpdateNotification
        show={showUpdateNotification}
        onUpdate={handleUpdate}
        onDismiss={handleDismissUpdate}
      />
    </>
  );
}

export default App;
