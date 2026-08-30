/** Shared AI semantic search types (main process + worker). */

/** Catalog roles: three search models + caption (JoyCaption for descriptions / auto-tags). */
export type ModelRole = 'search-clip' | 'search-embed-2b' | 'search-embed-8b' | 'caption';

export type SearchModelId =
  | 'clip-vit-base-patch32'
  | 'qwen3-vl-embedding-2b'
  | 'qwen3-vl-embedding-8b';

export type CaptionModelId = 'joycaption-beta-one';

export type AiModelId = SearchModelId | CaptionModelId;

/**
 * @deprecated Prefer ModelRole / SearchModelId. Kept for migration and a few legacy call sites.
 * light ≈ CLIP search; heavy ≈ caption (JoyCaption) historically bundled search+caption.
 */
export type ModelTier = 'light' | 'heavy';

export type ModelStack = 'transformers' | 'llama-embed' | 'llama-caption';

export type ModelFileSpec = {
  name: string;
  role: 'weights' | 'mmproj';
  /** Separate HF repo when mmproj lives outside main hfId */
  hfId?: string;
};

export function usesLlamaStack(stack: ModelStack): boolean {
  return stack === 'llama-embed' || stack === 'llama-caption';
}

export type ModelCatalogEntry = {
  id: AiModelId;
  role: ModelRole;
  /** @deprecated use role */
  tier?: ModelTier;
  stack: ModelStack;
  hfId: string;
  hfRevision?: string;
  catalogRevision: number;
  label: string;
  description: string;
  sizeLabel: string;
  sizeMb: number;
  minRamMb: number;
  /** Search UI group: light / medium / heavy */
  searchLevel?: 'light' | 'medium' | 'heavy';
  /** @deprecated use files */
  ggufFile?: string;
  /** @deprecated use files */
  mmprojFile?: string;
  files?: ModelFileSpec[];
};

export const SEARCH_MODEL_IDS: SearchModelId[] = [
  'clip-vit-base-patch32',
  'qwen3-vl-embedding-2b',
  'qwen3-vl-embedding-8b'
];

export const MODEL_ROLES: ModelRole[] = [
  'search-clip',
  'search-embed-2b',
  'search-embed-8b',
  'caption'
];

export const MODEL_CATALOG: Record<ModelRole, ModelCatalogEntry> = {
  'search-clip': {
    id: 'clip-vit-base-patch32',
    role: 'search-clip',
    tier: 'light',
    stack: 'transformers',
    hfId: 'Xenova/clip-vit-base-patch32',
    catalogRevision: 1,
    label: 'Лёгкая',
    description:
      'Быстрый поиск по содержимому изображений. Подходит, если нет мощного GPU.',
    sizeLabel: '~350 МБ',
    sizeMb: 350,
    minRamMb: 2048,
    searchLevel: 'light'
  },
  'search-embed-2b': {
    id: 'qwen3-vl-embedding-2b',
    role: 'search-embed-2b',
    stack: 'llama-embed',
    hfId: 'DevQuasar/Qwen.Qwen3-VL-Embedding-2B-GGUF',
    catalogRevision: 1,
    label: 'Средняя',
    description:
      'Ищет по смыслу текста и картинки, а не только по внешнему сходству. Лучше понимает запрос и находит близкие референсы.',
    sizeLabel: '~2.3 ГБ',
    sizeMb: 2300,
    minRamMb: 8192,
    searchLevel: 'medium',
    files: [
      { name: 'Qwen.Qwen3-VL-Embedding-2B.Q6_K.gguf', role: 'weights' },
      { name: 'mmproj-Qwen.Qwen3-VL-Embedding-2B.f16.gguf', role: 'mmproj' }
    ]
  },
  'search-embed-8b': {
    id: 'qwen3-vl-embedding-8b',
    role: 'search-embed-8b',
    stack: 'llama-embed',
    hfId: 'mradermacher/Qwen3-VL-Embedding-8B-GGUF',
    catalogRevision: 1,
    label: 'Тяжёлая',
    description:
      'Максимальное качество поиска по сложным сценам. Лучше различает тонкие отличия между похожими кадрами.',
    sizeLabel: '~5.8 ГБ',
    sizeMb: 5800,
    minRamMb: 12288,
    searchLevel: 'heavy',
    files: [
      { name: 'Qwen3-VL-Embedding-8B.Q4_K_M.gguf', role: 'weights' },
      { name: 'Qwen3-VL-Embedding-8B.mmproj-f16.gguf', role: 'mmproj' }
    ]
  },
  caption: {
    id: 'joycaption-beta-one',
    role: 'caption',
    tier: 'heavy',
    stack: 'llama-caption',
    hfId: 'mradermacher/llama-joycaption-beta-one-hf-llava-GGUF',
    catalogRevision: 1,
    label: 'JoyCaption',
    description:
      'Анализирует изображение или кадры видео и предлагает метки из каталога. При необходимости создаёт новые метки.',
    sizeLabel: '~5.5 ГБ',
    sizeMb: 5500,
    minRamMb: 12288,
    files: [
      { name: 'llama-joycaption-beta-one-hf-llava.Q4_K_M.gguf', role: 'weights' },
      {
        name: 'llama-joycaption-beta-one-llava-mmproj-model-f16.gguf',
        role: 'mmproj',
        hfId: 'concedo/llama-joycaption-beta-one-hf-llava-mmproj-gguf'
      }
    ]
  }
};

export const SEARCH_ROLE_BY_ID: Record<SearchModelId, ModelRole> = {
  'clip-vit-base-patch32': 'search-clip',
  'qwen3-vl-embedding-2b': 'search-embed-2b',
  'qwen3-vl-embedding-8b': 'search-embed-8b'
};

export function isSearchModelId(raw: unknown): raw is SearchModelId {
  return typeof raw === 'string' && (SEARCH_MODEL_IDS as string[]).includes(raw);
}

export function getRoleForModelId(modelId: string): ModelRole | null {
  for (const role of MODEL_ROLES) {
    if (MODEL_CATALOG[role].id === modelId) return role;
  }
  return null;
}

export function getEntryByModelId(modelId: string): ModelCatalogEntry | null {
  const role = getRoleForModelId(modelId);
  return role ? MODEL_CATALOG[role] : null;
}

/** Legacy: map old light/heavy tier to a catalog role (best-effort). */
export function roleFromLegacyTier(tier: ModelTier): ModelRole {
  return tier === 'heavy' ? 'caption' : 'search-clip';
}

export type HardwareInfo = {
  platform: NodeJS.Platform;
  cpuCores: number;
  cpuModel: string | null;
  cpuFrequencyGhz: number | null;
  totalMemoryMb: number;
  hasGpu: boolean;
  hasNvidiaGpu: boolean;
  gpuName: string | null;
  estimatedVramMb: number | null;
  /** @deprecated Prefer recommendedSearchModelId */
  recommendedTier: ModelTier;
  recommendedSearchModelId: SearchModelId;
};

export type AiResourceSettings = {
  threads: number;
  gpuLayers: number;
  maxRamMb: number;
};

export type IndexStatus = {
  indexed: number;
  total: number;
  running: boolean;
  paused: boolean;
  currentCardId: string | null;
  currentCardProgress: number | null;
  /** Current pipeline stage for UI copy. */
  stage?: 'embeddings' | 'captions' | 'tags' | null;
};

export type ModelInstallStatus = {
  role: ModelRole;
  modelId: AiModelId;
  /** @deprecated use role */
  tier?: ModelTier;
  installed: boolean;
  downloading: boolean;
  progressPercent: number | null;
  updateAvailable?: boolean;
  installedCatalogRevision?: number;
  catalogRevision?: number;
};

export type AiModelCardInfo = {
  role: ModelRole;
  modelId: AiModelId;
  /** @deprecated use role */
  tier?: ModelTier;
  label: string;
  description: string;
  sizeLabel: string;
  minRamMb: number;
  supported: boolean;
  searchLevel?: 'light' | 'medium' | 'heavy';
};

export type AiStatus = {
  enabled: boolean;
  activeSearchModelId: SearchModelId | null;
  /** @deprecated use activeSearchModelId */
  activeTier: ModelTier | null;
  /** @deprecated use activeSearchModelId */
  activeModelId: string | null;
  hardware: HardwareInfo;
  supportedSearchModelIds: SearchModelId[];
  /** @deprecated */
  supportedTiers: ModelTier[];
  searchModelCards: AiModelCardInfo[];
  captionModelCard: AiModelCardInfo;
  /** @deprecated combined cards — prefer searchModelCards + captionModelCard */
  modelCards: AiModelCardInfo[];
  resources: AiResourceSettings;
  resourcePreset: number;
  searchStrictness: number;
  autoTagEnabled: boolean;
  autoTagVolume: number;
  autoTagCatalogMode: 'reuse' | 'reuse_create';
  autoTagOnImport: boolean;
  index: IndexStatus;
  models: ModelInstallStatus[];
  llamaRuntime: {
    cpuInstalled: boolean;
    cudaInstalled: boolean;
    release: string;
  };
  download: {
    role: ModelRole;
    modelId: AiModelId;
    /** @deprecated */
    tier?: ModelTier;
    percent: number | null;
    phase: 'runtime' | 'model' | 'finalize';
  } | null;
  lastError: string | null;
  setupReady: boolean;
};

export type AiSearchResult = {
  cardId: string;
  score: number;
};

export type WorkerRequest =
  | { type: 'ping' }
  | { type: 'init'; role: ModelRole; modelsDir: string; resources: AiResourceSettings }
  | { type: 'download-model'; role: ModelRole; modelsDir: string; resources: AiResourceSettings }
  | { type: 'test-model'; role: ModelRole; modelsDir: string; resources: AiResourceSettings }
  | { type: 'cancel-download' }
  | { type: 'pause-download' }
  | { type: 'resume-download' }
  | { type: 'embed-image'; imagePath: string; modelId: string }
  | { type: 'embed-text'; text: string; modelId: string }
  | { type: 'unload' };

export type WorkerResponse =
  | { type: 'pong' }
  | { type: 'ready'; modelId: string; role: ModelRole; tier?: ModelTier }
  | {
      type: 'download-progress';
      role: ModelRole;
      tier?: ModelTier;
      percent: number;
      bytesReceived?: number;
      bytesTotal?: number;
    }
  | { type: 'download-complete'; role: ModelRole; tier?: ModelTier; modelId: string }
  | { type: 'download-error'; role: ModelRole; tier?: ModelTier; message: string }
  | {
      type: 'test-result';
      role: ModelRole;
      tier?: ModelTier;
      ok: boolean;
      message: string;
      vectorDim?: number;
    }
  | { type: 'embedding'; requestType: 'embed-image' | 'embed-text'; vector: number[] }
  | { type: 'error'; message: string; recoverable?: boolean };

export const AI_SEARCH_CACHE_TTL_MS = 30_000;
