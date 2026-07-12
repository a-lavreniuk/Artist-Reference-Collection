export type DiskBarSegmentTone = 'images' | 'videos' | 'trash' | 'nonArc' | 'free';

export type DiskBarSegment = {
  id: DiskBarSegmentTone;
  bytes: number;
  tone: DiskBarSegmentTone;
};

export type DiskBarLegendItem = {
  id: Exclude<DiskBarSegmentTone, 'free' | 'nonArc'> | 'nonArc';
  label: string;
  bytes: number;
  tone: DiskBarSegmentTone;
};

export type DiskBarModel = {
  segments: DiskBarSegment[];
  legend: DiskBarLegendItem[];
  libraryFolderBytes: number;
  diskTotalBytes: number;
  diskFreeBytes: number;
  driveLabel: string;
};

type BuildDiskBarInput = {
  imageBytes: number;
  videoBytes: number;
  trashBytes: number;
  libraryFolderBytes: number;
  diskTotalBytes: number;
  diskFreeBytes: number;
  driveLabel: string;
};

export function buildDiskBarModel(input: BuildDiskBarInput): DiskBarModel {
  const {
    imageBytes,
    videoBytes,
    trashBytes,
    libraryFolderBytes,
    diskTotalBytes,
    diskFreeBytes,
    driveLabel
  } = input;

  const diskUsedBytes = Math.max(0, diskTotalBytes - diskFreeBytes);
  const nonArcBytes = Math.max(0, diskUsedBytes - libraryFolderBytes);
  const freeBytes = Math.max(0, diskFreeBytes);

  const segments: DiskBarSegment[] = [
    { id: 'nonArc', bytes: nonArcBytes, tone: 'nonArc' },
    { id: 'images', bytes: imageBytes, tone: 'images' },
    { id: 'videos', bytes: videoBytes, tone: 'videos' }
  ];

  if (trashBytes > 0) {
    segments.push({ id: 'trash', bytes: trashBytes, tone: 'trash' });
  }

  segments.push({ id: 'free', bytes: freeBytes, tone: 'free' });

  const legend: DiskBarLegendItem[] = [
    { id: 'nonArc', label: 'Системные файлы', bytes: nonArcBytes, tone: 'nonArc' },
    { id: 'images', label: 'Изображения', bytes: imageBytes, tone: 'images' },
    { id: 'videos', label: 'Видео', bytes: videoBytes, tone: 'videos' }
  ];

  if (trashBytes > 0) {
    legend.push({ id: 'trash', label: 'Корзина', bytes: trashBytes, tone: 'trash' });
  }

  return {
    segments,
    legend,
    libraryFolderBytes,
    diskTotalBytes,
    diskFreeBytes,
    driveLabel
  };
}

export function segmentWidthPercent(bytes: number, totalBytes: number): number {
  if (!Number.isFinite(bytes) || bytes <= 0 || totalBytes <= 0) return 0;
  return (bytes / totalBytes) * 100;
}
