/** «метка» / «метки» / «меток» — для заголовков, подтверждений и тостов. */
export function pluralTags(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'метка';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'метки';
  return 'меток';
}

export function formatDeleteTagsTitle(count: number): string {
  return count === 1 ? 'Удалить метку?' : `Удалить ${count} ${pluralTags(count)}?`;
}

export function formatSelectedTagsSubtitle(count: number): string {
  return count === 1 ? 'Выбрана 1 метка' : `Выбрано ${count} ${pluralTags(count)}`;
}

export function formatTagsDeletedToast(count: number): string {
  return count === 1 ? 'Метка удалена' : `Удалено меток: ${count}`;
}

export function formatTagsMovedToast(count: number, categoryName?: string): string {
  if (!categoryName) {
    return count === 1 ? 'Метка перенесена' : `Перенесено меток: ${count}`;
  }
  return count === 1
    ? `Метка перенесена в «${categoryName}»`
    : `Перенесено меток: ${count} → «${categoryName}»`;
}
