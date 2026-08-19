import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ContextMenuSeparator } from '../context-menu';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import SettingsSidebarNavItem from './SettingsSidebarNavItem';

const PRODUCT_SECTIONS = [
  { key: 'general', to: '/settings/general', label: 'Общие', iconClass: 'arc-icon-options' },
  {
    key: 'detail-template',
    to: '/settings/detail-template',
    label: 'Шаблон деталки',
    iconClass: 'arc-icon-layout-template'
  },
  { key: 'screenshots', to: '/settings/screenshots', label: 'Скриншоты', iconClass: 'arc-icon-screenshot' },
  { key: 'notifications', to: '/settings/notifications', label: 'Уведомления', iconClass: 'arc-icon-notifications' },
  { key: 'shortcuts', to: '/settings/shortcuts', label: 'Горячие клавиши', iconClass: 'arc-icon-keyboard' }
] as const;

const LIBRARY_SECTIONS = [
  { key: 'library', to: '/settings/library', label: 'Библиотека', iconClass: 'arc-icon-folder' }
] as const;

const ADVANCED_SECTIONS = [
  { key: 'auto-import', to: '/settings/auto-import', label: 'Автоимпорт', iconClass: 'arc-icon-autoimport' },
  {
    key: 'browser-extension',
    to: '/settings/browser-extension',
    label: 'Расширение браузера',
    iconClass: 'arc-icon-browser'
  },
  {
    key: 'mcp-server',
    to: '/settings/mcp-server',
    label: 'MCP сервер',
    iconClass: 'arc-icon-server'
  },
  { key: 'ai', to: '/settings/ai', label: 'AI', iconClass: 'arc-icon-ai' }
] as const;

const UPDATES_SECTION = {
  key: 'updates',
  to: '/settings/updates',
  label: 'Обновления',
  iconClass: 'arc-icon-update'
} as const;

export default function SettingsPageSidebar() {
  const rootRef = useRef<HTMLElement>(null);
  const location = useLocation();

  useLayoutEffect(() => {
    if (rootRef.current) {
      void hydrateArcNavbarIcons(rootRef.current);
    }
  }, [location.pathname]);

  return (
    <aside
      ref={rootRef}
      className="arc-settings-page-sidebar context-menu context-menu--static panel elevation-sunken arc-ui-kit-scope"
      data-elevation="sunken"
      data-typo-tone="white"
      data-btn-size="m"
      role="menu"
      aria-label="Разделы настроек"
    >
      <div className="arc-settings-page-sidebar__scroll context-menu__list">
        <div className="arc-settings-page-sidebar__pad arc-settings-page-sidebar__pad--head">
          {PRODUCT_SECTIONS.map((item) => (
            <SettingsSidebarNavItem key={item.key} to={item.to} label={item.label} iconClass={item.iconClass} />
          ))}
        </div>

        <ContextMenuSeparator />

        <div className="arc-settings-page-sidebar__pad">
          {LIBRARY_SECTIONS.map((item) => (
            <SettingsSidebarNavItem key={item.key} to={item.to} label={item.label} iconClass={item.iconClass} />
          ))}
        </div>

        <ContextMenuSeparator />

        <div className="arc-settings-page-sidebar__pad">
          {ADVANCED_SECTIONS.map((item) => (
            <SettingsSidebarNavItem key={item.key} to={item.to} label={item.label} iconClass={item.iconClass} />
          ))}
        </div>

        <ContextMenuSeparator />

        <div className="arc-settings-page-sidebar__pad">
          <SettingsSidebarNavItem
            to={UPDATES_SECTION.to}
            label={UPDATES_SECTION.label}
            iconClass={UPDATES_SECTION.iconClass}
          />
        </div>
      </div>
    </aside>
  );
}
