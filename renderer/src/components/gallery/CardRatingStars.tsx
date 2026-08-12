import { useLayoutEffect, useRef, useState } from 'react';
import { CARD_RATING_VALUES, clampCardRating } from '@arc-main-shared/cardRating';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';

type Props = {
  value: number;
  onChange: (next: number) => void;
  /** Размер кнопок DS. */
  size?: 's' | 'm';
  disabled?: boolean;
  className?: string;
};

function ratingLabel(star: number, isActive: boolean): string {
  if (isActive) return 'Убрать оценку';
  return star === 1 ? 'Оценка 1 звезда' : `Оценка ${star} звёзд`;
}

/** Figma 2174:2066 — оценка карточки группой кнопок (Group Button, icon-only). */
export default function CardRatingStars({
  value,
  onChange,
  size = 'm',
  disabled = false,
  className = ''
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(0);

  const rating = clampCardRating(value);
  const preview = hovered > 0 ? hovered : rating;

  useLayoutEffect(() => {
    if (rootRef.current) void hydrateArcNavbarIcons(rootRef.current);
  }, [preview, size, disabled]);

  return (
    <div
      ref={rootRef}
      className={`btn-group btn-group-ds arc-card-rating arc-ui-kit-scope${className ? ` ${className}` : ''}`}
      data-btn-size={size}
      role="group"
      aria-label={rating > 0 ? `Оценка: ${rating} из 5` : 'Оценка не выставлена'}
      onMouseLeave={() => setHovered(0)}
    >
      {CARD_RATING_VALUES.map((star) => {
        const filled = star <= preview;
        const isActive = star === rating;
        return (
          <button
            key={star}
            type="button"
            className={`btn btn-outline btn-icon-only btn-ds arc-card-rating__star${filled ? ' is-filled' : ''}`}
            disabled={disabled}
            aria-pressed={star <= rating}
            aria-label={ratingLabel(star, isActive)}
            onMouseEnter={() => setHovered(star)}
            onFocus={() => setHovered(star)}
            onBlur={() => setHovered(0)}
            onClick={(e) => {
              e.preventDefault();
              onChange(isActive ? 0 : star);
            }}
          >
            <span
              className={`btn-icon-only__glyph ${filled ? 'arc-icon-star-fill' : 'arc-icon-star-stroke'}`}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}
