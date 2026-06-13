import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ContextMenu, type ContextMenuRow } from '../context-menu';

export default function NavbarMenu() {
  const navigate = useNavigate();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const rows = useMemo<ContextMenuRow[]>(
    () => [
      { type: 'item', key: 'board', label: 'Доска', iconClass: 'arc-icon-whiteboard', onSelect: () => navigate('/board') },
      { type: 'item', key: 'tags', label: 'Категории и метки', iconClass: 'arc-icon-tag', onSelect: () => navigate('/tags') },
      { type: 'item', key: 'stats', label: 'Статистика', iconClass: 'arc-icon-pie-chart', onSelect: () => navigate('/statistics') },
      { type: 'item', key: 'history', label: 'История', iconClass: 'arc-icon-history', onSelect: () => navigate('/history') },
      { type: 'item', key: 'settings', label: 'Настройки', iconClass: 'arc-icon-edit', onSelect: () => navigate('/settings') },
      { type: 'separator', key: 'sep1' },
      { type: 'item', key: 'dup', label: 'Поиск дублей', iconClass: 'arc-icon-copy', onSelect: () => navigate('/duplicates') },
      { type: 'separator', key: 'sep2' },
      { type: 'header', key: 'theme-label', label: 'Оформление' },
      { type: 'item', key: 'theme-light', label: 'Светлая', disabled: true },
      { type: 'item', key: 'theme-dark', label: 'Тёмная', disabled: true },
      { type: 'item', key: 'theme-auto', label: 'Автоматическая', disabled: true },
      { type: 'separator', key: 'sep3' },
      { type: 'item', key: 'onboarding', label: 'Онбординг', onSelect: () => navigate('/onboarding') },
      { type: 'item', key: 'uikit', label: 'UI-Kit', onSelect: () => navigate('/ui-kit') },
      { type: 'separator', key: 'sep4' },
      { type: 'item', key: 'storage', label: 'Хранилище', iconClass: 'arc-icon-hard-drive', onSelect: () => navigate('/storage') }
    ],
    [navigate]
  );

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="btn btn-outline btn-ds btn-l btn-icon-only arc-navbar-no-drag"
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
    </>
  );
}
