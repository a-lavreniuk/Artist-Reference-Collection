import type { SearchModelId } from './types';

/** Bump when hybrid caption payload / indexing steps change (e.g. visible UI text merge). */
export const HYBRID_INDEX_VERSION = 2;
export const HYBRID_VISUAL_SUFFIX = '::visual';
export const HYBRID_CAPTION_SUFFIX = '::caption';

// Fusion weights calibrated for visual-dominant queries with caption support.
// visual 0.55 — сохраняет качество на визуальных запросах;
// caption 0.45 — усиливает описательные запросы;
// tagsBoostMax 0.12 — мягкий буст без «ломания» выдачи.
// captionTextBoostMax 0.18 — literal match по ai_caption (в т.ч. UI-текст на кадре).
// Бонус рейтинга карточки (0–5 звёзд) использует ту же величину после отсечки.
export const HYBRID_FUSION_WEIGHTS = {
  visual: 0.55,
  caption: 0.45,
  tagsBoostMax: 0.12,
  /** Literal match of query against ai_caption (incl. on-image UI text). */
  captionTextBoostMax: 0.18
} as const;

/** Hybrid channels are keyed by the active search model id. */
export function hybridVisualModelId(baseModelId: string): string {
  return `${baseModelId}${HYBRID_VISUAL_SUFFIX}`;
}

export function hybridCaptionModelId(baseModelId: string): string {
  return `${baseModelId}${HYBRID_CAPTION_SUFFIX}`;
}

export function isHybridChannelModelId(modelId: string): boolean {
  return modelId.endsWith(HYBRID_VISUAL_SUFFIX) || modelId.endsWith(HYBRID_CAPTION_SUFFIX);
}

export function isQwenSearchModel(modelId: string): modelId is SearchModelId {
  return modelId === 'qwen3-vl-embedding-2b' || modelId === 'qwen3-vl-embedding-8b';
}
