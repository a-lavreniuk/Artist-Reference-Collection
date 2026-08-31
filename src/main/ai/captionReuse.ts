/**
 * JoyCaption-описание карточки одно на все модели.
 * Обычная индексация его не переписывает; полная переиндексация — да.
 */
export function shouldRegenerateSearchCaption(
  existingCaption: string | null | undefined,
  refreshCaption: boolean
): boolean {
  if (refreshCaption) return true;
  return !Boolean(existingCaption?.trim());
}
