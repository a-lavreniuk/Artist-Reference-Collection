import type { GridSize } from '../../layout/gridSizePreference';

/** Высота shade по размеру сетки (Figma: L 128 / M 96 / S 64). */
export const GALLERY_CARD_SHADE_HEIGHT_PX: Record<GridSize, number> = {
  l: 128,
  m: 96,
  s: 64
};

/** Отступ overlay от краёв карточки. */
export const GALLERY_CARD_EDGE_PAD_PX: Record<GridSize, number> = {
  l: 16,
  m: 16,
  s: 8
};

/** Отступ между строкой кнопок и таймлайном. */
export const GALLERY_CARD_CONTROLS_TIMELINE_GAP_PX: Record<GridSize, number> = {
  l: 16,
  m: 16,
  s: 8
};

/** Высота кнопок overlay (M = 32px, S = 24px). */
export const GALLERY_CARD_BTN_HEIGHT_PX: Record<GridSize, number> = {
  l: 32,
  m: 32,
  s: 24
};

export const GALLERY_CARD_TIMELINE_HEIGHT_PX = 6;

/** L и M — кнопки M; S — кнопки S. */
export function galleryCardBtnSize(gridSize: GridSize): 'm' | 's' {
  return gridSize === 's' ? 's' : 'm';
}

/** Минимальная высота карточки для показа overlay (видео — с таймлайном). */
export function minGalleryCardOverlayHeightPx(gridSize: GridSize, hasTimeline: boolean): number {
  const shade = GALLERY_CARD_SHADE_HEIGHT_PX[gridSize];
  const edge = GALLERY_CARD_EDGE_PAD_PX[gridSize];
  const btn = GALLERY_CARD_BTN_HEIGHT_PX[gridSize];
  const gap = hasTimeline ? GALLERY_CARD_CONTROLS_TIMELINE_GAP_PX[gridSize] : 0;
  const timeline = hasTimeline ? GALLERY_CARD_TIMELINE_HEIGHT_PX : 0;
  return shade + edge + btn + gap + timeline + edge;
}

export function galleryCardOverlayStyleVars(gridSize: GridSize): Record<string, string> {
  return {
    '--arc-card-shade-h': `${GALLERY_CARD_SHADE_HEIGHT_PX[gridSize]}px`,
    '--arc-card-overlay-pad': `${GALLERY_CARD_EDGE_PAD_PX[gridSize]}px`,
    '--arc-card-overlay-gap': `${GALLERY_CARD_CONTROLS_TIMELINE_GAP_PX[gridSize]}px`
  };
}
