export type DiskSpacePressureLevel = 'none' | 'warning' | 'critical';

export type DiskSpacePressureAdvice = {
  level: DiskSpacePressureLevel;
  title: string;
  body: string;
};

const FREE_CRITICAL_RATIO = 0.05;
const FREE_WARNING_RATIO = 0.15;
const LIBRARY_WARNING_RATIO = 0.5;
const LIBRARY_CRITICAL_RATIO = 0.75;
const FREE_VS_LIBRARY_WARNING = 0.5;
const FREE_VS_LIBRARY_CRITICAL = 0.2;

export function evaluateDiskSpacePressure(input: {
  diskTotalBytes: number;
  diskFreeBytes: number;
  libraryFolderBytes: number;
}): DiskSpacePressureAdvice | null {
  const { diskTotalBytes, diskFreeBytes, libraryFolderBytes } = input;
  if (diskTotalBytes <= 0) return null;

  const freeRatio = diskFreeBytes / diskTotalBytes;
  const libraryRatio = libraryFolderBytes / diskTotalBytes;
  const freeVsLibrary =
    libraryFolderBytes > 0 ? diskFreeBytes / libraryFolderBytes : Number.POSITIVE_INFINITY;

  const critical =
    freeRatio < FREE_CRITICAL_RATIO ||
    libraryRatio >= LIBRARY_CRITICAL_RATIO ||
    freeVsLibrary < FREE_VS_LIBRARY_CRITICAL;

  const warning =
    !critical &&
    (freeRatio < FREE_WARNING_RATIO ||
      libraryRatio >= LIBRARY_WARNING_RATIO ||
      freeVsLibrary < FREE_VS_LIBRARY_WARNING);

  if (critical) {
    return {
      level: 'critical',
      title: 'На диске почти не осталось места',
      body: 'Библиотека ARC занимает заметную долю диска. Освободите место на носителе, очистите корзину ARC или перенесите библиотеку на диск с большим запасом'
    };
  }

  if (warning) {
    return {
      level: 'warning',
      title: 'Библиотека активно растёт',
      body: 'Свободного места на диске может не хватить для импорта и резервных копий. Рекомендуем очистить корзину, удалить лишние файлы с диска или перенести библиотеку'
    };
  }

  return null;
}

export const DISK_PRESSURE_NOTIFY_SESSION_KEY = 'arc:disk-pressure-notified';
