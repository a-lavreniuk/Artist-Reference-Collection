export type NavbarMetrics = {
  totalCards: number;
  imageCards: number;
  videoCards: number;
  totalCollections: number;
  moodboardCards: number;
  totalCategories: number;
};

export type CategoryWeight = 'neutral' | 'low' | 'medium' | 'high';

/** Числовой вклад метки в скоринг «похожих» (одно место для настройки). */
export const CATEGORY_WEIGHT_SCORE: Record<CategoryWeight, number> = {
  neutral: 1,
  low: 2,
  medium: 4,
  high: 8
};

export type CategoryRecord = {
  id: string;
  name: string;
  colorHex: string;
  weight: CategoryWeight;
  sortIndex: number;
  createdAt: string;
  description?: string;
};

export type TagRecord = {
  id: string;
  categoryId: string;
  name: string;
  usageCount: number;
  description?: string;
  tooltipImageDataUrl?: string;
};

export type CategoryStats = {
  tagCount: number;
  cardsWithTags: number;
  usageSum: number;
  createdAt: string;
};

export type CollectionStats = {
  cardCount: number;
  totalSizeMb: number;
  createdAt: string;
};

export type { CardRecord, CollectionRecord } from '../arcSchema';
