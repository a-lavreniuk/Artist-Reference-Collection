import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';
import { ARC_SIMILAR_SEARCH_LOADING_EVENT } from '../../search/similarSearchEvents';
import {
  clearSimilarUploadPath,
  FULL_SIMILAR_CROP,
  getSimilarUploadPath,
  setSimilarUploadPath,
  type SimilarCropRect
} from '../../search/similarSearchSession';
import {
  parseSearchSimilarCrop,
  parseSearchSimilarRef,
  setSearchSimilarInParams
} from '../../search/searchUrl';

type SimilarQueryRef = ReturnType<typeof parseSearchSimilarRef>;
import { clearGallerySearchParams } from '../../search/clearGallerySearch';
import { getCardById } from '../../services/db';
import { readGridSize } from '../../layout/gridSizePreference';
import { mergeCardsSrcMap, peekCardsSrcMap } from '../gallery/galleryMediaCache';

const SIMILAR_SEARCH_DEBOUNCE_MS = 280;

function mediaAbsUrl(absPath: string): string {
  return `arc-media://localhost/?abs=${encodeURIComponent(absPath)}`;
}

export function useNavbarSimilarSearch(
  searchParams: URLSearchParams,
  setSearchParams: SetURLSearchParams,
  searchMode: string,
  panelOpen: boolean
) {
  const similarRef = useMemo(() => parseSearchSimilarRef(searchParams), [searchParams]);
  const similarCrop = useMemo(() => parseSearchSimilarCrop(searchParams), [searchParams]);
  const [panelCrop, setPanelCrop] = useState<SimilarCropRect>(FULL_SIMILAR_CROP);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [similarSearching, setSimilarSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasSimilarQuery = Boolean(similarRef);

  useEffect(() => {
    setPanelCrop(similarCrop);
  }, [similarCrop]);

  useEffect(() => {
    const onLoading = (e: Event) => {
      const detail = (e as CustomEvent<{ loading: boolean }>).detail;
      setSimilarSearching(Boolean(detail?.loading));
    };
    window.addEventListener(ARC_SIMILAR_SEARCH_LOADING_EVENT, onLoading);
    return () => window.removeEventListener(ARC_SIMILAR_SEARCH_LOADING_EVENT, onLoading);
  }, []);

  useEffect(() => {
    if (searchMode !== 'similar') return;
    let cancelled = false;
    void (async () => {
      if (!similarRef) {
        if (!cancelled) setPreviewSrc(null);
        return;
      }
      if (similarRef.kind === 'upload') {
        const path = getSimilarUploadPath();
        if (!cancelled) setPreviewSrc(path ? mediaAbsUrl(path) : null);
        return;
      }
      const card = await getCardById(similarRef.cardId);
      if (!card || cancelled) return;
      const gridSize = readGridSize();
      const map = await mergeCardsSrcMap([card], peekCardsSrcMap([card], gridSize), gridSize);
      if (!cancelled) setPreviewSrc(map[card.id] ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [searchMode, similarRef]);

  useEffect(() => {
    if (searchMode !== 'similar' || !panelOpen) return;
    document.body.classList.add('arc-similar-search-panel-open');
    return () => {
      document.body.classList.remove('arc-similar-search-panel-open');
    };
  }, [panelOpen, searchMode]);

  const applySimilarSearch = useCallback(
    (ref: SimilarQueryRef, crop: SimilarCropRect) => {
      if (!ref) return;
      const base = clearGallerySearchParams(searchParams);
      setSearchParams(setSearchSimilarInParams(base, ref, crop), { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const applySimilarDebounced = useCallback(
    (ref: NonNullable<SimilarQueryRef>, crop: SimilarCropRect) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        applySimilarSearch(ref, crop);
      }, SIMILAR_SEARCH_DEBOUNCE_MS);
    },
    [applySimilarSearch]
  );

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  const setSimilarCardQuery = useCallback(
    (cardId: string, crop: SimilarCropRect = FULL_SIMILAR_CROP) => {
      clearSimilarUploadPath();
      setPanelCrop(crop);
      applySimilarSearch({ kind: 'card', cardId }, crop);
    },
    [applySimilarSearch]
  );

  const setSimilarUploadQuery = useCallback(
    (stagedPath: string, crop: SimilarCropRect = FULL_SIMILAR_CROP) => {
      setSimilarUploadPath(stagedPath);
      setPanelCrop(crop);
      setPreviewSrc(mediaAbsUrl(stagedPath));
      applySimilarSearch({ kind: 'upload' }, crop);
    },
    [applySimilarSearch]
  );

  const clearSimilarQuery = useCallback(() => {
    clearSimilarUploadPath();
    setPanelCrop(FULL_SIMILAR_CROP);
    setPreviewSrc(null);
    const base = clearGallerySearchParams(searchParams);
    setSearchParams(base, { replace: true });
  }, [searchParams, setSearchParams]);

  const onPanelCropChange = useCallback(
    (crop: SimilarCropRect) => {
      setPanelCrop(crop);
      if (!similarRef) return;
      applySimilarDebounced(similarRef, crop);
    },
    [applySimilarDebounced, similarRef]
  );

  return {
    similarRef,
    similarCrop,
    panelCrop,
    previewSrc,
    hasSimilarQuery,
    similarSearching,
    setSimilarCardQuery,
    setSimilarUploadQuery,
    clearSimilarQuery,
    onPanelCropChange,
    applySimilarSearch
  };
}
