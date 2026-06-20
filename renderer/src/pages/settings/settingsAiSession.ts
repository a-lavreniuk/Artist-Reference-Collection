import type { DemoAlertVariant } from '../../components/layout/DemoAlert';
import { dispatchAiSetupChanged } from '../../search/aiSearchEvents';
import type { AiModelTier } from '../../services/appPreferences';
import { patchAppPreferences } from '../../services/appPreferencesRuntime';
import type { AiIndexStatus, AiStatus } from '../../services/aiTypes';

type AlertState = { message: string; variant: DemoAlertVariant } | null;
export type DownloadPhase = 'runtime' | 'model' | 'finalize' | null;
export type AiSetupPhase = 'off' | 'analyzing' | 'models' | 'ready';
export type AiDownloadOperation = 'install' | 'update' | null;

const RUNTIME_PROGRESS_WEIGHT = 40;
const INDEX_PROGRESS_THROTTLE_MS = 300;
const INDEX_FALLBACK_POLL_MS = 12_000;

type IndexProgressPayload = {
  done: number;
  total: number;
  running?: boolean;
  currentCardId?: string | null;
  currentCardProgress?: number | null;
};

export type CudaPromptState = {
  tier: AiModelTier;
  onConfirm: () => void;
  onCancel: () => void;
} | null;

type SessionState = {
  status: AiStatus | null;
  loading: boolean;
  analyzing: boolean;
  downloadTier: AiModelTier | null;
  downloadPercent: number | null;
  downloadPhase: DownloadPhase;
  downloadBytesReceived: number | null;
  downloadBytesTotal: number | null;
  downloadPaused: boolean;
  cudaPrompt: CudaPromptState;
  alert: AlertState;
  busy: boolean;
  testingTier: AiModelTier | null;
  downloadOperation: AiDownloadOperation;
  indexEtaHint: string | null;
};

const listeners = new Set<() => void>();
let subscriberCount = 0;
let sessionInitialized = false;
let downloadPollTimer: ReturnType<typeof setInterval> | null = null;
let indexPollTimer: ReturnType<typeof setInterval> | null = null;
let cudaPromptResolver: ((install: boolean) => void) | null = null;
let indexEtaSamples: Array<{ at: number; indexed: number }> = [];
let lastDownloadSpeedSample: { at: number; bytes: number } | null = null;
let smoothedDownloadSpeedMbps: number | null = null;
let pendingIndexProgress: IndexProgressPayload | null = null;
let indexProgressFlushTimer: ReturnType<typeof setTimeout> | null = null;
let lastIndexProgressFlushAt = 0;

let state: SessionState = {
  status: null,
  loading: true,
  analyzing: false,
  downloadTier: null,
  downloadPercent: null,
  downloadPhase: null,
  downloadBytesReceived: null,
  downloadBytesTotal: null,
  downloadPaused: false,
  cudaPrompt: null,
  alert: null,
  busy: false,
  testingTier: null,
  downloadOperation: null,
  indexEtaHint: null
};

function isVisionTier(tier: AiModelTier): tier is 'heavy' {
  return tier === 'heavy';
}

export function resolveAiSetupPhase(status: AiStatus | null, analyzing: boolean): AiSetupPhase {
  if (!status?.enabled) return 'off';
  if (analyzing) return 'analyzing';
  if (!status.setupReady) return 'models';
  return 'ready';
}

type AiSettingsSnapshot = SessionState & { phase: AiSetupPhase };

function buildSnapshot(): AiSettingsSnapshot {
  return {
    ...state,
    phase: resolveAiSetupPhase(state.status, state.analyzing)
  };
}

let cachedSnapshot: AiSettingsSnapshot = buildSnapshot();

function notify(): void {
  cachedSnapshot = buildSnapshot();
  if (subscriberCount === 0) return;
  listeners.forEach((listener) => listener());
}

function patchState(partial: Partial<SessionState>): void {
  state = { ...state, ...partial };
  notify();
}

export function subscribeAiSettings(listener: () => void): () => void {
  subscriberCount += 1;
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    subscriberCount = Math.max(0, subscriberCount - 1);
    if (subscriberCount === 0) {
      stopIndexPoll();
      stopDownloadPoll();
      clearIndexProgressFlush();
    }
  };
}

export function getAiSettingsSnapshot(): AiSettingsSnapshot {
  return cachedSnapshot;
}

export function clampPercent(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function isAiDownloading(snapshot: {
  status: AiStatus | null;
  downloadTier: AiModelTier | null;
  busy: boolean;
}): boolean {
  return Boolean(
    snapshot.downloadTier ||
      snapshot.status?.download?.tier ||
      snapshot.status?.models.some((m) => m.downloading) ||
      (snapshot.busy && snapshot.downloadTier)
  );
}

export function getEffectiveDownload(
  snapshot: Pick<SessionState, 'status' | 'downloadTier' | 'downloadPercent' | 'downloadPhase'>
): {
  tier: AiModelTier | null;
  percent: number | null;
  phase: DownloadPhase;
} {
  if (snapshot.downloadTier) {
    return {
      tier: snapshot.downloadTier,
      percent: snapshot.downloadPercent,
      phase: snapshot.downloadPhase
    };
  }
  if (snapshot.status?.download) {
    return {
      tier: snapshot.status.download.tier,
      percent: snapshot.status.download.percent,
      phase: snapshot.status.download.phase
    };
  }
  const fromModels = snapshot.status?.models.find((m) => m.downloading);
  if (fromModels) {
    return {
      tier: fromModels.tier,
      percent: fromModels.progressPercent,
      phase: 'model'
    };
  }
  return { tier: null, percent: null, phase: null };
}

function formatMb(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 100) return Math.round(mb).toLocaleString('ru-RU');
  if (mb >= 10) return mb.toFixed(1).replace('.', ',');
  return mb.toFixed(1).replace('.', ',');
}

function updateDownloadSpeed(bytesReceived: number | null | undefined): void {
  if (bytesReceived == null || !Number.isFinite(bytesReceived)) return;
  const now = Date.now();
  if (lastDownloadSpeedSample) {
    const dt = (now - lastDownloadSpeedSample.at) / 1000;
    const db = bytesReceived - lastDownloadSpeedSample.bytes;
    if (dt > 0.4 && db >= 0) {
      const mbps = db / (1024 * 1024) / dt;
      smoothedDownloadSpeedMbps =
        smoothedDownloadSpeedMbps == null ? mbps : smoothedDownloadSpeedMbps * 0.65 + mbps * 0.35;
    }
  }
  lastDownloadSpeedSample = { at: now, bytes: bytesReceived };
}

export function formatDownloadSubtitle(snapshot: ReturnType<typeof getAiSettingsSnapshot>): string | null {
  const received = snapshot.downloadBytesReceived;
  const total = snapshot.downloadBytesTotal;
  if (received == null) return null;
  const totalPart = total != null ? `${formatMb(received)}/${formatMb(total)} Мб` : `${formatMb(received)} Мб`;
  if (smoothedDownloadSpeedMbps != null && smoothedDownloadSpeedMbps > 0.05) {
    return `${totalPart} (${smoothedDownloadSpeedMbps.toFixed(1).replace('.', ',')} Мб/с)`;
  }
  return totalPart;
}

export function resolveDownloadPercent(snapshot: ReturnType<typeof getAiSettingsSnapshot>): number {
  const download = getEffectiveDownload(snapshot);
  return clampPercent(download.percent) ?? 0;
}

export function resolveDownloadStatus(snapshot: ReturnType<typeof getAiSettingsSnapshot>): {
  visible: boolean;
  percent: number;
  subtitle: string | null;
  paused: boolean;
} | null {
  if (snapshot.testingTier || snapshot.cudaPrompt) return null;
  const download = getEffectiveDownload(snapshot);
  if (!download.tier && !isAiDownloading(snapshot)) return null;
  if (download.phase === 'finalize') return null;
  return {
    visible: true,
    percent: resolveDownloadPercent(snapshot),
    subtitle: formatDownloadSubtitle(snapshot),
    paused: snapshot.downloadPaused
  };
}

export function resolveInstallStatus(snapshot: ReturnType<typeof getAiSettingsSnapshot>): {
  visible: boolean;
  percent: number;
} | null {
  const download = getEffectiveDownload(snapshot);
  if (!download.tier || download.phase !== 'finalize') return null;
  return { visible: true, percent: resolveDownloadPercent(snapshot) };
}

function recordIndexEtaHint(indexed: number, total: number): string | null {
  if (total <= 0 || indexed <= 0 || indexed >= total) return null;
  const now = Date.now();
  indexEtaSamples.push({ at: now, indexed });
  indexEtaSamples = indexEtaSamples.filter((s) => now - s.at <= 20_000);
  if (indexEtaSamples.length < 2) return null;
  const first = indexEtaSamples[0];
  const last = indexEtaSamples[indexEtaSamples.length - 1];
  const dt = (last.at - first.at) / 1000;
  const di = last.indexed - first.indexed;
  if (dt <= 0 || di <= 0) return null;
  const remaining = total - indexed;
  const etaSec = Math.round((remaining / di) * dt);
  if (etaSec < 60) return 'менее минуты';
  return `${Math.max(1, Math.round(etaSec / 60))} мин`;
}

function clearIndexProgressFlush(): void {
  if (indexProgressFlushTimer) {
    clearTimeout(indexProgressFlushTimer);
    indexProgressFlushTimer = null;
  }
  pendingIndexProgress = null;
}

function applyIndexProgress(payload: IndexProgressPayload): void {
  const running = payload.running ?? payload.done < payload.total;
  let nextEtaHint = state.indexEtaHint;
  if (running) {
    if (!state.status?.index.paused) {
      const computed = recordIndexEtaHint(payload.done, payload.total);
      if (computed) nextEtaHint = computed;
    }
  } else {
    nextEtaHint = null;
  }

  patchState({
    indexEtaHint: nextEtaHint,
    status: state.status
      ? {
          ...state.status,
          index: {
            ...state.status.index,
            indexed: payload.done,
            total: payload.total,
            running,
            currentCardId: payload.currentCardId ?? state.status.index.currentCardId,
            currentCardProgress:
              payload.currentCardProgress == null
                ? state.status.index.currentCardProgress
                : payload.currentCardProgress
          },
          lastError: running ? null : state.status.lastError
        }
      : state.status
  });

  if (!running) {
    indexEtaSamples = [];
    clearIndexProgressFlush();
  }

  syncIndexPoll(state.status);
}

function flushIndexProgress(force = false): void {
  if (!pendingIndexProgress) return;

  const now = Date.now();
  if (!force && now - lastIndexProgressFlushAt < INDEX_PROGRESS_THROTTLE_MS) {
    if (!indexProgressFlushTimer) {
      indexProgressFlushTimer = setTimeout(() => {
        indexProgressFlushTimer = null;
        flushIndexProgress(true);
      }, INDEX_PROGRESS_THROTTLE_MS - (now - lastIndexProgressFlushAt));
    }
    return;
  }

  const payload = pendingIndexProgress;
  pendingIndexProgress = null;
  lastIndexProgressFlushAt = now;
  if (indexProgressFlushTimer) {
    clearTimeout(indexProgressFlushTimer);
    indexProgressFlushTimer = null;
  }
  applyIndexProgress(payload);
}

function queueIndexProgress(payload: IndexProgressPayload): void {
  pendingIndexProgress = payload;
  const running = payload.running ?? payload.done < payload.total;
  if (!running) {
    flushIndexProgress(true);
    return;
  }
  flushIndexProgress(false);
}

export function resolveIndexStatusLine(snapshot: ReturnType<typeof getAiSettingsSnapshot>): string | null {
  const index = snapshot.status?.index;
  if (!index) return null;
  if (index.running) {
    if (index.paused) return 'Индексация на паузе…';
    const pct = index.total > 0 ? Math.round((index.indexed / index.total) * 100) : 0;
    const etaPart = snapshot.indexEtaHint ? ` Осталось примерно ${snapshot.indexEtaHint}.` : '';
    return `Индексируется ${index.indexed.toLocaleString('ru-RU')} из ${index.total.toLocaleString('ru-RU')} карточек. ${pct}%.${etaPart}`;
  }
  if (index.total > 0 && index.indexed >= index.total && !index.running) {
    return `Индексирование завершено, всего ${index.total.toLocaleString('ru-RU')} карточек`;
  }
  return null;
}

export function downloadProgressLabel(
  phase: DownloadPhase,
  percent: number | null,
  options?: { waitingCuda?: boolean; updating?: boolean }
): string {
  const value = clampPercent(percent);

  if (options?.waitingCuda) return 'Ожидание выбора CUDA…';
  if (phase === 'runtime') {
    if (value == null) return 'Среда vision…';
    if (value >= 100) return 'Среда vision… готово';
    return `Среда vision… ${value}%`;
  }
  if (phase === 'model') {
    const prefix = options?.updating ? 'Обновление модели…' : 'Модель…';
    if (value == null) return prefix;
    if (value >= 100) return `${prefix} сохранение`;
    return `${prefix} ${value}%`;
  }
  if (phase === 'finalize') {
    return options?.updating ? 'Обновление модели… регистрация' : 'Модель… регистрация';
  }
  if (value == null) return 'Загрузка…';
  return `Загрузка… ${value}%`;
}

export function computeDownloadUi(
  phase: DownloadPhase,
  percent: number | null,
  options?: { waitingCuda?: boolean; updating?: boolean }
): { label: string; overallPercent: number; indeterminate: boolean } {
  if (options?.waitingCuda) {
    return { label: 'Ожидание выбора CUDA…', overallPercent: RUNTIME_PROGRESS_WEIGHT, indeterminate: true };
  }

  const raw = clampPercent(percent) ?? 0;
  let overallPercent = raw;
  if (phase === 'runtime') {
    overallPercent = Math.round((raw * RUNTIME_PROGRESS_WEIGHT) / 100);
  } else if (phase === 'model') {
    overallPercent = RUNTIME_PROGRESS_WEIGHT + Math.round((raw * (100 - RUNTIME_PROGRESS_WEIGHT)) / 100);
  } else if (phase === 'finalize') {
    overallPercent = 100;
  }

  return {
    label: downloadProgressLabel(phase, percent, options),
    overallPercent: Math.max(0, Math.min(100, overallPercent)),
    indeterminate: raw === 0 && phase != null && !options?.waitingCuda
  };
}

export function resolveAiActivityMessage(snapshot: ReturnType<typeof getAiSettingsSnapshot>): string | null {
  if (snapshot.cudaPrompt) return 'Выберите вариант ускорения CUDA в модальном окне…';
  if (snapshot.testingTier) {
    const label =
      snapshot.status?.modelCards.find((c) => c.tier === snapshot.testingTier)?.label ?? snapshot.testingTier;
    return `Проверка модели: ${label}…`;
  }

  const download = getEffectiveDownload(snapshot);
  if (download.tier) {
    return computeDownloadUi(download.phase, download.percent, {
      waitingCuda: Boolean(snapshot.cudaPrompt),
      updating: snapshot.downloadOperation === 'update'
    }).label;
  }

  const index = snapshot.status?.index;
  if (index?.running) {
    if (index.paused) return 'Индексация на паузе';
    const cardPercent = clampPercent(index.currentCardProgress);
    const percent =
      index.total > 0 ? Math.max(0, Math.min(100, Math.round((index.indexed / index.total) * 100))) : 0;
    if (index.indexed === 0 && index.currentCardId) {
      if (cardPercent != null) return `Индексация… обработка карточки (${cardPercent}%)`;
      return `Индексация… обработка карточки (${percent}%)`;
    }
    return `Индексация библиотеки… ${percent}%`;
  }

  return null;
}

export function resolveActivityProgress(snapshot: ReturnType<typeof getAiSettingsSnapshot>): {
  visible: boolean;
  label: string;
  percent: number;
  indeterminate: boolean;
} | null {
  if (snapshot.testingTier) return null;

  if (snapshot.cudaPrompt) {
    return {
      visible: true,
      label: 'Ожидание выбора CUDA…',
      percent: RUNTIME_PROGRESS_WEIGHT,
      indeterminate: true
    };
  }

  const download = getEffectiveDownload(snapshot);
  if (download.tier || isAiDownloading(snapshot)) {
    const ui = computeDownloadUi(download.phase, download.percent, {
      waitingCuda: Boolean(snapshot.cudaPrompt),
      updating: snapshot.downloadOperation === 'update'
    });
    return {
      visible: true,
      label: ui.label,
      percent: ui.overallPercent,
      indeterminate: ui.indeterminate
    };
  }

  const index = snapshot.status?.index;
  if (index?.running) {
    const cardPercent = clampPercent(index.currentCardProgress);
    const percent =
      index.total > 0 ? Math.max(0, Math.min(100, Math.round((index.indexed / index.total) * 100))) : 0;
    const label =
      index.paused
        ? `Индексация на паузе · ${percent}%`
        : index.indexed === 0 && index.currentCardId
          ? `Индексация… обработка карточки · ${cardPercent ?? percent}%`
          : `Индексация… ${percent}%`;
    return { visible: true, label, percent, indeterminate: false };
  }

  return null;
}

function clearDownloadSessionFields(): Partial<SessionState> {
  return {
    downloadTier: null,
    downloadPercent: null,
    downloadPhase: null,
    downloadBytesReceived: null,
    downloadBytesTotal: null,
    downloadPaused: false,
    downloadOperation: null
  };
}

function clearDownloadUiState(): Partial<SessionState> {
  if (!state.status) {
    return clearDownloadSessionFields();
  }

  return {
    ...clearDownloadSessionFields(),
    status: {
      ...state.status,
      download: null,
      models: state.status.models.map((model) =>
        model.downloading || model.progressPercent != null
          ? { ...model, downloading: false, progressPercent: null }
          : model
      )
    }
  };
}

function applyAiStatusFromServer(status: AiStatus): Partial<SessionState> {
  const localActive = Boolean(state.busy || state.downloadTier);

  if (status.download && localActive) {
    return {
      status,
      downloadTier: status.download.tier,
      downloadPercent: status.download.percent,
      downloadPhase: status.download.phase
    };
  }

  if (localActive && state.downloadTier) {
    return { status };
  }

  return {
    ...clearDownloadSessionFields(),
    status: {
      ...status,
      download: null,
      models: status.models.map((model) =>
        model.downloading || model.progressPercent != null
          ? { ...model, downloading: false, progressPercent: null }
          : model
      )
    }
  };
}

function startDownloadPoll(): void {
  if (downloadPollTimer) return;
  downloadPollTimer = setInterval(() => {
    void refreshAiSettings();
  }, 1500);
}

function stopDownloadPoll(): void {
  if (!downloadPollTimer) return;
  clearInterval(downloadPollTimer);
  downloadPollTimer = null;
}

function stopIndexPoll(): void {
  if (!indexPollTimer) return;
  clearInterval(indexPollTimer);
  indexPollTimer = null;
}

function syncIndexPoll(status: AiStatus | null): void {
  if (status?.index.running) {
    if (indexPollTimer) return;
    indexPollTimer = setInterval(() => {
      void refreshIndexStatusLightweight();
    }, INDEX_FALLBACK_POLL_MS);
    return;
  }
  stopIndexPoll();
}

async function refreshIndexStatusLightweight(): Promise<void> {
  const arc = window.arc;
  if (!arc?.aiGetIndexStatus || !state.status) return;

  const index = (await arc.aiGetIndexStatus()) as AiIndexStatus;
  patchState({
    status: {
      ...state.status,
      index
    },
    indexEtaHint: index.running && !index.paused ? state.indexEtaHint : null
  });
  if (!index.running) {
    indexEtaSamples = [];
    stopIndexPoll();
  }
}

function syncDownloadPoll(): void {
  if (isAiDownloading(state) || state.status?.download) {
    startDownloadPoll();
  } else {
    stopDownloadPoll();
  }
}

export async function refreshAiSettings(): Promise<void> {
  const arc = window.arc;
  if (!arc?.aiGetStatus) {
    patchState({ loading: false });
    return;
  }

  if (arc.aiDetectHardware) {
    await arc.aiDetectHardware();
  }

  const next = (await arc.aiGetStatus()) as AiStatus;
  patchState({
    loading: false,
    ...applyAiStatusFromServer(next)
  });
  syncDownloadPoll();
  syncIndexPoll(next);
}

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function shouldOfferCudaInstall(status: AiStatus | null | undefined): boolean {
  if (!status) return false;
  if (status.hardware.platform !== 'win32') return false;
  if (status.llamaRuntime.cudaInstalled) return false;
  if (status.hardware.hasNvidiaGpu) return true;
  return Boolean(status.hardware.gpuName && /nvidia/i.test(status.hardware.gpuName));
}

function askCudaInstall(tier: AiModelTier): Promise<boolean> {
  return new Promise((resolve) => {
    stopDownloadPoll();
    cudaPromptResolver = resolve;
    patchState({
      cudaPrompt: {
        tier,
        onConfirm: () => {
          cudaPromptResolver?.(true);
          cudaPromptResolver = null;
          patchState({ cudaPrompt: null });
          syncDownloadPoll();
        },
        onCancel: () => {
          cudaPromptResolver?.(false);
          cudaPromptResolver = null;
          patchState({ cudaPrompt: null });
          syncDownloadPoll();
        }
      }
    });
  });
}

async function downloadLlamaRuntime(
  tier: AiModelTier,
  variant: 'cpu' | 'cuda'
): Promise<{ ok: boolean; error?: string }> {
  const arc = window.arc;
  if (!arc?.aiDownloadLlamaRuntime) {
    return { ok: false, error: 'Загрузка среды vision недоступна.' };
  }
  patchState({ downloadPhase: 'runtime' });
  syncDownloadPoll();
  const res = await arc.aiDownloadLlamaRuntime({ variant, tier });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true };
}

async function prepareVisionRuntimeWithCudaOffer(tier: 'heavy'): Promise<{ ok: boolean; error?: string }> {
  const cpuRes = await downloadLlamaRuntime(tier, 'cpu');
  if (!cpuRes.ok) return cpuRes;

  const arc = window.arc;
  const currentStatus = (await arc?.aiGetStatus?.()) as AiStatus | undefined;
  if (shouldOfferCudaInstall(currentStatus)) {
    await waitForNextFrame();
    const installCuda = await askCudaInstall(tier);
    if (installCuda) {
      const cudaRes = await downloadLlamaRuntime(tier, 'cuda');
      if (!cudaRes.ok) return cudaRes;
    }
  }

  return { ok: true };
}

async function downloadVisionModel(tier: 'heavy'): Promise<{ ok: boolean; error?: string }> {
  const arc = window.arc;
  if (!arc?.aiDownloadModel) {
    return { ok: false, error: 'Загрузка модели недоступна.' };
  }

  patchState({ downloadTier: tier, downloadPercent: 0, downloadPhase: 'runtime' });
  syncDownloadPoll();

  const runtimeRes = await prepareVisionRuntimeWithCudaOffer(tier);
  if (!runtimeRes.ok) return runtimeRes;

  patchState({ downloadPhase: 'model', downloadPercent: 0 });
  const res = await arc.aiDownloadModel(tier);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true };
}

export function initAiSettingsSession(): void {
  if (sessionInitialized) return;
  sessionInitialized = true;

  const arc = window.arc;
  if (!arc) return;

  arc.onAiDownloadProgress?.(({ tier, percent, phase, bytesReceived, bytesTotal }) => {
    if (!state.busy && !state.downloadTier) return;

    updateDownloadSpeed(bytesReceived);
    patchState({
      downloadTier: tier as AiModelTier,
      downloadPercent: clampPercent(percent),
      downloadPhase: phase ?? state.downloadPhase ?? 'model',
      downloadBytesReceived: bytesReceived ?? state.downloadBytesReceived,
      downloadBytesTotal: bytesTotal ?? state.downloadBytesTotal
    });
    syncDownloadPoll();
  });

  arc.onAiDownloadComplete?.(() => {
    patchState({
      busy: false,
      ...clearDownloadUiState()
    });
    lastDownloadSpeedSample = null;
    smoothedDownloadSpeedMbps = null;
    syncDownloadPoll();
    void refreshAiSettings();
  });

  arc.onAiIndexProgress?.(({ done, total, running, currentCardId, currentCardProgress }) => {
    queueIndexProgress({ done, total, running, currentCardId, currentCardProgress });
  });

  arc.onAiIndexComplete?.((payload) => {
    const indexed = typeof payload?.indexed === 'number' ? payload.indexed : state.status?.index.indexed ?? 0;
    const total = typeof payload?.total === 'number' ? payload.total : state.status?.index.total ?? 0;
    indexEtaSamples = [];
    patchState({
      indexEtaHint: null,
      alert: {
        message: `Индексация завершена: ${indexed} из ${total} карточек.`,
        variant: 'success'
      }
    });
    void refreshAiSettings();
  });

  arc.onAiError?.(({ message, fallback }) => {
    patchState({
      alert: {
        message: fallback
          ? `${message}. Попробуйте лёгкую модель или проверьте подключение к Hugging Face.`
          : message,
        variant: 'warning'
      },
      busy: false,
      ...clearDownloadUiState()
    });
    lastDownloadSpeedSample = null;
    smoothedDownloadSpeedMbps = null;
    syncDownloadPoll();
    void refreshAiSettings();
  });
}

export async function setAiEnabled(enabled: boolean): Promise<void> {
  const arc = window.arc;
  if (!arc?.aiSetEnabled) return;

  patchState({ busy: true, analyzing: enabled });
  try {
    const next = (await arc.aiSetEnabled({ enabled })) as AiStatus;
    patchState({ ...applyAiStatusFromServer(next) });
    await patchAppPreferences({ aiSemanticSearchEnabled: enabled });
    dispatchAiSetupChanged();
    if (enabled) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await refreshAiSettings();
    }
  } finally {
    patchState({ analyzing: false, busy: false });
    syncDownloadPoll();
    syncIndexPoll(state.status);
  }
}

export async function downloadAiModel(tier: AiModelTier): Promise<void> {
  const arc = window.arc;
  if (!arc?.aiDownloadModel) return;

  patchState({
    busy: true,
    downloadTier: tier,
    downloadPercent: 0,
    downloadPhase: isVisionTier(tier) ? 'runtime' : 'model',
    downloadOperation: 'install'
  });
  syncDownloadPoll();

  try {
    let ok = false;
    let error: string | undefined;

    if (isVisionTier(tier)) {
      const res = await downloadVisionModel(tier);
      ok = res.ok;
      error = res.error;
    } else {
      const res = await arc.aiDownloadModel(tier);
      ok = res.ok;
      error = res.error;
    }

    if (!ok) {
      patchState({ alert: { message: error || 'Не удалось скачать модель.', variant: 'warning' } });
    } else {
      patchState({
        alert: { message: 'Модель установлена.', variant: 'success' },
        ...clearDownloadUiState()
      });
      void patchAppPreferences({ aiModelTier: tier });
    }
  } finally {
    patchState({
      busy: false,
      ...clearDownloadUiState()
    });
    lastDownloadSpeedSample = null;
    smoothedDownloadSpeedMbps = null;
    syncDownloadPoll();
    void refreshAiSettings();
  }
}

export async function deleteAiModel(tier: AiModelTier): Promise<void> {
  const arc = window.arc;
  if (!arc?.aiDeleteModel) return;

  patchState({ busy: true });
  try {
    const next = (await arc.aiDeleteModel(tier)) as AiStatus;
    patchState({ status: next, alert: { message: 'Модель удалена.', variant: 'info' } });
    dispatchAiSetupChanged();
  } finally {
    patchState({ busy: false });
  }
}

export async function testAiModel(tier: AiModelTier): Promise<void> {
  const arc = window.arc;
  if (!arc?.aiTestModel) return;

  patchState({ busy: true, testingTier: tier });
  try {
    const res = await arc.aiTestModel(tier);
    patchState({
      alert: {
        message: res.message,
        variant: res.ok ? 'success' : 'warning'
      }
    });
  } catch (err) {
    patchState({
      alert: {
        message: err instanceof Error ? err.message : 'Не удалось проверить модель.',
        variant: 'warning'
      }
    });
  } finally {
    patchState({ busy: false, testingTier: null });
  }
}

export async function setActiveAiModel(tier: AiModelTier): Promise<void> {
  const arc = window.arc;
  if (!arc?.aiSetActiveModel) return;

  const previousTier = state.status?.activeTier;
  patchState({ busy: true });
  try {
    const next = (await arc.aiSetActiveModel(tier)) as AiStatus;
    patchState({ status: next });
    await patchAppPreferences({ aiModelTier: tier });
    if (previousTier && previousTier !== tier) {
      patchState({
        alert: { message: 'Модель переключена. Запущена переиндексация библиотеки.', variant: 'info' }
      });
    }
  } finally {
    patchState({ busy: false });
  }
}

export async function reindexAiLibrary(): Promise<void> {
  const arc = window.arc;
  if (!arc?.aiReindex) return;

  patchState({
    busy: true,
    indexEtaHint: null,
    status: state.status
      ? {
          ...state.status,
          index: { ...state.status.index, running: true, paused: false }
        }
      : state.status
  });
  indexEtaSamples = [];
  syncIndexPoll(state.status);

  try {
    await arc.aiReindex();
  } catch (err) {
    patchState({
      alert: {
        message: err instanceof Error ? err.message : 'Не удалось запустить индексацию.',
        variant: 'warning'
      }
    });
  } finally {
    patchState({ busy: false });
  }
}

export async function pauseAiIndex(): Promise<void> {
  await window.arc?.aiPauseIndex?.();
  await refreshAiSettings();
}

export async function resumeAiIndex(): Promise<void> {
  await window.arc?.aiResumeIndex?.();
  await refreshAiSettings();
}

export async function updateAiResourcePreset(resourcePreset: number): Promise<void> {
  const arc = window.arc;
  if (!arc?.aiSetEnabled) return;

  patchState({ busy: true });
  try {
    const next = (await arc.aiSetEnabled({ resourcePreset })) as AiStatus;
    patchState({ status: next });
  } finally {
    patchState({ busy: false });
  }
}

export async function updateAiSearchStrictness(searchStrictness: number): Promise<void> {
  const arc = window.arc;
  if (!arc?.aiSetEnabled) return;

  patchState({ busy: true });
  try {
    const next = (await arc.aiSetEnabled({ searchStrictness })) as AiStatus;
    patchState({ status: next });
  } finally {
    patchState({ busy: false });
  }
}

export async function updateAiModel(tier: AiModelTier): Promise<void> {
  const arc = window.arc;
  if (!arc?.aiUpdateModel) return;

  patchState({
    busy: true,
    downloadTier: tier,
    downloadPercent: 0,
    downloadPhase: isVisionTier(tier) ? 'runtime' : 'model',
    downloadOperation: 'update'
  });
  syncDownloadPoll();

  try {
    let res: { ok: boolean; error?: string };
    if (isVisionTier(tier)) {
      const runtimeRes = await prepareVisionRuntimeWithCudaOffer(tier);
      if (!runtimeRes.ok) {
        res = runtimeRes;
      } else {
        patchState({ downloadPhase: 'model', downloadPercent: 0 });
        const updateRes = await arc.aiUpdateModel(tier);
        res = updateRes.ok ? { ok: true } : { ok: false, error: updateRes.error };
      }
    } else {
      const updateRes = await arc.aiUpdateModel(tier);
      res = updateRes.ok ? { ok: true } : { ok: false, error: updateRes.error };
    }

    if (!res.ok) {
      patchState({ alert: { message: res.error || 'Не удалось обновить модель.', variant: 'warning' } });
    } else {
      patchState({
        alert: { message: 'Модель обновлена. Запущена переиндексация.', variant: 'success' },
        ...clearDownloadUiState()
      });
    }
  } finally {
    patchState({
      busy: false,
      ...clearDownloadUiState()
    });
    lastDownloadSpeedSample = null;
    smoothedDownloadSpeedMbps = null;
    syncDownloadPoll();
    void refreshAiSettings();
  }
}

export function dismissAiAlert(): void {
  patchState({ alert: null });
}

export async function cancelAiDownload(): Promise<void> {
  await window.arc?.aiCancelDownload?.();
  patchState({
    ...clearDownloadUiState(),
    busy: false
  });
  lastDownloadSpeedSample = null;
  smoothedDownloadSpeedMbps = null;
  syncDownloadPoll();
  void refreshAiSettings();
}

export async function pauseAiDownload(): Promise<void> {
  await window.arc?.aiPauseDownload?.();
  patchState({ downloadPaused: true });
}

export async function resumeAiDownload(): Promise<void> {
  await window.arc?.aiResumeDownload?.();
  patchState({ downloadPaused: false });
}

export function isActiveModelInstalled(status: AiStatus | null): boolean {
  if (!status?.activeTier) return false;
  return Boolean(status.models.find((m) => m.tier === status.activeTier)?.installed);
}
