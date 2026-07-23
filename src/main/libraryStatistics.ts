import path from 'path';
import { withLibraryDbReadonly } from './storage/db';
import { countCardsReadonly } from './storage/libraryStorage';
import { readLibraryDiskStats, type LibraryDiskStats } from './libraryDiskStats';
import {
  getActiveLibraryEntry,
  readLibraryRootConfigSync,
  type LibraryRegistryEntry
} from './librarySessionSnapshot';
import { readParentLibraryPathSync } from './libraryRootConfig';

export type LibraryStatisticsScope = 'all' | string;

export type LibraryStatisticsResult = {
  totalCards: number;
  imageCards: number;
  videoCards: number;
  totalCollections: number;
  imageBytes: number;
  videoBytes: number;
  trashBytes: number;
  libraryFolderBytes: number;
  diskTotalBytes: number;
  diskFreeBytes: number;
  driveLabel: string;
  /** usage по tag_id в выбранном scope (одна БД или сумма по всем). */
  tagUsage: Record<string, number>;
};

type MediaAgg = {
  imageBytes: number;
  videoBytes: number;
  trashBytes: number;
  totalCollections: number;
  tagUsage: Record<string, number>;
};

function emptyMediaAgg(): MediaAgg {
  return {
    imageBytes: 0,
    videoBytes: 0,
    trashBytes: 0,
    totalCollections: 0,
    tagUsage: {}
  };
}

function readMediaAggFromDb(libraryRoot: string): MediaAgg {
  const agg = withLibraryDbReadonly(libraryRoot, (db) => {
    const byType = db
      .prepare(
        `SELECT type AS t, COALESCE(SUM(file_size), 0) AS bytes
         FROM cards
         WHERE COALESCE(is_deleted, 0) = 0
         GROUP BY type`
      )
      .all() as Array<{ t: string; bytes: number }>;

    let imageBytes = 0;
    let videoBytes = 0;
    for (const row of byType) {
      const n = Number(row.bytes) || 0;
      if (row.t === 'image') imageBytes = n;
      else if (row.t === 'video') videoBytes = n;
    }

    const trashRow = db
      .prepare(
        `SELECT COALESCE(SUM(file_size), 0) AS bytes
         FROM cards
         WHERE COALESCE(is_deleted, 0) = 1`
      )
      .get() as { bytes: number } | undefined;
    const trashBytes = Number(trashRow?.bytes) || 0;

    const colRow = db.prepare('SELECT COUNT(*) AS n FROM collections').get() as { n: number } | undefined;
    const totalCollections = Number(colRow?.n) || 0;

    const tagRows = db
      .prepare(
        `SELECT ct.tag_id AS tagId, COUNT(DISTINCT ct.card_id) AS n
         FROM card_tags ct
         INNER JOIN cards c ON c.id = ct.card_id AND COALESCE(c.is_deleted, 0) = 0
         GROUP BY ct.tag_id`
      )
      .all() as Array<{ tagId: string; n: number }>;

    const tagUsage: Record<string, number> = {};
    for (const row of tagRows) {
      if (row.tagId) tagUsage[row.tagId] = Number(row.n) || 0;
    }

    return { imageBytes, videoBytes, trashBytes, totalCollections, tagUsage };
  });

  return agg ?? emptyMediaAgg();
}

function mergeTagUsage(into: Record<string, number>, from: Record<string, number>): void {
  for (const [id, n] of Object.entries(from)) {
    into[id] = (into[id] ?? 0) + n;
  }
}

function resolveLibraryEntry(libraryId: string): LibraryRegistryEntry | null {
  const cfg = readLibraryRootConfigSync();
  return (cfg.libraries ?? []).find((l) => l.id === libraryId) ?? null;
}

async function statsForSingleRoot(libraryRoot: string): Promise<LibraryStatisticsResult> {
  const root = path.resolve(libraryRoot);
  const media = readMediaAggFromDb(root);
  const totalCards = countCardsReadonly(root, 'all', 'all');
  const imageCards = countCardsReadonly(root, 'images', 'all');
  const videoCards = countCardsReadonly(root, 'videos', 'all');

  let disk: LibraryDiskStats;
  try {
    disk = await readLibraryDiskStats(root);
  } catch {
    disk = {
      driveLabel: '',
      diskTotalBytes: 0,
      diskFreeBytes: 0,
      libraryFolderBytes: 0
    };
  }

  return {
    totalCards,
    imageCards,
    videoCards,
    totalCollections: media.totalCollections,
    imageBytes: media.imageBytes,
    videoBytes: media.videoBytes,
    trashBytes: media.trashBytes,
    libraryFolderBytes: disk.libraryFolderBytes,
    diskTotalBytes: disk.diskTotalBytes,
    diskFreeBytes: disk.diskFreeBytes,
    driveLabel: disk.driveLabel,
    tagUsage: media.tagUsage
  };
}

/**
 * Статистика для одной библиотеки (по id) или сводка по всем (`scope === 'all'`).
 * Читает дочерние БД readonly — без переключения активной библиотеки.
 */
export async function getLibraryStatistics(
  scope: LibraryStatisticsScope = 'all'
): Promise<LibraryStatisticsResult> {
  const cfg = readLibraryRootConfigSync();
  const libs = cfg.libraries ?? [];

  if (scope !== 'all') {
    const entry = resolveLibraryEntry(scope);
    if (!entry) {
      const active = getActiveLibraryEntry(cfg);
      if (!active) {
        return {
          totalCards: 0,
          imageCards: 0,
          videoCards: 0,
          totalCollections: 0,
          imageBytes: 0,
          videoBytes: 0,
          trashBytes: 0,
          libraryFolderBytes: 0,
          diskTotalBytes: 0,
          diskFreeBytes: 0,
          driveLabel: '',
          tagUsage: {}
        };
      }
      return statsForSingleRoot(active.path);
    }
    return statsForSingleRoot(entry.path);
  }

  // Одна библиотека или legacy без реестра — как активная.
  if (libs.length <= 1) {
    const only = libs[0] ?? getActiveLibraryEntry(cfg);
    if (!only?.path) {
      return {
        totalCards: 0,
        imageCards: 0,
        videoCards: 0,
        totalCollections: 0,
        imageBytes: 0,
        videoBytes: 0,
        trashBytes: 0,
        libraryFolderBytes: 0,
        diskTotalBytes: 0,
        diskFreeBytes: 0,
        driveLabel: '',
        tagUsage: {}
      };
    }
    return statsForSingleRoot(only.path);
  }

  let totalCards = 0;
  let imageCards = 0;
  let videoCards = 0;
  let totalCollections = 0;
  let imageBytes = 0;
  let videoBytes = 0;
  let trashBytes = 0;
  const tagUsage: Record<string, number> = {};

  for (const lib of libs) {
    const media = readMediaAggFromDb(lib.path);
    totalCards += countCardsReadonly(lib.path, 'all', 'all');
    imageCards += countCardsReadonly(lib.path, 'images', 'all');
    videoCards += countCardsReadonly(lib.path, 'videos', 'all');
    totalCollections += media.totalCollections;
    imageBytes += media.imageBytes;
    videoBytes += media.videoBytes;
    trashBytes += media.trashBytes;
    mergeTagUsage(tagUsage, media.tagUsage);
  }

  // Вес «всех» — папка контейнера «Библиотека ARC» (включая общий meta).
  const parent = readParentLibraryPathSync() ?? cfg.parentPath ?? null;
  let disk: LibraryDiskStats;
  try {
    disk = parent
      ? await readLibraryDiskStats(parent)
      : await readLibraryDiskStats(libs[0]!.path);
  } catch {
    disk = {
      driveLabel: '',
      diskTotalBytes: 0,
      diskFreeBytes: 0,
      libraryFolderBytes: 0
    };
  }

  return {
    totalCards,
    imageCards,
    videoCards,
    totalCollections,
    imageBytes,
    videoBytes,
    trashBytes,
    libraryFolderBytes: disk.libraryFolderBytes,
    diskTotalBytes: disk.diskTotalBytes,
    diskFreeBytes: disk.diskFreeBytes,
    driveLabel: disk.driveLabel,
    tagUsage
  };
}
