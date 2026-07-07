import { buildGalleryQueryKey, defaultGalleryFeedQuery } from '../components/gallery/galleryQuery';
import { listGallerySnapshotStats } from '../components/gallery/galleryScopeCache';

export type MoodboardLibraryDiagReport = {
  moodboardIdsInStorage: number;
  dbCardCountAll: number;
  dbCardCountUntagged: number;
  listCardsLibrary: number;
  listCardsMoodboardFilterEmpty: number;
  listCardsMoodboardFilterStorage: number;
  cacheKeyGalleryAll: string;
  cacheKeyMoodboardEmpty: string;
  cacheKeysCollide: boolean;
  snapshotStats: Record<string, { cardCount: number; offset: number; hasMore: boolean }>;
  issues: string[];
};

/** Диагностика коллизии кэша галереи / мудборда и расхождений счётчиков. */
export async function runArcMoodboardLibraryDiag(): Promise<MoodboardLibraryDiagReport> {
  const arc = window.arc;
  if (!arc) {
    throw new Error('window.arc недоступен — запустите в окне ARC (DevTools renderer).');
  }

  const mb = await arc.storageGetMoodboard();
  const mbIds = mb.moodboardCardIds ?? [];

  const [dbCardCountAll, dbCardCountUntagged, libraryPage, moodboardEmptyPage, moodboardActualPage] =
    await Promise.all([
      arc.storageCountCards({ filter: 'all', libraryScope: 'all' }),
      arc.storageCountCards({ filter: 'all', libraryScope: 'untagged' }),
      arc.storageListCards({ offset: 0, limit: 500, libraryScope: 'all' }),
      arc.storageListCards({
        offset: 0,
        limit: 500,
        libraryScope: 'all',
        moodboardCardIds: []
      }),
      arc.storageListCards({
        offset: 0,
        limit: 500,
        libraryScope: 'all',
        moodboardCardIds: mbIds
      })
    ]);

  const galleryQuery = defaultGalleryFeedQuery('all');
  const moodboardEmptyQuery = { ...defaultGalleryFeedQuery('all'), moodboardCardIds: [] as string[] };
  const cacheKeyGalleryAll = buildGalleryQueryKey(galleryQuery);
  const cacheKeyMoodboardEmpty = buildGalleryQueryKey(moodboardEmptyQuery);
  const cacheKeysCollide = cacheKeyGalleryAll === cacheKeyMoodboardEmpty;

  const snapshotStats = listGallerySnapshotStats();
  const gallerySnap = snapshotStats[cacheKeyGalleryAll];

  const issues: string[] = [];

  if (cacheKeysCollide) {
    issues.push(
      'Ключ кэша пустого мудборда совпадает с ключом «Вся библиотека» — snapshot одного раздела может подменять другой.'
    );
  }

  if (cacheKeysCollide && dbCardCountAll > 0 && moodboardEmptyPage.length === 0) {
    issues.push(
      'Коллизия ключей: запрос мудборда с moodboardCardIds=[] может обнулить snapshot галереи.'
    );
  }

  if (cacheKeysCollide && gallerySnap && dbCardCountAll > 0 && gallerySnap.cardCount === 0) {
    issues.push(
      `Snapshot галереи (${cacheKeyGalleryAll}) содержит 0 карточек при ${dbCardCountAll} в БД — вероятно отравлен кэш мудбордом.`
    );
  }

  if (
    cacheKeysCollide &&
    gallerySnap &&
    dbCardCountAll > 0 &&
    gallerySnap.cardCount === dbCardCountAll &&
    mbIds.length === 0
  ) {
    issues.push(
      'Snapshot галереи заполнен всеми карточками при пустом мудборде — мудборд мог показать кэш библиотеки.'
    );
  }

  if (mbIds.length > 0 && mbIds.length !== moodboardActualPage.length && moodboardActualPage.length < mbIds.length) {
    issues.push('Не все id из moodboardCardIds найдены в cards — проверьте arc-moodboard.json.');
  }

  const report: MoodboardLibraryDiagReport = {
    moodboardIdsInStorage: mbIds.length,
    dbCardCountAll,
    dbCardCountUntagged,
    listCardsLibrary: libraryPage.length,
    listCardsMoodboardFilterEmpty: moodboardEmptyPage.length,
    listCardsMoodboardFilterStorage: moodboardActualPage.length,
    cacheKeyGalleryAll,
    cacheKeyMoodboardEmpty,
    cacheKeysCollide,
    snapshotStats,
    issues
  };

  console.group('[ARC] Диагностика мудборда / библиотеки');
  console.table({
    'ID в moodboard (storage)': report.moodboardIdsInStorage,
    'Карточек в БД (all)': report.dbCardCountAll,
    'Карточек в БД (untagged)': report.dbCardCountUntagged,
    'listCards без mb-фильтра': report.listCardsLibrary,
    'listCards mb=[]': report.listCardsMoodboardFilterEmpty,
    'listCards mb=storage': report.listCardsMoodboardFilterStorage,
    'Ключи кэша совпадают': report.cacheKeysCollide
  });
  console.log('Ключ галереи (all):', report.cacheKeyGalleryAll);
  console.log('Ключ мудборда (пустой):', report.cacheKeyMoodboardEmpty);
  console.log('Snapshot-кэш:', report.snapshotStats);
  if (report.issues.length) {
    console.warn('Обнаруженные проблемы:');
    for (const issue of report.issues) console.warn('•', issue);
  } else {
    console.log('Явных проблем не обнаружено.');
  }
  console.groupEnd();

  return report;
}

declare global {
  interface Window {
    __arcDiagMoodboardLibrary?: () => Promise<MoodboardLibraryDiagReport>;
  }
}
