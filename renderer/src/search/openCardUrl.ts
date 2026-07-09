import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ARC_CARD_DETAIL_CLOSE_EVENT } from '../components/gallery/cardDetailEvents';
import { ARC_SEARCH_QUERY_CARD, parseSearchCardId } from './searchUrl';
import {
  beginManualSectionNavigation,
  getManualSectionNavigationEpoch
} from './sectionNavigation';

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
      const replacing = Boolean(parseDetailCardId(searchParams));
      navigate(
        { pathname: location.pathname, search: formatSearchQuery(next) },
        { replace: replacing, state: null }
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

  /** Закрыть detail сразу в раздел, без пошагового POP по истории карточек. */
  const closeCard = useCallback(() => {
    closeCardReplace();
  }, [closeCardReplace]);

  const sectionNavEpochRef = useRef(getManualSectionNavigationEpoch());

  useEffect(() => {
    const onCloseRequest = () => {
      if (getManualSectionNavigationEpoch() !== sectionNavEpochRef.current) return;
      closeCardReplace();
    };
    window.addEventListener(ARC_CARD_DETAIL_CLOSE_EVENT, onCloseRequest);
    return () => window.removeEventListener(ARC_CARD_DETAIL_CLOSE_EVENT, onCloseRequest);
  }, [closeCardReplace]);

  useEffect(() => {
    sectionNavEpochRef.current = getManualSectionNavigationEpoch();
  });

  return { openCardId, openCard, closeCard, closeCardReplace };
}

/** Один navigate при смене раздела: снимает detail= без отдельного closeCard (избегает гонки с /gallery). */
export function useNavigateToAppSection() {
  const navigate = useNavigate();

  return useCallback(
    (pathname: string, search = '') => {
      beginManualSectionNavigation();
      navigate({ pathname, search }, { replace: true });
    },
    [navigate]
  );
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
