/** Порог: скрыть счётчик, как только ряд не помещается. */
const OVERFLOW_EPS_PX = 1;

/** Запас при возврате счётчика — без мерцания на границе. */
const SHOW_HYSTERESIS_PX = 8;

export type OverlayTimeFitMeasure = {
  availablePx: number;
  badgeWidthPx: number;
  timeWidthPx: number;
  rightWidthPx: number;
  leftGapPx: number;
  rowGapPx: number;
  currentlyHidden: boolean;
};

/**
 * Нужно ли скрыть счётчик времени в оверлее карточки,
 * чтобы бейдж и кнопки справа не наезжали друг на друга.
 */
export function shouldHideOverlayTime(m: OverlayTimeFitMeasure): boolean {
  const timeBlock =
    m.timeWidthPx > 0 ? m.leftGapPx + m.timeWidthPx : 0;
  const needWithTimePx =
    m.badgeWidthPx + timeBlock + m.rowGapPx + m.rightWidthPx;

  if (m.currentlyHidden) {
    return needWithTimePx + SHOW_HYSTERESIS_PX > m.availablePx;
  }
  return needWithTimePx > m.availablePx + OVERFLOW_EPS_PX;
}
