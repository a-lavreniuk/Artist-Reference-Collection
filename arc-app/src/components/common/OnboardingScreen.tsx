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
  
  /** Обработчик пропуска */
  onSkip?: () => void;
  
  /** Функция запроса директории */
  requestDirectory: () => Promise<any>;
}

/**
 * Компонент OnboardingScreen
 */
export const OnboardingScreen = ({
  onDirectorySelected,
  onSkip,
  requestDirectory
}: OnboardingScreenProps) => {
  const [isSelecting, setIsSelecting] = useState(false);
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

  return (
    <div className="onboarding">
      <div className="onboarding__container">
        {/* Иконка */}
        <div className="onboarding__icon">
          <svg width="120" height="120" viewBox="0 0 24 24" fill="none">
            <path
              d="M20 6H12L10 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V8C22 6.9 21.1 6 20 6Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Заголовок */}
        <h1 className="onboarding__title">
          Добро пожаловать в ARC
        </h1>

        {/* Описание */}
        <p className="onboarding__description text-l">
          Для начала работы выберите папку с вашими медиафайлами.
          <br />
          Приложение получит доступ только к этой папке.
        </p>

        {/* Список возможностей */}
        <div className="onboarding__features">
          <div className="onboarding__feature">
            <svg className="onboarding__feature-icon" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M9 12L11 14L15 10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div>
              <h4 className="onboarding__feature-title">Полностью офлайн</h4>
              <p className="onboarding__feature-text text-s">
                Все данные хранятся локально на вашем компьютере
              </p>
            </div>
          </div>

          <div className="onboarding__feature">
            <svg className="onboarding__feature-icon" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M9 12L11 14L15 10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div>
              <h4 className="onboarding__feature-title">Безопасно</h4>
              <p className="onboarding__feature-text text-s">
                Вы полностью контролируете доступ к своим файлам
              </p>
            </div>
          </div>

          <div className="onboarding__feature">
            <svg className="onboarding__feature-icon" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M9 12L11 14L15 10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div>
              <h4 className="onboarding__feature-title">Быстро</h4>
              <p className="onboarding__feature-text text-s">
                Оптимизировано для работы с большими коллекциями
              </p>
            </div>
          </div>
        </div>

        {/* Кнопки действий */}
        <div className="onboarding__actions">
          <Button
            variant="primary"
            size="large"
            onClick={handleSelectDirectory}
            loading={isSelecting}
            fullWidth
          >
            Выбрать папку с файлами
          </Button>
          
          {onSkip && (
            <Button
              variant="ghost"
              size="medium"
              onClick={onSkip}
              disabled={isSelecting}
            >
              Пропустить (можно настроить позже)
            </Button>
          )}
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

        {/* Подсказка */}
        <p className="onboarding__hint text-s">
          💡 Совет: Выберите папку, где уже хранятся ваши референсы.
          <br />
          Приложение проиндексирует все изображения и видео в этой папке.
        </p>
      </div>
    </div>
  );
};

export default OnboardingScreen;

