import type { AiSearchResult } from './types';
import { applySearchCutoff, type SearchCutoffOptions } from './semanticSearch';
import {
  cosineSimilarity,
  listEmbeddingsForModel,
  listHybridEmbeddingsForModel,
  listLegacyHeavyEmbeddings
} from '../storage/cardEmbeddings';
import { getLibraryDb } from '../storage/db';

/**
 * Visual (image-query) search across hybrid visual vectors and simple embeddings
 * for the same modelId. Qwen without captions stores simple rows; with captions —
 * hybrid rows. Checking both avoids empty results after the dual-index change.
 */
export function searchByVisualEmbedding(
  queryVector: Float32Array,
  modelId: string,
  options?: SearchCutoffOptions
): AiSearchResult[] {
  const db = getLibraryDb();
  if (!db) return [];

  const tier = options?.tier ?? 'light';
  const strictness = options?.strictness ?? 50;
  const scored = new Map<string, number>();

  for (const row of listHybridEmbeddingsForModel(db, modelId)) {
    scored.set(row.cardId, cosineSimilarity(queryVector, row.visual));
  }
  for (const row of listLegacyHeavyEmbeddings(db, modelId)) {
    if (scored.has(row.cardId)) continue;
    scored.set(row.cardId, cosineSimilarity(queryVector, row.vector));
  }
  for (const row of listEmbeddingsForModel(db, modelId)) {
    if (scored.has(row.cardId)) continue;
    scored.set(row.cardId, cosineSimilarity(queryVector, row.vector));
  }

  const allScored = [...scored.entries()]
    .map(([cardId, score]) => ({ cardId, score }))
    .sort((a, b) => b.score - a.score);
  return applySearchCutoff(allScored, { ...options, tier, strictness });
}
