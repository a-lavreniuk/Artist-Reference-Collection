import { buildGalleryQueryKey, type GalleryFeedQuery } from '../components/gallery/galleryQuery';

/** Ключ сброса reveal: меняется при фильтрах, сортировке, тегах, scope и т.п. */
export function galleryRevealResetKey(query: GalleryFeedQuery): string {
  return buildGalleryQueryKey(query);
}
