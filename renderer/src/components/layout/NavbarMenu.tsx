import { useMemo, useRef, useState } from 'react';
import { ContextMenu, type ContextMenuRow } from '../context-menu';
import { useNavigateToAppSection } from '../../search/openCardUrl';
import { openBugReportForm } from '../../services/bugReportService';
import { useAppPreferences } from '../../hooks/useAppPreferences';
import type { UiThemePreference } from '../../services/appPreferences';
import { useGlobalTrashCardCount, useNavigateToTrashGallery } from '../gallery/GalleryTrashToolbar';

export default function NavbarMenu() {
  const navigateToSection = useNavigateToAppSection();
  const { prefs, ready, update } = useAppPreferences();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const currentTheme = prefs?.uiTheme ?? 'dark';
  const trashCount = useGlobalTrashCardCount();
  const navigateToTrash = useNavigateToTrashGallery();

  const setTheme = (uiTheme: UiThemePreference) => {
    void update({ uiTheme });
    setOpen(false);
  };

  const rows = useMemo<ContextMenuRow[]>(
    () => [
      { type: 'item', key: 'tags', label: 'Категории и метки', iconClass: 'arc-icon-tag', onSelect: () => navigateToSection('/tags') },
      { type: 'item', key: 'stats', label: 'Статистика', iconClass: 'arc-icon-pie-chart', onSelect: () => navigateToSection('/statistics') },
      { type: 'item', key: 'history', label: 'История', iconClass: 'arc-icon-history', onSelect: () => navigateToSection('/history') },
      { type: 'item', key: 'settings', label: 'Настройки', iconClass: 'arc-icon-edit', onSelect: () => navigateToSection('/settings/general') },
      { type: 'separator', key: 'sep1' },
      { type: 'item', key: 'dup', label: 'Поиск дублей', iconClass: 'arc-icon-copy', onSelect: () => navigateToSection('/duplicates') },
      {
        type: 'item',
        key: 'trash',
        label: 'Корзина',
        iconClass: 'arc-icon-trash',
        counter: trashCount > 0 ? trashCount : undefined,
        onSelect: () => {
          setOpen(false);
          navigateToTrash();
        }
      },
      { type: 'separator', key: 'sep2' },
      { type: 'header', key: 'theme-label', label: 'Оформление' },
      {
        type: 'item',
        key: 'theme-dark',
        label: 'Тёмное',
        iconClass: 'arc-icon-moon',
        disabled: !ready,
        selected: currentTheme === 'dark',
        onSelect: () => setTheme('dark')
      },
      {
        type: 'item',
        key: 'theme-light',
        label: 'Светлое',
        iconClass: 'arc-icon-sun-medium',
        disabled: !ready,
        selected: currentTheme === 'light',
        onSelect: () => setTheme('light')
      },
      {
        type: 'item',
        key: 'theme-auto',
        label: 'Как в системе',
        iconClass: 'arc-icon-contrast',
        disabled: !ready,
        selected: currentTheme === 'system',
        onSelect: () => setTheme('system')
      },
      { type: 'separator', key: 'sep3' },
      { type: 'item', key: 'feedback', label: 'Сообщить о проблеме', iconClass: 'arc-icon-bug-s', onSelect: () => { setOpen(false); void openBugReportForm(); } },
      { type: 'item', key: 'uikit', label: 'UI-Kit', onSelect: () => navigateToSection('/ui-kit') }
    ],
    [navigateToSection, navigateToTrash, ready, currentTheme, trashCount]
  );

  return (
    <span className="arc-navbar-island-action">
      <button
        ref={anchorRef}
        type="button"
        className={`btn btn-ghost btn-ds btn-m btn-icon-only arc-navbar-no-drag${open ? ' is-active' : ''}`}
        aria-label="Меню"
        aria-expanded={open}
        aria-haspopup="menu"
        data-interface-tour-anchor="navbar-menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="btn-icon-only__glyph arc-icon-menu" aria-hidden="true" />
      </button>
      <ContextMenu
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        rows={rows}
        ariaLabel="Дополнительные разделы"
        noDragClassName="arc-navbar-no-drag"
      />
    </span>
  );
}
