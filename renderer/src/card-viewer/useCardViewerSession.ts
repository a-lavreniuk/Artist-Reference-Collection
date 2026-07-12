import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CardRecord } from '../services/arcSchema';
import { cardOriginalRel } from '../components/gallery/galleryMediaCache';

type SessionState = {
  cardIds: string[];
  index: number;
  card: CardRecord | null;
  mediaSrc: string | null;
  mediaRel: string | null;
  loading: boolean;
  error: string | null;
};

function initialState(cardIds: string[], startIndex: number): SessionState {
  return {
    cardIds,
    index: startIndex,
    card: null,
    mediaSrc: null,
    mediaRel: null,
    loading: cardIds.length > 0,
    error: cardIds.length === 0 ? 'Нет карточек для просмотра' : null
  };
}

async function loadCardMedia(card: CardRecord): Promise<{ src: string | null; rel: string | null }> {
  const rel = cardOriginalRel(card);
  if (!rel || !window.arc?.toFileUrl) return { src: null, rel: null };
  const src = await window.arc.toFileUrl(rel);
  return { src, rel };
}

export function useCardViewerSession(cardIds: readonly string[], startIndex: number) {
  const [state, setState] = useState<SessionState>(() => initialState([...cardIds], startIndex));

  const loadAtIndex = useCallback(async (ids: string[], index: number) => {
    if (ids.length === 0) {
      setState((prev) => ({ ...prev, loading: false, error: 'Нет карточек для просмотра' }));
      return;
    }
    const safeIndex = Math.min(Math.max(0, index), ids.length - 1);
    const cardId = ids[safeIndex];
    if (!cardId || !window.arc?.storageGetCard) {
      setState((prev) => ({
        ...prev,
        index: safeIndex,
        card: null,
        mediaSrc: null,
        mediaRel: null,
        loading: false,
        error: 'Карточка недоступна'
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      cardIds: ids,
      index: safeIndex,
      loading: true,
      error: null
    }));

    try {
      const card = await window.arc.storageGetCard(cardId);
      if (!card) {
        setState((prev) => ({
          ...prev,
          card: null,
          mediaSrc: null,
          mediaRel: null,
          loading: false,
          error: 'Карточка не найдена'
        }));
        return;
      }
      const { src, rel } = await loadCardMedia(card);
      setState((prev) => ({
        ...prev,
        card,
        mediaSrc: src,
        mediaRel: rel,
        loading: false,
        error: src ? null : 'Не удалось загрузить медиа'
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        card: null,
        mediaSrc: null,
        mediaRel: null,
        loading: false,
        error: 'Ошибка загрузки карточки'
      }));
    }
  }, []);

  useEffect(() => {
    void loadAtIndex([...cardIds], startIndex);
  }, [cardIds, loadAtIndex, startIndex]);

  const goPrev = useCallback(() => {
    if (state.index <= 0) return;
    void loadAtIndex(state.cardIds, state.index - 1);
  }, [loadAtIndex, state.cardIds, state.index]);

  const goNext = useCallback(() => {
    if (state.index >= state.cardIds.length - 1) return;
    void loadAtIndex(state.cardIds, state.index + 1);
  }, [loadAtIndex, state.cardIds, state.index]);

  const canGoPrev = state.index > 0;
  const canGoNext = state.index < state.cardIds.length - 1;

  const counterLabel = useMemo(() => {
    if (state.cardIds.length <= 1) return null;
    return `${state.index + 1} из ${state.cardIds.length}`;
  }, [state.cardIds.length, state.index]);

  return {
    ...state,
    canGoPrev,
    canGoNext,
    goPrev,
    goNext,
    counterLabel
  };
}
