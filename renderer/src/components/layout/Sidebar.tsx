/**
 * Компонент Sidebar - боковое меню навигации
 * Закреплено слева, с кнопками разделов и подсказками
 */

import { NavLink } from 'react-router-dom';
import { Icon, type IconName } from '../common';
import './Sidebar.css';

interface SidebarItem {
  id: string;
  label: string;
  path: string;
  icon: IconName;
}

const sidebarItems: SidebarItem[] = [
  {
    id: 'cards',
    label: 'Карточки',
    path: '/',
    icon: 'image'
  },
  {
    id: 'collections',
    label: 'Коллекции',
    path: '/collections',
    icon: 'folder-open'
  },
  {
    id: 'tags',
    label: 'Метки',
    path: '/tags',
    icon: 'tag'
  },
  {
    id: 'moodboard',
    label: 'Мудборд',
    path: '/moodboard',
    icon: 'bookmark'
  },
  {
    id: 'add',
    label: 'Добавить',
    path: '/add',
    icon: 'plus'
  }
];

/**
 * Компонент Sidebar
 */
export const Sidebar = () => {
  return (
    <aside className="sidebar">
      <nav className="sidebar__nav">
        {/* Верхняя группа кнопок */}
        <div className="sidebar__group sidebar__group--top">
          {sidebarItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) =>
                `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
              }
              title={item.label}
            >
              {({ isActive }) => (
                <>
                  <span className="sidebar__icon">
                    <Icon name={item.icon} size={24} variant={isActive ? 'fill' : 'border'} />
                  </span>
                  <span className="sidebar__tooltip">
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>

        {/* Нижняя кнопка (настройки) */}
        <div className="sidebar__group sidebar__group--bottom">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
            }
            title="Настройки"
          >
            {({ isActive }) => (
              <>
                <span className="sidebar__icon">
                  <Icon name="settings" size={24} variant={isActive ? 'fill' : 'border'} />
                </span>
                <span className="sidebar__tooltip">
                  Настройки
                </span>
              </>
            )}
          </NavLink>
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;

