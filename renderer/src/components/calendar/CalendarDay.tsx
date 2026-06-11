export type CalendarDayVisualState =
  | 'default'
  | 'hover'
  | 'active'
  | 'outdate'
  | 'in-range'
  | 'range-start'
  | 'range-end';

type Props = {
  day: number;
  visual: CalendarDayVisualState;
  isCurrentDay?: boolean;
  isWeekendLabel?: boolean;
  isHeader?: boolean;
  label?: string;
  disabled?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

export default function CalendarDay({
  day,
  visual,
  isCurrentDay = false,
  isWeekendLabel = false,
  isHeader = false,
  label,
  disabled,
  onClick,
  onMouseEnter,
  onMouseLeave
}: Props) {
  if (isHeader) {
    return (
      <span
        className={`arc-calendar-day arc-calendar-day--header${isWeekendLabel ? ' arc-calendar-day--weekend' : ''}`}
        aria-hidden="true"
      >
        {label}
      </span>
    );
  }

  const className = [
    'arc-calendar-day',
    `arc-calendar-day--${visual}`,
    isCurrentDay ? 'arc-calendar-day--today' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <span className="arc-calendar-day__label">{day}</span>
      {isCurrentDay ? <span className="arc-calendar-day__today-dot" aria-hidden="true" /> : null}
    </button>
  );
}
