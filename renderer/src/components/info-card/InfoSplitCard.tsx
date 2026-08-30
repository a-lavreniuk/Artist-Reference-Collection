import { memo, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';

export type InfoSplitCardProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Бейдж рядом с заголовком (Рекомендуется / Недоступно). */
  badge?: ReactNode;
  /** Справа в шапке: радио, превью и т.п. */
  headerAside?: ReactNode;
  /** Средняя полоса (прогресс скачивания). */
  mid?: ReactNode;
  chips?: ReactNode;
  actions?: ReactNode;
  /** Brand-обводка активной библиотеки. */
  active?: boolean;
  /** Подсветка как hover (аннотация selected / hovered / focused). */
  highlighted?: boolean;
  interactive?: boolean;
  disabled?: boolean;
  className?: string;
  role?: string;
  tabIndex?: number;
  'aria-current'?: 'true' | undefined;
  'aria-label'?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

/**
 * Общий каркас info-карточки: верх (текст / бейдж / aside) → mid → футер (чипы + действия).
 * Поверхность Tertiary, не `.panel` / Background.
 */
function InfoSplitCard({
  title,
  description,
  badge,
  headerAside,
  mid,
  chips,
  actions,
  active = false,
  highlighted = false,
  interactive = false,
  disabled = false,
  className = '',
  role,
  tabIndex,
  'aria-current': ariaCurrent,
  'aria-label': ariaLabel,
  onClick,
  onKeyDown,
  onMouseEnter,
  onMouseLeave
}: InfoSplitCardProps) {
  const classNames = [
    'arc-info-card',
    interactive ? 'arc-info-card--interactive' : '',
    active ? 'is-active' : '',
    highlighted ? 'is-highlighted' : '',
    disabled ? 'is-disabled' : '',
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classNames}
      role={role}
      tabIndex={tabIndex}
      aria-current={ariaCurrent}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      onKeyDown={disabled ? undefined : onKeyDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="arc-info-card__top">
        <div className="arc-info-card__top-main">
          <div className="arc-info-card__title-row">
            <div className="arc-info-card__title text-l">{title}</div>
            {badge ? <div className="arc-info-card__badge">{badge}</div> : null}
          </div>
          {description ? <div className="arc-info-card__description text-m">{description}</div> : null}
        </div>
        {headerAside ? <div className="arc-info-card__aside">{headerAside}</div> : null}
      </div>

      {mid ? <div className="arc-info-card__mid">{mid}</div> : null}

      {chips || actions ? (
        <div className="arc-info-card__footer arc-ui-kit-scope" data-btn-size="s">
          <div className="arc-info-card__chips">{chips}</div>
          {actions ? <div className="arc-info-card__actions">{actions}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

export default memo(InfoSplitCard);
