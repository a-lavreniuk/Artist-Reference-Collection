import type { CardRecord } from '../services/arcSchema';
import { cardSizeToBytes } from './cardSizeToBytes';

async function sumDiskBytes(arc: NonNullable<Window['arc']>, rels: string[]): Promise<number> {
  if (rels.length === 0 || !arc.sumLibraryFilesBytes) return 0;
  const res = await arc.sumLibraryFilesBytes(rels);
  return res.ok ? res.totalBytes : 0;
}

/**
 * Оценка объёма по карточкам с разбивкой на изображения / видео.
 * Сначала суммируются байты из полей карточки (`fileSize` / `fileSizeMb`);
 * для записей без размера — сумма `stat` по `originalRelativePath` и `thumbRelativePath`.
 */
export async function computeSplitLibraryMediaBytesFromCards(
  arc: NonNullable<Window['arc']>,
  cards: CardRecord[]
): Promise<{ imageBytes: number; videoBytes: number }> {
  let imageMeta = 0;
  let videoMeta = 0;
  const imageRels: string[] = [];
  const videoRels: string[] = [];
  for (const c of cards) {
    const b = cardSizeToBytes(c);
    if (b > 0) {
      if (c.type === 'image') imageMeta += b;
      else videoMeta += b;
      continue;
    }
    const pair = [
      c.originalRelativePath,
      c.thumbRelativePath,
      c.thumbMRelativePath,
      c.thumbLRelativePath
    ].filter((p): p is string => Boolean(p && p !== 'legacy'));
    if (c.type === 'image') imageRels.push(...pair);
    else videoRels.push(...pair);
  }
  const [imgDisk, vidDisk] = await Promise.all([sumDiskBytes(arc, imageRels), sumDiskBytes(arc, videoRels)]);
  return { imageBytes: imageMeta + imgDisk, videoBytes: videoMeta + vidDisk };
}

/** Суммарный объём медиа по всем карточкам (изображения + видео). */
export async function computeLibraryMediaBytesFromCards(
  arc: NonNullable<Window['arc']>,
  cards: CardRecord[]
): Promise<number> {
  const { imageBytes, videoBytes } = await computeSplitLibraryMediaBytesFromCards(arc, cards);
  return imageBytes + videoBytes;
}
