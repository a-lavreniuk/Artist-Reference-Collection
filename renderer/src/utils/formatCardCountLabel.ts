/** «1 карточка», «2 карточки», «25 карточек» */
export function formatCardCountLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${count} карточка`;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} карточки`;
  }
  return `${count} карточек`;
}
