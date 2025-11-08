/**
 * Компонент UpdateNotification - уведомление о доступном обновлении
 */

import { Button } from './Button';
import './UpdateNotification.css';

export interface UpdateNotificationProps {
  /** Показывать ли уведомление */
  show: boolean;
  
  /** Обработчик обновления */
  onUpdate: () => void;
  
  /** Обработчик закрытия */
  onDismiss: () => void;
}

/**
 * Компонент UpdateNotification
 */
export const UpdateNotification = ({
  show,
  onUpdate,
  onDismiss
}: UpdateNotificationProps) => {
  if (!show) {
    return null;
  }

  return (
    <div className="update-notification">
      <div className="update-notification__content">
        <div className="update-notification__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 12V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M16 6L12 2L8 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12 2V15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        
        <div className="update-notification__text">
          <p className="update-notification__title">Доступно обновление</p>
          <p className="update-notification__description text-s">
            Новая версия ARC готова к установке
          </p>
        </div>

        <div className="update-notification__actions">
          <Button
            variant="primary"
            size="small"
            onClick={onUpdate}
          >
            Обновить
          </Button>
          <Button
            variant="ghost"
            size="small"
            onClick={onDismiss}
          >
            Позже
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UpdateNotification;

