import type { AiHardwareInfo, AiModelCardInfo, AiSearchModelId, AiStatus } from '../../services/aiTypes';

export const AI_INTRO_TEXT =
  'AI в ARC работает локально и не отправляет материалы в облако. Поиск, описания и автотеги включаются независимо, а общие лимиты ресурсов помогают контролировать нагрузку на CPU, GPU и память.';
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

export type SearchLevelLabel = 'Лёгкая' | 'Средняя' | 'Тяжёлая';

export function searchLevelShortLabel(level: 'light' | 'medium' | 'heavy' | undefined): SearchLevelLabel {
  if (level === 'medium') return 'Средняя';
  if (level === 'heavy') return 'Тяжёлая';
  return 'Лёгкая';
}

export function modelCardTitle(
  card: AiModelCardInfo,
  recommendedSearchModelId: AiSearchModelId | undefined
): string {
  const levelLabel = searchLevelShortLabel(card.searchLevel);
  if (!card.supported) return `${levelLabel}. Режим недоступен`;
  if (recommendedSearchModelId && card.modelId === recommendedSearchModelId) {
    return `${levelLabel}. Рекомендуется`;
  }
  return levelLabel;
}

/** @deprecated Prefer searchLevelShortLabel / modelCardTitle with recommendedSearchModelId */
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
