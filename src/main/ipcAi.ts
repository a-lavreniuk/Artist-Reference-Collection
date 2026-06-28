import { app, BrowserWindow, ipcMain } from 'electron';

import { readAppPreferences, writeAppPreferences } from './appPreferences';
import { detectHardware, getSupportedTiers, isTierSupported } from './ai/hardware';
import {
  cancelIdleIndexing,
  getActiveAiModelId,
  getActiveAiTier,
  getIndexStatus,
  getIndexerError,
  pauseIndexing,
  queueCardsForIndexing,
  resumeIndexing,
  resetWorkerReadyState,
  runFullReindex,
  scheduleIdleIndexing,
  scheduleReindexForActiveModel,
  setActiveAiTier
} from './ai/indexer';
import {
  cancelModelDownloadInWorker,
  downloadModelInWorker,
  getModelsDir,
  initAiWorker,
  pauseModelDownloadInWorker,
  resumeModelDownloadInWorker,
  shutdownAiWorker,
  testModelInWorker
} from './ai/aiWorkerBridge';
import {
  deleteInstalledModel,
  ensureModelsDirs,
  getModelEntry,
  getModelIdForTier,
  hasAnyInstalledModel,
  isModelInstalled,
  listModelInstallStatuses
} from './ai/modelManager';
import { downloadGgufModel, cancelGgufDownload, pauseGgufDownload, resumeGgufDownload } from './ai/downloadGguf';
import { verifyHeavyGgufLoad } from './ai/heavyModelVerify';
import { embedTextForTier, embedHeavyHybridQuery, ensureLightClipForHybrid } from './ai/aiEmbeddingService';
import { testJoyCaptionLoad } from './ai/joyCaption';
import { shutdownLlamaBridge } from './ai/llamaCppBridge';
import {
  deleteLlamaRuntimeIfUnused,
  ensureLlamaRuntime,
  getLlamaRuntimeStatus,
  isLlamaRuntimeInstalled,
} from './ai/llamaRuntime';
import type { LlamaRuntimeVariant } from './ai/llamaRuntimeCatalog';
import {
  clearTierManifest,
  isModelUpdateAvailable,
  readModelManifest,
  recordInstalledModel
} from './ai/modelManifest';
import { clearAiSearchCache, searchByEmbedding, vectorFromNumbers } from './ai/semanticSearch';
import { searchHybridHeavy } from './ai/hybridSearch';
import {
  searchCardsBySimilarImage,
  stageSimilarQueryFile,
  type NormalizedCropRect
} from './ai/similarImageSearch';
import type { ListCardsParams } from './storage/types';
import type { AiSearchResult, AiStatus, ModelTier } from './ai/types';
import { MODEL_CATALOG } from './ai/types';
import { readLibraryRootFromDisk } from './libraryRootConfig';
import { getCardByIdFromDb, rowToCardRecord } from './storage/libraryStorage';
import { ensureLibraryReady } from './storage/libraryStorage';
import { countEmbeddingsForModel, countHybridEmbeddingsForModel, deleteEmbeddingsForModel } from './storage/cardEmbeddings';
import { openLibraryDb } from './storage/db';

let ipcRegistered = false;
let downloadingTier: ModelTier | null = null;
let downloadPercent: number | null = null;
let downloadPhase: 'runtime' | 'model' | 'finalize' | null = null;
let downloadBytesReceived: number | null = null;
let downloadBytesTotal: number | null = null;

function clampPercent(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function broadcastDownloadProgress(
  tier: ModelTier,
  percent: number,
  phase: 'runtime' | 'model' | 'finalize',
  bytes?: { received?: number | null; total?: number | null }
): void {
  downloadPercent = clampPercent(percent) ?? 0;
  downloadPhase = phase;
  if (bytes?.received != null) downloadBytesReceived = bytes.received;
  if (bytes?.total != null) downloadBytesTotal = bytes.total;
  broadcast('arc:ai-download-progress', {
    tier,
    percent: downloadPercent,
    phase,
    ...(downloadBytesReceived != null ? { bytesReceived: downloadBytesReceived } : {}),
    ...(downloadBytesTotal != null ? { bytesTotal: downloadBytesTotal } : {})
  });
}

function broadcastDownloadComplete(tier: ModelTier): void {
  broadcast('arc:ai-download-complete', { tier });
}

function createFinalizeProgress(tier: ModelTier) {
  let lastPercent = 0;

  const report = (percent: number): void => {
    const next = clampPercent(percent) ?? 0;
    if (next < lastPercent) return;
    lastPercent = next;
    broadcastDownloadProgress(tier, next, 'finalize');
  };

  const run = async <T>(
    from: number,
    to: number,
    work: (sub: (subPercent: number) => void) => Promise<T>
  ): Promise<T> => {
    const start = clampPercent(from) ?? 0;
    const end = clampPercent(to) ?? 100;
    let current = start;
    report(start);

    let done = false;
    const ceiling = Math.max(start, end - 1);
    const timer = setInterval(() => {
      if (done || current >= ceiling) return;
      current = Math.min(ceiling, current + 1);
      report(current);
    }, 100);

    const sub = (subPercent: number): void => {
      const mapped = start + Math.round(((clampPercent(subPercent) ?? 0) / 100) * (end - start));
      if (mapped <= current) return;
      current = Math.min(end, mapped);
      report(current);
    };

    try {
      return await work(sub);
    } finally {
      done = true;
      clearInterval(timer);
      report(end);
    }
  };

  return { report, run };
}

async function finalizeModelInstall(
  tier: ModelTier,
  userData: string,
  entry: ReturnType<typeof getModelEntry>,
  modelId: string,
  options?: {
    withHybridClip?: boolean;
    onComplete?: () => void | Promise<void>;
  }
): Promise<void> {
  const progress = createFinalizeProgress(tier);
  let cursor = 0;

  if (options?.withHybridClip) {
    await progress.run(cursor, 55, async (sub) => {
      await ensureLightClipForHybrid(
        (info) => {
          const raw = typeof info === 'number' ? info : info.percent;
          sub(raw);
        },
        { allowDownload: true }
      );
    });
    cursor = 55;
  }

  const recordEnd = options?.withHybridClip ? cursor + 25 : 60;
  await progress.run(cursor, recordEnd, async () => {
    await recordInstalledModel(userData, tier, entry, entry.hfRevision ?? 'main');
  });
  cursor = recordEnd;

  await progress.run(cursor, cursor + 12, async () => {
    await writeAppPreferences({ aiModelTier: tier });
    setActiveAiTier(tier, modelId);
  });
  cursor += 12;

  await progress.run(cursor, 100, async () => {
    if (options?.onComplete) {
      await options.onComplete();
    }
  });
}

async function ensureVisionRuntimeForUpdate(
  userData: string,
  tier: ModelTier
): Promise<void> {
  await ensureLlamaRuntime(userData, 'cpu', (percent) => {
    broadcastDownloadProgress(tier, percent, 'runtime');
  });
  if (await isLlamaRuntimeInstalled(userData, 'cuda')) {
    await ensureLlamaRuntime(userData, 'cuda', (percent) => {
      broadcastDownloadProgress(tier, percent, 'runtime');
    });
  }
}

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}

function sanitizeTier(raw: unknown): ModelTier {
  if (raw === 'heavy' || raw === 'medium') return 'heavy';
  return 'light';
}

function applyResourcePreset(preset: number, hardware: ReturnType<typeof detectHardware>): {
  threads: number;
  gpuLayers: number;
  maxRamMb: number;
} {
  const ratio = Math.max(0.1, Math.min(1, preset / 100));
  const threads = Math.max(1, Math.min(32, Math.round(hardware.cpuCores * ratio)));
  const maxRamMb = Math.max(
    1024,
    Math.min(hardware.totalMemoryMb, Math.round(hardware.totalMemoryMb * 0.25 + hardware.totalMemoryMb * 0.45 * ratio))
  );
  const gpuLayers = hardware.hasGpu ? Math.round(20 * ratio) : 0;
  return { threads, gpuLayers, maxRamMb };
}

function cardIndexToRenderer(row: ReturnType<typeof rowToCardRecord>) {
  return {
    id: row.id,
    type: row.type,
    addedAt: row.addedAt,
    dateModified: row.dateModified,
    originalRelativePath: row.originalRel,
    thumbRelativePath: row.thumbSRel,
    thumbSRelativePath: row.thumbSRel,
    thumbMRelativePath: row.thumbMRel,
    thumbLRelativePath: row.thumbLRel,
    dominantColorHex: row.dominantColor,
    format: row.format,
    width: row.width,
    height: row.height,
    fileSize: row.fileSize,
    fileSizeMb: row.fileSize ? row.fileSize / (1024 * 1024) : undefined,
    tagIds: row.tagIds,
    collectionIds: row.collectionIds,
    description: row.description,
    name: row.name,
    linkUrl: row.linkUrl,
    durationMs: row.durationMs
  };
}

async function buildAiStatus(): Promise<AiStatus> {
  const prefs = await readAppPreferences();
  const hardware = detectHardware();
  const supportedTiers = getSupportedTiers(hardware);
  const index = await getIndexStatus();
  const userData = app.getPath('userData');
  const models = await listModelInstallStatuses(userData, downloadingTier, downloadPercent);
  const llamaRuntime = await getLlamaRuntimeStatus(userData);
  const setupReady = prefs.aiSemanticSearchEnabled && (await hasAnyInstalledModel(userData));

  const modelCards = (['light', 'heavy'] as ModelTier[]).map((tier) => {
    const entry = MODEL_CATALOG[tier];
    return {
      tier,
      label: entry.label,
      description: entry.description,
      sizeLabel: entry.sizeLabel,
      minRamMb: entry.minRamMb,
      supported: isTierSupported(hardware, tier)
    };
  });

  return {
    enabled: prefs.aiSemanticSearchEnabled,
    activeTier: getActiveAiTier() ?? prefs.aiModelTier,
    activeModelId: getActiveAiModelId(),
    hardware,
    supportedTiers,
    modelCards,
    resources: {
      threads: prefs.aiThreads,
      gpuLayers: prefs.aiGpuLayers,
      maxRamMb: prefs.aiMaxRamMb
    },
    resourcePreset: prefs.aiResourcePreset,
    searchStrictness: prefs.aiSearchStrictness,
    index,
    models,
    llamaRuntime,
    download:
      downloadingTier != null
        ? {
            tier: downloadingTier,
            percent: downloadPercent,
            phase: downloadPhase ?? 'model'
          }
        : null,
    lastError: getIndexerError(),
    setupReady
  };
}

async function runAiSearch(query: string): Promise<AiSearchResult[]> {
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

export function registerAiIpc(): void {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.handle('arc:ai-get-status', async () => buildAiStatus());
  ipcMain.handle('arc:ai-get-index-status', async () => getIndexStatus());
  ipcMain.handle('arc:ai-detect-hardware', async () => detectHardware({ force: true }));

  ipcMain.handle('arc:ai-download-llama-runtime', async (_e, payloadRaw: unknown) => {
    const payload = payloadRaw as { variant?: string; tier?: string };
    const variant: LlamaRuntimeVariant = payload.variant === 'cuda' ? 'cuda' : 'cpu';
    const tier = sanitizeTier(payload.tier);
    const userData = app.getPath('userData');
    await ensureModelsDirs(userData);

    try {
      await ensureLlamaRuntime(userData, variant, (percent) => {
        broadcast('arc:ai-download-progress', { tier, percent: clampPercent(percent) ?? 0, phase: 'runtime' });
      });
      return { ok: true as const, variant };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      broadcast('arc:ai-error', { message, fallback: false });
      return { ok: false as const, error: message };
    }
  });

  ipcMain.handle('arc:ai-download-model', async (_e, tierRaw: unknown) => {
    const tier = sanitizeTier(tierRaw);
    const hardware = detectHardware();
    if (!isTierSupported(hardware, tier)) {
      return {
        ok: false as const,
        error: 'Эта модель не поддерживается вашим оборудованием.'
      };
    }

    const prefs = await readAppPreferences();
    const modelsDir = getModelsDir();
    const userData = app.getPath('userData');
    await ensureModelsDirs(userData);

    downloadingTier = tier;
    downloadPercent = 0;
    downloadPhase = 'model';
    downloadBytesReceived = null;
    downloadBytesTotal = null;
    broadcastDownloadProgress(tier, 0, 'model');

    const report = (percentOrInfo: number | import('./ai/downloadGguf').DownloadProgressInfo) => {
      const info = typeof percentOrInfo === 'number' ? { percent: percentOrInfo } : percentOrInfo;
      if (tier === 'heavy') {
        broadcastDownloadProgress(tier, info.percent, 'model', {
          received: info.bytesReceived,
          total: info.bytesTotal
        });
        return;
      }
      downloadPercent = clampPercent(info.percent) ?? 0;
      if (info.bytesReceived != null) downloadBytesReceived = info.bytesReceived;
      if (info.bytesTotal != null) downloadBytesTotal = info.bytesTotal;
      broadcast('arc:ai-download-progress', {
        tier,
        percent: downloadPercent,
        phase: 'model',
        ...(downloadBytesReceived != null ? { bytesReceived: downloadBytesReceived } : {}),
        ...(downloadBytesTotal != null ? { bytesTotal: downloadBytesTotal } : {})
      });
    };

    try {
      const entry = getModelEntry(tier);
      if (tier === 'heavy') {
        await downloadGgufModel(userData, entry, report);
        if (!(await isModelInstalled(userData, tier))) {
          return {
            ok: false as const,
            error: 'Файлы модели не найдены после загрузки. Попробуйте ещё раз.'
          };
        }
        await finalizeModelInstall(tier, userData, entry, getModelIdForTier(tier), {
          withHybridClip: true,
          onComplete: () => scheduleIdleIndexing()
        });
        return { ok: true as const, modelId: getModelIdForTier(tier), tier };
      }

      const result = await downloadModelInWorker(
        tier,
        modelsDir,
        {
          threads: prefs.aiThreads,
          gpuLayers: prefs.aiGpuLayers,
          maxRamMb: prefs.aiMaxRamMb
        },
        report
      );
      await finalizeModelInstall(tier, userData, entry, result.modelId, {
        onComplete: () => scheduleIdleIndexing()
      });
      return { ok: true as const, modelId: result.modelId, tier };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      broadcast('arc:ai-error', { message, fallback: tier !== 'light' });
      return { ok: false as const, error: message };
    } finally {
      broadcastDownloadComplete(tier);
      downloadingTier = null;
      downloadPercent = null;
      downloadPhase = null;
      downloadBytesReceived = null;
      downloadBytesTotal = null;
    }
  });

  ipcMain.handle('arc:ai-delete-model', async (_e, tierRaw: unknown) => {
    const tier = sanitizeTier(tierRaw);
    const userData = app.getPath('userData');
    await deleteInstalledModel(userData, tier);
    await clearTierManifest(userData, tier);
    if (tier === 'heavy') {
      await deleteLlamaRuntimeIfUnused(userData);
    }
    await shutdownLlamaBridge();
    const prefs = await readAppPreferences();
    if (prefs.aiModelTier === tier) {
      setActiveAiTier(null, null);
    }
    clearAiSearchCache();
    return buildAiStatus();
  });

  ipcMain.handle('arc:ai-set-active-model', async (_e, tierRaw: unknown) => {
    const tier = sanitizeTier(tierRaw);
    const userData = app.getPath('userData');
    if (!(await isModelInstalled(userData, tier))) {
      throw new Error('Модель не установлена');
    }
    const prefs = await readAppPreferences();
    const previousTier = prefs.aiModelTier;
    await writeAppPreferences({ aiModelTier: tier });
    setActiveAiTier(tier, getModelIdForTier(tier));
    clearAiSearchCache();
    if (previousTier !== tier) {
      scheduleReindexForActiveModel();
    } else {
      scheduleIdleIndexing();
    }
    return buildAiStatus();
  });

  ipcMain.handle('arc:ai-cancel-download', async () => {
    cancelModelDownloadInWorker();
    cancelGgufDownload();
    downloadingTier = null;
    downloadPercent = null;
    downloadPhase = null;
    downloadBytesReceived = null;
    downloadBytesTotal = null;
    return { ok: true as const };
  });

  ipcMain.handle('arc:ai-pause-download', async () => {
    pauseModelDownloadInWorker();
    pauseGgufDownload();
    return { ok: true as const };
  });

  ipcMain.handle('arc:ai-resume-download', async () => {
    resumeModelDownloadInWorker();
    resumeGgufDownload();
    return { ok: true as const };
  });

  ipcMain.handle('arc:ai-update-model', async (_e, tierRaw: unknown) => {
    const tier = sanitizeTier(tierRaw);
    const userData = app.getPath('userData');
    const entry = getModelEntry(tier);
    const manifest = await readModelManifest(userData);
    if (!isModelUpdateAvailable(tier, entry, manifest[tier])) {
      return { ok: false as const, error: 'Обновление не требуется.' };
    }

    const oldModelId = manifest[tier]?.modelId;
    await deleteInstalledModel(userData, tier);
    await clearTierManifest(userData, tier);
    await shutdownLlamaBridge();

    const prefs = await readAppPreferences();
    const modelsDir = getModelsDir();
    await ensureModelsDirs(userData);

    downloadingTier = tier;
    downloadPercent = 0;
    downloadPhase = tier === 'heavy' ? 'runtime' : null;
    downloadBytesReceived = null;
    downloadBytesTotal = null;
    broadcast('arc:ai-download-progress', {
      tier,
      percent: 0,
      ...(downloadPhase ? { phase: downloadPhase } : {})
    });

    const report = (percentOrInfo: number | import('./ai/downloadGguf').DownloadProgressInfo) => {
      const info = typeof percentOrInfo === 'number' ? { percent: percentOrInfo } : percentOrInfo;
      if (tier === 'heavy') {
        broadcastDownloadProgress(tier, info.percent, 'model', {
          received: info.bytesReceived,
          total: info.bytesTotal
        });
        return;
      }
      downloadPercent = clampPercent(info.percent) ?? 0;
      if (info.bytesReceived != null) downloadBytesReceived = info.bytesReceived;
      if (info.bytesTotal != null) downloadBytesTotal = info.bytesTotal;
      broadcast('arc:ai-download-progress', {
        tier,
        percent: downloadPercent,
        phase: 'model',
        ...(downloadBytesReceived != null ? { bytesReceived: downloadBytesReceived } : {}),
        ...(downloadBytesTotal != null ? { bytesTotal: downloadBytesTotal } : {})
      });
    };

    try {
      if (tier === 'heavy') {
        await ensureVisionRuntimeForUpdate(userData, tier);
        downloadPhase = 'model';
        broadcastDownloadProgress(tier, 0, 'model');
        await downloadGgufModel(userData, entry, report);
      } else {
        await downloadModelInWorker(
          tier,
          modelsDir,
          {
            threads: prefs.aiThreads,
            gpuLayers: prefs.aiGpuLayers,
            maxRamMb: prefs.aiMaxRamMb
          },
          report
        );
      }

      if (!(await isModelInstalled(userData, tier))) {
        return { ok: false as const, error: 'Файлы модели не найдены после обновления.' };
      }

      await finalizeModelInstall(tier, userData, entry, entry.id, {
        onComplete: async () => {
          const root = await readLibraryRootFromDisk();
          if (root && oldModelId && oldModelId !== entry.id) {
            await ensureLibraryReady(root);
            const db = openLibraryDb(root);
            deleteEmbeddingsForModel(db, oldModelId);
          }
          clearAiSearchCache();
          scheduleReindexForActiveModel();
        }
      });
      return { ok: true as const, modelId: entry.id, tier };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false as const, error: message };
    } finally {
      broadcastDownloadComplete(tier);
      downloadingTier = null;
      downloadPercent = null;
      downloadPhase = null;
      downloadBytesReceived = null;
      downloadBytesTotal = null;
    }
  });

  ipcMain.handle('arc:ai-test-model', async (_e, tierRaw: unknown) => {
    const tier = sanitizeTier(tierRaw);
    const prefs = await readAppPreferences();
    const userData = app.getPath('userData');
    if (!(await isModelInstalled(userData, tier))) {
      return { ok: false as const, message: 'Модель не установлена.' };
    }
    try {
      const resources = {
        threads: prefs.aiThreads,
        gpuLayers: prefs.aiGpuLayers,
        maxRamMb: prefs.aiMaxRamMb
      };
      if (tier === 'heavy') {
        await verifyHeavyGgufLoad(getModelsDir(), resources, userData);
        return await testJoyCaptionLoad(userData, resources);
      }
      return await testModelInWorker(tier, getModelsDir(), resources);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false as const, message };
    }
  });

  ipcMain.handle('arc:ai-search', async (_e, queryRaw: unknown) => {
    const query = typeof queryRaw === 'string' ? queryRaw.trim() : '';
    if (!query) return [] as AiSearchResult[];
    try {
      return await runAiSearch(query);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      broadcast('arc:ai-error', { message, fallback: true });
      throw err;
    }
  });

  ipcMain.handle('arc:ai-search-cards', async (_e, payloadRaw: unknown) => {
    let query = '';
    let collectionId: string | null = null;
    let moodboardCardIds: string[] | null = null;
    let scopeCardIds: string[] | undefined;
    let offset = 0;
    let limit = 50;

    if (typeof payloadRaw === 'string') {
      query = payloadRaw.trim();
    } else if (payloadRaw && typeof payloadRaw === 'object') {
      const p = payloadRaw as {
        query?: string;
        collectionId?: string | null;
        moodboardCardIds?: string[] | null;
        scopeCardIds?: string[];
        offset?: number;
        limit?: number;
      };
      query = typeof p.query === 'string' ? p.query.trim() : '';
      collectionId = typeof p.collectionId === 'string' ? p.collectionId : null;
      moodboardCardIds = Array.isArray(p.moodboardCardIds) ? p.moodboardCardIds : null;
      scopeCardIds = Array.isArray(p.scopeCardIds) ? p.scopeCardIds : undefined;
      offset = typeof p.offset === 'number' ? Math.max(0, p.offset) : 0;
      limit = typeof p.limit === 'number' ? Math.max(1, p.limit) : 50;
    }

    if (!query) return [];

    const root = await readLibraryRootFromDisk();
    if (!root) return [];

    const cacheKey = JSON.stringify({
      query,
      collectionId,
      moodboardCardIds,
      scopeCardIds: scopeCardIds ? [...scopeCardIds].sort() : null
    });

    const { getOrBuildAiResultsPage } = await import('./ai/aiResultsCache');
    return getOrBuildAiResultsPage(cacheKey, offset, limit, async () => {
      const searchResults = await runAiSearch(query);
      const scope =
        scopeCardIds && scopeCardIds.length > 0 ? new Set(scopeCardIds) : null;
      const moodboardSet =
        moodboardCardIds && moodboardCardIds.length > 0 ? new Set(moodboardCardIds) : null;

      const cards = [];
      for (const hit of searchResults) {
        const row = getCardByIdFromDb(root, hit.cardId);
        if (!row) continue;
        if (collectionId && !row.collectionIds.includes(collectionId)) continue;
        if (moodboardSet && !moodboardSet.has(hit.cardId)) continue;
        if (scope && !scope.has(hit.cardId)) continue;
        cards.push({ ...cardIndexToRenderer(rowToCardRecord(row)), aiScore: hit.score });
      }
      return cards;
    });
  });

  ipcMain.handle('arc:ai-reindex', async () => {
    void runFullReindex().catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      broadcast('arc:ai-error', { message, fallback: false });
    });
    return { ok: true as const };
  });

  ipcMain.handle('arc:ai-pause-index', async () => {
    pauseIndexing();
    return { ok: true as const };
  });

  ipcMain.handle('arc:ai-resume-index', async () => {
    resumeIndexing();
    return { ok: true as const };
  });

  ipcMain.handle('arc:ai-set-enabled', async (_e, payload: unknown) => {
    const p = payload as {
      enabled?: boolean;
      tier?: ModelTier;
      threads?: number;
      gpuLayers?: number;
      maxRamMb?: number;
      resourcePreset?: number;
      searchStrictness?: number;
    };
    const patch: Record<string, unknown> = {};
    if (typeof p.enabled === 'boolean') patch.aiSemanticSearchEnabled = p.enabled;
    if (p.tier) patch.aiModelTier = sanitizeTier(p.tier);
    if (typeof p.resourcePreset === 'number') {
      const preset = Math.max(10, Math.min(100, Math.round(p.resourcePreset)));
      patch.aiResourcePreset = preset;
      const resources = applyResourcePreset(preset, detectHardware());
      patch.aiThreads = resources.threads;
      patch.aiGpuLayers = resources.gpuLayers;
      patch.aiMaxRamMb = resources.maxRamMb;
    }
    if (typeof p.searchStrictness === 'number') {
      patch.aiSearchStrictness = Math.max(0, Math.min(100, Math.round(p.searchStrictness / 5) * 5));
    }
    if (typeof p.threads === 'number') patch.aiThreads = Math.max(1, Math.min(32, Math.round(p.threads)));
    if (typeof p.gpuLayers === 'number') patch.aiGpuLayers = Math.max(0, Math.min(128, Math.round(p.gpuLayers)));
    if (typeof p.maxRamMb === 'number') patch.aiMaxRamMb = Math.max(512, Math.min(65536, Math.round(p.maxRamMb)));

    const next = await writeAppPreferences(patch);
    clearAiSearchCache();

    if (next.aiSemanticSearchEnabled) {
      if (await hasAnyInstalledModel(app.getPath('userData'))) {
        scheduleIdleIndexing();
      }
    } else {
      cancelIdleIndexing();
      shutdownAiWorker();
      void shutdownLlamaBridge();
      resetWorkerReadyState();
      setActiveAiTier(null, null);
    }

    return buildAiStatus();
  });

  ipcMain.handle('arc:ai-similar-stage-file', async (_e, sourcePath: unknown) => {
    const source = typeof sourcePath === 'string' ? sourcePath.trim() : '';
    if (!source) return { ok: false as const, error: 'Путь к файлу не указан.' };
    try {
      const stagedPath = await stageSimilarQueryFile(source);
      return { ok: true as const, stagedPath };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false as const, error: message };
    }
  });

  ipcMain.handle('arc:ai-similar-search-cards', async (_e, payload: unknown) => {
    const prefs = await readAppPreferences();
    if (!prefs.aiSemanticSearchEnabled) {
      throw new Error('AI Semantic Search выключен в настройках');
    }
    const userData = app.getPath('userData');
    const tier = (prefs.aiModelTier ?? 'light') as ModelTier;
    if (!(await isModelInstalled(userData, tier))) {
      throw new Error('Модель не установлена. Скачайте модель в настройках AI Поиска.');
    }

    const root = await readLibraryRootFromDisk();
    if (!root) return [];
    await ensureLibraryReady(root);
    const db = openLibraryDb(root);
    const indexed =
      tier === 'heavy'
        ? Math.max(countHybridEmbeddingsForModel(db, MODEL_CATALOG.heavy.id), countEmbeddingsForModel(db, MODEL_CATALOG.light.id))
        : countEmbeddingsForModel(db, MODEL_CATALOG.light.id);
    if (indexed === 0) {
      throw new Error('Библиотека ещё не проиндексирована. Дождитесь завершения индексации.');
    }

    const p = payload as Partial<ListCardsParams> & {
      cardId?: string | null;
      imagePath?: string | null;
      crop?: NormalizedCropRect | null;
      scopeCardIds?: string[];
    };

    const scope =
      Array.isArray(p.scopeCardIds) && p.scopeCardIds.length > 0 ? new Set(p.scopeCardIds) : null;

    const modelId = tier === 'heavy' ? MODEL_CATALOG.heavy.id : MODEL_CATALOG.light.id;

    try {
      const rows = await searchCardsBySimilarImage(root, {
        cardId: p.cardId ?? null,
        imagePath: p.imagePath ?? null,
        crop: p.crop ?? null,
        libraryScope: p.libraryScope,
        selectedTagIds: p.selectedTagIds,
        cardIdExact: p.cardIdExact,
        collectionId: p.collectionId,
        moodboardCardIds: p.moodboardCardIds,
        advancedFilters: p.advancedFilters,
        sort: p.sort,
        scopeCardIds: scope,
        tier,
        modelId,
        strictness: prefs.aiSearchStrictness,
        offset: typeof p.offset === 'number' ? p.offset : 0,
        limit: typeof p.limit === 'number' ? p.limit : 50
      });
      return rows.map((r) => cardIndexToRenderer(rowToCardRecord(r)));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      broadcast('arc:ai-error', { message, fallback: true });
      throw err;
    }
  });
}

export { queueCardsForIndexing, scheduleIdleIndexing, cancelIdleIndexing, shutdownAiWorker };
