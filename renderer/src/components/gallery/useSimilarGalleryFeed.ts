import { useCallback, useEffect, useMemo } from 'react';

import { dispatchSimilarSearchLoading } from '../../search/similarSearchEvents';
import { getSimilarUploadPath } from '../../search/similarSearchSession';
import type { SimilarCropRect } from '../../search/searchUrl';
import type { CardRecord } from '../../services/db';
import type { GalleryFeedQuery } from './galleryQuery';
import { usePaginatedRemoteFeed } from './usePaginatedRemoteFeed';

export type SimilarGalleryFeedOptions = {
  scopeCardIds?: ReadonlySet<string> | null;
};

export type SimilarSearchRef =
  | { kind: 'card'; cardId: string }
  | { kind: 'upload' }
  | null;

export function useSimilarGalleryFeed(
  similarRef: SimilarSearchRef,
  crop: SimilarCropRect,
  feedQuery: GalleryFeedQuery,
  libraryReady: boolean,
  options?: SimilarGalleryFeedOptions
) {
  const scopeCardIds = options?.scopeCardIds ?? null;

  const requestBase = useMemo(() => {
    if (!similarRef) return null;
    const uploadPath = similarRef.kind === 'upload' ? getSimilarUploadPath() : null;
    if (similarRef.kind === 'upload' && !uploadPath) return null;
    return {
      cardId: similarRef.kind === 'card' ? similarRef.cardId : null,
      imagePath: similarRef.kind === 'upload' ? uploadPath : null,
      crop,
      libraryScope: feedQuery.libraryScope,
      selectedTagIds: feedQuery.selectedTagIds,
      cardIdExact: feedQuery.cardIdExact,
      collectionId: feedQuery.collectionId ?? null,
      moodboardCardIds: feedQuery.moodboardCardIds ?? null,
      advancedFilters: feedQuery.advancedFilters,
      sort: feedQuery.sort,
      scopeCardIds: scopeCardIds ? [...scopeCardIds] : undefined
    };
  }, [crop, feedQuery, scopeCardIds, similarRef]);

  const resetKey = useMemo(() => JSON.stringify(requestBase), [requestBase]);

  const fetchPage = useCallback(
    async (offset: number, limit: number) => {
      const arc = window.arc;
      if (!arc?.aiSimilarSearchCards || !requestBase) return [];
      const status = arc.aiGetStatus ? await arc.aiGetStatus() : null;
      if (status && !status.setupReady) {
        throw new Error('Сначала установите модель в «Настройки → AI Поиск».');
      }
      const raw = await arc.aiSimilarSearchCards({ ...requestBase, offset, limit });
      return Array.isArray(raw) ? (raw as CardRecord[]) : [];
    },
    [requestBase]
  );

  const feed = usePaginatedRemoteFeed({
    enabled: libraryReady && Boolean(requestBase),
    fetchPage,
    resetKey
  });

  useEffect(() => {
    dispatchSimilarSearchLoading(feed.loading);
  }, [feed.loading]);

  return feed;
}
