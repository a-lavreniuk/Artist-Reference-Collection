/** Shared storage types for the new library format (v2). */

import type { GalleryAdvancedFilters, GallerySortState } from './galleryFilters';

export const STORAGE_SCHEMA_VERSION = 9;

/** Виртуальная библиотека в галерее: вся / без меток / корзина. */
export type LibraryScope = 'all' | 'untagged' | 'trash';

export {
  THUMB_S_MAX,
  THUMB_M_MAX,
  THUMB_L_MAX,
  THUMB_GENERATION_VERSION
} from '../shared/thumbConstants';

export type CardType = 'image' | 'video';

export type ImageDupFingerprint = {
  rotHashes: [string, string, string, string];
  hist: number[];
};

/** Расширенные метаданные файла (EXIF / sharp / ffprobe), только card.json. */
export type CardMediaMetaV1 = {
  version: 1;
  probedAt: string;
  colorDepth?: string;
  colorSpace?: string;
  densityDpi?: number;
  camera?: string;
  lens?: string;
  iso?: number;
  aperture?: string;
  shutterSpeed?: string;
  focalLength?: string;
  dateTaken?: string;
  videoCodec?: string;
  frameRate?: number;
  bitrate?: number;
};

export type CardJsonV1 = {
  version: 1;
  id: string;
  type: CardType;
  addedAt: string;
  dateModified?: string;
  fileCreatedAt?: string;
  originalFileName: string;
  format?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  dominantColorHex?: string;
  description?: string;
  name?: string;
  linkUrl?: string;
  tagIds: string[];
  collectionIds: string[];
  phash?: ImageDupFingerprint;
  deletedAt?: string;
  durationMs?: number;
  /** Timestamp кадра превью (мс); нет = первый кадр. */
  previewFrameMs?: number;
  /** Нативная ширина ролика; не меняется при смене превью. */
  videoWidth?: number;
  /** Нативная высота ролика; не меняется при смене превью. */
  videoHeight?: number;
  /** Расширенные метаданные для окна «Информация о файле». */
  mediaMeta?: CardMediaMetaV1;
};

export type CategoryRow = {
  id: string;
  name: string;
  colorHex: string;
  weight: 'neutral' | 'low' | 'medium' | 'high';
  sortIndex: number;
  createdAt: string;
  description?: string;
};

export type TagRow = {
  id: string;
  categoryId: string;
  name: string;
  usageCount: number;
  description?: string;
  tooltipImage?: string;
};

export type CollectionRow = {
  id: string;
  name: string;
  createdAt: string;
  sortIndex: number;
  description?: string;
};

export type CollectionStatsRow = {
  cardCount: number;
  totalSizeMb: number;
  createdAt: string;
};

export type CardIndexRow = {
  id: string;
  type: CardType;
  addedAt: string;
  dateModified?: string;
  format?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  dominantColor?: string;
  paletteJson?: string;
  phashJson?: string;
  originalRel: string;
  thumbSRel: string;
  thumbMRel: string;
  thumbLRel: string;
  tagIds: string[];
  collectionIds: string[];
  description?: string;
  aiCaption?: string;
  name?: string;
  linkUrl?: string;
  durationMs?: number;
};

export type ArcSystemV1 = {
  version: 1;
  schemaVersion: number;
  appVersion?: string;
  duplicateSimilarityThresholdPct: number;
  /** Версия пайплайна thumb_s/thumb_m; см. THUMB_GENERATION_VERSION. */
  thumbGenerationVersion?: number;
};

export type ArcMoodboardV1 = {
  version: 1;
  moodboardCardIds: string[];
  moodboardBoard?: unknown;
};

export type ListCardsParams = {
  offset: number;
  limit: number;
  libraryScope?: LibraryScope;
  selectedTagIds?: string[];
  cardIdExact?: string | null;
  collectionId?: string | null;
  moodboardCardIds?: string[] | null;
  advancedFilters?: GalleryAdvancedFilters;
  sort?: GallerySortState;
};

export type ImportedMediaRow = {
  id: string;
  type: CardType;
  originalRelativePath: string;
  thumbRelativePath: string;
  thumbSRelativePath: string;
  thumbMRelativePath: string;
  thumbLRelativePath: string;
  dominantColorHex?: string;
  fileSize: number;
  addedAt: string;
  width?: number;
  height?: number;
};
