import type { AiHardwareInfo, AiModelCardInfo, AiStatus } from '../../services/aiTypes';
import type { AiModelTier } from '../../services/appPreferences';

export const AI_INTRO_TEXT =
  'Функционал позволяет использовать поиск на естественном языке, что значительно повышает эффективность. Для работы необходимо проверить технические характеристики системы и скачать языковые модели';

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

export function modelCardTitle(
  card: AiModelCardInfo,
  recommendedTier: AiModelTier,
  tierLabel: 'Лёгкая' | 'Тяжёлая'
): string {
  if (!card.supported) return `${tierLabel}. Режим недоступен`;
  if (card.tier === recommendedTier) return `${tierLabel}. Рекомендуется`;
  return tierLabel;
}

export function tierShortLabel(tier: AiModelTier): 'Лёгкая' | 'Тяжёлая' {
  return tier === 'heavy' ? 'Тяжёлая' : 'Лёгкая';
}

export function strictnessHint(value: number): string {
  if (value <= 20) return 'Больше карточек, возможны слабо связанные изображения';
  if (value <= 40) return 'Расширенный поиск, небольшой шум в хвосте';
  if (value <= 60) return 'Рекомендуемый баланс точности и полноты';
  if (value <= 80) return 'Только близкие совпадения, список короче';
  return 'Максимальная строгость, часто пустая выдача';
}

export function isIndexComplete(status: AiStatus): boolean {
  const index = status.index;
  return Boolean(index.total > 0 && index.indexed >= index.total && !index.running);
}
