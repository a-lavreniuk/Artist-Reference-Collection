import { useCallback, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ARC_CARD_DETAIL_CLOSE_EVENT } from '../components/gallery/cardDetailEvents';
import { ARC_SEARCH_QUERY_CARD, parseSearchCardId } from './searchUrl';

/** Открытая детальная карточка (шаги «назад/вперёд»). Не путать с `card=` — фильтр ленты. */
export const ARC_DETAIL_QUERY_CARD = 'detail';

export function parseDetailCardId(searchParams: URLSearchParams): string | null {
  const raw = searchParams.get(ARC_DETAIL_QUERY_CARD)?.trim();
  return raw || null;
}

export function resolveOpenCardId(searchParams: URLSearchParams): string | null {
  return parseDetailCardId(searchParams);
}

export function formatSearchQuery(searchParams: URLSearchParams): string {
  const s = searchParams.toString();
  return s ? `?${s}` : '';
}

export function stripOpenCardFromParams(searchParams: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  next.delete(ARC_DETAIL_QUERY_CARD);
  return next;
}

export function setDetailCardInParams(searchParams: URLSearchParams, cardId: string): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  next.set(ARC_DETAIL_QUERY_CARD, cardId);
  return next;
}

export function setSearchAndDetailCardInParams(
  searchParams: URLSearchParams,
  cardId: string
): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  next.set(ARC_SEARCH_QUERY_CARD, cardId);
  next.set(ARC_DETAIL_QUERY_CARD, cardId);
  return next;
}

export type OpenCardUrlApi = {
  openCardId: string | null;
  openCard: (cardId: string) => void;
  closeCard: () => void;
  closeCardReplace: () => void;
};

export function useOpenCardUrl(): OpenCardUrlApi {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const openCardId = resolveOpenCardId(searchParams);

  const openCard = useCallback(
    (cardId: string) => {
      const next = setDetailCardInParams(searchParams, cardId);
      navigate(
        { pathname: location.pathname, search: formatSearchQuery(next) },
        { state: null }
      );
    },
    [location.pathname, navigate, searchParams]
  );

  const closeCardReplace = useCallback(() => {
    const next = stripOpenCardFromParams(searchParams);
    navigate(
      { pathname: location.pathname, search: formatSearchQuery(next) },
      { replace: true, state: null }
    );
  }, [location.pathname, navigate, searchParams]);

  const closeCard = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  useEffect(() => {
    const onCloseRequest = () => closeCardReplace();
    window.addEventListener(ARC_CARD_DETAIL_CLOSE_EVENT, onCloseRequest);
    return () => window.removeEventListener(ARC_CARD_DETAIL_CLOSE_EVENT, onCloseRequest);
  }, [closeCardReplace]);

  return { openCardId, openCard, closeCard, closeCardReplace };
}

/** Удаляет `detail` и при совпадении — `card` из query (сброс чипа ID в поиске). */
export function removeCardFilterFromParams(searchParams: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  const detailId = parseDetailCardId(next);
  const filterId = parseSearchCardId(next);
  next.delete(ARC_SEARCH_QUERY_CARD);
  if (detailId && filterId && detailId === filterId) {
    next.delete(ARC_DETAIL_QUERY_CARD);
  }
  return next;
}
