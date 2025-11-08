/**
 * Страница категорий и меток
 */

import { useState, useEffect } from 'react';
import { Layout } from '../components/layout';
import { useSearchNavigation } from '../hooks';
import { Button } from '../components/common';
import { CategorySection, CreateCategoryModal, CreateTagModal } from '../components/tags';
import { getAllCategories, getAllTags, deleteTag, deleteCategory, updateCategory, updateTag } from '../services/db';
import { logDeleteCategory, logRenameCategory, logRenameTag } from '../services/history';
import type { Category, Tag } from '../types';
import './TagsPage.css';

export const TagsPage = () => {
  const { searchProps } = useSearchNavigation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Модальные окна
  const [isCreateCategoryModalOpen, setIsCreateCategoryModalOpen] = useState(false);
  const [isCreateTagModalOpen, setIsCreateTagModalOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

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
      
      // Логируем удаление категории
      await logDeleteCategory(category.name);
      
      await loadData();
    } catch (error) {
      console.error('Ошибка удаления категории:', error);
    }
  };

  const handleAddTag = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setIsCreateTagModalOpen(true);
  };

  const handleCategoryRename = async (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;

    const newName = prompt('Новое название категории:', category.name);
    
    if (!newName || newName.trim() === '' || newName.trim() === category.name) {
      return;
    }

    try {
      const oldName = category.name;
      await updateCategory(categoryId, { name: newName.trim() });
      
      // Логируем переименование
      await logRenameCategory(oldName, newName.trim());
      
      await loadData();
    } catch (error) {
      console.error('Ошибка переименования категории:', error);
    }
  };

  const handleTagRename = async (tagId: string) => {
    const tag = tags.find(t => t.id === tagId);
    if (!tag) return;

    const newName = prompt('Новое название метки:', tag.name);
    
    if (!newName || newName.trim() === '' || newName.trim() === tag.name) {
      return;
    }

    try {
      const oldName = tag.name;
      await updateTag(tagId, { name: newName.trim() });
      
      // Логируем переименование
      await logRenameTag(oldName, newName.trim());
      
      await loadData();
    } catch (error) {
      console.error('Ошибка переименования метки:', error);
    }
  };

  const handleCategoryCreated = () => {
    loadData();
  };

  const handleTagCreated = () => {
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
            size="medium"
            onClick={() => setIsCreateCategoryModalOpen(true)}
          >
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
                onCategoryRename={handleCategoryRename}
                onTagRename={handleTagRename}
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

      {selectedCategoryId && (
        <CreateTagModal
          isOpen={isCreateTagModalOpen}
          categoryId={selectedCategoryId}
          categoryColor={categories.find(c => c.id === selectedCategoryId)?.color}
          onClose={() => {
            setIsCreateTagModalOpen(false);
            setSelectedCategoryId(null);
          }}
          onTagCreated={handleTagCreated}
        />
      )}
    </Layout>
  );
};

export default TagsPage;

