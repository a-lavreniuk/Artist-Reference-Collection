import type { AiModelTier } from './appPreferences';

export type AiHardwareInfo = {
  platform: string;
  cpuCores: number;
  cpuModel: string | null;
  cpuFrequencyGhz: number | null;
  totalMemoryMb: number;
  hasGpu: boolean;
  hasNvidiaGpu: boolean;
  gpuName: string | null;
  estimatedVramMb: number | null;
  recommendedTier: AiModelTier;
};

export type AiModelInstallStatus = {
  tier: AiModelTier;
  installed: boolean;
  downloading: boolean;
  progressPercent: number | null;
  updateAvailable?: boolean;
  installedCatalogRevision?: number;
  catalogRevision?: number;
};

export type AiModelCardInfo = {
  tier: AiModelTier;
  label: string;
  description: string;
  sizeLabel: string;
  minRamMb: number;
  supported: boolean;
};

export type AiIndexStatus = {
  indexed: number;
  total: number;
  running: boolean;
  paused: boolean;
  currentCardId: string | null;
  currentCardProgress: number | null;
};

export type AiLlamaRuntimeStatus = {
  cpuInstalled: boolean;
  cudaInstalled: boolean;
  release: string;
};

export type AiDownloadStatus = {
  tier: AiModelTier;
  percent: number | null;
  phase: 'runtime' | 'model' | 'finalize';
  bytesReceived?: number | null;
  bytesTotal?: number | null;
};

export type AiStatus = {
  enabled: boolean;
  activeTier: AiModelTier | null;
  activeModelId: string | null;
  hardware: AiHardwareInfo;
  supportedTiers: AiModelTier[];
  modelCards: AiModelCardInfo[];
  resources: { threads: number; gpuLayers: number; maxRamMb: number };
  resourcePreset: number;
  searchStrictness: number;
  index: AiIndexStatus;
  models: AiModelInstallStatus[];
  llamaRuntime: AiLlamaRuntimeStatus;
  download: AiDownloadStatus | null;
  lastError: string | null;
  setupReady: boolean;
};

export type AiSearchResult = {
  cardId: string;
  score: number;
};
