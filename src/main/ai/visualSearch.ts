import type { AiSearchResult } from './types';
import { applySearchCutoff, type SearchCutoffOptions } from './semanticSearch';
import {
  cosineSimilarity,
  listEmbeddingsForModel,
  listHybridEmbeddingsForModel,
  listLegacyHeavyEmbeddings
} from '../storage/cardEmbeddings';
import { getLibraryDb } from '../storage/db';

/** Поиск только по visual-вектору (запрос — изображение). */
export function searchByVisualEmbedding(
  queryVector: Float32Array,
  modelId: string,
  options?: SearchCutoffOptions
): AiSearchResult[] {
  const db = getLibraryDb();
  if (!db) return [];

  const tier = options?.tier ?? 'light';
  const strictness = options?.strictness ?? 50;

  if (tier === 'heavy') {
    const hybridRows = listHybridEmbeddingsForModel(db, modelId);
    const scored = new Map<string, number>();
    for (const row of hybridRows) {
      const score = cosineSimilarity(queryVector, row.visual);
      scored.set(row.cardId, score);
    }
    const legacyRows = listLegacyHeavyEmbeddings(db, modelId);
    for (const row of legacyRows) {
      if (scored.has(row.cardId)) continue;
      scored.set(row.cardId, cosineSimilarity(queryVector, row.vector));
    }
    const allScored = [...scored.entries()]
      .map(([cardId, score]) => ({ cardId, score }))
      .sort((a, b) => b.score - a.score);
    return applySearchCutoff(allScored, { ...options, tier, strictness });
  }

  const rows = listEmbeddingsForModel(db, modelId);
  const allScored = rows
    .map((row) => ({
      cardId: row.cardId,
      score: cosineSimilarity(queryVector, row.vector)
    }))
    .sort((a, b) => b.score - a.score);

  return applySearchCutoff(allScored, { ...options, tier, strictness });
}
