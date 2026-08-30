import type { AiHardwareInfo, AiModelCardInfo, AiStatus } from '../../services/aiTypes';

export const AI_INTRO_TEXT =
  'AI работает локально. Модели сопоставляют запрос с карточками.';

export const AUTO_TAG_INTRO_TEXT =
  'Автотегирование анализирует изображение или кадры видео, сопоставляет результат с каталогом меток и при необходимости создаёт новые метки.';

/** Текст карточки модели автотегов: только про метки, без размера и без связи с поиском. */
export const AUTO_TAG_MODEL_DESCRIPTION =
  'Анализирует изображение или кадры видео и предлагает метки из каталога. При необходимости создаёт новые метки.';

export function formatRamGb(mb: number): string {
  if (mb >= 1024) {
    const gb = mb / 1024;
    return `${gb % 1 === 0 ? gb.toFixed(0) : gb.toFixed(1).replace('.', ',')} Гб`;
  }
  return `${mb} Мб`;
}

export function formatCpuLabel(hardware: AiHardwareInfo): string {
  const raw = hardware.cpuModel?.trim();
  if (!raw) return 'Не определён';

  const model = raw
    .replace(/\s*CPU\s*@\s*[\d.,]+\s*GHz\s*$/i, '')
    .replace(/\s*@\s*[\d.,]+\s*GHz\s*$/i, '')
    .replace(/\s*,\s*[\d.,]+\s*GHz\s*$/i, '')
    .trim();

  const freq =
    hardware.cpuFrequencyGhz != null
      ? `${hardware.cpuFrequencyGhz.toFixed(2).replace('.', ',')} ГГц`
      : null;

  if (freq) return `${model}, ${freq}`;
  return model || 'Не определён';
}

export function formatGpuLabel(hardware: AiHardwareInfo): string {
  if (!hardware.gpuName) return 'Не обнаружен';
  if (hardware.estimatedVramMb != null && hardware.estimatedVramMb > 0) {
    const gb = hardware.estimatedVramMb / 1024;
    const vram =
      gb >= 1
        ? `${gb % 1 === 0 ? gb.toFixed(0) : gb.toFixed(1).replace('.', ',')} Гб`
        : `${hardware.estimatedVramMb} Мб`;
    return `${hardware.gpuName}, ${vram}`;
  }
  return hardware.gpuName;
}

export type SearchLevelLabel = 'Лёгкая модель' | 'Средняя модель' | 'Тяжёлая модель';

export function searchLevelShortLabel(level: 'light' | 'medium' | 'heavy' | undefined): SearchLevelLabel {
  if (level === 'medium') return 'Средняя модель';
  if (level === 'heavy') return 'Тяжёлая модель';
  return 'Лёгкая модель';
}

export function modelCardTitle(card: AiModelCardInfo): string {
  return searchLevelShortLabel(card.searchLevel);
}

export function searchModelChipLabel(modelId: string): string {
  if (modelId === 'qwen3-vl-embedding-2b') return 'Qwen3-VL-Embedding 2B';
  if (modelId === 'qwen3-vl-embedding-8b') return 'Qwen3-VL-Embedding 8B';
  return 'CLIP ViT-B/32';
}

/** Причина недоступности: GPU → VRAM → RAM (как пороги в hardware.ts). */
export function searchModelUnavailableReason(
  card: AiModelCardInfo,
  hardware: AiHardwareInfo
): string | null {
  if (card.supported) return null;
  if (card.modelId === 'clip-vit-base-patch32') return null;

  const needRam = card.modelId === 'qwen3-vl-embedding-8b' ? 12288 : 8192;
  const needVram = card.modelId === 'qwen3-vl-embedding-8b' ? 10000 : 4000;

  if (hardware.estimatedVramMb == null) return 'Нужен GPU';
  if (hardware.estimatedVramMb < needVram) return 'Мало VRAM';
  if (hardware.totalMemoryMb < needRam) return 'Мало RAM';
  return 'Нужен GPU';
}

/** @deprecated Prefer searchLevelShortLabel / modelCardTitle */
export function tierShortLabel(tier: 'light' | 'heavy'): 'Лёгкая' | 'Тяжёлая' {
  return tier === 'heavy' ? 'Тяжёлая' : 'Лёгкая';
}

export function strictnessHint(value: number): string {
  if (value <= 20) return 'Больше карточек, возможны слабо связанные изображения';
  if (value <= 40) return 'Расширенный поиск, небольшой шум в хвосте';
  if (value <= 60) return 'Рекомендуемый баланс точности и полноты';
  if (value <= 80) return 'Только близкие совпадения, список короче';
  return 'Максимальная строгость, часто пустая выдача';
}

export function autoTagVolumeHint(value: number): string {
  if (value <= 33) return 'Меньше меток, чаще совпадение с уже существующими';
  if (value <= 66) return 'Баланс числа меток и точности сопоставления';
  return 'Больше предложений, порог совпадения ниже';
}

export { captionLengthHint, captionLengthLabel } from './joyCaptionSettingsCopy';

export function isIndexComplete(status: AiStatus): boolean {
  const index = status.index;
  return Boolean(index.total > 0 && index.indexed >= index.total && !index.running);
}
