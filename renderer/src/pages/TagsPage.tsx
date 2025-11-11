/**
 * Страница категорий и меток
 */

import { useState, useEffect } from 'react';
import { Layout } from '../components/layout';
import { useSearch } from '../contexts';
import { Button, Icon } from '../components/common';
import { CategorySection, CreateCategoryModal, CategoryStats, EditCategoryModal } from '../components/tags';
import { getAllCategories, getAllTags } from '../services/db';
import type { Category, Tag } from '../types';
import './TagsPage.css';

export const TagsPage = () => {
  const { searchProps } = useSearch();
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Модальные окна
  const [isCreateCategoryModalOpen, setIsCreateCategoryModalOpen] = useState(false);
  const [isEditCategoryModalOpen, setIsEditCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

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

  const handleCategoryClick = (categoryId: string) => {
    setEditingCategoryId(categoryId);
    setIsEditCategoryModalOpen(true);
  };

  const handleCategoryUpdated = () => {
    loadData();
  };

  const handleCategoryDeleted = () => {
    loadData();
  };

  const handleCategoryCreated = () => {
    loadData();
  };


  if (isLoading) {
    return (
      <Layout
        headerProps={{
          title: 'Категории и метки'
        }}
        searchProps={searchProps}
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
          <Button
            variant="primary"
            size="L"
            iconLeft={<Icon name="tag-plus" size={24} variant="border" />}
            onClick={() => setIsCreateCategoryModalOpen(true)}
          >
            Добавить категорию
          </Button>
        )
      }}
      searchProps={searchProps}
    >
      <CategoryStats categories={categories} tags={tags} />
      {categories.length > 0 ? (
        <div className="tags-page">
          {categories.map((category) => {
            const categoryTags = tags.filter(t => t.categoryId === category.id);
            return (
              <CategorySection
                key={category.id}
                category={category}
                tags={categoryTags}
                onCategoryClick={handleCategoryClick}
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
            size="L"
            iconLeft={<Icon name="tag-plus" size={24} variant="border" />}
            onClick={() => setIsCreateCategoryModalOpen(true)}
            style={{ marginTop: '16px' }}
          >
            Создать категорию
          </Button>
        </div>
      )}

      {/* Модальные окна */}
      <CreateCategoryModal
        isOpen={isCreateCategoryModalOpen}
        onClose={() => setIsCreateCategoryModalOpen(false)}
        onCategoryCreated={handleCategoryCreated}
      />

      {editingCategoryId && (
        <EditCategoryModal
          isOpen={isEditCategoryModalOpen}
          category={categories.find(c => c.id === editingCategoryId) || null}
          tags={tags.filter(t => t.categoryId === editingCategoryId)}
          onClose={() => {
            setIsEditCategoryModalOpen(false);
            setEditingCategoryId(null);
          }}
          onCategoryUpdated={handleCategoryUpdated}
          onCategoryDeleted={handleCategoryDeleted}
        />
      )}
    </Layout>
  );
};

export default TagsPage;

