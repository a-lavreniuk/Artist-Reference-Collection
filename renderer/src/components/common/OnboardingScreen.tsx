/**
 * Компонент OnboardingScreen - экран первого запуска
 * Запрашивает выбор рабочей папки с медиафайлами
 */

import { useState } from 'react';
import { Button } from './Button';
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
            <svg className="onboarding__feature-icon" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 12H15M9 16H15M17 21H7C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3H12.5858C12.851 3 13.1054 3.10536 13.2929 3.29289L18.7071 8.70711C18.8946 8.89464 19 9.149 19 9.41421V19C19 20.1046 18.1046 21 17 21Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="onboarding__feature-content">
              <h3 className="onboarding__feature-title">Коллекции</h3>
              <p className="onboarding__feature-text text-s">
                Организуйте тематические коллекции
              </p>
            </div>
          </div>

          {/* Метки */}
          <div className="onboarding__feature-card">
            <svg className="onboarding__feature-icon" viewBox="0 0 24 24" fill="none">
              <path
                d="M7.5 7.5H7.51M7 3H17L21 7V17L17 21H7L3 17V7L7 3Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="onboarding__feature-content">
              <h3 className="onboarding__feature-title">Метки</h3>
              <p className="onboarding__feature-text text-s">
                Категории и метки поиска
              </p>
            </div>
          </div>

          {/* Всё локально */}
          <div className="onboarding__feature-card">
            <svg className="onboarding__feature-icon" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 12H15M9 16H15M17 21H7C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3H17C18.1046 3 19 3.89543 19 5V19C19 20.1046 18.1046 21 17 21Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect x="8" y="6" width="8" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <div className="onboarding__feature-content">
              <h3 className="onboarding__feature-title">Всё локально</h3>
              <p className="onboarding__feature-text text-s">
                Файлы хранятся прямо на компьютере
              </p>
            </div>
          </div>

          {/* Мудборды */}
          <div className="onboarding__feature-card">
            <svg className="onboarding__feature-icon" viewBox="0 0 24 24" fill="none">
              <rect
                x="3"
                y="3"
                width="18"
                height="18"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 8V12L14 14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="16" cy="8" r="2" fill="currentColor" />
            </svg>
            <div className="onboarding__feature-content">
              <h3 className="onboarding__feature-title">Мудборды</h3>
              <p className="onboarding__feature-text text-s">
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
            <span>Показать куда сохранять</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M20 6H12L10 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V8C22 6.9 21.1 6 20 6Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M12 12L16 12M16 12L14 10M16 12L14 14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
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
            <span>Восстановить резервную копию</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M19 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H19C20.1046 3 21 3.89543 21 5V19C21 20.1046 20.1046 21 19 21Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 8V16M12 16L9 13M12 16L15 13"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
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

