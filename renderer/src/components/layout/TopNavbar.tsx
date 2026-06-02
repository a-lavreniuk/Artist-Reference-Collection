import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  addCategory,
  ARC_CARDS_CHANGED_EVENT,
  ARC_COLLECTIONS_CHANGED_EVENT,
  getNavbarMetrics,
  notifyCategoriesChanged,
  type NavbarMetrics
} from '../../services/db';
import {
  ARC_ADD_CARDS_QUEUE_STATE_EVENT,
  ARC_ADD_CARDS_SUBMIT_REQUEST,
  getLastAddCardsQueueState,
  ARC_EDIT_CARD_SUBMIT_REQUEST,
  ARC_COLLECTIONS_ADD_REQUEST,
  ARC_NAVBAR_COLLECTION_TITLE_EVENT,
  ARC_RENAME_COLLECTION_REQUEST
} from './navbarEvents';
import { hydrateArcNavbarIcons } from './navbarIconHydrate';
import NewCategoryModal from './NewCategoryModal';
import NavbarSearch, { formatNavbarTabCount } from './NavbarSearch';
import {
  parseUiKitElevation,
  parseUiKitSize,
  type UiKitElevationTab,
  type UiKitSizeTab,
  UI_KIT_URL
} from '../../ui-kit/uiKitToolbarSearch';

type MainSectionKey = 'gallery' | 'onboarding' | 'tags' | 'collections' | 'moodboard' | 'settings' | 'uiKit';
type ActiveView = MainSectionKey | 'add' | 'collectionDetail' | 'editCardDetail';

type TabItem = {
  key: string;
  label: string;
  count?: number;
  iconClass: string;
};

const MAIN_TABS: Array<{ key: MainSectionKey; label: string; path: string }> = [
  { key: 'gallery', label: 'Галерея', path: '/gallery' },
  { key: 'onboarding', label: 'Онбординг', path: '/onboarding' },
  { key: 'tags', label: 'Метки', path: '/tags' },
  { key: 'collections', label: 'Коллекции', path: '/collections' },
  { key: 'moodboard', label: 'Мудборд', path: '/moodboard' },
  { key: 'settings', label: 'Настройки', path: '/settings' },
  { key: 'uiKit', label: 'UI-Kit', path: '/ui-kit' }
];

const DEFAULT_METRICS: NavbarMetrics = {
  totalCards: 0,
  imageCards: 0,
  videoCards: 0,
  totalCollections: 0,
  moodboardCards: 0,
  totalCategories: 0
};

export default function TopNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const headerRef = useRef<HTMLElement>(null);

  const [metrics, setMetrics] = useState<NavbarMetrics>(DEFAULT_METRICS);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [collectionDetailTitle, setCollectionDetailTitle] = useState('');
  const [addQueueHasItems, setAddQueueHasItems] = useState(false);
  const [addQueueCount, setAddQueueCount] = useState(0);
  const [maintenanceLocked, setMaintenanceLocked] = useState(false);

  const galleryFilter = searchParams.get('gf') ?? 'all';
  const moodboardFilter = searchParams.get('mf') ?? 'cards';
  const settingsFilter = searchParams.get('sf') ?? 'storage';

  const setGalleryFilter = (key: string) => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (key === 'all') n.delete('gf');
        else n.set('gf', key);
        return n;
      },
      { replace: true }
    );
  };

  const setMoodboardFilter = (key: string) => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.set('mf', key);
        return n;
      },
      { replace: true }
    );
  };

  const setSettingsFilter = (key: string) => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.set('sf', key);
        return n;
      },
      { replace: true }
    );
  };

  const uiKitElev = parseUiKitElevation(searchParams.get(UI_KIT_URL.elevation));
  const uiKitSize = parseUiKitSize(searchParams.get(UI_KIT_URL.size));

  const setUiKitElevParam = (v: UiKitElevationTab) => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (v === 'default') n.delete(UI_KIT_URL.elevation);
        else n.set(UI_KIT_URL.elevation, v);
        return n;
      },
      { replace: true }
    );
  };

  const setUiKitSizeParam = (v: UiKitSizeTab) => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (v === 'm') n.delete(UI_KIT_URL.size);
        else n.set(UI_KIT_URL.size, v);
        return n;
      },
      { replace: true }
    );
  };

  const activeView = useMemo<ActiveView>(() => {
    const path = location.pathname;
    if (path === '/add') return 'add';
    if (/^\/collections\/[^/]+$/.test(path)) return 'collectionDetail';
    if (/^\/gallery\/[^/]+\/edit$/.test(path)) return 'editCardDetail';
    if (path.startsWith('/onboarding')) return 'onboarding';
    if (path.startsWith('/tags')) return 'tags';
    if (path.startsWith('/collections')) return 'collections';
    if (path.startsWith('/moodboard')) return 'moodboard';
    if (path.startsWith('/settings')) return 'settings';
    if (path.startsWith('/ui-kit')) return 'uiKit';
    return 'gallery';
  }, [location.pathname]);

  const activeMainTab: MainSectionKey =
    activeView === 'collectionDetail'
      ? 'collections'
      : activeView === 'editCardDetail' || activeView === 'add'
        ? 'gallery'
        : activeView;

  useEffect(() => {
    void refreshMetrics();
    const onMetrics = () => void refreshMetrics();
    window.addEventListener(ARC_CARDS_CHANGED_EVENT, onMetrics);
    window.addEventListener(ARC_COLLECTIONS_CHANGED_EVENT, onMetrics);
    window.addEventListener('arc:library-changed', onMetrics);
    return () => {
      window.removeEventListener(ARC_CARDS_CHANGED_EVENT, onMetrics);
      window.removeEventListener(ARC_COLLECTIONS_CHANGED_EVENT, onMetrics);
      window.removeEventListener('arc:library-changed', onMetrics);
    };
  }, []);

  useEffect(() => {
    if (!window.arc?.onMaintenance) return undefined;
    return window.arc.onMaintenance((v) => setMaintenanceLocked(v));
  }, []);

  useEffect(() => {
    const fn = (e: Event) => {
      const ce = e as CustomEvent<{ title?: string }>;
      setCollectionDetailTitle(typeof ce.detail?.title === 'string' ? ce.detail.title : '');
    };
    window.addEventListener(ARC_NAVBAR_COLLECTION_TITLE_EVENT, fn);
    return () => window.removeEventListener(ARC_NAVBAR_COLLECTION_TITLE_EVENT, fn);
  }, []);

  useEffect(() => {
    const apply = (detail: { hasItems?: boolean; count?: number }) => {
      setAddQueueHasItems(Boolean(detail.hasItems));
      setAddQueueCount(typeof detail.count === 'number' ? detail.count : 0);
    };
    apply(getLastAddCardsQueueState());
    const onQueueState = (event: Event) => {
      const ce = event as CustomEvent<{ hasItems?: boolean; count?: number }>;
      apply(ce.detail ?? {});
    };
    window.addEventListener(ARC_ADD_CARDS_QUEUE_STATE_EVENT, onQueueState);
    return () => window.removeEventListener(ARC_ADD_CARDS_QUEUE_STATE_EVENT, onQueueState);
  }, []);

  useEffect(() => {
    if (activeView !== 'add') {
      setAddQueueHasItems(false);
      setAddQueueCount(0);
    }
  }, [activeView]);

  useEffect(() => {
    if (!showAddCategoryModal) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowAddCategoryModal(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showAddCategoryModal]);

  const refreshMetrics = async () => {
    const nextMetrics = await getNavbarMetrics();
    setMetrics(nextMetrics);
  };

  const galleryTabs: TabItem[] = [
    { key: 'all', label: 'Все карточки', count: metrics.totalCards, iconClass: 'arc-icon-images' },
    { key: 'images', label: 'Изображения', count: metrics.imageCards, iconClass: 'arc-icon-image' },
    { key: 'videos', label: 'Видео', count: metrics.videoCards, iconClass: 'arc-icon-play' }
  ];

  const moodboardTabs: TabItem[] = [
    { key: 'cards', label: 'Карточки', count: metrics.moodboardCards, iconClass: 'arc-icon-images' },
    { key: 'board', label: 'Доска', iconClass: 'arc-icon-whiteboard' }
  ];

  const settingsTabs: TabItem[] = [
    { key: 'storage', label: 'Хранилище', iconClass: 'arc-icon-hard-drive' },
    { key: 'statistics', label: 'Статистика', iconClass: 'arc-icon-pie-chart' },
    { key: 'history', label: 'История', iconClass: 'arc-icon-history' },
    { key: 'duplicates', label: 'Поиск дублей', iconClass: 'arc-icon-copy' }
  ];

  const title = getTitle(activeView, collectionDetailTitle);

  const handleMainTabClick = (path: string) => {
    if (maintenanceLocked) return;
    navigate(path);
  };

  const openAddCategoryModal = () => {
    setShowAddCategoryModal(true);
  };

  useLayoutEffect(() => {
    if (headerRef.current) {
      void hydrateArcNavbarIcons(headerRef.current);
    }
  }, [
    activeView,
    activeMainTab,
    galleryFilter,
    moodboardFilter,
    settingsFilter,
    searchParams,
    metrics,
    showAddCategoryModal,
    uiKitElev,
    uiKitSize,
    collectionDetailTitle,
    maintenanceLocked
  ]);

  const requestCollectionsAdd = () => {
    window.dispatchEvent(new CustomEvent(ARC_COLLECTIONS_ADD_REQUEST));
  };

  const requestAddCardsSubmit = () => {
    window.dispatchEvent(new CustomEvent(ARC_ADD_CARDS_SUBMIT_REQUEST));
  };

  const requestEditCardSubmit = () => {
    window.dispatchEvent(new CustomEvent(ARC_EDIT_CARD_SUBMIT_REQUEST));
  };

  return (
    <>
      <header
        ref={headerRef}
        className="arc-navbar panel elevation-default"
        data-elevation="default"
        data-navbar-elevation="default"
      >
        <div className="arc-navbar-row">
          <div className="arc-navbar-group">
            <div className="tabs arc-navbar-main-tabs" role="tablist" aria-label="Основная навигация">
              {MAIN_TABS.map((tab) => {
                const isActive = tab.key === activeMainTab;
                return (
                  <button
                    key={tab.key}
                    className={`tab-button${isActive ? ' is-active' : ''}`}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    disabled={maintenanceLocked}
                    onClick={() => handleMainTabClick(tab.path)}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="arc-navbar-group arc-navbar-group--grow">
            <NavbarSearch />
          </div>

          <div className="arc-navbar-group">
            <button
              className="btn btn-brand btn-ds arc-navbar-add"
              type="button"
              disabled={maintenanceLocked}
              onClick={() => {
                if (maintenanceLocked) return;
                navigate('/add');
              }}
            >
              <span className="btn-ds__value">Добавить карточки</span>
              <span className="btn-ds__icon arc-icon-plus" aria-hidden="true"></span>
            </button>
          </div>
        </div>

        <div
          className={
            activeView === 'collectionDetail'
              ? 'arc-navbar-row arc-navbar-row--collection-detail'
              : 'arc-navbar-row'
          }
        >
          {activeView === 'collectionDetail' ? (
            <>
              <button
                type="button"
                className="btn btn-outline btn-ds btn-icon-only"
                aria-label="Назад к списку коллекций"
                onClick={() => navigate('/collections')}
              >
                <span className="btn-icon-only__glyph arc-icon-undo" aria-hidden="true" />
              </button>
              <div className="arc-navbar-collection-heading">
                <h1 className="h1 arc-navbar-title arc-navbar-title--collection">{title}</h1>
                <button
                  type="button"
                  className="btn btn-ghost btn-ds btn-icon-only arc-navbar-collection-rename"
                  aria-label="Изменить название коллекции"
                  onClick={() => window.dispatchEvent(new CustomEvent(ARC_RENAME_COLLECTION_REQUEST))}
                >
                  <span className="btn-icon-only__glyph arc-icon-edit" aria-hidden="true" />
                </button>
              </div>
            </>
          ) : activeView !== 'editCardDetail' ? (
            <h1 className="h1 arc-navbar-title">{title}</h1>
          ) : null}
          {activeView === 'collectionDetail' ? (
            <div className="arc-navbar-collection-row-spacer" aria-hidden="true" />
          ) : null}
          <div className="arc-navbar-secondary-actions">
            {activeView === 'uiKit' && (
              <UiKitNavbarToolbar
                elevation={uiKitElev}
                size={uiKitSize}
                onElevationChange={setUiKitElevParam}
                onSizeChange={setUiKitSizeParam}
              />
            )}
            {activeView === 'gallery' && (
              <FilterTabs
                ariaLabel="Фильтрация карточек"
                items={galleryTabs}
                activeKey={galleryFilter}
                onChange={setGalleryFilter}
                disabled={maintenanceLocked}
              />
            )}
            {activeView === 'tags' && (
              <button
                className="btn btn-secondary btn-ds"
                type="button"
                disabled={maintenanceLocked}
                onClick={openAddCategoryModal}
              >
                <span className="btn-ds__value">Добавить категорию</span>
                <span className="btn-ds__icon arc-icon-plus" aria-hidden="true"></span>
              </button>
            )}
            {activeView === 'collections' && (
              <button
                className="btn btn-secondary btn-ds"
                type="button"
                disabled={maintenanceLocked}
                onClick={requestCollectionsAdd}
              >
                <span className="btn-ds__value">Добавить коллекцию</span>
                <span className="btn-ds__icon arc-icon-plus" aria-hidden="true"></span>
              </button>
            )}
            {activeView === 'moodboard' && (
              <FilterTabs
                ariaLabel="Фильтрация мудборда"
                items={moodboardTabs}
                activeKey={moodboardFilter}
                onChange={setMoodboardFilter}
                disabled={maintenanceLocked}
              />
            )}
            {activeView === 'settings' && (
              <FilterTabs
                ariaLabel="Разделы настроек"
                items={settingsTabs}
                activeKey={settingsFilter}
                onChange={setSettingsFilter}
              />
            )}
            {activeView === 'add' && addQueueHasItems && (
              <div className="arc-navbar-action-group">
                <button className="btn btn-outline btn-ds" type="button" onClick={() => navigate('/gallery')}>
                  <span className="btn-ds__value">Отмена</span>
                </button>
                <button
                  className="btn btn-success btn-ds arc-navbar-add-submit"
                  type="button"
                  onClick={requestAddCardsSubmit}
                  aria-label={`Добавить ${addQueueCount} карточек`}
                >
                  <span className="btn-ds__value">Добавить</span>
                  <span className="btn-ds__counter">{addQueueCount}</span>
                  <span className="btn-ds__icon arc-navbar-add-submit-plus" aria-hidden="true"></span>
                </button>
              </div>
            )}
            {activeView === 'collectionDetail' && (
              <div className="arc-navbar-collection-detail">
                <FilterTabs
                  ariaLabel="Фильтрация карточек коллекции"
                  items={galleryTabs}
                  activeKey={galleryFilter}
                  onChange={setGalleryFilter}
                  disabled={maintenanceLocked}
                />
              </div>
            )}
            {activeView === 'editCardDetail' && (
              <div className="arc-navbar-edit-detail">
                <h1 className="h1 arc-navbar-title">Изменить карточку</h1>
                <div className="arc-navbar-action-group">
                  <button className="btn btn-outline btn-ds" type="button" onClick={() => navigate('/gallery')}>
                    <span className="btn-ds__value">Отмена</span>
                  </button>
                  <button className="btn btn-success btn-ds" type="button" onClick={requestEditCardSubmit}>
                    <span className="btn-ds__value">Сохранить изменения</span>
                    <span className="btn-ds__icon arc-icon-save" aria-hidden="true"></span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {showAddCategoryModal ? (
        <NewCategoryModal
          onClose={() => setShowAddCategoryModal(false)}
          onSubmit={async (name, colorHex) => {
            await addCategory(name, colorHex);
            notifyCategoriesChanged();
            await refreshMetrics();
          }}
        />
      ) : null}
    </>
  );
}

function UiKitNavbarToolbar({
  elevation,
  size,
  onElevationChange,
  onSizeChange
}: {
  elevation: UiKitElevationTab;
  size: UiKitSizeTab;
  onElevationChange: (v: UiKitElevationTab) => void;
  onSizeChange: (v: UiKitSizeTab) => void;
}) {
  const elevOptions: Array<{ key: UiKitElevationTab; label: string }> = [
    { key: 'sunken', label: 'Sunken' },
    { key: 'default', label: 'Default' },
    { key: 'raised', label: 'Raised' }
  ];
  const sizeOptions: Array<{ key: UiKitSizeTab; label: string }> = [
    { key: 'l', label: 'L' },
    { key: 'm', label: 'M' },
    { key: 's', label: 'S' }
  ];

  return (
    <div className="arc-navbar-ui-kit-controls">
      <div className="control-group">
        <div className="tabs arc-navbar-ui-kit-tabs" role="tablist" aria-label="Elevation">
          {elevOptions.map((opt) => {
            const isActive = opt.key === elevation;
            return (
              <button
                key={opt.key}
                type="button"
                role="tab"
                className={`tab-button${isActive ? ' is-active' : ''}`}
                aria-selected={isActive}
                onClick={() => onElevationChange(opt.key)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="control-group">
        <div className="tabs arc-navbar-ui-kit-tabs" role="tablist" aria-label="Глобальный размер">
          {sizeOptions.map((opt) => {
            const isActive = opt.key === size;
            return (
              <button
                key={opt.key}
                type="button"
                role="tab"
                className={`tab-button${isActive ? ' is-active' : ''}`}
                aria-selected={isActive}
                onClick={() => onSizeChange(opt.key)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FilterTabs({
  ariaLabel,
  items,
  activeKey,
  onChange,
  disabled = false
}: {
  ariaLabel: string;
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="tabs arc-navbar-filters" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const isActive = item.key === activeKey;
        return (
          <button
            key={item.key}
            className={`tab-button${isActive ? ' is-active' : ''}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              onChange(item.key);
            }}
          >
            <span className={`tab-icon ${item.iconClass}`} aria-hidden="true"></span>
            <span>{item.label}</span>
            {typeof item.count === 'number' && item.count > 0 ? (
              <span className="tab-counter">{formatNavbarTabCount(item.count)}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function getTitle(activeView: ActiveView, collectionTitle: string): string {
  switch (activeView) {
    case 'gallery':
      return 'Карточки';
    case 'onboarding':
      return 'Онбординг';
    case 'tags':
      return 'Категории и метки';
    case 'collections':
      return 'Коллекции';
    case 'moodboard':
      return 'Мудборд';
    case 'settings':
      return 'Настройки';
    case 'uiKit':
      return 'UI-Kit';
    case 'add':
      return 'Добавить карточки';
    case 'collectionDetail':
      return collectionTitle ? collectionTitle : 'Коллекция';
    case 'editCardDetail':
      return 'Изменить карточку';
    default:
      return 'Карточки';
  }
}
