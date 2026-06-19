import type { EmptyStateCopy } from '../../content/emptyStates';
import { EMPTY_STATE_COPY } from '../../content/emptyStates';
import type { LibraryScope } from '../../search/libraryScopeUrl';

export type GalleryFeedEmptyContext = 'gallery' | 'collection' | 'moodboard';

export type GalleryFeedEmptyStateResult = {
  copy: EmptyStateCopy;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
};

function isAiSetupError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('модель') || lower.includes('ai поиск') || lower.includes('индекс');
}

export function resolveGalleryFeedEmptyState(input: {
  ready: boolean;
  loading: boolean;
  booting?: boolean;
  cardCount: number;
  feedError: string | null;
  hasSearchFilters: boolean;
  libraryScope?: LibraryScope;
  context: GalleryFeedEmptyContext;
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
    cardCount,
    feedError,
    hasSearchFilters,
    libraryScope = 'all',
    context,
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
  if (cardCount > 0 || loading) return null;

  if (feedError) {
    const copy: EmptyStateCopy = {
      ...EMPTY_STATE_COPY.searchFeedError,
      subtitle: feedError
    };
    if (isAiSetupError(feedError) && onNavigateAiSettings) {
      return {
        copy: {
          ...copy,
          primaryActionLabel: 'Настройки AI Поиска',
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
    if (libraryScope === 'untagged') {
      return { copy: EMPTY_STATE_COPY.libraryUntagged };
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
      copy: EMPTY_STATE_COPY.collectionEmpty,
      onPrimaryAction: onNavigateLibrary
    };
  }

  return {
    copy: EMPTY_STATE_COPY.moodboardEmpty,
    onPrimaryAction: onNavigateLibrary
  };
}
