/**
 * Компонент статистики по категориям и меткам
 * Отображает три блока: всего категорий, всего меток, всего используемых меток
 */

import { useEffect, useState, useMemo } from 'react';
import { Icon } from '../common';
import { getAllCategories, getAllTags } from '../../services/db';
import type { Category, Tag } from '../../types';
import './CategoryStats.css';

interface CategoryStatsProps {
  /** Категории для подсчета статистики (опционально, если не переданы - загружаются автоматически) */
  categories?: Category[];
  /** Метки для подсчета статистики (опционально, если не переданы - загружаются автоматически) */
  tags?: Tag[];
}

export const CategoryStats = ({ categories, tags }: CategoryStatsProps = {}) => {
  const [loadedCategories, setLoadedCategories] = useState<Category[]>([]);
  const [loadedTags, setLoadedTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Используем переданные данные или загруженные
  const categoriesData = categories || loadedCategories;
  const tagsData = tags || loadedTags;

  // Вычисляем статистику из данных
  const stats = useMemo(() => {
    const usedTagsCount = tagsData.filter(tag => (tag.cardCount || 0) > 0).length;
    
    return {
      totalCategories: categoriesData.length,
      totalTags: tagsData.length,
      usedTags: usedTagsCount
    };
  }, [categoriesData, tagsData]);

  useEffect(() => {
    // Загружаем данные только если они не переданы через пропсы
    if (!categories || !tags) {
      loadStats();
    } else {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, tags]);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      const [cats, tgs] = await Promise.all([
        getAllCategories(),
        getAllTags()
      ]);
      setLoadedCategories(cats);
      setLoadedTags(tgs);
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Форматирование числа с пробелами для тысяч
  const formatNumber = (num: number): string => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  if (isLoading) {
    return (
      <div className="category-stats">
        <div className="category-stats__card category-stats__card--skeleton" />
        <div className="category-stats__card category-stats__card--skeleton" />
        <div className="category-stats__card category-stats__card--skeleton" />
      </div>
    );
  }

  return (
    <div className="category-stats">
      {/* Блок: Всего категорий */}
      <div className="category-stats__card">
        <div className="category-stats__icon">
          <Icon name="tags" size={24} variant="border" />
        </div>
        <div className="category-stats__content">
          <p className="category-stats__number">{formatNumber(stats.totalCategories)}</p>
          <p className="category-stats__label">Всего категорий</p>
        </div>
      </div>

      {/* Блок: Всего меток */}
      <div className="category-stats__card">
        <div className="category-stats__icon">
          <Icon name="tag" size={24} variant="border" />
        </div>
        <div className="category-stats__content">
          <p className="category-stats__number">{formatNumber(stats.totalTags)}</p>
          <p className="category-stats__label">Всего меток</p>
        </div>
      </div>

      {/* Блок: Всего используемых меток */}
      <div className="category-stats__card">
        <div className="category-stats__icon">
          <Icon name="tag-check" size={24} variant="border" />
        </div>
        <div className="category-stats__content">
          <p className="category-stats__number">{formatNumber(stats.usedTags)}</p>
          <p className="category-stats__label">Всего используемых меток</p>
        </div>
      </div>
    </div>
  );
};

export default CategoryStats;

