import { useLayoutEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import GalleryPage from '../../pages/GalleryPage';
import CollectionsPage from '../../pages/CollectionsPage';
import MoodboardCardsView from '../moodboard/MoodboardCardsView';
import type { MainTabKey } from './navbarLayout';
import {
  CardSectionMediaContext,
  syncCardSectionMediaActive,
  type CardSectionMediaState
} from './cardSectionMedia';
import { cancelGalleryMediaPreloads } from '../gallery/galleryMediaCache';

export function isCardSectionPath(pathname: string): boolean {
  return (
    pathname === '/gallery' ||
    pathname.startsWith('/collections') ||
    pathname.startsWith('/moodboard')
  );
}

function resolveCardSectionTab(pathname: string): MainTabKey | null {
  if (pathname === '/' || pathname === '') return 'gallery';
  if (pathname.startsWith('/collections')) return 'collections';
  if (pathname.startsWith('/moodboard')) return 'moodboard';
  if (pathname === '/gallery') return 'gallery';
  return null;
}

/** Разделы с карточками: монтируем только активную вкладку — скрытые feed не шлют IPC. Кэш в galleryScopeCache. */
export default function CardSectionsShell() {
  const { pathname } = useLocation();
  const activeTab = resolveCardSectionTab(pathname);

  const mediaActive = useMemo<CardSectionMediaState>(
    () => ({
      gallery: activeTab === 'gallery',
      collections: activeTab === 'collections',
      moodboard: activeTab === 'moodboard'
    }),
    [activeTab]
  );

  useLayoutEffect(() => {
    cancelGalleryMediaPreloads();
    syncCardSectionMediaActive(mediaActive);
    window.arc?.setActiveMediaTab?.(activeTab);
  }, [activeTab, mediaActive]);

  return (
    <CardSectionMediaContext.Provider value={mediaActive}>
      {activeTab === 'gallery' ? <GalleryPage /> : null}
      {activeTab === 'collections' ? <CollectionsPage /> : null}
      {activeTab === 'moodboard' ? <MoodboardCardsView /> : null}
    </CardSectionMediaContext.Provider>
  );
}
