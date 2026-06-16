import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGalleryFilters } from '../components/gallery/GalleryFilterContext';
import { clearGallerySearchParams } from '../search/clearGallerySearch';
import { parseSearchAiQuery, parseSearchCardId, parseSearchTagIds } from '../search/searchUrl';

export function useResetGallerySearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { clearFilters, activeCategoryCount } = useGalleryFilters();

  const hasUrlSearch = useMemo(() => {
    return (
      parseSearchTagIds(searchParams).length > 0 ||
      Boolean(parseSearchCardId(searchParams)) ||
      Boolean(parseSearchAiQuery(searchParams))
    );
  }, [searchParams]);

  const hasActiveGallerySearch = hasUrlSearch || activeCategoryCount > 0;

  const resetGallerySearch = useCallback(() => {
    clearFilters();
    setSearchParams(clearGallerySearchParams(searchParams), { replace: true });
  }, [clearFilters, searchParams, setSearchParams]);

  return { resetGallerySearch, hasActiveGallerySearch, hasUrlSearch, activeCategoryCount };
}
