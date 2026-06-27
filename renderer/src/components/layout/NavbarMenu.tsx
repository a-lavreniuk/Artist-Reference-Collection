import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ContextMenu, type ContextMenuRow } from '../context-menu';
import { openBugReportForm } from '../../services/bugReportService';
import { useAppPreferences } from '../../hooks/useAppPreferences';
import { useGridSize, type GridSize } from '../../layout/gridSizePreference';
import type { UiThemePreference } from '../../services/appPreferences';

const GRID_OPTIONS: { key: GridSize; label: string; iconClass: string }[] = [
  { key: 'l', label: 'Большая', iconClass: 'arc-icon-grid-l' },
  { key: 'm', label: 'Средняя', iconClass: 'arc-icon-grid-m' },
  { key: 's', label: 'Маленькая', iconClass: 'arc-icon-grid-s' }
];

export default function NavbarMenu() {
  const navigate = useNavigate();
  const { prefs, ready, update } = useAppPreferences();
  const [gridSize, setGridSize] = useGridSize();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const currentTheme = prefs?.uiTheme ?? 'dark';

  const setTheme = (uiTheme: UiThemePreference) => {
    void update({ uiTheme });
    setOpen(false);
  };

  const rows = useMemo<ContextMenuRow[]>(
    () => [
      { type: 'item', key: 'tags', label: 'Категории и метки', iconClass: 'arc-icon-tag', onSelect: () => navigate('/tags') },
      { type: 'item', key: 'stats', label: 'Статистика', iconClass: 'arc-icon-pie-chart', onSelect: () => navigate('/statistics') },
      { type: 'item', key: 'history', label: 'История', iconClass: 'arc-icon-history', onSelect: () => navigate('/history') },
      { type: 'item', key: 'settings', label: 'Настройки', iconClass: 'arc-icon-edit', onSelect: () => navigate('/settings/general') },
      { type: 'separator', key: 'sep1' },
      { type: 'item', key: 'dup', label: 'Поиск дублей — в разработке', iconClass: 'arc-icon-copy', onSelect: () => navigate('/duplicates') },
      { type: 'separator', key: 'sep-grid' },
      { type: 'header', key: 'grid-size-title', label: 'Размер сетки' },
      ...GRID_OPTIONS.map((opt) => ({
        type: 'item' as const,
        key: `grid-${opt.key}`,
        label: opt.label,
        iconClass: opt.iconClass,
        selected: gridSize === opt.key,
        onSelect: () => setGridSize(opt.key)
      })),
      { type: 'separator', key: 'sep2' },
      { type: 'header', key: 'theme-label', label: 'Оформление' },
      {
        type: 'item',
        key: 'theme-light',
        label: 'Светлая',
        disabled: !ready,
        selected: currentTheme === 'light',
        onSelect: () => setTheme('light')
      },
      {
        type: 'item',
        key: 'theme-dark',
        label: 'Тёмная',
        disabled: !ready,
        selected: currentTheme === 'dark',
        onSelect: () => setTheme('dark')
      },
      {
        type: 'item',
        key: 'theme-auto',
        label: 'Автоматическая',
        disabled: !ready,
        selected: currentTheme === 'system',
        onSelect: () => setTheme('system')
      },
      { type: 'separator', key: 'sep3' },
      { type: 'item', key: 'feedback', label: 'Сообщить о проблеме', iconClass: 'arc-icon-bug-s', onSelect: () => { setOpen(false); void openBugReportForm(); } },
      { type: 'item', key: 'uikit', label: 'UI-Kit', onSelect: () => navigate('/ui-kit') }
    ],
    [gridSize, navigate, ready, currentTheme, setGridSize]
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
