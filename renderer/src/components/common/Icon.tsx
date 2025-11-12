/**
 * Компонент Icon - централизованная система иконок
 * Загружает SVG из файлов и автоматически применяет currentColor
 */

import React from 'react';
import type { SVGProps } from 'react';
import './Icon.css';

// Тип иконки (название)
export type IconName =
  | 'folder-open'
  | 'folder'
  | 'folder-plus'
  | 'folder-input'
  | 'folder-output'
  | 'grid-small'
  | 'grid'
  | 'grid-default'
  | 'trash'
  | 'line-chart'
  | 'trending-up'
  | 'trending-down'
  | 'copy'
  | 'history'
  | 'server'
  | 'hard-drive'
  | 'bookmark-plus'
  | 'bookmark'
  | 'bookmark-minus'
  | 'save'
  | 'eye'
  | 'tag'
  | 'tags'
  | 'tag-check'
  | 'tag-plus'
  | 'image'
  | 'images'
  | 'play-circle'
  | 'play'
  | 'import'
  | 'check'
  | 'file-search'
  | 'file-check'
  | 'pencil'
  | 'settings'
  | 'plus'
  | 'x'
  | 'download'
  | 'arrow-left'
  | 'search';

// Размер иконки
export type IconSize = 16 | 24;

// Вариант иконки (стиль)
export type IconVariant = 'border' | 'fill';

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  /** Название иконки */
  name: IconName;
  /** Размер иконки */
  size?: IconSize;
  /** Вариант иконки (border = stroke, fill = filled) */
  variant?: IconVariant;
  /** CSS класс */
  className?: string;
}

// Динамический импорт всех SVG
const iconModules = import.meta.glob('../../assets/icons/*.svg', { 
  query: '?raw',
  import: 'default'
});

// Кэш загруженных иконок
const iconCache = new Map<string, string>();

/**
 * Встроенные SVG для иконок, которых нет в файлах
 * (Оставьте пустым если все иконки загружаются из файлов)
 */
const inlineSvgs: Record<string, string> = {
  // Все иконки теперь загружаются из файлов
};

/**
 * Загрузка SVG контента из файла
 */
async function loadIcon(name: string, size: number, variant: IconVariant): Promise<string> {
  // Специальные названия для некоторых иконок
  const nameMap: Record<string, string> = {
    'trash-16-fill': 'trash-3-16-fill',
    'trash-24-fill': 'trash-3-24-fill',
    'trash-16-border': 'trash--16-border', // двойной дефис в файле
    'grid-16-fill': 'grid-2-16-fill',
    'grid-24-fill': 'grid-2-24-fill',
  };
  
  const key = `${name}-${size}-${variant}`;
  const mappedKey = nameMap[key] || key;
  
  // Проверяем встроенные SVG
  if (inlineSvgs[mappedKey]) {
    return inlineSvgs[mappedKey];
  }
  
  // Проверяем кэш
  if (iconCache.has(mappedKey)) {
    return iconCache.get(mappedKey)!;
  }
  
  // Путь к файлу
  const filePath = `../../assets/icons/${mappedKey}.svg`;
  
  try {
    const loader = iconModules[filePath];
    if (!loader) {
      console.error(`[Icon] Не найден файл: ${filePath}`);
      return '';
    }
    
    let svgContent = await loader() as string;
    
    // Заменяем черный цвет на currentColor для правильного наследования
    svgContent = svgContent
      .replace(/stroke="black"/g, 'stroke="currentColor"')
      .replace(/fill="black"/g, 'fill="currentColor"')
      .replace(/stroke="#000000"/gi, 'stroke="currentColor"')
      .replace(/fill="#000000"/gi, 'fill="currentColor"')
      .replace(/stroke="#000"/gi, 'stroke="currentColor"')
      .replace(/fill="#000"/gi, 'fill="currentColor"');
    
    // Кэшируем результат
    iconCache.set(mappedKey, svgContent);
    
    return svgContent;
  } catch (error) {
    console.error(`[Icon] Ошибка загрузки иконки ${mappedKey}:`, error);
    return '';
  }
}

/**
 * Компонент Icon
 */
export const Icon = ({
  name,
  size = 24,
  variant = 'border',
  className = '',
  style,
  ...props
}: IconProps) => {
  const [svgContent, setSvgContent] = React.useState<string>('');
  
  React.useEffect(() => {
    loadIcon(name, size, variant).then(setSvgContent);
  }, [name, size, variant]);
  
  const classNames = [
    'icon',
    `icon--${size}`,
    `icon--${variant}`,
    className
  ].filter(Boolean).join(' ');

  if (!svgContent) {
    // Заглушка пока иконка загружается
    return (
      <span 
        className={classNames} 
        style={{ 
          display: 'inline-block', 
          width: size, 
          height: size,
          ...style 
        }} 
      />
    );
  }

  return (
    <span
      className={classNames}
      style={style}
      dangerouslySetInnerHTML={{ __html: svgContent }}
      {...(props as any)}
    />
  );
};

export default Icon;
