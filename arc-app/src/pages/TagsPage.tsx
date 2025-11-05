/**
 * Страница категорий и меток
 */

import { useState, useEffect } from 'react';
import { Layout } from '../components/layout';
import { Button } from '../components/common';
import { CategorySection } from '../components/tags';
import { getAllCategories, getAllTags, deleteTag, deleteCategory } from '../services/db';
import type { Category, Tag } from '../types';
import './TagsPage.css';

export const TagsPage = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Загрузка категорий и меток
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [allCategories, allTags] = await Promise.all([
        getAllCategories(),
        getAllTags()
      ]);
      setCategories(allCategories);
      setTags(allTags);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTagRemove = async (tagId: string) => {
    const tag = tags.find(t => t.id === tagId);
    if (!tag) return;

    if (!confirm(`Удалить метку "${tag.name}"? Это действие необратимо.`)) {
      return;
    }

    try {
      await deleteTag(tagId);
      await loadData();
    } catch (error) {
      console.error('Ошибка удаления метки:', error);
    }
  };

  const handleCategoryDelete = async (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;

    if (!confirm(`Удалить категорию "${category.name}" и все метки в ней? Это действие необратимо.`)) {
      return;
    }

    try {
      await deleteCategory(categoryId);
      await loadData();
    } catch (error) {
      console.error('Ошибка удаления категории:', error);
    }
  };

  const handleAddTag = (categoryId: string) => {
    console.log('Добавление метки в категорию:', categoryId);
    // Здесь будет модальное окно создания метки
  };

  if (isLoading) {
    return (
      <Layout
        headerProps={{
          title: 'Категории и метки'
        }}
        showSearch={false}
      >
        <div className="layout__loading">
          <div className="layout__spinner" />
          <p className="layout__loading-text">Загрузка категорий и меток...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      headerProps={{
        title: 'Категории и метки',
        actions: (
          <Button variant="primary" size="medium">
            Добавить категорию
          </Button>
        )
      }}
      showSearch={false}
    >
      {categories.length > 0 ? (
        <div className="tags-page">
          {categories.map((category) => {
            const categoryTags = tags.filter(t => t.categoryId === category.id);
            return (
              <CategorySection
                key={category.id}
                category={category}
                tags={categoryTags}
                onTagRemove={handleTagRemove}
                onCategoryDelete={handleCategoryDelete}
                onAddTag={handleAddTag}
              />
            );
          })}
        </div>
      ) : (
        <div className="layout__empty-state">
          <h3 className="layout__empty-title">Категорий и меток пока нет</h3>
          <p className="layout__empty-text text-m">
            Создайте первую категорию и добавьте метки для организации карточек
          </p>
          <Button
            variant="primary"
            size="large"
            style={{ marginTop: '16px' }}
          >
            Создать категорию
          </Button>
        </div>
      )}
    </Layout>
  );
};

export default TagsPage;

