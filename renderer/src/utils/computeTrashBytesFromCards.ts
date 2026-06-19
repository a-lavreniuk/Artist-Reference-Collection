import type { CardRecord } from '../services/arcSchema';
import { computeSplitLibraryMediaBytesFromCards } from './computeLibraryMediaBytesFromCards';

/** Суммарный объём файлов карточек в корзине. */
export async function computeTrashBytesFromCards(
  arc: NonNullable<Window['arc']>,
  cards: CardRecord[]
): Promise<number> {
  const { imageBytes, videoBytes } = await computeSplitLibraryMediaBytesFromCards(arc, cards);
  return imageBytes + videoBytes;
}
