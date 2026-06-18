import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGalleryFilters } from '../components/gallery/GalleryFilterContext';
import { clearGallerySearchParams } from '../search/clearGallerySearch';
import { parseSearchAiQuery, parseSearchCardId, parseSearchTagIds, parseSearchColorHex, parseSearchSimilarRef } from '../search/searchUrl';
import { clearSimilarUploadPath } from '../search/similarSearchSession';

export function useResetGallerySearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { clearFilters, activeCategoryCount } = useGalleryFilters();

  const hasUrlSearch = useMemo(() => {
    return (
      parseSearchTagIds(searchParams).length > 0 ||
      Boolean(parseSearchCardId(searchParams)) ||
      Boolean(parseSearchAiQuery(searchParams)) ||
      Boolean(parseSearchColorHex(searchParams)) ||
      Boolean(parseSearchSimilarRef(searchParams))
    );
  }, [searchParams]);

  const hasActiveGallerySearch = hasUrlSearch || activeCategoryCount > 0;

  const resetGallerySearch = useCallback(() => {
    clearFilters();
    clearSimilarUploadPath();
    setSearchParams(clearGallerySearchParams(searchParams), { replace: true });
  }, [clearFilters, searchParams, setSearchParams]);

  return { resetGallerySearch, hasActiveGallerySearch, hasUrlSearch, activeCategoryCount };
}
