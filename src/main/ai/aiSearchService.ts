import { app } from 'electron';

import { readAppPreferences } from '../appPreferences';
import { embedSearchText, embedHeavyHybridQuery, isQwenSearchModel } from '../ai/aiEmbeddingService';
import {
  getActiveAiModelId,
  getActiveSearchModelId,
  setActiveSearchModel
} from '../ai/indexer';
import { getModelsDir, initAiWorker } from '../ai/aiWorkerBridge';
import { isModelInstalled, sanitizeSearchModelId } from '../ai/modelManager';
import { searchHybridHeavy } from '../ai/hybridSearch';
import { searchByEmbedding, vectorFromNumbers } from '../ai/semanticSearch';
import type { AiSearchResult, SearchModelId } from '../ai/types';
import { readLibraryRootFromDisk } from '../libraryRootConfig';
import { openLibraryDb } from '../storage/db';
import {
  countEmbeddingsForModel,
  countHybridEmbeddingsForModel
} from '../storage/cardEmbeddings';
import { ensureLibraryReady } from '../storage/libraryStorage';

function usesFusion(modelId: SearchModelId): boolean {
  return isQwenSearchModel(modelId);
}

export async function runAiSearch(query: string): Promise<AiSearchResult[]> {
  const prefs = await readAppPreferences();
  if (!prefs.aiSearchEnabled && !prefs.aiSemanticSearchEnabled) {
    throw new Error('AI Semantic Search выключен в настройках');
  }

  const userData = app.getPath('userData');
  const modelId = sanitizeSearchModelId(prefs.aiSearchModelId ?? getActiveSearchModelId());
  if (!(await isModelInstalled(userData, modelId))) {
    throw new Error('Модель не установлена. Скачайте модель в настройках AI.');
  }

  const modelsDir = getModelsDir();
  const resources = {
    threads: prefs.aiThreads,
    gpuLayers: prefs.aiGpuLayers,
    maxRamMb: prefs.aiMaxRamMb
  };

  if (modelId === 'clip-vit-base-patch32') {
    if (getActiveSearchModelId() !== modelId || !getActiveAiModelId()) {
      const loaded = await initAiWorker('search-clip', modelsDir, resources);
      setActiveSearchModel(loaded.modelId as SearchModelId);
    }
  } else {
    setActiveSearchModel(modelId);
  }

  const root = await readLibraryRootFromDisk();
  if (!root) return [];
  await ensureLibraryReady(root);
  const db = openLibraryDb(root);

  const fusion = usesFusion(modelId);
  const indexed = fusion
    ? Math.max(countHybridEmbeddingsForModel(db, modelId), countEmbeddingsForModel(db, modelId))
    : countEmbeddingsForModel(db, modelId);
  if (indexed === 0) {
    throw new Error('Библиотека ещё не проиндексирована. Дождитесь завершения индексации.');
  }

  if (fusion) {
    const queryVectors = await embedHeavyHybridQuery(query, modelsDir, modelId);
    return searchHybridHeavy(
      modelId,
      {
        visual: vectorFromNumbers(queryVectors.visual),
        caption: vectorFromNumbers(queryVectors.caption)
      },
      query,
      {
        tier: 'heavy',
        strictness: prefs.aiSearchStrictness
      }
    );
  }

  const vector = await embedSearchText(modelId, query, modelsDir);
  return searchByEmbedding(vectorFromNumbers(vector), modelId, query, {
    // Qwen without fusion still uses heavy cutoff; tags boost applies only for light/CLIP.
    tier: isQwenSearchModel(modelId) ? 'heavy' : 'light',
    strictness: prefs.aiSearchStrictness
  });
}
