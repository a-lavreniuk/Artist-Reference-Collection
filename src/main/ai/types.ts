/** Shared AI semantic search types (main process + worker). */



export type ModelTier = 'light' | 'heavy';



export type ModelStack = 'transformers' | 'llama-embed' | 'llama-caption';



export type ModelFileSpec = {

  name: string;

  role: 'weights' | 'mmproj';

  /** Separate HF repo when mmproj lives outside main hfId */

  hfId?: string;

};



export type ModelCatalogEntry = {

  id: string;

  tier: ModelTier;

  stack: ModelStack;

  hfId: string;

  hfRevision?: string;

  catalogRevision: number;

  label: string;

  description: string;

  sizeLabel: string;

  sizeMb: number;

  minRamMb: number;

  /** @deprecated use files */

  ggufFile?: string;

  /** @deprecated use files */

  mmprojFile?: string;

  files?: ModelFileSpec[];

};



export const MODEL_CATALOG: Record<ModelTier, ModelCatalogEntry> = {

  light: {

    id: 'clip-vit-base-patch32',

    tier: 'light',

    stack: 'transformers',

    hfId: 'Xenova/clip-vit-base-patch32',

    catalogRevision: 1,

    label: 'Лёгкая',

    description:
      'Режим для устройств без GPU. Быстрый поиск по содержимому изображений. Потребуется 350 Мб для загрузки.',

    sizeLabel: '~350 МБ',

    sizeMb: 350,

    minRamMb: 2048

  },

  heavy: {

    id: 'joycaption-beta-one',

    tier: 'heavy',

    stack: 'llama-caption',

    hfId: 'mradermacher/llama-joycaption-beta-one-hf-llava-GGUF',

    catalogRevision: 1,

    label: 'Тяжёлая',

    description:
      'Продвинутый медленный режим, отлично работает с любыми изображениями. Потребуется 5.5 Гб для загрузки.',

    sizeLabel: '~5.5 ГБ',

    sizeMb: 5500,

    minRamMb: 12288,

    ggufFile: 'llama-joycaption-beta-one-hf-llava.Q4_K_M.gguf',

    mmprojFile: 'llama-joycaption-beta-one-llava-mmproj-model-f16.gguf',

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

  recommendedTier: ModelTier;

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

};



export type ModelInstallStatus = {

  tier: ModelTier;

  installed: boolean;

  downloading: boolean;

  progressPercent: number | null;

  updateAvailable?: boolean;

  installedCatalogRevision?: number;

  catalogRevision?: number;

};



export type AiModelCardInfo = {

  tier: ModelTier;

  label: string;

  description: string;

  sizeLabel: string;

  minRamMb: number;

  supported: boolean;

};



export type AiStatus = {

  enabled: boolean;

  activeTier: ModelTier | null;

  activeModelId: string | null;

  hardware: HardwareInfo;

  supportedTiers: ModelTier[];

  modelCards: AiModelCardInfo[];

  resources: AiResourceSettings;

  resourcePreset: number;

  searchStrictness: number;

  index: IndexStatus;

  models: ModelInstallStatus[];

  llamaRuntime: {

    cpuInstalled: boolean;

    cudaInstalled: boolean;

    release: string;

  };

  download: {

    tier: ModelTier;

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

  | { type: 'init'; tier: ModelTier; modelsDir: string; resources: AiResourceSettings }

  | { type: 'download-model'; tier: ModelTier; modelsDir: string; resources: AiResourceSettings }

  | { type: 'test-model'; tier: ModelTier; modelsDir: string; resources: AiResourceSettings }

  | { type: 'cancel-download' }

  | { type: 'pause-download' }

  | { type: 'resume-download' }

  | { type: 'embed-image'; imagePath: string; modelId: string }

  | { type: 'embed-text'; text: string; modelId: string }

  | { type: 'unload' };



export type WorkerResponse =

  | { type: 'pong' }

  | { type: 'ready'; modelId: string; tier: ModelTier }

  | { type: 'download-progress'; tier: ModelTier; percent: number; bytesReceived?: number; bytesTotal?: number }

  | { type: 'download-complete'; tier: ModelTier; modelId: string }

  | { type: 'download-error'; tier: ModelTier; message: string }

  | { type: 'test-result'; tier: ModelTier; ok: boolean; message: string; vectorDim?: number }

  | { type: 'embedding'; requestType: 'embed-image' | 'embed-text'; vector: number[] }

  | { type: 'error'; message: string; recoverable?: boolean };



export const AI_SEARCH_CACHE_TTL_MS = 30_000;


