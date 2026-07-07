export function duplicateSimilarityHint(pct: number): string {
  const v = Math.max(50, Math.min(100, Math.round(pct)));
  if (v >= 100) return 'Только абсолютно идентичные файлы';
  if (v >= 95) return 'Почти точные копии и полные совпадения';
  if (v >= 85) return 'Сильно похожие изображения, возможны ложные срабатывания';
  if (v >= 70) return 'Расширенный поиск похожих изображений';
  return 'Максимально широкий поиск, больше шума';
}
