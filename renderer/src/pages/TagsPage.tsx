/**
 * Страница категорий и меток
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout';
import { useSearch } from '../contexts';
import { Button, Icon } from '../components/common';
import { CategorySection, CreateCategoryModal, CategoryStats, EditCategoryModal } from '../components/tags';
import { getAllCategories, getAllTags, updateCategory, moveTagToCategory } from '../services/db';
import { useToast } from '../hooks/useToast';
import { useAlert } from '../hooks/useAlert';
import type { Category, Tag } from '../types';
import './TagsPage.css';

export const TagsPage = () => {
  const navigate = useNavigate();
  const { searchProps, setSelectedTags } = useSearch();
  const toast = useToast();
  const alert = useAlert();
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Модальные окна
  const [isCreateCategoryModalOpen, setIsCreateCategoryModalOpen] = useState(false);
  const [isEditCategoryModalOpen, setIsEditCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  
  // Состояние для drag-and-drop меток
  const [draggingTagId, setDraggingTagId] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);

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

  const handleMoveCategoryUp = async (categoryId: string) => {
    const currentIndex = categories.findIndex(c => c.id === categoryId);
    if (currentIndex <= 0) return;

    const prevCategory = categories[currentIndex - 1];
    const currentCategory = categories[currentIndex];

    // Меняем местами order
    const currentOrder = currentCategory.order ?? currentIndex;
    const prevOrder = prevCategory.order ?? currentIndex - 1;

    await Promise.all([
      updateCategory(currentCategory.id, { order: prevOrder }),
      updateCategory(prevCategory.id, { order: currentOrder })
    ]);

    loadData();
  };

  const handleMoveCategoryDown = async (categoryId: string) => {
    const currentIndex = categories.findIndex(c => c.id === categoryId);
    if (currentIndex < 0 || currentIndex >= categories.length - 1) return;

    const nextCategory = categories[currentIndex + 1];
    const currentCategory = categories[currentIndex];

    // Меняем местами order
    const currentOrder = currentCategory.order ?? currentIndex;
    const nextOrder = nextCategory.order ?? currentIndex + 1;

    await Promise.all([
      updateCategory(currentCategory.id, { order: nextOrder }),
      updateCategory(nextCategory.id, { order: currentOrder })
    ]);

    loadData();
  };

  // ========== DRAG-AND-DROP ДЛЯ МЕТОК ==========
  
  const handleTagDragStart = (tagId: string) => {
    setDraggingTagId(tagId);
  };

  const handleTagDragEnd = () => {
    setDraggingTagId(null);
  };

  const handleTagDrop = async (tagId: string, targetCategoryId: string) => {
    try {
      setIsMoving(true);
      
      // Получаем информацию о метке для уведомления
      const tag = tags.find(t => t.id === tagId);
      const targetCategory = categories.find(c => c.id === targetCategoryId);
      
      if (!tag || !targetCategory) {
        throw new Error('Метка или категория не найдены');
      }
      
      // Проверяем, что метка не из этой же категории
      if (tag.categoryId === targetCategoryId) {
        return;
      }
      
      // Перемещаем метку
      await moveTagToCategory(tagId, targetCategoryId);
      
      // Показываем уведомление
      toast.success(`Метка "${tag.name}" перемещена в "${targetCategory.name}"`);
      
      // Перезагружаем данные
      await loadData();
      
    } catch (error) {
      console.error('Ошибка перемещения метки:', error);
      if (error instanceof Error) {
        if (error.message.includes('не найдена')) {
          alert.error('Метка или категория не найдены');
        } else {
          alert.error(`Не удалось переместить метку: ${error.message}`);
        }
      } else {
        alert.error('Не удалось переместить метку');
      }
    } finally {
      setIsMoving(false);
      setDraggingTagId(null);
    }
  };

  const handleTagClick = (tagId: string) => {
    console.log('Поиск по метке:', tagId);
    // Закрываем модальное окно редактирования если оно открыто
    if (isEditCategoryModalOpen) {
      setIsEditCategoryModalOpen(false);
      setEditingCategoryId(null);
    }
    // Сначала устанавливаем выбранную метку
    setSelectedTags([tagId]);
    // Затем переходим на страницу карточек
    navigate('/cards');
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
        <div 
          className="tags-page"
          onDragOver={(e) => {
            // Разрешаем drop меток на уровне страницы
            if (e.dataTransfer.types.includes('application/tag-id')) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }
          }}
          onDrop={(e) => {
            // Обрабатываем drop метки на уровне страницы (если не попали в категорию)
            if (e.dataTransfer.types.includes('application/tag-id')) {
              e.preventDefault();
              e.stopPropagation();
              // Если drop произошел не на категорию, просто сбрасываем состояние
              setDraggingTagId(null);
            }
          }}
        >
          {categories.map((category, index) => {
            const categoryTags = tags.filter(t => t.categoryId === category.id);
            return (
              <CategorySection
                key={category.id}
                category={category}
                tags={categoryTags}
                onCategoryClick={handleCategoryClick}
                onTagClick={handleTagClick}
                onMoveUp={handleMoveCategoryUp}
                onMoveDown={handleMoveCategoryDown}
                canMoveUp={index > 0}
                canMoveDown={index < categories.length - 1}
                onTagDragStart={handleTagDragStart}
                onTagDragEnd={handleTagDragEnd}
                onTagDrop={handleTagDrop}
                draggingTagId={draggingTagId}
                allTags={tags}
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

