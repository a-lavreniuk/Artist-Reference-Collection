export const HUD_ICON = 24;
export const HUD_CARD_W = 215;
export const HUD_CARD_H = 72;
export const HUD_W = HUD_ICON + HUD_CARD_W;
export const HUD_H = HUD_ICON + HUD_CARD_H;
/** Запас у края, чтобы плашка не дёргалась на пороге переворота. */
export const HUD_FLIP_HYSTERESIS = 16;

export type EyedropperHudCorner = 'bottom-right' | 'top-right' | 'bottom-left' | 'top-left';

export type EyedropperHudLayout = {
  left: number;
  top: number;
  corner: EyedropperHudCorner;
  cardLeft: number;
  cardTop: number;
};

/**
 * Горячая точка пипетки — нижний левый угол иконки (кончик).
 * Оболочка HUD стоит на курсоре; карточка смещается относительно кончика.
 */
export function resolveEyedropperHudCorner(
  cursorX: number,
  cursorY: number,
  viewWidth: number,
  viewHeight: number,
  previous?: EyedropperHudCorner | null
): EyedropperHudCorner {
  const preferLeft = previous === 'bottom-left' || previous === 'top-left';
  const preferTop = previous === 'top-right' || previous === 'top-left';
  const h = previous ? HUD_FLIP_HYSTERESIS : 0;
  const flipX = preferLeft ? cursorX + HUD_W + h > viewWidth : cursorX + HUD_W > viewWidth;
  const flipY = preferTop
    ? cursorY + HUD_CARD_H + h > viewHeight
    : cursorY + HUD_CARD_H > viewHeight;
  if (!flipX && !flipY) return 'bottom-right';
  if (!flipX && flipY) return 'top-right';
  if (flipX && !flipY) return 'bottom-left';
  return 'top-left';
}

export function eyedropperCardOffset(corner: EyedropperHudCorner): {
  left: number;
  top: number;
} {
  const flipX = corner === 'bottom-left' || corner === 'top-left';
  const flipY = corner === 'top-right' || corner === 'top-left';
  return {
    left: flipX ? -HUD_CARD_W : HUD_ICON,
    top: flipY ? -HUD_H : 0
  };
}

export function eyedropperHudPosition(
  cursorX: number,
  cursorY: number,
  viewWidth: number,
  viewHeight: number,
  previous?: EyedropperHudCorner | null
): EyedropperHudLayout {
  const corner = resolveEyedropperHudCorner(cursorX, cursorY, viewWidth, viewHeight, previous);
  const card = eyedropperCardOffset(corner);
  return {
    left: cursorX,
    top: cursorY,
    corner,
    cardLeft: card.left,
    cardTop: card.top
  };
}
