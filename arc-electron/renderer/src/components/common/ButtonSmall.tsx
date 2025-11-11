/**
 * Компонент маленькой кнопки для диалогов
 * Отступы: 18px слева/справа, 14px сверху/снизу
 * Иконки: размер 16px
 */

import './ButtonSmall.css';

interface ButtonSmallProps {
  /** Вариант кнопки */
  variant: 'primary' | 'secondary';
  /** Содержимое кнопки */
  children: React.ReactNode;
  /** Иконка (16px) */
  icon?: React.ReactNode;
  /** Обработчик клика */
  onClick: () => void;
  /** Отключена ли кнопка */
  disabled?: boolean;
  /** Дополнительные классы */
  className?: string;
}

/**
 * Компонент маленькой кнопки для диалогов
 */
export function ButtonSmall({
  variant,
  children,
  icon,
  onClick,
  disabled = false,
  className = ''
}: ButtonSmallProps) {
  return (
    <button
      className={`button-small button-small--${variant} ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      type="button"
    >
      <span className="button-small__text">{children}</span>
      {icon && <span className="button-small__icon">{icon}</span>}
    </button>
  );
}

