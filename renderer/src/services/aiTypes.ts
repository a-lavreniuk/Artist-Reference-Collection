export type AiModelRole = 'search-clip' | 'search-embed-2b' | 'search-embed-8b' | 'caption' | 'tagger';
export type AiSearchModelId =
  | 'clip-vit-base-patch32'
  | 'qwen3-vl-embedding-2b'
  | 'qwen3-vl-embedding-8b';
/** @deprecated Prefer AiModelRole / AiSearchModelId */
export type AiModelTier = 'light' | 'heavy';

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
  recommendedSearchModelId?: AiSearchModelId;
};

export type AiModelInstallStatus = {
  role: AiModelRole;
  modelId: string;
  tier?: AiModelTier;
  installed: boolean;
  downloading: boolean;
  progressPercent: number | null;
  updateAvailable?: boolean;
  installedCatalogRevision?: number;
  catalogRevision?: number;
};

export type AiModelCardInfo = {
  role: AiModelRole;
  modelId: string;
  tier?: AiModelTier;
  label: string;
  description: string;
  sizeLabel: string;
  minRamMb: number;
  supported: boolean;
  searchLevel?: 'light' | 'medium' | 'heavy';
};

export type AiIndexStatus = {
  indexed: number;
  total: number;
  running: boolean;
  paused: boolean;
  currentCardId: string | null;
  currentCardProgress: number | null;
  stage?: 'embeddings' | 'captions' | 'tags' | null;
};

export type AiLlamaRuntimeStatus = {
  cpuInstalled: boolean;
  cudaInstalled: boolean;
  release: string;
};

export type AiDownloadStatus = {
  role: AiModelRole;
  modelId: string;
  tier?: AiModelTier;
  percent: number | null;
  phase: 'runtime' | 'model' | 'finalize';
  bytesReceived?: number | null;
  bytesTotal?: number | null;
};

export type AiStatus = {
  enabled: boolean;
  activeSearchModelId: AiSearchModelId | null;
  /** @deprecated */
  activeTier: AiModelTier | null;
  /** @deprecated */
  activeModelId: string | null;
  hardware: AiHardwareInfo;
  supportedSearchModelIds: AiSearchModelId[];
  /** @deprecated */
  supportedTiers: AiModelTier[];
  searchModelCards: AiModelCardInfo[];
  captionModelCard: AiModelCardInfo;
  taggerModelCard: AiModelCardInfo;
  /** Combined search + caption cards */
  modelCards: AiModelCardInfo[];
  resources: { threads: number; gpuLayers: number; maxRamMb: number };
  resourcePreset: number;
  searchStrictness: number;
  autoTagEnabled: boolean;
  autoTagVolume: number;
  autoTagCatalogMode: 'reuse' | 'reuse_create';
  autoTagOnImport: boolean;
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

export type AiModelRef = AiModelRole | AiModelTier | AiSearchModelId | { role?: string; modelId?: string; tier?: string };
