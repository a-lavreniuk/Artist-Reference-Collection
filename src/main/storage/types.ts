/** Shared storage types for the new library format (v2). */

import type { GalleryAdvancedFilters, GallerySortState } from './galleryFilters';

export const STORAGE_SCHEMA_VERSION = 6;

/** Виртуальная библиотека в галерее: вся / без меток / корзина. */
export type LibraryScope = 'all' | 'untagged' | 'trash';

export const THUMB_S_MAX = 160;
export const THUMB_M_MAX = 400;
export const THUMB_L_MAX = 800;

export type CardType = 'image' | 'video';

export type ImageDupFingerprint = {
  rotHashes: [string, string, string, string];
  hist: number[];
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
  phashJson?: string;
  originalRel: string;
  thumbSRel: string;
  thumbMRel: string;
  thumbLRel: string;
  tagIds: string[];
  collectionIds: string[];
  description?: string;
  name?: string;
  linkUrl?: string;
  durationMs?: number;
};

export type ArcSystemV1 = {
  version: 1;
  schemaVersion: number;
  appVersion?: string;
  duplicateSimilarityThresholdPct: number;
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
