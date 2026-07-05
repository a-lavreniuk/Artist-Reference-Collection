import type { PaletteSwatch } from '@arc-main-shared/paletteCore';

export type { PaletteSwatch } from '@arc-main-shared/paletteCore';

/** Палитра деталки: расчёт в main (sharp), без canvas — обход CORS arc-media. */
export async function loadCardDetailPalette(cardId: string): Promise<PaletteSwatch[]> {
  if (!cardId || !window.arc?.storageGetCardDisplayPalette) return [];
  try {
    return await window.arc.storageGetCardDisplayPalette(cardId);
  } catch {
    return [];
  }
}
