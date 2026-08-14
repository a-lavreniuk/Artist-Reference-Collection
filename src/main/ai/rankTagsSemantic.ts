import { app } from 'electron';

import { readAppPreferences } from '../appPreferences';
import { listAllTags } from '../storage/libraryStorage';
import { cosineSimilarity } from '../storage/cardEmbeddings';
import type { SearchModelId } from './types';
import { embedSearchText } from './aiEmbeddingService';
import { getModelsDir } from './aiWorkerBridge';
import { isModelInstalled, sanitizeSearchModelId } from './modelManager';
import { isQwenSearchModelId } from './qwenVlEmbedding';

const SEMANTIC_TAG_MIN = 0.76;
const MAX_HITS = 24;

const tagEmbedCache = new Map<string, Float32Array>();

function toVec(nums: number[]): Float32Array {
  return Float32Array.from(nums);
}

async function embedCached(modelId: SearchModelId, text: string, modelsDir: string): Promise<Float32Array> {
  const key = `${modelId}\0${text.trim().toLowerCase()}`;
  const hit = tagEmbedCache.get(key);
  if (hit) return hit;
  const vec = toVec(await embedSearchText(modelId, text, modelsDir));
  tagEmbedCache.set(key, vec);
  return vec;
}

/**
 * Semantic tag ranking for navbar search. Silent empty result if AI search is off,
 * model is not Qwen, missing, or embedding fails.
 */
export async function rankTagsSemantic(query: string): Promise<Array<{ tagId: string; score: number }>> {
  try {
    const q = query.trim();
    if (q.length < 2) return [];
    const prefs = await readAppPreferences();
    if (!prefs.aiSearchEnabled && !prefs.aiSemanticSearchEnabled) return [];
    const modelId = sanitizeSearchModelId(prefs.aiSearchModelId);
    if (!isQwenSearchModelId(modelId)) return [];
    const userData = app.getPath('userData');
    if (!(await isModelInstalled(userData, modelId))) return [];
    const modelsDir = getModelsDir();
    const queryVec = toVec(await embedSearchText(modelId, q, modelsDir));
    const tags = listAllTags();
    const hits: Array<{ tagId: string; score: number }> = [];
    for (const tag of tags) {
      const texts = [tag.name, tag.description].filter((t): t is string => Boolean(t?.trim()));
      if (texts.length === 0) continue;
      let best = 0;
      for (const text of texts) {
        const vec = await embedCached(modelId, text, modelsDir);
        best = Math.max(best, cosineSimilarity(queryVec, vec));
      }
      if (best >= SEMANTIC_TAG_MIN) hits.push({ tagId: tag.id, score: best });
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, MAX_HITS);
  } catch {
    return [];
  }
}
