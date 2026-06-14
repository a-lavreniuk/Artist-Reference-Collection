import type { AiSearchResult, ModelTier } from './types';

import { resolveSearchCutoff } from './searchStrictness';
import { HYBRID_FUSION_WEIGHTS } from './hybridConstants';
import { computeTagsBoost } from './tagsBoost';

import {
  cosineSimilarity,
  getCardTagNames,
  listEmbeddingsForModel,
  type CardEmbeddingRow
} from '../storage/cardEmbeddings';

import { getLibraryDb } from '../storage/db';

type SearchCacheEntry = {
  query: string;
  modelId: string;
  strictness: number;
  tier: ModelTier;
  results: AiSearchResult[];
  expiresAt: number;
};

const searchCache = new Map<string, SearchCacheEntry>();

function cacheKey(query: string, modelId: string, strictness: number, tier: ModelTier): string {
  return `${modelId}::${tier}::${strictness}::${query.trim().toLowerCase()}`;
}

export function clearAiSearchCache(): void {
  searchCache.clear();
}

export type SearchCutoffOptions = {
  tier?: ModelTier;
  strictness?: number;
  topK?: number;
  minScore?: number;
  useCache?: boolean;
  cacheTtlMs?: number;
};

export function applySearchCutoff(
  allScored: AiSearchResult[],
  options: SearchCutoffOptions
): AiSearchResult[] {
  const tier = options.tier ?? 'light';
  const cutoff = resolveSearchCutoff(tier, options.strictness);
  const topK = options.topK ?? cutoff.topK;
  const minScore = options.minScore ?? cutoff.minScore;

  const aboveMin = allScored.filter((item) => item.score >= minScore);
  let results = aboveMin.slice(0, topK);

  if (results.length === 0 && allScored.length > 0 && aboveMin.length > 0) {
    const best = aboveMin[0].score;
    const relativeFloor = best * cutoff.relativeThreshold;
    results = aboveMin.filter((item) => item.score >= relativeFloor).slice(0, topK);
  }

  if (results.length === 0 && cutoff.allowFallback && allScored.length > 0) {
    results = allScored.slice(0, Math.min(cutoff.fallbackCount, topK));
  }

  return results;
}

export function searchByEmbedding(
  queryVector: Float32Array,
  modelId: string,
  queryText: string,
  options?: SearchCutoffOptions
): AiSearchResult[] {
  const db = getLibraryDb();
  if (!db) return [];

  const tier = options?.tier ?? 'light';
  const strictness = options?.strictness ?? 50;
  const useCache = options?.useCache !== false;
  const cacheTtlMs = options?.cacheTtlMs ?? 30_000;

  const key = cacheKey(queryText, modelId, strictness, tier);
  if (useCache) {
    const cached = searchCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.results;
    }
  }

  const rows: CardEmbeddingRow[] = listEmbeddingsForModel(db, modelId);
  const tagsBoostMax = HYBRID_FUSION_WEIGHTS.tagsBoostMax;
  const allScored = rows
    .map((row) => {
      let score = cosineSimilarity(queryVector, row.vector);
      if (tier === 'light') {
        score += computeTagsBoost(queryText, getCardTagNames(db, row.cardId), tagsBoostMax);
      }
      return { cardId: row.cardId, score };
    })
    .sort((a, b) => b.score - a.score);

  const results = applySearchCutoff(allScored, { ...options, tier, strictness });

  if (useCache) {
    searchCache.set(key, {
      query: queryText,
      modelId,
      strictness,
      tier,
      results,
      expiresAt: Date.now() + cacheTtlMs
    });
  }

  return results;
}

export function vectorFromNumbers(values: number[]): Float32Array {
  return Float32Array.from(values);
}
