/**
 * Компонент OnboardingScreen - экран первого запуска
 * Запрашивает выбор рабочей папки с медиафайлами
 */

import { useState } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import './OnboardingScreen.css';

export interface OnboardingScreenProps {
  /** Обработчик выбора папки */
  onDirectorySelected: () => void;
  
  /** Обработчик восстановления резервной копии */
  onRestoreBackup: () => void;
  
  /** Функция запроса директории */
  requestDirectory: () => Promise<any>;
}

/**
 * Компонент OnboardingScreen
 */
export const OnboardingScreen = ({
  onDirectorySelected,
  onRestoreBackup,
  requestDirectory
}: OnboardingScreenProps) => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectDirectory = async () => {
    try {
      setIsSelecting(true);
      setError(null);
      
      const handle = await requestDirectory();
      
      if (handle) {
        onDirectorySelected();
      }
    } catch (err) {
      console.error('Ошибка выбора папки:', err);
      setError('Не удалось получить доступ к папке. Попробуйте ещё раз.');
    } finally {
      setIsSelecting(false);
    }
  };

  const handleRestoreBackup = async () => {
    try {
      setIsRestoring(true);
      setError(null);
      await onRestoreBackup();
    } catch (err) {
      console.error('Ошибка восстановления:', err);
      setError('Не удалось восстановить резервную копию.');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="onboarding">
      <div className="onboarding__container">
        {/* Заголовок */}
        <h1 className="onboarding__title">
          Добро пожаловать
        </h1>

        {/* Сетка возможностей 2×2 */}
        <div className="onboarding__features-grid">
          {/* Коллекции */}
          <div className="onboarding__feature-card">
            <Icon name="folder-open" size={24} className="onboarding__feature-icon" />
            <div className="onboarding__feature-content">
              <h3 className="onboarding__feature-title">Коллекции</h3>
              <p className="onboarding__feature-text text-l">
                Организуйте тематические коллекции
              </p>
            </div>
          </div>

          {/* Метки */}
          <div className="onboarding__feature-card">
            <Icon name="tag" size={24} className="onboarding__feature-icon" />
            <div className="onboarding__feature-content">
              <h3 className="onboarding__feature-title">Метки</h3>
              <p className="onboarding__feature-text text-l">
                Категории и метки поиска
              </p>
            </div>
          </div>

          {/* Всё локально */}
          <div className="onboarding__feature-card">
            <Icon name="server" size={24} className="onboarding__feature-icon" />
            <div className="onboarding__feature-content">
              <h3 className="onboarding__feature-title">Всё локально</h3>
              <p className="onboarding__feature-text text-l">
                Файлы хранятся прямо на компьютере
              </p>
            </div>
          </div>

          {/* Мудборды */}
          <div className="onboarding__feature-card">
            <Icon name="bookmark-plus" size={24} className="onboarding__feature-icon" />
            <div className="onboarding__feature-content">
              <h3 className="onboarding__feature-title">Мудборды</h3>
              <p className="onboarding__feature-text text-l">
                Доски настроения проектов
              </p>
            </div>
          </div>
        </div>

        {/* Кнопки действий */}
        <div className="onboarding__actions">
          {/* Основная кнопка */}
          <Button
            variant="primary"
            size="L"
            onClick={handleSelectDirectory}
            loading={isSelecting}
            disabled={isRestoring}
            fullWidth
          >
            Показать куда сохранять
            <Icon name="folder-open" size={24} />
          </Button>
          
          {/* Вторичная кнопка */}
          <Button
            variant="secondary"
            size="L"
            onClick={handleRestoreBackup}
            loading={isRestoring}
            disabled={isSelecting}
            fullWidth
          >
            Восстановить резервную копию
            <Icon name="download" size={24} />
          </Button>
        </div>

        {/* Сообщение об ошибке */}
        {error && (
          <div className="onboarding__error">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path d="M12 8V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="16" r="1" fill="currentColor" />
            </svg>
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingScreen;

