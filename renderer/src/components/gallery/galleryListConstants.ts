/** Высота строки List = thumb 64 + pad --s-2×2 + border 1px×2. */
export const GALLERY_LIST_ROW_HEIGHT_PX = 82;
/** Зазор между строками = --s-2. */
export const GALLERY_LIST_ROW_GAP_PX = 8;
/** Отступ между заголовком колонок и первой карточкой = --s-2. */
export const GALLERY_LIST_HEADER_GAP_PX = 8;
/** Шаг виртуализации = высота строки + зазор. */
export const GALLERY_LIST_ROW_STRIDE_PX = GALLERY_LIST_ROW_HEIGHT_PX + GALLERY_LIST_ROW_GAP_PX;
/** Превью в строке = --s-4 × 2. */
export const GALLERY_LIST_THUMB_SIZE_PX = 64;
/** Высота строки заголовка колонок. */
export const GALLERY_LIST_HEADER_HEIGHT_PX = 32;
export const GALLERY_LIST_OVERSCAN_ROWS = 8;

export const GALLERY_LIST_COLUMN_LABELS = {
  name: 'Имя',
  resolution: 'Разрешение',
  size: 'Размер',
  format: 'Формат',
  addedAt: 'Дата добавления'
} as const;
