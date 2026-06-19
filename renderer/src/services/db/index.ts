export type {
  NavbarMetrics,
  CategoryWeight,
  CategoryRecord,
  TagRecord,
  CategoryStats,
  CollectionStats,
  CardRecord,
  CollectionRecord
} from './types';

export { CATEGORY_WEIGHT_SCORE } from './types';

export {
  ARC_CATEGORIES_CHANGED_EVENT,
  ARC_TAGS_CHANGED_EVENT,
  ARC_CARDS_CHANGED_EVENT,
  ARC_COLLECTIONS_CHANGED_EVENT,
  ARC_MOODBOARD_BOARD_CHANGED_EVENT,
  notifyCategoriesChanged,
  notifyTagsChanged
} from './events';

export { invalidateLibraryCache } from './backend';

export {
  getAllCategories,
  addCategory,
  updateCategoryName,
  updateCategoryColorHex,
  updateCategoryWeight,
  updateCategoryDescription,
  updateCategory,
  getCategoryStats,
  moveCategory,
  reorderCategoryToIndex,
  deleteCategory,
  getTagsByCategory,
  addTag,
  updateTag,
  deleteTag,
  getDuplicateSimilarityThresholdPct,
  setDuplicateSimilarityThresholdPct,
  addSkippedDuplicatePair,
  moveTagToCategory
} from './categories';

export {
  getAllCollections,
  getCollectionById,
  addCollection,
  updateCollection,
  renameCollection,
  reorderCollectionToIndex,
  getCollectionStats,
  deleteCollection
} from './collections';

export {
  getMoodboardCardIds,
  isCardInMoodboard,
  addCardToMoodboard,
  getMoodboardBoard,
  saveMoodboardBoard,
  isCardOnBoard,
  listMoodboardCards,
  removeCardFromMoodboard,
  toggleCardInMoodboard
} from './moodboard';

export {
  listCardsSorted,
  listCardsPage,
  listCardsInCollection,
  getCardById,
  getCollectionCardCounts,
  getCollectionPreviewSlices,
  listSimilarCards,
  insertImportedCards,
  updateCardPayload,
  softDeleteCard,
  restoreCard,
  permanentDeleteCard,
  emptyTrash,
  deleteCard
} from './cards';

export {
  isLibraryConfigured,
  getNavbarMetrics,
  loadLibraryMetadataSnapshot,
  applyLibraryIntegrityFixes
} from './library';
