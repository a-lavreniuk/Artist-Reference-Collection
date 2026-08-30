import { app, BrowserWindow, ipcMain } from 'electron';

import { readAppPreferences, writeAppPreferences } from './appPreferences';
import {
  detectHardware,
  getSupportedSearchModelIds,
  getSupportedTiers,
  isSearchModelSupported,
  isTierSupported
} from './ai/hardware';
import {
  cancelIdleIndexing,
  getActiveSearchModelId,
  getIndexStatus,
  getIndexerError,
  isIndexingInFlight,
  isIndexingPaused,
  pauseIndexing,
  queueCardsForIndexing,
  resumeIndexing,
  resetWorkerReadyState,
  runFullReindex,
  scheduleIdleIndexing,
  scheduleReindexForActiveModel,
  setActiveSearchModel,
  waitForIndexingLoopIdle
} from './ai/indexer';
import {
  cancelModelDownloadInWorker,
  downloadModelInWorker,
  getModelsDir,
  pauseModelDownloadInWorker,
  resumeModelDownloadInWorker,
  shutdownAiWorker,
  testModelInWorker
} from './ai/aiWorkerBridge';
import {
  deleteInstalledModel,
  ensureModelsDirs,
  getModelEntry,
  hasAnyInstalledSearchModel,
  hasModelArtifactsOnDisk,
  isModelInstalled,
  listModelInstallStatuses,
  sanitizeModelRole,
  sanitizeSearchModelId,
  snapshotLlamaModelFiles
} from './ai/modelManager';
import { logAiModel } from './ai/aiIndexerLog';
import { shouldKeepSharedCaptionFiles } from './ai/captionShare';
import { mapRuntimePercent, shouldAcceptDownloadProgress } from './ai/downloadProgressGate';
import {
  downloadGgufModel,
  cancelGgufDownload,
  pauseGgufDownload,
  resumeGgufDownload,
  isDownloadAbortError
} from './ai/downloadGguf';
import { verifyHeavyGgufLoad } from './ai/heavyModelVerify';
import { runAiSearch } from './ai/aiSearchService';
import { ensureLightClipForHybrid, isQwenSearchModel } from './ai/aiEmbeddingService';
import { testJoyCaptionLoad } from './ai/joyCaption';
import { testQwenEmbedding } from './ai/qwenVlEmbedding';
import { shutdownLlamaBridge } from './ai/llamaCppBridge';
import {
  deleteLlamaRuntimeIfUnused,
  ensureLlamaRuntime,
  getLlamaRuntimeStatus,
  hasCudaServerBinary,
  isLlamaRuntimeInstalled
} from './ai/llamaRuntime';
import type { LlamaRuntimeVariant } from './ai/llamaRuntimeCatalog';
import {
  clearRoleManifest,
  isModelUpdateAvailable,
  readModelManifest,
  recordInstalledModel
} from './ai/modelManifest';
import { clearAiSearchCache } from './ai/semanticSearch';
import {
  searchCardsBySimilarImage,
  stageSimilarQueryFile,
  type NormalizedCropRect
} from './ai/similarImageSearch';
import { allowMediaStagingPaths } from './media/mediaStagingTokens';
import type { ListCardsParams } from './storage/types';
import type { AiSearchResult, AiStatus, ModelRole, SearchModelId } from './ai/types';
import { MODEL_CATALOG, MODEL_ROLES, SEARCH_MODEL_IDS, SEARCH_ROLE_BY_ID, usesLlamaStack } from './ai/types';
import { readLibraryRootFromDisk } from './libraryRootConfig';
import { getCardByIdFromDb, rowToCardRecord } from './storage/libraryStorage';
import { ensureLibraryReady } from './storage/libraryStorage';
import {
  countEmbeddingsForModel,
  countHybridEmbeddingsForModel,
  deleteEmbeddingsForModel
} from './storage/cardEmbeddings';
import { openLibraryDb } from './storage/db';

let ipcRegistered = false;
let downloadingRole: ModelRole | null = null;
let modelTestInFlight = false;
let downloadPercent: number | null = null;
let downloadPhase: 'runtime' | 'model' | 'finalize' | null = null;
let lastEmittedPhase: 'runtime' | 'model' | 'finalize' | null = null;
let downloadBytesReceived: number | null = null;
let downloadBytesTotal: number | null = null;
let lastProgressEmitAt = 0;

function clampPercent(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function mapPercentToRange(percent: number, from: number, to: number): number {
  const raw = clampPercent(percent) ?? 0;
  return Math.round(from + (raw / 100) * (to - from));
}

function isQwenSearchRole(role: ModelRole): boolean {
  return role === 'search-embed-2b' || role === 'search-embed-8b';
}

async function qwenShouldBundleCaption(userData: string, role: ModelRole): Promise<boolean> {
  if (!isQwenSearchRole(role)) return false;
  if (await isModelInstalled(userData, 'caption')) return false;
  if (await hasModelArtifactsOnDisk(userData, 'caption')) return false;
  return true;
}

async function logCaptionTrace(userData: string, reason: string, extra?: Record<string, unknown>): Promise<void> {
  const prefs = await readAppPreferences();
  const [onDisk, installed, qwen2, qwen8, disk] = await Promise.all([
    hasModelArtifactsOnDisk(userData, 'caption'),
    isModelInstalled(userData, 'caption'),
    isModelInstalled(userData, 'search-embed-2b'),
    isModelInstalled(userData, 'search-embed-8b'),
    snapshotLlamaModelFiles(userData, 'caption')
  ]);
  logAiModel(reason, {
    captionOnDisk: onDisk,
    captionInManifest: installed,
    aiAutoTagModelInstalled: prefs.aiAutoTagModelInstalled === true,
    qwen2Installed: qwen2,
    qwen8Installed: qwen8,
    captionFiles: disk.files,
    ...extra
  });
}

function resetDownloadTracking(percent: number | null = null): void {
  downloadPercent = percent;
  downloadPhase = null;
  lastEmittedPhase = null;
  downloadBytesReceived = null;
  downloadBytesTotal = null;
  lastProgressEmitAt = 0;
}

function mapDownloadError(err: unknown): string {
  if (isDownloadAbortError(err)) return 'Загрузка отменена';
  return err instanceof Error ? err.message : String(err);
}

function downloadBusyError(): { ok: false; error: string } | null {
  if (downloadingRole) {
    return { ok: false as const, error: 'Уже скачивается другая модель.' };
  }
  if (modelTestInFlight) {
    return { ok: false as const, error: 'Дождитесь окончания проверки модели.' };
  }
  return null;
}

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}

function broadcastDownloadProgress(
  role: ModelRole,
  percent: number,
  phase: 'runtime' | 'model' | 'finalize',
  bytes?: { received?: number | null; total?: number | null }
): void {
  const nextPercent = clampPercent(percent) ?? 0;
  const phaseChanged = lastEmittedPhase !== phase;
  if (!shouldAcceptDownloadProgress(lastEmittedPhase, downloadPercent, phase, nextPercent)) {
    if (bytes?.received != null && (downloadBytesReceived == null || bytes.received > downloadBytesReceived)) {
      downloadBytesReceived = bytes.received;
    }
    if (bytes?.total != null) downloadBytesTotal = bytes.total;
    return;
  }
  downloadPercent = nextPercent;
  downloadPhase = phase;
  lastEmittedPhase = phase;
  if (phaseChanged && bytes?.received == null) {
    downloadBytesReceived = null;
    downloadBytesTotal = null;
  }
  if (bytes?.received != null) downloadBytesReceived = bytes.received;
  if (bytes?.total != null) downloadBytesTotal = bytes.total;
  const now = Date.now();
  const force =
    lastProgressEmitAt === 0 || phaseChanged || downloadPercent >= 100;
  if (!force && now - lastProgressEmitAt < 250) return;
  lastProgressEmitAt = now;
  const entry = MODEL_CATALOG[role];
  broadcast('arc:ai-download-progress', {
    role,
    modelId: entry.id,
    tier: entry.tier,
    percent: downloadPercent,
    phase,
    ...(downloadBytesReceived != null ? { bytesReceived: downloadBytesReceived } : {}),
    ...(downloadBytesTotal != null ? { bytesTotal: downloadBytesTotal } : {})
  });
}

function broadcastDownloadComplete(role: ModelRole): void {
  broadcast('arc:ai-download-complete', { role, modelId: MODEL_CATALOG[role].id, tier: MODEL_CATALOG[role].tier });
}

function resolveRoleFromPayload(raw: unknown): ModelRole {
  if (raw && typeof raw === 'object') {
    const o = raw as { role?: unknown; modelId?: unknown; tier?: unknown };
    const byRole = sanitizeModelRole(o.role ?? o.modelId ?? o.tier);
    if (byRole) return byRole;
  }
  const byRaw = sanitizeModelRole(raw);
  if (byRaw) return byRaw;
  return 'search-clip';
}

function createFinalizeProgress(role: ModelRole, silent = false) {
  let lastPercent = 0;
  const report = (percent: number): void => {
    if (silent) return;
    const next = clampPercent(percent) ?? 0;
    if (next < lastPercent) return;
    lastPercent = next;
    broadcastDownloadProgress(role, next, 'finalize');
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
  role: ModelRole,
  userData: string,
  entry: ReturnType<typeof getModelEntry>,
  modelId: string,
  options?: {
    withHybridClip?: boolean;
    setActiveSearch?: boolean;
    silentProgress?: boolean;
    onComplete?: () => void | Promise<void>;
  }
): Promise<void> {
  const progress = createFinalizeProgress(role, options?.silentProgress);
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
    await recordInstalledModel(userData, role, entry, entry.hfRevision ?? 'main');
  });
  cursor = recordEnd;

  await progress.run(cursor, cursor + 12, async () => {
    if (role !== 'caption') {
      if (options?.setActiveSearch !== false && SEARCH_MODEL_IDS.includes(entry.id as SearchModelId)) {
        await writeAppPreferences({
          aiSearchModelId: entry.id as SearchModelId,
          aiSearchEnabled: true,
          aiSemanticSearchEnabled: true
        });
        setActiveSearchModel(entry.id as SearchModelId);
      }
    }
  });
  cursor += 12;

  await progress.run(cursor, 100, async () => {
    if (options?.onComplete) await options.onComplete();
  });
}

/**
 * Файлы JoyCaption для hybrid-поиска Средней/Тяжёлой: тот же прогресс, роль карточки поиска не меняется.
 */
async function downloadCaptionFilesIfNeeded(
  userData: string,
  ownerRole: ModelRole,
  mapToUpperBand: boolean
): Promise<void> {
  if (await isModelInstalled(userData, 'caption')) {
    logAiModel('JoyCaption для Qwen не нужна — уже в manifest', { ownerRole, mapToUpperBand });
    return;
  }
  if (await hasModelArtifactsOnDisk(userData, 'caption')) {
    logAiModel('JoyCaption для Qwen не качаем — файлы уже на диске', { ownerRole, mapToUpperBand });
    return;
  }

  const hardware = detectHardware();
  const captionEntry = getModelEntry('caption');
  if (!isRoleSupportedByHardware(hardware, 'caption', captionEntry)) {
    logAiModel('JoyCaption для Qwen пропущена — мало RAM', { ownerRole });
    return;
  }
  logAiModel('JoyCaption качается вместе с моделью поиска', { ownerRole, mapToUpperBand });

  const report = (percentOrInfo: number | import('./ai/downloadGguf').DownloadProgressInfo) => {
    const info = typeof percentOrInfo === 'number' ? { percent: percentOrInfo } : percentOrInfo;
    const percent = mapToUpperBand ? mapPercentToRange(info.percent, 50, 100) : (clampPercent(info.percent) ?? 0);
    broadcastDownloadProgress(ownerRole, percent, 'model', {
      received: info.bytesReceived,
      total: info.bytesTotal
    });
  };

  if (mapToUpperBand) broadcastDownloadProgress(ownerRole, 50, 'model');
  await downloadGgufModel(userData, captionEntry, report);
  if (!(await hasModelArtifactsOnDisk(userData, 'caption'))) {
    throw new Error('Файлы модели не найдены после загрузки. Попробуйте ещё раз.');
  }
}

async function finalizeCaptionIfPresent(userData: string): Promise<void> {
  if (await isModelInstalled(userData, 'caption')) return;
  if (!(await hasModelArtifactsOnDisk(userData, 'caption'))) return;
  const entry = getModelEntry('caption');
  await finalizeModelInstall('caption', userData, entry, entry.id, {
    setActiveSearch: false,
    silentProgress: true,
    onComplete: () => scheduleIdleIndexing()
  });
}

async function qwenStillInstalled(userData: string, exceptRole?: ModelRole): Promise<boolean> {
  for (const role of ['search-embed-2b', 'search-embed-8b'] as const) {
    if (role === exceptRole) continue;
    if (await isModelInstalled(userData, role)) return true;
  }
  return false;
}

function mapModelFileLockError(err: unknown): Error {
  const code = (err as NodeJS.ErrnoException)?.code;
  if (code === 'EBUSY' || code === 'EPERM' || code === 'EACCES') {
    return new Error('Файл модели занят. Дождитесь окончания индексации и удалите ещё раз.');
  }
  return err instanceof Error ? err : new Error(String(err));
}

/** Останавливает llama-server до снятия GGUF: иначе Windows держит EBUSY. */
async function withLlamaFilesUnlocked<T>(fn: () => Promise<T>): Promise<T> {
  const alreadyPaused = isIndexingPaused();
  cancelIdleIndexing();
  pauseIndexing();
  try {
    await shutdownLlamaBridge();
    await waitForIndexingLoopIdle();
    return await fn();
  } finally {
    if (!alreadyPaused) resumeIndexing();
  }
}

async function ensureVisionRuntimeProgress(
  userData: string,
  role: ModelRole,
  alwaysEnsureCpu: boolean
): Promise<void> {
  const cpuMissing = !(await isLlamaRuntimeInstalled(userData, 'cpu'));
  const runCpu = alwaysEnsureCpu || cpuMissing;
  const runCuda = await hasCudaServerBinary(userData);
  if (!runCpu && !runCuda) return;

  if (runCpu) {
    await ensureLlamaRuntime(userData, 'cpu', (percent, llamaBytes) => {
      broadcastDownloadProgress(
        role,
        mapRuntimePercent(percent, runCuda ? 'lower' : 'full'),
        'runtime',
        llamaBytes
      );
    });
  }
  if (runCuda) {
    await ensureLlamaRuntime(userData, 'cuda', (percent, llamaBytes) => {
      broadcastDownloadProgress(
        role,
        mapRuntimePercent(percent, runCpu ? 'upper' : 'full'),
        'runtime',
        llamaBytes
      );
    });
    return;
  }
  broadcastDownloadProgress(role, 100, 'runtime');
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
  const gpuLayers = hardware.hasGpu ? Math.max(1, Math.round(999 * ratio)) : 0;
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
    aiCaption: row.aiCaption,
    name: row.name,
    linkUrl: row.linkUrl,
    durationMs: row.durationMs
  };
}

function isRoleSupportedByHardware(
  hardware: ReturnType<typeof detectHardware>,
  role: ModelRole,
  entry: ReturnType<typeof getModelEntry>
): boolean {
  if (role === 'caption') return isTierSupported(hardware, 'heavy');
  return isSearchModelSupported(hardware, entry.id as SearchModelId);
}

function toModelCard(role: ModelRole, hardware: ReturnType<typeof detectHardware>) {
  const entry = MODEL_CATALOG[role];
  const supported = isRoleSupportedByHardware(hardware, role, entry);
  return {
    role,
    modelId: entry.id,
    tier: entry.tier,
    label: entry.label,
    description: entry.description,
    sizeLabel: entry.sizeLabel,
    minRamMb: entry.minRamMb,
    supported,
    searchLevel: entry.searchLevel
  };
}

export async function buildAiStatus(): Promise<AiStatus> {
  const prefs = await readAppPreferences();
  const hardware = detectHardware();
  const supportedSearchModelIds = getSupportedSearchModelIds(hardware);
  const supportedTiers = getSupportedTiers(hardware);
  const index = await getIndexStatus();
  const userData = app.getPath('userData');
  const models = await listModelInstallStatuses(userData, downloadingRole, downloadPercent);
  const llamaRuntime = await getLlamaRuntimeStatus(userData);
  const searchEnabled = prefs.aiSearchEnabled || prefs.aiSemanticSearchEnabled;
  const setupReady = searchEnabled && (await hasAnyInstalledSearchModel(userData));

  const searchModelCards = (['search-clip', 'search-embed-2b', 'search-embed-8b'] as ModelRole[]).map((role) =>
    toModelCard(role, hardware)
  );
  const captionModelCard = toModelCard('caption', hardware);
  const activeSearchId = getActiveSearchModelId() ?? prefs.aiSearchModelId;
  const activeTier =
    activeSearchId === 'qwen3-vl-embedding-8b' || activeSearchId === 'qwen3-vl-embedding-2b'
      ? ('heavy' as const)
      : ('light' as const);

  return {
    enabled: searchEnabled,
    activeSearchModelId: activeSearchId,
    activeTier,
    activeModelId: activeSearchId,
    hardware,
    supportedSearchModelIds,
    supportedTiers,
    searchModelCards,
    captionModelCard,
    modelCards: [...searchModelCards, captionModelCard],
    resources: {
      threads: prefs.aiThreads,
      gpuLayers: prefs.aiGpuLayers,
      maxRamMb: prefs.aiMaxRamMb
    },
    resourcePreset: prefs.aiResourcePreset,
    searchStrictness: prefs.aiSearchStrictness,
    autoTagEnabled: prefs.aiAutoTagEnabled,
    autoTagVolume: prefs.aiAutoTagVolume,
    autoTagCatalogMode: prefs.aiAutoTagCatalogMode,
    autoTagOnImport: prefs.aiAutoTagOnImport,
    index,
    models,
    llamaRuntime,
    download:
      downloadingRole != null
        ? {
            role: downloadingRole,
            modelId: MODEL_CATALOG[downloadingRole].id,
            tier: MODEL_CATALOG[downloadingRole].tier,
            percent: downloadPercent,
            phase: downloadPhase ?? 'model'
          }
        : null,
    lastError: getIndexerError(),
    setupReady
  };
}

export function registerAiIpc(): void {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.handle('arc:ai-get-status', async () => buildAiStatus());
  ipcMain.handle('arc:ai-get-index-status', async () => getIndexStatus());
  ipcMain.handle('arc:ai-detect-hardware', async () => detectHardware({ force: true }));

  ipcMain.handle('arc:ai-download-llama-runtime', async (_e, payloadRaw: unknown) => {
    const payload = payloadRaw as { variant?: string; role?: string; tier?: string };
    const variant: LlamaRuntimeVariant = payload.variant === 'cuda' ? 'cuda' : 'cpu';
    const role = resolveRoleFromPayload(payload.role ?? payload.tier ?? 'caption');
    const userData = app.getPath('userData');
    await ensureModelsDirs(userData);
    try {
      await ensureLlamaRuntime(userData, variant, (percent, llamaBytes) => {
        broadcastDownloadProgress(role, clampPercent(percent) ?? 0, 'runtime', llamaBytes);
      });
      return { ok: true as const, variant };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      broadcast('arc:ai-error', { message, fallback: false });
      return { ok: false as const, error: message };
    }
  });

  ipcMain.handle('arc:ai-download-model', async (_e, payloadRaw: unknown) => {
    const role = resolveRoleFromPayload(payloadRaw);
    const hardware = detectHardware();
    const entry = getModelEntry(role);
    if (!isRoleSupportedByHardware(hardware, role, entry)) {
      return { ok: false as const, error: 'Эта модель не поддерживается вашим оборудованием.' };
    }

    const busy = downloadBusyError();
    if (busy) return busy;

    downloadingRole = role;
    resetDownloadTracking(0);
    // Сброс зависшего abort/pause после ошибки предыдущей загрузки.
    cancelGgufDownload();

    try {
      const prefs = await readAppPreferences();
      const modelsDir = getModelsDir();
      const userData = app.getPath('userData');
      await ensureModelsDirs(userData);

      const needsLlama = usesLlamaStack(entry.stack);
      const needsFileDownload = entry.stack !== 'transformers';
      const bundleCaption = await qwenShouldBundleCaption(userData, role);
      if (role === 'caption' || isQwenSearchRole(role)) {
        await logCaptionTrace(userData, 'старт установки', {
          role,
          bundleCaption,
          needsLlama
        });
      }
      const report = (percentOrInfo: number | import('./ai/downloadGguf').DownloadProgressInfo) => {
        const info = typeof percentOrInfo === 'number' ? { percent: percentOrInfo } : percentOrInfo;
        const percent = bundleCaption ? mapPercentToRange(info.percent, 0, 50) : (clampPercent(info.percent) ?? 0);
        broadcastDownloadProgress(role, percent, 'model', {
          received: info.bytesReceived,
          total: info.bytesTotal
        });
      };

      if (needsFileDownload) {
        if (needsLlama) {
          // CUDA offer is handled by Settings UI; ensure CPU if missing (+ repair CUDA if present).
          const cpuReady = await isLlamaRuntimeInstalled(userData, 'cpu');
          const cudaPresent = await hasCudaServerBinary(userData);
          logAiModel('проверка runtime перед файлами', { role, cpuReady, cudaPresent });
          await ensureVisionRuntimeProgress(userData, role, false);
        }
        const artifactsReady = await hasModelArtifactsOnDisk(userData, role);
        if (artifactsReady) {
          logAiModel('файлы модели уже на диске — HTTP-скачивание пропускаем', { role });
          broadcastDownloadProgress(role, 100, 'model');
        } else {
          logAiModel('файлов модели нет — качаем GGUF', { role, modelId: entry.id });
          broadcastDownloadProgress(role, 0, 'model');
          await downloadGgufModel(userData, entry, report);
        }
        if (!(await hasModelArtifactsOnDisk(userData, role))) {
          return { ok: false as const, error: 'Файлы модели не найдены после загрузки. Попробуйте ещё раз.' };
        }
        if (isQwenSearchRole(role)) {
          await downloadCaptionFilesIfNeeded(userData, role, bundleCaption);
        }
        await finalizeModelInstall(role, userData, entry, entry.id, {
          withHybridClip: false,
          setActiveSearch: role !== 'caption',
          onComplete: () => scheduleIdleIndexing()
        });
        if (role === 'caption') {
          await writeAppPreferences({ aiAutoTagModelInstalled: true });
        }
        if (isQwenSearchRole(role)) {
          await finalizeCaptionIfPresent(userData);
        }
        if (role === 'caption' || isQwenSearchRole(role)) {
          await logCaptionTrace(userData, 'установка завершена', { role });
        }
        return { ok: true as const, modelId: entry.id, role, tier: entry.tier };
      }

      let result: { modelId: string };
      if (await hasModelArtifactsOnDisk(userData, role)) {
        broadcastDownloadProgress(role, 100, 'model');
        result = { modelId: entry.id };
      } else {
        broadcastDownloadProgress(role, 0, 'model');
        result = await downloadModelInWorker(
          role,
          modelsDir,
          { threads: prefs.aiThreads, gpuLayers: prefs.aiGpuLayers, maxRamMb: prefs.aiMaxRamMb },
          report
        );
      }
      if (!(await hasModelArtifactsOnDisk(userData, role))) {
        return { ok: false as const, error: 'Файлы модели не найдены после загрузки. Попробуйте ещё раз.' };
      }
      await finalizeModelInstall(role, userData, entry, result.modelId, {
        onComplete: () => scheduleIdleIndexing()
      });
      return { ok: true as const, modelId: result.modelId, role, tier: entry.tier };
    } catch (err) {
      const message = mapDownloadError(err);
      return { ok: false as const, error: message };
    } finally {
      cancelGgufDownload();
      broadcastDownloadComplete(role);
      downloadingRole = null;
      resetDownloadTracking();
    }
  });

  ipcMain.handle('arc:ai-delete-model', async (_e, payloadRaw: unknown) => {
    const role = resolveRoleFromPayload(payloadRaw);
    const userData = app.getPath('userData');

    if (downloadingRole || modelTestInFlight) {
      throw new Error('Дождитесь окончания текущей операции.');
    }

    try {
      if (role === 'caption') {
        await logCaptionTrace(userData, 'удаление автотегов: до');
        await writeAppPreferences({
          aiAutoTagModelInstalled: false
        });
        const keepCaptionFiles = shouldKeepSharedCaptionFiles(await qwenStillInstalled(userData), false);
        if (keepCaptionFiles) {
          logAiModel('удаление автотегов: файлы оставлены — Qwen ещё установлен');
          await logCaptionTrace(userData, 'удаление автотегов: после', { keptSharedFiles: true });
          return buildAiStatus();
        }
        await withLlamaFilesUnlocked(async () => {
          await deleteInstalledModel(userData, 'caption');
          await clearRoleManifest(userData, 'caption');
          await deleteLlamaRuntimeIfUnused(userData);
        });
        clearAiSearchCache();
        await logCaptionTrace(userData, 'удаление автотегов: после', { keptSharedFiles: false });
        return buildAiStatus();
      }

      const removeSearchModel = async () => {
        await deleteInstalledModel(userData, role);
        await clearRoleManifest(userData, role);

        if (isQwenSearchRole(role)) {
          const prefsAfter = await readAppPreferences();
          const keepCaption = shouldKeepSharedCaptionFiles(
            await qwenStillInstalled(userData),
            prefsAfter.aiAutoTagModelInstalled === true
          );
          if (!keepCaption) {
            await deleteInstalledModel(userData, 'caption');
            await clearRoleManifest(userData, 'caption');
          }
        }

        if (role !== 'search-clip' && usesLlamaStack(getModelEntry(role).stack)) {
          await deleteLlamaRuntimeIfUnused(userData);
        }
      };
      if (usesLlamaStack(getModelEntry(role).stack)) {
        await withLlamaFilesUnlocked(removeSearchModel);
      } else {
        await removeSearchModel();
      }
      const prefs = await readAppPreferences();
      if (prefs.aiSearchModelId === MODEL_CATALOG[role].id) {
        setActiveSearchModel(null);
      }
      clearAiSearchCache();
      return buildAiStatus();
    } catch (err) {
      throw mapModelFileLockError(err);
    }
  });

  ipcMain.handle('arc:ai-set-active-model', async (_e, payloadRaw: unknown) => {
    const role = resolveRoleFromPayload(payloadRaw);
    if (role === 'caption') {
      scheduleIdleIndexing();
      return buildAiStatus();
    }
    const userData = app.getPath('userData');
    if (!(await isModelInstalled(userData, role))) {
      throw new Error('Модель не установлена');
    }
    const modelId = MODEL_CATALOG[role].id as SearchModelId;
    const prefs = await readAppPreferences();
    const previous = prefs.aiSearchModelId;
    await writeAppPreferences({
      aiSearchModelId: modelId,
      aiSearchEnabled: true,
      aiSemanticSearchEnabled: true
    });
    setActiveSearchModel(modelId);
    clearAiSearchCache();
    if (previous !== modelId) {
      scheduleReindexForActiveModel();
    } else {
      scheduleIdleIndexing();
    }
    return buildAiStatus();
  });

  ipcMain.handle('arc:ai-cancel-download', async () => {
    cancelModelDownloadInWorker();
    cancelGgufDownload();
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

  ipcMain.handle('arc:ai-update-model', async (_e, payloadRaw: unknown) => {
    const role = resolveRoleFromPayload(payloadRaw);
    const busy = downloadBusyError();
    if (busy) return busy;
    const userData = app.getPath('userData');
    const entry = getModelEntry(role);
    const manifest = await readModelManifest(userData);
    if (!isModelUpdateAvailable(role, entry, manifest[role])) {
      return { ok: false as const, error: 'Обновление не требуется.' };
    }

    const stillBusy = downloadBusyError();
    if (stillBusy) return stillBusy;

    const oldModelId = manifest[role]?.modelId;
    const alreadyPaused = isIndexingPaused();
    cancelIdleIndexing();
    pauseIndexing();
    downloadingRole = role;
    resetDownloadTracking(0);

    try {
      await shutdownLlamaBridge();
      await waitForIndexingLoopIdle();
      await deleteInstalledModel(userData, role);
      await clearRoleManifest(userData, role);

      const prefs = await readAppPreferences();
      const modelsDir = getModelsDir();
      await ensureModelsDirs(userData);
      const bundleCaption = await qwenShouldBundleCaption(userData, role);

      broadcastDownloadProgress(role, 0, usesLlamaStack(entry.stack) ? 'runtime' : 'model');

      const report = (percentOrInfo: number | import('./ai/downloadGguf').DownloadProgressInfo) => {
        const info = typeof percentOrInfo === 'number' ? { percent: percentOrInfo } : percentOrInfo;
        const percent = bundleCaption ? mapPercentToRange(info.percent, 0, 50) : (clampPercent(info.percent) ?? 0);
        broadcastDownloadProgress(role, percent, 'model', {
          received: info.bytesReceived,
          total: info.bytesTotal
        });
      };

      if (entry.stack === 'transformers') {
        await downloadModelInWorker(
          role,
          modelsDir,
          { threads: prefs.aiThreads, gpuLayers: prefs.aiGpuLayers, maxRamMb: prefs.aiMaxRamMb },
          report
        );
      } else {
        if (usesLlamaStack(entry.stack)) {
          await ensureVisionRuntimeProgress(userData, role, true);
        }
        broadcastDownloadProgress(role, 0, 'model');
        await downloadGgufModel(userData, entry, report);
      }

      if (!(await hasModelArtifactsOnDisk(userData, role))) {
        return { ok: false as const, error: 'Файлы модели не найдены после обновления.' };
      }
      if (isQwenSearchRole(role)) {
        await downloadCaptionFilesIfNeeded(userData, role, bundleCaption);
      }

      await finalizeModelInstall(role, userData, entry, entry.id, {
        onComplete: async () => {
          const root = await readLibraryRootFromDisk();
          if (root && oldModelId && oldModelId !== entry.id) {
            await ensureLibraryReady(root);
            const db = openLibraryDb(root);
            deleteEmbeddingsForModel(db, oldModelId);
          }
          clearAiSearchCache();
          if (role !== 'caption') scheduleReindexForActiveModel();
          else scheduleIdleIndexing();
        }
      });
      if (role === 'caption') {
        await writeAppPreferences({ aiAutoTagModelInstalled: true });
      }
      if (isQwenSearchRole(role)) {
        await finalizeCaptionIfPresent(userData);
      }
      return { ok: true as const, modelId: entry.id, role, tier: entry.tier };
    } catch (err) {
      const message = mapDownloadError(err);
      return { ok: false as const, error: message };
    } finally {
      cancelGgufDownload();
      broadcastDownloadComplete(role);
      downloadingRole = null;
      resetDownloadTracking();
      if (!alreadyPaused) resumeIndexing();
    }
  });

  ipcMain.handle('arc:ai-test-model', async (_e, payloadRaw: unknown) => {
    const role = resolveRoleFromPayload(payloadRaw);
    const prefs = await readAppPreferences();
    const userData = app.getPath('userData');
    if (downloadingRole) {
      return { ok: false as const, message: 'Дождитесь окончания скачивания.' };
    }
    if (modelTestInFlight) {
      return { ok: false as const, message: 'Проверка уже выполняется.' };
    }
    modelTestInFlight = true;
    try {
      if (!(await isModelInstalled(userData, role))) {
        return { ok: false as const, message: 'Модель не установлена.' };
      }
      const resources = {
        threads: prefs.aiThreads,
        gpuLayers: prefs.aiGpuLayers,
        maxRamMb: prefs.aiMaxRamMb
      };
      if (role === 'caption') {
        await verifyHeavyGgufLoad(getModelsDir(), resources, userData);
        return await testJoyCaptionLoad(userData, resources);
      }
      if (role === 'search-embed-2b' || role === 'search-embed-8b') {
        return await testQwenEmbedding(userData, resources, MODEL_CATALOG[role].id);
      }
      return await testModelInWorker(role, getModelsDir(), resources);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false as const, message };
    } finally {
      modelTestInFlight = false;
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
      return [] as AiSearchResult[];
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
      limit = typeof p.limit === 'number' ? Math.max(1, Math.min(100, p.limit)) : 50;
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
      const scope = scopeCardIds && scopeCardIds.length > 0 ? new Set(scopeCardIds) : null;
      const moodboardSet = Array.isArray(moodboardCardIds) ? new Set(moodboardCardIds) : null;
      const hits: Array<{ cardId: string; score: number }> = [];
      for (const hit of searchResults) {
        if (scope && !scope.has(hit.cardId)) continue;
        if (moodboardSet && !moodboardSet.has(hit.cardId)) continue;
        if (collectionId) {
          const row = getCardByIdFromDb(root, hit.cardId);
          if (!row || !row.collectionIds.includes(collectionId)) continue;
        }
        hits.push({ cardId: hit.cardId, score: hit.score });
      }
      return hits;
    }).then((pageHits) => {
      const cards = [];
      for (const hit of pageHits as Array<{ cardId: string; score: number }>) {
        const row = getCardByIdFromDb(root, hit.cardId);
        if (!row) continue;
        cards.push({ ...cardIndexToRenderer(rowToCardRecord(row)), aiScore: hit.score });
      }
      return cards;
    });
  });

  ipcMain.handle('arc:ai-reindex', async () => {
    if (isIndexingInFlight()) {
      return { ok: true as const };
    }
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

  ipcMain.handle('arc:ai-suggest-tags', async (_e, payload: unknown) => {
    const cardId =
      typeof payload === 'string'
        ? payload.trim()
        : typeof (payload as { cardId?: unknown })?.cardId === 'string'
          ? String((payload as { cardId: string }).cardId).trim()
          : '';
    if (!cardId) return { ok: false as const, error: 'Не указана карточка.' };
    const { suggestTagsForCard } = await import('./ai/suggestTags');
    return suggestTagsForCard(cardId);
  });

  ipcMain.handle('arc:rank-tags-semantic', async (_e, query: unknown) => {
    const q = typeof query === 'string' ? query : '';
    const { rankTagsSemantic } = await import('./ai/rankTagsSemantic');
    return rankTagsSemantic(q);
  });

  ipcMain.handle('arc:ai-set-enabled', async (_e, payload: unknown) => {
    const p = payload as {
      enabled?: boolean;
      searchEnabled?: boolean;
      searchModelId?: SearchModelId;
      tier?: string;
      threads?: number;
      gpuLayers?: number;
      maxRamMb?: number;
      resourcePreset?: number;
      searchStrictness?: number;
      autoTagEnabled?: boolean;
      autoTagVolume?: number;
      autoTagCatalogMode?: 'reuse' | 'reuse_create';
      autoTagOnImport?: boolean;
    };
    const patch: Record<string, unknown> = {};
    if (typeof p.enabled === 'boolean') {
      patch.aiSemanticSearchEnabled = p.enabled;
      patch.aiSearchEnabled = p.enabled;
    }
    if (typeof p.searchEnabled === 'boolean') {
      patch.aiSearchEnabled = p.searchEnabled;
      patch.aiSemanticSearchEnabled = p.searchEnabled;
    }
    if (p.searchModelId) patch.aiSearchModelId = sanitizeSearchModelId(p.searchModelId);
    if (p.tier) {
      const role = sanitizeModelRole(p.tier);
      if (role && role !== 'caption') patch.aiSearchModelId = MODEL_CATALOG[role].id;
    }
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
    if (typeof p.autoTagEnabled === 'boolean') patch.aiAutoTagEnabled = p.autoTagEnabled;
    if (typeof p.autoTagVolume === 'number') {
      patch.aiAutoTagVolume = Math.max(0, Math.min(100, Math.round(p.autoTagVolume / 5) * 5));
    }
    if (p.autoTagCatalogMode === 'reuse' || p.autoTagCatalogMode === 'reuse_create') {
      patch.aiAutoTagCatalogMode = p.autoTagCatalogMode;
    }
    if (typeof p.autoTagOnImport === 'boolean') patch.aiAutoTagOnImport = p.autoTagOnImport;
    if (typeof p.threads === 'number') patch.aiThreads = Math.max(1, Math.min(32, Math.round(p.threads)));
    if (typeof p.gpuLayers === 'number') patch.aiGpuLayers = Math.max(0, Math.min(128, Math.round(p.gpuLayers)));
    if (typeof p.maxRamMb === 'number') patch.aiMaxRamMb = Math.max(512, Math.min(65536, Math.round(p.maxRamMb)));

    const next = await writeAppPreferences(patch);
    clearAiSearchCache();

    const searchOn = next.aiSearchEnabled || next.aiSemanticSearchEnabled;
    if (searchOn) {
      if ((await hasAnyInstalledSearchModel(app.getPath('userData'))) || (await isModelInstalled(app.getPath('userData'), 'caption'))) {
        scheduleIdleIndexing();
      }
    } else {
      cancelIdleIndexing();
      shutdownAiWorker();
      void shutdownLlamaBridge();
      resetWorkerReadyState();
      setActiveSearchModel(null);
    }

    return buildAiStatus();
  });

  ipcMain.handle('arc:ai-similar-stage-file', async (_e, sourcePath: unknown) => {
    const source = typeof sourcePath === 'string' ? sourcePath.trim() : '';
    if (!source) return { ok: false as const, error: 'Путь к файлу не указан.' };
    try {
      allowMediaStagingPaths([source]);
      const stagedPath = await stageSimilarQueryFile(source);
      return { ok: true as const, stagedPath };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false as const, error: message };
    }
  });

  ipcMain.handle('arc:ai-similar-search-cards', async (_e, payload: unknown) => {
    const prefs = await readAppPreferences();
    if (!prefs.aiSearchEnabled && !prefs.aiSemanticSearchEnabled) {
      throw new Error('AI Semantic Search выключен в настройках');
    }
    const userData = app.getPath('userData');
    const modelId = sanitizeSearchModelId(prefs.aiSearchModelId);
    if (!(await isModelInstalled(userData, modelId))) {
      throw new Error('Модель не установлена. Скачайте модель в Настройки → Умный поиск.');
    }

    const root = await readLibraryRootFromDisk();
    if (!root) return [];
    await ensureLibraryReady(root);
    const db = openLibraryDb(root);
    const indexed = isQwenSearchModel(modelId)
        ? Math.max(countHybridEmbeddingsForModel(db, modelId), countEmbeddingsForModel(db, modelId))
        : countEmbeddingsForModel(db, modelId);
    if (indexed === 0) {
      throw new Error('Библиотека ещё не проиндексирована. Дождитесь завершения индексации.');
    }

    const p = payload as Partial<ListCardsParams> & {
      cardId?: string | null;
      imagePath?: string | null;
      crop?: NormalizedCropRect | null;
      scopeCardIds?: string[];
    };

    const scope = Array.isArray(p.scopeCardIds) && p.scopeCardIds.length > 0 ? new Set(p.scopeCardIds) : null;

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
        tier: modelId === 'clip-vit-base-patch32' ? 'light' : 'heavy',
        modelId,
        strictness: prefs.aiSearchStrictness,
        offset: typeof p.offset === 'number' ? p.offset : 0,
        limit: Math.min(typeof p.limit === 'number' && p.limit > 0 ? Math.floor(p.limit) : 50, 100)
      });
      return rows.map((r) => cardIndexToRenderer(rowToCardRecord(r)));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      broadcast('arc:ai-error', { message, fallback: true });
      return [];
    }
  });
}

export { queueCardsForIndexing, scheduleIdleIndexing, cancelIdleIndexing, shutdownAiWorker };
