export function pluralCardsRu(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'карточек';
  if (mod10 === 1) return 'карточка';
  if (mod10 >= 2 && mod10 <= 4) return 'карточки';
  return 'карточек';
}

export function formatSelectedCardsLabel(count: number): string {
  return `Выбрано: ${count}`;
}

export function formatTrashToast(count: number): string {
  return `${count} ${pluralCardsRu(count)} отправлены в корзину`;
}

export function formatRestoreToast(count: number): string {
  return `${count} ${pluralCardsRu(count)} восстановлены`;
}

export function formatPermanentDeleteToast(count: number): string {
  return `${count} ${pluralCardsRu(count)} удалены навсегда`;
}

export function formatMoodboardAddToast(count: number): string {
  return `Добавлено в мудборд: ${count} ${pluralCardsRu(count)}`;
}

export function formatCollectionAddToast(count: number): string {
  return `Добавлено в коллекцию: ${count} ${pluralCardsRu(count)}`;
}

export function formatCollectionRemoveToast(count: number): string {
  return `Убрано из коллекции: ${count} ${pluralCardsRu(count)}`;
}
