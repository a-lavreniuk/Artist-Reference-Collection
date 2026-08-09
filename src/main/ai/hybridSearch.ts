import type { AiSearchResult } from './types';
import { HYBRID_FUSION_WEIGHTS } from './hybridConstants';
import { computeCaptionTextBoost, computeTagsBoost } from './tagsBoost';
import { applySearchCutoff, type SearchCutoffOptions } from './semanticSearch';
import {
  cosineSimilarity,
  getCardTagNames,
  listHybridEmbeddingsForModel,
  listLegacyHeavyEmbeddings
} from '../storage/cardEmbeddings';
import { getCardAiCaptionsByIds } from '../storage/cardAiCaption';
import { getLibraryDb } from '../storage/db';

export type HybridQueryVectors = {
  visual: Float32Array;
  caption: Float32Array;
};

export function searchHybridHeavy(
  baseModelId: string,
  queryVectors: HybridQueryVectors,
  queryText: string,
  options?: SearchCutoffOptions
): AiSearchResult[] {
  const db = getLibraryDb();
  if (!db) return [];

  const tier = options?.tier ?? 'heavy';
  const strictness = options?.strictness ?? 50;
  const {
    visual: wVisual,
    caption: wCaption,
    tagsBoostMax,
    captionTextBoostMax
  } = HYBRID_FUSION_WEIGHTS;

  const hybridRows = listHybridEmbeddingsForModel(db, baseModelId);
  const legacyRows = listLegacyHeavyEmbeddings(db, baseModelId);
  const captionByCardId = getCardAiCaptionsByIds(db, [
    ...hybridRows.map((row) => row.cardId),
    ...legacyRows.map((row) => row.cardId)
  ]);

  const scored = new Map<string, number>();

  for (const row of hybridRows) {
    const visualScore = cosineSimilarity(queryVectors.visual, row.visual);
    const captionScore = cosineSimilarity(queryVectors.caption, row.caption);
    const tagsBoost = computeTagsBoost(queryText, getCardTagNames(db, row.cardId), tagsBoostMax);
    const textBoost = computeCaptionTextBoost(
      queryText,
      captionByCardId.get(row.cardId) ?? '',
      captionTextBoostMax
    );
    const score = wVisual * visualScore + wCaption * captionScore + tagsBoost + textBoost;
    scored.set(row.cardId, score);
  }

  for (const row of legacyRows) {
    if (scored.has(row.cardId)) continue;
    const captionScore = cosineSimilarity(queryVectors.caption, row.vector);
    const tagsBoost = computeTagsBoost(queryText, getCardTagNames(db, row.cardId), tagsBoostMax);
    const textBoost = computeCaptionTextBoost(
      queryText,
      captionByCardId.get(row.cardId) ?? '',
      captionTextBoostMax
    );
    scored.set(row.cardId, wCaption * captionScore + tagsBoost + textBoost);
  }

  const allScored = [...scored.entries()]
    .map(([cardId, score]) => ({ cardId, score }))
    .sort((a, b) => b.score - a.score);

  return applySearchCutoff(allScored, { ...options, tier, strictness });
}
