import type { EmptyStateCopy } from '../../content/emptyStates';
import { EMPTY_STATE_COPY } from '../../content/emptyStates';
import type { LibraryScope } from '../../search/libraryScopeUrl';

export type GalleryFeedEmptyContext = 'gallery' | 'collection' | 'moodboard';

export type GalleryFeedEmptyStateResult = {
  copy: EmptyStateCopy;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  layout?: 'default' | 'inline';
};

function isAiSetupError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('модель') || lower.includes('ai поиск') || lower.includes('индекс');
}

export function resolveGalleryFeedEmptyState(input: {
  ready: boolean;
  loading: boolean;
  booting?: boolean;
  feedSettled?: boolean;
  cardCount: number;
  feedError: string | null;
  hasSearchFilters: boolean;
  libraryScope?: LibraryScope;
  /** Фильтр наличия меток (галерея). */
  tagPresence?: 'tagged' | 'untagged' | null;
  context: GalleryFeedEmptyContext;
  /** Для context=collection: коллекция или раздел — разный empty-copy. */
  collectionKind?: 'collection' | 'section';
  isRemoteSearch: boolean;
  isAiSearch?: boolean;
  onResetSearch: () => void;
  onOpenImport?: () => void;
  onNavigateLibrary?: () => void;
  onNavigateSettingsLibrary?: () => void;
  onNavigateAiSettings?: () => void;
}): GalleryFeedEmptyStateResult | null {
  const {
    ready,
    loading,
    booting,
    feedSettled = true,
    cardCount,
    feedError,
    hasSearchFilters,
    libraryScope = 'all',
    tagPresence = null,
    context,
    collectionKind = 'collection',
    isRemoteSearch,
    isAiSearch = false,
    onResetSearch,
    onOpenImport,
    onNavigateLibrary,
    onNavigateSettingsLibrary,
    onNavigateAiSettings
  } = input;

  if (!ready) {
    return {
      copy: EMPTY_STATE_COPY.libraryUnconfigured,
      onPrimaryAction: onNavigateSettingsLibrary
    };
  }

  if (booting && !isRemoteSearch) return null;
  if (!feedSettled || cardCount > 0 || loading) return null;

  if (feedError) {
    const copy: EmptyStateCopy = {
      ...EMPTY_STATE_COPY.searchFeedError,
      subtitle: feedError
    };
    if (isAiSetupError(feedError) && onNavigateAiSettings) {
      return {
        copy: {
          ...copy,
          primaryActionLabel: 'Умный поиск',
          primaryActionVariant: 'outline',
          secondaryActionLabel: 'Сбросить фильтры',
          secondaryActionVariant: 'outline'
        },
        onPrimaryAction: onNavigateAiSettings,
        onSecondaryAction: onResetSearch
      };
    }
    return {
      copy,
      onPrimaryAction: onResetSearch
    };
  }

  if (hasSearchFilters) {
    if (isRemoteSearch && context === 'gallery' && isAiSearch) {
      return {
        copy: EMPTY_STATE_COPY.aiSearchNoResults,
        onPrimaryAction: onNavigateAiSettings,
        onSecondaryAction: onResetSearch
      };
    }
    return {
      copy: EMPTY_STATE_COPY.searchNoResults,
      onPrimaryAction: onResetSearch
    };
  }

  if (context === 'gallery') {
    if (tagPresence === 'untagged' || libraryScope === 'untagged') {
      return {
        copy: EMPTY_STATE_COPY.libraryUntagged,
        onPrimaryAction: onResetSearch
      };
    }
    if (libraryScope === 'trash') {
      return { copy: EMPTY_STATE_COPY.libraryTrashEmpty };
    }
    return {
      copy: EMPTY_STATE_COPY.libraryEmpty,
      onPrimaryAction: onOpenImport
    };
  }

  if (context === 'collection') {
    return {
      copy:
        collectionKind === 'section' ? EMPTY_STATE_COPY.sectionEmpty : EMPTY_STATE_COPY.collectionEmpty,
      onPrimaryAction: onNavigateLibrary,
      layout: 'inline'
    };
  }

  return {
    copy: EMPTY_STATE_COPY.moodboardEmpty,
    onPrimaryAction: onNavigateLibrary
  };
}
