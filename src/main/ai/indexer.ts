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
import {
  captionForHeavyIndex,
  embedHeavyHybridForIndex,
  embedSearchImage,
  ensureLightClipForHybrid,
  isQwenSearchModel
} from './aiEmbeddingService';
import { initAiWorker, getModelsDir } from './aiWorkerBridge';
import {
  ensureModelsDirs,
  hasAnyInstalledSearchModel,
  isModelInstalled,
  sanitizeSearchModelId
} from './modelManager';
import type { IndexStatus, SearchModelId } from './types';
import { MODEL_CATALOG } from './types';
import { clearAiSearchCache, vectorFromNumbers } from './semanticSearch';
import { upsertCardAiCaption } from '../storage/cardAiCaption';
import { upsertCardAiCaptionFts } from '../storage/cardFts';
import { waitForNavigationIpc } from '../ipcNavigationPriority';
import { logAiIndexer, logAiIndexerError, logAiIndexerWarn } from './aiIndexerLog';
import { getCardAiCaption } from '../storage/cardAiCaption';
import {
  extractVisibleTextFromImage,
  mergeCaptionWithVisibleText
} from './visibleTextExtract';

let indexRunning = false;
let indexPaused = false;
let currentCardId: string | null = null;
let currentCardProgress: number | null = null;
let indexStage: IndexStatus['stage'] = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let activeSearchModelId: SearchModelId | null = null;
/** CLIP worker ready model id */
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
    currentCardProgress,
    stage: indexStage
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

function usesHybridIndex(searchModelId: SearchModelId, captionEnabled: boolean): boolean {
  return captionEnabled && isQwenSearchModel(searchModelId);
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
  return activeSearchModelId;
}

export function getActiveSearchModelId(): SearchModelId | null {
  return activeSearchModelId;
}

/** @deprecated */
export function getActiveAiTier(): 'light' | 'heavy' | null {
  if (!activeSearchModelId) return null;
  return isQwenSearchModel(activeSearchModelId) ? 'heavy' : 'light';
}

export function setActiveSearchModel(modelId: SearchModelId | null): void {
  activeSearchModelId = modelId;
}

/** @deprecated */
export function setActiveAiTier(_tier: 'light' | 'heavy' | null, modelId: string | null): void {
  activeSearchModelId = modelId ? sanitizeSearchModelId(modelId) : null;
}

export function resetWorkerReadyState(): void {
  workerReadyModelId = null;
}

function countIndexedForModel(
  db: NonNullable<ReturnType<typeof getLibraryDb>>,
  modelId: SearchModelId,
  captionEnabled: boolean
): number {
  if (usesHybridIndex(modelId, captionEnabled)) {
    const hybridCount = countHybridEmbeddingsForModel(db, modelId);
    if (hybridCount > 0) return hybridCount;
  }
  return countEmbeddingsForModel(db, modelId);
}

function listMissingForModel(
  db: NonNullable<ReturnType<typeof getLibraryDb>>,
  modelId: SearchModelId,
  captionEnabled: boolean,
  limit: number
): string[] {
  if (usesHybridIndex(modelId, captionEnabled)) {
    return listCardsMissingHybridEmbedding(db, modelId, limit);
  }
  return listCardsMissingEmbedding(db, modelId, limit);
}

export async function getIndexStatus(): Promise<IndexStatus> {
  const opened = await openLibraryDbSafe();
  const prefs = await readAppPreferences();
  const modelId = sanitizeSearchModelId(prefs.aiSearchModelId ?? activeSearchModelId);
  const total = opened ? countIndexableImageCards(opened.db) : 0;
  const indexed = opened ? countIndexedForModel(opened.db, modelId, prefs.aiCaptionEnabled) : 0;
  return {
    indexed,
    total,
    running: indexRunning,
    paused: indexPaused,
    currentCardId,
    currentCardProgress,
    stage: indexStage
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
  if (!prefs.aiSearchEnabled && !prefs.aiSemanticSearchEnabled) return false;

  const userData = app.getPath('userData');
  const modelId = sanitizeSearchModelId(prefs.aiSearchModelId);
  if (!(await isModelInstalled(userData, modelId))) {
    lastError = 'Сначала скачайте модель поиска в настройках AI';
    return false;
  }

  const modelsDir = getModelsDir();
  await ensureModelsDirs(userData);

  try {
    if (modelId === 'clip-vit-base-patch32') {
      if (workerReadyModelId === MODEL_CATALOG['search-clip'].id && activeSearchModelId === modelId) {
        return true;
      }
      const loaded = await initAiWorker('search-clip', modelsDir, {
        threads: prefs.aiThreads,
        gpuLayers: prefs.aiGpuLayers,
        maxRamMb: prefs.aiMaxRamMb
      });
      workerReadyModelId = loaded.modelId;
    } else if (prefs.aiCaptionEnabled) {
      // Hybrid may still need CLIP only if we ever mix — for Qwen hybrid we don't.
      // Ensure llama runtime exists via caption/search install paths elsewhere.
    } else {
      // Qwen-only: no CLIP worker required
    }

    // Optional: ensure CLIP present for hybrid legacy paths
    if (prefs.aiCaptionEnabled && modelId === 'clip-vit-base-patch32') {
      await ensureLightClipForHybrid();
    }

    activeSearchModelId = modelId;
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
  if (!prefs.aiSearchEnabled && !prefs.aiSemanticSearchEnabled && !prefs.aiCaptionEnabled) {
    return false;
  }

  const opened = await openLibraryDbSafe();
  if (!opened) return false;

  const searchOn = prefs.aiSearchEnabled || prefs.aiSemanticSearchEnabled;
  if (searchOn) {
    const ready = await ensureWorkerReady();
    if (!ready || !activeSearchModelId) return false;
  }

  const db = requireLibraryDb(opened.root);
  const imagePath = resolveImageAbsPath(opened.root, cardId, db);
  if (!imagePath) return false;

  const searchModelId = sanitizeSearchModelId(prefs.aiSearchModelId ?? activeSearchModelId);
  let heavyLoadProgress = 5;

  try {
    setCurrentCardProgress(5);
    logAiIndexer('Индексация карточки', {
      cardId,
      searchModelId,
      caption: prefs.aiCaptionEnabled
    });

    let caption = '';
    if (prefs.aiCaptionEnabled) {
      indexStage = 'captions';
      if (!(await isModelInstalled(app.getPath('userData'), 'caption'))) {
        throw new Error('Модель описания (JoyCaption) не установлена');
      }
      const onHeavyStatus = (message: string) => {
        logAiIndexer(message, { cardId });
        heavyLoadProgress = Math.min(45, heavyLoadProgress + 2);
        setCurrentCardProgress(heavyLoadProgress);
      };
      caption = await captionForHeavyIndex(imagePath, onHeavyStatus);
      setCurrentCardProgress(48);

      // Qwen hybrid: second JoyCaption pass extracts on-image UI text into ai_caption.
      if (isQwenSearchModel(searchModelId)) {
        try {
          logAiIndexer('Извлечение видимого текста', { cardId, searchModelId });
          const onVisibleStatus = (message: string) => {
            logAiIndexer(message, { cardId });
            heavyLoadProgress = Math.min(54, Math.max(heavyLoadProgress, 48) + 1);
            setCurrentCardProgress(heavyLoadProgress);
          };
          const visibleText = await extractVisibleTextFromImage(imagePath, onVisibleStatus);
          caption = mergeCaptionWithVisibleText(caption, visibleText);
        } catch (err) {
          logAiIndexerWarn('Не удалось извлечь видимый текст — продолжаем с описанием', {
            cardId,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }

      setCurrentCardProgress(55);
      const liveDb = requireLibraryDb(opened.root);
      upsertCardAiCaption(liveDb, cardId, caption);
      upsertCardAiCaptionFts(liveDb, cardId, caption);
    } else {
      caption = getCardAiCaption(db, cardId) ?? '';
    }

    if (searchOn) {
      indexStage = 'embeddings';
      const liveDb = requireLibraryDb(opened.root);
      const tagNames = getCardTagNames(liveDb, cardId);

      if (usesHybridIndex(searchModelId, prefs.aiCaptionEnabled)) {
        logAiIndexer('Гибридные эмбеддинги', { cardId, searchModelId });
        setCurrentCardProgress(65);
        const hybrid = await embedHeavyHybridForIndex(imagePath, caption, tagNames, searchModelId);
        setCurrentCardProgress(85);
        upsertHybridCardEmbeddings(
          liveDb,
          cardId,
          searchModelId,
          vectorFromNumbers(hybrid.visual),
          vectorFromNumbers(hybrid.caption)
        );
      } else {
        const vector = await embedSearchImage(searchModelId, imagePath);
        setCurrentCardProgress(85);
        upsertCardEmbedding(liveDb, cardId, searchModelId, vectorFromNumbers(vector));
      }
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
  } finally {
    indexStage = null;
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
      const prefs = await readAppPreferences();
      const searchOn = prefs.aiSearchEnabled || prefs.aiSemanticSearchEnabled;
      if (!searchOn && !prefs.aiCaptionEnabled) return;

      const opened = await openLibraryDbSafe();
      if (!opened) return;

      if (searchOn) {
        const ready = await ensureWorkerReady();
        if (!ready || !activeSearchModelId) return;
      } else {
        activeSearchModelId = sanitizeSearchModelId(prefs.aiSearchModelId);
      }

      lastError = null;
      let db = opened.db;
      const modelId = sanitizeSearchModelId(prefs.aiSearchModelId ?? activeSearchModelId);
      let total = countIndexableImageCards(db);
      let indexed = searchOn ? countIndexedForModel(db, modelId, prefs.aiCaptionEnabled) : 0;
      let didWork = false;
      let autoTagCards = 0;
      let autoTagTags = 0;
      let autoTagCreated = 0;
      lastIndexed = indexed;
      lastTotal = total;
      logAiIndexer('Старт цикла индексации', { modelId, indexed, total, caption: prefs.aiCaptionEnabled });
      broadcastProgress(indexed, total);

      while (!indexPaused) {
        const queued = pendingCardIds.splice(0, pendingCardIds.length);
        const batchSize =
          prefs.aiCaptionEnabled || isQwenSearchModel(modelId) ? HEAVY_BATCH_SIZE : BATCH_SIZE;
        const missing = searchOn
          ? listMissingForModel(db, modelId, prefs.aiCaptionEnabled, batchSize)
          : [];
        const targets = [...new Set([...queued, ...missing])].filter((id) => !skippedCardIds.has(id));
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
            try {
              const { applyAutoTagsAfterIndex } = await import('./suggestTags');
              const auto = await applyAutoTagsAfterIndex(cardId);
              if (auto && (auto.added > 0 || auto.created > 0)) {
                indexStage = 'tags';
                autoTagCards += auto.added > 0 ? 1 : 0;
                autoTagTags += auto.added;
                autoTagCreated += auto.created;
              }
            } catch (err) {
              logAiIndexerWarn('Автотегирование после индексации не выполнено', {
                cardId,
                error: err instanceof Error ? err.message : String(err)
              });
            }
          } else {
            skippedCardIds.add(cardId);
            logAiIndexerWarn('Карточка пропущена до конца сессии индексации', {
              cardId,
              error: lastError
            });
            if (lastError) broadcastError(lastError);
          }
          db = requireLibraryDb(opened.root);
          indexed = searchOn ? countIndexedForModel(db, modelId, prefs.aiCaptionEnabled) : indexed + (ok ? 1 : 0);
          total = countIndexableImageCards(db);
          lastIndexed = indexed;
          lastTotal = total;
          broadcastProgress(indexed, total);
        }
      }

      db = requireLibraryDb(opened.root);
      indexed = searchOn ? countIndexedForModel(db, modelId, prefs.aiCaptionEnabled) : lastIndexed;
      total = countIndexableImageCards(db);
      lastIndexed = indexed;
      lastTotal = total;
      if (didWork) {
        broadcastComplete(indexed, total);
        if (autoTagCards > 0 || autoTagCreated > 0) {
          const { broadcastAutoTagApplied } = await import('./suggestTags');
          broadcastAutoTagApplied({
            cards: autoTagCards,
            tags: autoTagTags,
            created: autoTagCreated
          });
        }
      }
    } finally {
      indexRunning = false;
      currentCardId = null;
      currentCardProgress = null;
      indexStage = null;
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

  const prefs = await readAppPreferences();
  const searchOn = prefs.aiSearchEnabled || prefs.aiSemanticSearchEnabled;
  if (searchOn) {
    const ready = await ensureWorkerReady();
    if (!ready || !activeSearchModelId) {
      throw new Error(lastError ?? 'Сначала установите модель поиска');
    }
  }

  indexPaused = true;
  if (loopPromise) {
    await loopPromise;
  }
  indexPaused = false;
  pendingCardIds.length = 0;
  skippedCardIds.clear();

  const db = requireLibraryDb(opened.root);
  const modelId = sanitizeSearchModelId(prefs.aiSearchModelId ?? activeSearchModelId);
  deleteEmbeddingsForModel(db, modelId);
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
  if (cardIds.length === 0) return;
  const ids = cardIds.filter(Boolean);
  const userData = app.getPath('userData');

  const searchOn = prefs.aiSearchEnabled || prefs.aiSemanticSearchEnabled;
  if ((searchOn || prefs.aiCaptionEnabled) && (await hasAnyInstalledSearchModel(userData) || await isModelInstalled(userData, 'caption'))) {
    await runIndexingLoop(ids);
  }

  try {
    const { applyAutoTagsForImportedVideos, broadcastAutoTagApplied } = await import('./suggestTags');
    const auto = await applyAutoTagsForImportedVideos(ids);
    broadcastAutoTagApplied(auto);
  } catch {
    /* ignore */
  }
  try {
    const { applyVideoCaptionsAfterImport } = await import('./videoAiCaption');
    await applyVideoCaptionsAfterImport(ids);
  } catch {
    /* ignore */
  }
}
