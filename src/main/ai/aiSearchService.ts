import { app } from 'electron';

import { readAppPreferences } from '../appPreferences';
import { embedTextForTier, embedHeavyHybridQuery } from '../ai/aiEmbeddingService';
import {
  getActiveAiModelId,
  getActiveAiTier,
  setActiveAiTier
} from '../ai/indexer';
import { getModelsDir, initAiWorker } from '../ai/aiWorkerBridge';
import { getModelIdForTier, isModelInstalled } from '../ai/modelManager';
import { searchHybridHeavy } from '../ai/hybridSearch';
import { searchByEmbedding, vectorFromNumbers } from '../ai/semanticSearch';
import type { AiSearchResult, ModelTier } from '../ai/types';
import { readLibraryRootFromDisk } from '../libraryRootConfig';
import { openLibraryDb } from '../storage/db';
import {
  countEmbeddingsForModel,
  countHybridEmbeddingsForModel
} from '../storage/cardEmbeddings';
import { ensureLibraryReady } from '../storage/libraryStorage';

export async function runAiSearch(query: string): Promise<AiSearchResult[]> {
  const prefs = await readAppPreferences();
  if (!prefs.aiSemanticSearchEnabled) {
    throw new Error('AI Semantic Search выключен в настройках');
  }

  const userData = app.getPath('userData');
  const tier = (prefs.aiModelTier ?? 'light') as ModelTier;
  if (!(await isModelInstalled(userData, tier))) {
    throw new Error('Модель не установлена. Скачайте модель в настройках AI Поиска.');
  }

  const modelsDir = getModelsDir();
  const resources = {
    threads: prefs.aiThreads,
    gpuLayers: prefs.aiGpuLayers,
    maxRamMb: prefs.aiMaxRamMb
  };

  if (tier === 'light') {
    if (getActiveAiTier() !== tier || !getActiveAiModelId()) {
      const loaded = await initAiWorker(tier, modelsDir, resources);
      setActiveAiTier(loaded.tier, loaded.modelId);
    }
  } else {
    setActiveAiTier(tier, getModelIdForTier(tier));
  }

  const modelId = getActiveAiModelId() ?? getModelIdForTier(tier);

  const root = await readLibraryRootFromDisk();
  if (!root) return [];
  await ensureLibraryReady(root);
  const db = openLibraryDb(root);
  const indexed =
    tier === 'heavy'
      ? Math.max(countHybridEmbeddingsForModel(db, modelId), countEmbeddingsForModel(db, modelId))
      : countEmbeddingsForModel(db, modelId);
  if (indexed === 0) {
    throw new Error('Библиотека ещё не проиндексирована. Дождитесь завершения индексации.');
  }

  if (tier === 'heavy') {
    const queryVectors = await embedHeavyHybridQuery(query, modelsDir);
    return searchHybridHeavy(
      modelId,
      {
        visual: vectorFromNumbers(queryVectors.visual),
        caption: vectorFromNumbers(queryVectors.caption)
      },
      query,
      {
        tier,
        strictness: prefs.aiSearchStrictness
      }
    );
  }

  const vector = await embedTextForTier(tier, query, modelId, modelsDir);
  return searchByEmbedding(vectorFromNumbers(vector), modelId, query, {
    tier,
    strictness: prefs.aiSearchStrictness
  });
}
