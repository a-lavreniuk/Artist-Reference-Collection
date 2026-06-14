import { MODEL_CATALOG } from './types';

export const HYBRID_INDEX_VERSION = 1;
export const HYBRID_VISUAL_SUFFIX = '::visual';
export const HYBRID_CAPTION_SUFFIX = '::caption';

// Fusion weights calibrated for visual-dominant queries with caption support.
// visual 0.55 — сохраняет качество на визуальных запросах;
// caption 0.45 — усиливает описательные запросы;
// tagsBoostMax 0.12 — мягкий буст без «ломания» выдачи.
export const HYBRID_FUSION_WEIGHTS = {
  visual: 0.55,
  caption: 0.45,
  tagsBoostMax: 0.12
} as const;

export function hybridBaseModelId(): string {
  return MODEL_CATALOG.heavy.id;
}

export function hybridVisualModelId(baseModelId = hybridBaseModelId()): string {
  return `${baseModelId}${HYBRID_VISUAL_SUFFIX}`;
}

export function hybridCaptionModelId(baseModelId = hybridBaseModelId()): string {
  return `${baseModelId}${HYBRID_CAPTION_SUFFIX}`;
}

export function isHybridChannelModelId(modelId: string): boolean {
  return modelId.endsWith(HYBRID_VISUAL_SUFFIX) || modelId.endsWith(HYBRID_CAPTION_SUFFIX);
}
