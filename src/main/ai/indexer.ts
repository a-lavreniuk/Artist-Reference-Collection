import { BrowserWindow, app } from 'electron';
import path from 'path';

import { readAppPreferences } from '../appPreferences';
import { readLibraryRootFromDisk } from '../libraryRootConfig';
import {
  countEmbeddingsForModel,
  countHybridEmbeddingsForModel,
  countIndexableImageCards,
  deleteEmbeddingsForModel,
  getCardTagNames,
  listCardsMissingEmbedding,
  listCardsMissingHybridEmbedding,
  upsertCardEmbedding,
  upsertHybridCardEmbeddings
} from '../storage/cardEmbeddings';
import { getLibraryDb, openLibraryDb } from '../storage/db';
import { ensureLibraryReady } from '../storage/libraryStorage';
import { embedImageForTier, embedHeavyHybridForIndex, captionForHeavyIndex, ensureLightClipForHybrid } from './aiEmbeddingService';
import { initAiWorker, getModelsDir } from './aiWorkerBridge';
import { ensureModelsDirs, getModelIdForTier, hasAnyInstalledModel, isModelInstalled } from './modelManager';
import type { IndexStatus, ModelTier } from './types';
import { MODEL_CATALOG } from './types';
import { clearAiSearchCache, vectorFromNumbers } from './semanticSearch';
import { upsertCardAiCaption } from '../storage/cardAiCaption';
import { upsertCardAiCaptionFts } from '../storage/cardFts';
import { waitForNavigationIpc } from '../ipcNavigationPriority';
import { logAiIndexer, logAiIndexerError, logAiIndexerWarn } from './aiIndexerLog';

let indexRunning = false;
let indexPaused = false;
let currentCardId: string | null = null;
let currentCardProgress: number | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let activeModelId: string | null = null;
let activeTier: ModelTier | null = null;
/** modelId, загруженный в AI worker (может отставать от activeModelId до ensureWorkerReady). */
let workerReadyModelId: string | null = null;
let lastError: string | null = null;
let pendingCardIds: string[] = [];
let loopPromise: Promise<void> | null = null;
let lastBroadcastDone = 0;
let lastBroadcastTotal = 0;

const IDLE_DELAY_MS = 15_000;
const BATCH_SIZE = 8;
const HEAVY_BATCH_SIZE = 1;
const INTRA_CARD_BROADCAST_MIN_MS = 300;

let lastIntraCardBroadcastAt = 0;
let intraCardBroadcastTimer: ReturnType<typeof setTimeout> | null = null;
/** Карточки с ошибкой индексации в текущей сессии — не повторять в цикле. */
const skippedCardIds = new Set<string>();

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}

function broadcastProgress(done: number, total: number, running?: boolean): void {
  lastBroadcastDone = done;
  lastBroadcastTotal = total;
  broadcast('arc:ai-index-progress', {
    done,
    total,
    running: running ?? (indexRunning && !indexPaused),
    currentCardId,
    currentCardProgress
  });
}

function flushIntraCardBroadcast(): void {
  intraCardBroadcastTimer = null;
  lastIntraCardBroadcastAt = Date.now();
  broadcastProgress(lastBroadcastDone, lastBroadcastTotal, true);
}

function setCurrentCardProgress(percent: number | null): void {
  if (percent == null || !Number.isFinite(percent)) {
    currentCardProgress = null;
  } else {
    currentCardProgress = Math.max(0, Math.min(100, Math.round(percent)));
  }
  if (!indexRunning) return;

  const force = percent === 0 || percent === 100;
  const now = Date.now();
  if (!force && now - lastIntraCardBroadcastAt < INTRA_CARD_BROADCAST_MIN_MS) {
    if (!intraCardBroadcastTimer) {
      intraCardBroadcastTimer = setTimeout(
        flushIntraCardBroadcast,
        INTRA_CARD_BROADCAST_MIN_MS - (now - lastIntraCardBroadcastAt)
      );
    }
    return;
  }

  if (intraCardBroadcastTimer) {
    clearTimeout(intraCardBroadcastTimer);
    intraCardBroadcastTimer = null;
  }
  lastIntraCardBroadcastAt = now;
  broadcastProgress(lastBroadcastDone, lastBroadcastTotal, true);
}

function broadcastComplete(indexed: number, total: number): void {
  broadcast('arc:ai-index-complete', { indexed, total });
}

function broadcastError(message: string, fallback?: boolean): void {
  broadcast('arc:ai-error', { message, fallback: Boolean(fallback) });
}

async function resolveActiveModelId(): Promise<string | null> {
  const prefs = await readAppPreferences();
  const tier = (prefs.aiModelTier ?? 'light') as ModelTier;
  if (activeModelId && activeTier === tier) return activeModelId;
  if (await isModelInstalled(app.getPath('userData'), tier)) {
    return getModelIdForTier(tier);
  }
  for (const fallbackTier of ['light', 'heavy'] as ModelTier[]) {
    if (await isModelInstalled(app.getPath('userData'), fallbackTier)) {
      return getModelIdForTier(fallbackTier);
    }
  }
  return null;
}

async function openLibraryDbSafe(): Promise<{ root: string; db: NonNullable<ReturnType<typeof getLibraryDb>> } | null> {
  const root = await readLibraryRootFromDisk();
  if (!root) {
    lastError = 'Библиотека не выбрана';
    return null;
  }
  const resolved = path.resolve(root);
  await ensureLibraryReady(resolved);
  const db = requireLibraryDb(resolved);
  return { root: resolved, db };
}

function requireLibraryDb(root: string): NonNullable<ReturnType<typeof getLibraryDb>> {
  const existing = getLibraryDb();
  if (existing) {
    try {
      existing.prepare('SELECT 1 AS ok').get();
      return existing;
    } catch {
      /* connection closed */
    }
  }
  return openLibraryDb(root);
}

export function getIndexerError(): string | null {
  if (indexRunning && !indexPaused) return null;
  return lastError;
}

export function getActiveAiModelId(): string | null {
  return activeModelId;
}

export function getActiveAiTier(): ModelTier | null {
  return activeTier;
}

export function setActiveAiTier(tier: ModelTier | null, modelId: string | null): void {
  activeTier = tier;
  activeModelId = modelId;
}

export function resetWorkerReadyState(): void {
  workerReadyModelId = null;
}

function countIndexedForModel(db: NonNullable<ReturnType<typeof getLibraryDb>>, modelId: string, tier: ModelTier): number {
  if (tier === 'heavy') {
    const hybridCount = countHybridEmbeddingsForModel(db, modelId);
    if (hybridCount > 0) return hybridCount;
    return countEmbeddingsForModel(db, modelId);
  }
  return countEmbeddingsForModel(db, modelId);
}

function listMissingForModel(
  db: NonNullable<ReturnType<typeof getLibraryDb>>,
  modelId: string,
  tier: ModelTier,
  limit: number
): string[] {
  if (tier === 'heavy') {
    return listCardsMissingHybridEmbedding(db, modelId, limit);
  }
  return listCardsMissingEmbedding(db, modelId, limit);
}

export async function getIndexStatus(): Promise<IndexStatus> {
  const opened = await openLibraryDbSafe();
  const prefs = await readAppPreferences();
  const tier = (prefs.aiModelTier ?? 'light') as ModelTier;
  const modelId = (await resolveActiveModelId()) ?? getModelIdForTier('light');
  const total = opened ? countIndexableImageCards(opened.db) : 0;
  const indexed = opened ? countIndexedForModel(opened.db, modelId, tier) : 0;
  return {
    indexed,
    total,
    running: indexRunning,
    paused: indexPaused,
    currentCardId,
    currentCardProgress
  };
}

function resolveImageAbsPath(
  libraryRoot: string,
  cardId: string,
  db: NonNullable<ReturnType<typeof getLibraryDb>>
): string | null {
  const row = db.prepare('SELECT original_rel, type FROM cards WHERE id = ?').get(cardId) as
    | { original_rel?: string; type?: string }
    | undefined;
  if (!row?.original_rel || row.type !== 'image') return null;
  return path.join(libraryRoot, row.original_rel);
}

async function ensureWorkerReady(): Promise<boolean> {
  const prefs = await readAppPreferences();
  if (!prefs.aiSemanticSearchEnabled) return false;

  const tier = (prefs.aiModelTier ?? 'light') as ModelTier;
  const userData = app.getPath('userData');
  if (!(await isModelInstalled(userData, tier))) {
    lastError = 'Сначала скачайте модель в настройках AI Поиска';
    return false;
  }

  const modelsDir = getModelsDir();
  await ensureModelsDirs(userData);

  const expectedModelId = getModelIdForTier(tier);
  if (activeModelId === expectedModelId && activeTier === tier) {
    if (tier === 'light' || tier === 'heavy') {
      if (workerReadyModelId === MODEL_CATALOG.light.id) return true;
    }
  }

  try {
    const clipModelId =
      tier === 'heavy'
        ? await ensureLightClipForHybrid()
        : (await initAiWorker('light', modelsDir, {
            threads: prefs.aiThreads,
            gpuLayers: prefs.aiGpuLayers,
            maxRamMb: prefs.aiMaxRamMb
          })).modelId;
    activeTier = tier;
    activeModelId = expectedModelId;
    workerReadyModelId = clipModelId;
    lastError = null;
    return true;
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    broadcastError(lastError, true);
    return false;
  }
}

export async function indexCardById(cardId: string): Promise<boolean> {
  const prefs = await readAppPreferences();
  if (!prefs.aiSemanticSearchEnabled) return false;

  const opened = await openLibraryDbSafe();
  if (!opened) return false;

  const ready = await ensureWorkerReady();
  if (!ready || !activeModelId) return false;

  const db = requireLibraryDb(opened.root);
  const imagePath = resolveImageAbsPath(opened.root, cardId, db);
  if (!imagePath) return false;

  let heavyLoadProgress = 5;

  try {
    setCurrentCardProgress(5);
    const tier = (prefs.aiModelTier ?? 'light') as ModelTier;
    logAiIndexer('Индексация карточки', { cardId, tier });

    if (tier === 'heavy') {
      const onHeavyStatus = (message: string) => {
        logAiIndexer(message, { cardId });
        heavyLoadProgress = Math.min(45, heavyLoadProgress + 2);
        setCurrentCardProgress(heavyLoadProgress);
      };
      const caption = await captionForHeavyIndex(imagePath, onHeavyStatus);
      setCurrentCardProgress(55);
      const liveDb = requireLibraryDb(opened.root);
      upsertCardAiCaption(liveDb, cardId, caption);
      upsertCardAiCaptionFts(liveDb, cardId, caption);
      const tagNames = getCardTagNames(liveDb, cardId);
      logAiIndexer('Гибридные эмбеддинги', { cardId });
      setCurrentCardProgress(65);
      const hybrid = await embedHeavyHybridForIndex(imagePath, caption, tagNames);
      setCurrentCardProgress(85);
      upsertHybridCardEmbeddings(
        liveDb,
        cardId,
        activeModelId,
        vectorFromNumbers(hybrid.visual),
        vectorFromNumbers(hybrid.caption)
      );
    } else {
      const vector = await embedImageForTier(tier, imagePath, activeModelId);
      setCurrentCardProgress(85);
      const liveDb = requireLibraryDb(opened.root);
      upsertCardEmbedding(liveDb, cardId, activeModelId, vectorFromNumbers(vector));
    }
    clearAiSearchCache();
    lastError = null;
    setCurrentCardProgress(100);
    logAiIndexer('Карточка проиндексирована', { cardId });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    lastError = message;
    logAiIndexerError('Ошибка индексации карточки', err);
    setCurrentCardProgress(null);
    return false;
  }
}

async function runIndexingLoop(extraCardIds: string[] = []): Promise<void> {
  if (loopPromise) {
    if (extraCardIds.length > 0) {
      pendingCardIds.push(...extraCardIds);
    }
    return loopPromise;
  }

  if (extraCardIds.length > 0) {
    pendingCardIds.push(...extraCardIds);
  }

  loopPromise = (async () => {
    if (indexRunning) return;
    indexRunning = true;
    indexPaused = false;
    let lastIndexed = 0;
    let lastTotal = 0;

    try {
      const opened = await openLibraryDbSafe();
      if (!opened) return;

      const ready = await ensureWorkerReady();
      if (!ready || !activeModelId) return;

      lastError = null;
      let db = opened.db;
      const tier = activeTier ?? 'light';
      let total = countIndexableImageCards(db);
      let indexed = countIndexedForModel(db, activeModelId, tier);
      let didWork = false;
      lastIndexed = indexed;
      lastTotal = total;
      logAiIndexer('Старт цикла индексации', { tier, indexed, total });
      broadcastProgress(indexed, total);

      while (!indexPaused) {
        const queued = pendingCardIds.splice(0, pendingCardIds.length);
        const batchSize = activeTier === 'heavy' ? HEAVY_BATCH_SIZE : BATCH_SIZE;
        const targets = [
          ...new Set([...queued, ...listMissingForModel(db, activeModelId, tier, batchSize)])
        ].filter((id) => !skippedCardIds.has(id));
        if (targets.length === 0) break;

        for (const cardId of targets) {
          if (indexPaused) break;
          await waitForNavigationIpc();
          currentCardId = cardId;
          currentCardProgress = 0;
          lastError = null;
          broadcastProgress(indexed, total, true);
          const ok = await indexCardById(cardId);
          if (ok) {
            didWork = true;
          } else {
            skippedCardIds.add(cardId);
            logAiIndexerWarn('Карточка пропущена до конца сессии индексации', {
              cardId,
              error: lastError
            });
            if (lastError) broadcastError(lastError);
          }
          db = requireLibraryDb(opened.root);
          indexed = countIndexedForModel(db, activeModelId, tier);
          total = countIndexableImageCards(db);
          lastIndexed = indexed;
          lastTotal = total;
          broadcastProgress(indexed, total);
        }
      }

      db = requireLibraryDb(opened.root);
      indexed = countIndexedForModel(db, activeModelId, tier);
      total = countIndexableImageCards(db);
      lastIndexed = indexed;
      lastTotal = total;
      if (didWork) {
        broadcastComplete(indexed, total);
      }
    } finally {
      indexRunning = false;
      currentCardId = null;
      currentCardProgress = null;
      broadcastProgress(lastIndexed, lastTotal, false);
      loopPromise = null;
      if (pendingCardIds.length > 0 && !indexPaused) {
        void runIndexingLoop();
      }
    }
  })();

  return loopPromise;
}

export async function runFullReindex(): Promise<void> {
  const opened = await openLibraryDbSafe();
  if (!opened) {
    throw new Error(lastError ?? 'Библиотека не выбрана');
  }

  const ready = await ensureWorkerReady();
  if (!ready || !activeModelId) {
    throw new Error(lastError ?? 'Сначала установите модель AI');
  }

  indexPaused = true;
  if (loopPromise) {
    await loopPromise;
  }
  indexPaused = false;
  pendingCardIds.length = 0;
  skippedCardIds.clear();

  const db = requireLibraryDb(opened.root);
  deleteEmbeddingsForModel(db, activeModelId);
  clearAiSearchCache();

  await runIndexingLoop();
}

export function pauseIndexing(): void {
  indexPaused = true;
}

export function resumeIndexing(): void {
  indexPaused = false;
  scheduleIdleIndexing();
}

export function scheduleIdleIndexing(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    idleTimer = null;
    void runIndexingLoop();
  }, IDLE_DELAY_MS);
}

/** Сразу переиндексировать библиотеку под активную модель (например, после переключения tier). */
export function scheduleReindexForActiveModel(): void {
  cancelIdleIndexing();
  void runFullReindex().catch((err) => {
    lastError = err instanceof Error ? err.message : String(err);
    broadcastError(lastError);
  });
}

export function cancelIdleIndexing(): void {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

export async function queueCardsForIndexing(cardIds: string[]): Promise<void> {
  const prefs = await readAppPreferences();
  if (!prefs.aiSemanticSearchEnabled || cardIds.length === 0) return;
  const userData = app.getPath('userData');
  if (!(await hasAnyInstalledModel(userData))) return;
  await runIndexingLoop(cardIds.filter(Boolean));
}
