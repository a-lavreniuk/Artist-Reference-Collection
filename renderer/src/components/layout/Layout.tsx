/**
 * Компонент Layout - основной лэйаут приложения
 * Объединяет Sidebar, SearchBar, SectionHeader и основной контент
 */

import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { SearchBar } from './SearchBar';
import type { SectionHeaderProps } from './SectionHeader';
import { SectionHeader } from './SectionHeader';
import './Layout.css';

export interface LayoutProps {
  /** Контент страницы */
  children: ReactNode;
  
  /** Свойства для SectionHeader */
  headerProps?: SectionHeaderProps;
  
  /** Показывать ли поисковую строку */
  showSearch?: boolean;
  
  /** Свойства для SearchBar */
  searchProps?: {
    value?: string;
    onChange?: (value: string) => void;
    selectedTags?: string[];
    onTagsChange?: (tags: string[]) => void;
    onCardClick?: (card: any) => void;
    onSearchAction?: () => void;
  };
}

/**
 * Компонент Layout
 */
export const Layout = ({
  children,
  headerProps,
  showSearch = true,
  searchProps
}: LayoutProps) => {
  return (
    <div className="layout">
      {/* Боковое меню */}
      <Sidebar />

      {/* Основная область */}
      <div className="layout__main">
        {/* Верхняя панель */}
        <div className="layout__header">
          {/* Поисковая строка */}
          {showSearch && (
            <div className="layout__search">
              <SearchBar {...searchProps} />
            </div>
          )}
        </div>

        {/* Меню раздела */}
        {headerProps && (
          <SectionHeader {...headerProps} />
        )}

        {/* Контент страницы */}
        <main className="layout__content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;

