import type { RefObject, Dispatch, SetStateAction, KeyboardEvent } from 'react';
import type { CategoryRecord, TagRecord } from '../../../services/db';
import type { NavbarSearchMode } from '../../../search/navbarSearchMode';
import type { NavbarSearchPanelLayout } from './NavbarSearchPanelPortal';
import type { useNavbarSimilarSearch } from './hooks/useNavbarSimilarSearch';

export type NavbarSearchPanelLayoutState = NavbarSearchPanelLayout | null;

export type ScrollFadeState = {
  start: boolean;
  end: boolean;
};

export type NavbarSearchContextValue = {
  searchMode: NavbarSearchMode;
  setSearchMode: Dispatch<SetStateAction<NavbarSearchMode>>;
  aiNavbarModesVisible: boolean;
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  panelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  fieldError: boolean;
  setFieldError: Dispatch<SetStateAction<boolean>>;
  hasValue: boolean;
  placeholder: string;
  q: string;
  rankedTags: ReturnType<typeof import('../../../search/rankSearchTags').rankTagsForQuery>;
  selectedTagIds: string[];
  cardIdFilter: string | null;
  aiQuery: string | null;
  colorHex: string | null;
  colorTolerance: number;
  displayColorHex: string;
  categories: CategoryRecord[];
  tagsIndex: Map<string, TagRecord>;
  categoryById: Map<string, CategoryRecord>;
  recentIds: string[];
  recentAiIds: string[];
  recentViewedIds: string[];
  recentTick: number;
  setRecentTick: Dispatch<SetStateAction<number>>;
  aiSearching: boolean;
  panelColorHex: string;
  panelColorTolerance: number;
  similarSearch: ReturnType<typeof useNavbarSimilarSearch>;
  dropdownLayout: NavbarSearchPanelLayoutState;
  scrollFade: ScrollFadeState;
  searchAnchorRef: RefObject<HTMLDivElement | null>;
  measureRef: RefObject<HTMLSpanElement | null>;
  scrollTrackRef: RefObject<HTMLDivElement | null>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  panelHadInteraction: RefObject<boolean>;
  handleModeChange: (mode: NavbarSearchMode) => void;
  toggleTag: (tagId: string) => void;
  removeTag: (tagId: string) => void;
  resetSearchField: () => void;
  clearAiSearch: () => void;
  clearAiDraft: () => void;
  applyAiQuery: (raw: string) => void;
  applyCardIdFilter: (raw: string) => void;
  handlePanelColorChange: (hex: string) => void;
  handlePanelToleranceChange: (value: number) => void;
  onInputKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onScrollTrackWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
  ensureInputVisible: () => void;
  selectRecentCard: (id: string) => void;
  selectRecentAiQuery: (query: string) => void;
  reuseRecentAiQuery: (query: string) => void;
  showAiSend: boolean;
  showAiClearDraft: boolean;
  showAiClearResult: boolean;
  loadIndex: () => Promise<void>;
  searchParams: URLSearchParams;
  setSearchParams: ReturnType<typeof import('react-router-dom').useSearchParams>[1];
  closePanel: () => void;
};

export type NavbarSearchBarFieldProps = {
  ctx: NavbarSearchContextValue;
};

export type NavbarSearchPanelContentProps = {
  ctx: NavbarSearchContextValue;
};

export type NavbarSearchModePlugin = {
  mode: NavbarSearchMode;
  hasValue: (ctx: NavbarSearchContextValue) => boolean;
  onOpenPanel?: (ctx: NavbarSearchContextValue) => void;
  BarField: React.FC<NavbarSearchBarFieldProps>;
  PanelContent: React.FC<NavbarSearchPanelContentProps>;
};

export type NavbarSearchProps = {
  onPanelOpenChange?: (open: boolean) => void;
  islandRef?: RefObject<HTMLDivElement | null>;
};
