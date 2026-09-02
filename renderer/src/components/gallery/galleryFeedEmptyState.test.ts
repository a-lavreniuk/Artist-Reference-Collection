import { describe, expect, it, vi } from 'vitest';
import { resolveGalleryFeedEmptyState } from './galleryFeedEmptyState';
import { EMPTY_STATE_COPY } from '../../content/emptyStates';

const base = {
  ready: true,
  loading: false,
  booting: false,
  feedSettled: true,
  cardCount: 0,
  feedError: null as string | null,
  hasSearchFilters: false,
  isRemoteSearch: false,
  onResetSearch: () => undefined
};

describe('resolveGalleryFeedEmptyState collection copy', () => {
  it('uses collection empty copy with inline layout', () => {
    const result = resolveGalleryFeedEmptyState({
      ...base,
      context: 'collection',
      onNavigateLibrary: vi.fn()
    });
    expect(result?.copy).toBe(EMPTY_STATE_COPY.collectionEmpty);
    expect(result?.layout).toBe('inline');
  });

  it('uses section empty copy when viewing a section', () => {
    const result = resolveGalleryFeedEmptyState({
      ...base,
      context: 'collection',
      collectionKind: 'section',
      onNavigateLibrary: vi.fn()
    });
    expect(result?.copy).toBe(EMPTY_STATE_COPY.sectionEmpty);
    expect(result?.copy.subtitle).toContain('библиотеки');
    expect(result?.layout).toBe('inline');
  });

  it('uses library untagged copy with reset action', () => {
    const onResetSearch = vi.fn();
    const result = resolveGalleryFeedEmptyState({
      ...base,
      context: 'gallery',
      tagPresence: 'untagged',
      onResetSearch
    });
    expect(result?.copy).toBe(EMPTY_STATE_COPY.libraryUntagged);
    expect(result?.copy.primaryActionLabel).toBe('Открыть библиотеку');
    result?.onPrimaryAction?.();
    expect(onResetSearch).toHaveBeenCalledOnce();
  });
});
