import { useCallback, useEffect, useMemo, useState } from 'react';

import { dispatchAiSearchLoading } from '../../search/aiSearchEvents';
import type { CardRecord } from '../../services/db';
import type { GallerySortState } from './galleryFilterTypes';
import { usePaginatedRemoteFeed } from './usePaginatedRemoteFeed';

export type AiGalleryFeedOptions = {
  scopeCardIds?: ReadonlySet<string> | null;
  collectionId?: string | null;
  moodboardCardIds?: string[] | null;
};

export function useAiGalleryFeed(
  aiQuery: string | null,
  libraryReady: boolean,
  sort: GallerySortState,
  options?: AiGalleryFeedOptions
) {
  const query = useMemo(() => aiQuery?.trim() ?? '', [aiQuery]);
  const scopeCardIds = options?.scopeCardIds ?? null;
  const collectionId = options?.collectionId ?? null;
  const moodboardCardIds = options?.moodboardCardIds ?? null;
  const serverScoped = Boolean(collectionId) || Boolean(moodboardCardIds?.length);
  const [aiErrorOverride, setAiErrorOverride] = useState<string | null>(null);

  const requestBase = useMemo(
    () => ({
      query,
      collectionId,
      moodboardCardIds,
      sort,
      scopeCardIds: serverScoped ? undefined : scopeCardIds ? [...scopeCardIds] : undefined
    }),
    [collectionId, moodboardCardIds, query, scopeCardIds, serverScoped, sort]
  );

  const resetKey = useMemo(() => JSON.stringify(requestBase), [requestBase]);

  const fetchPage = useCallback(
    async (offset: number, limit: number) => {
      const arc = window.arc;
      if (!arc?.aiSearchCards || !query) return [];
      const status = arc.aiGetStatus ? await arc.aiGetStatus() : null;
      if (status && !status.setupReady) {
        throw new Error('Сначала установите модель в «Настройки → AI Поиск».');
      }
      setAiErrorOverride(null);
      const raw = await arc.aiSearchCards({ ...requestBase, offset, limit });
      let rows = Array.isArray(raw) ? (raw as Array<CardRecord & { aiScore?: number }>) : [];
      if (!serverScoped && scopeCardIds && scopeCardIds.size > 0) {
        rows = rows.filter((row) => scopeCardIds.has(row.id));
      }
      return rows;
    },
    [query, requestBase, scopeCardIds, serverScoped]
  );

  const feed = usePaginatedRemoteFeed({
    enabled: libraryReady && Boolean(query),
    fetchPage,
    resetKey
  });

  useEffect(() => {
    dispatchAiSearchLoading(feed.loading);
  }, [feed.loading]);

  useEffect(() => {
    const arc = window.arc;
    if (!arc?.onAiError) return;
    const unsub = arc.onAiError(({ message }) => {
      if (query) setAiErrorOverride(message);
    });
    return () => unsub?.();
  }, [query]);

  return {
    ...feed,
    error: aiErrorOverride ?? feed.error
  };
}
