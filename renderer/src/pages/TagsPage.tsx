/**
 * Страница категорий и меток
 */

import { useState, useEffect, useRef } from 'react';
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

  // Ref для сохранения позиции скролла
  const scrollPositionRef = useRef<number>(0);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  // Инициализация ref для контейнера скролла
  useEffect(() => {
    scrollContainerRef.current = document.querySelector('.layout__content') as HTMLElement;
  }, []);

  // Загрузка категорий и меток
  useEffect(() => {
    loadData();
  }, []);

  // Восстановление позиции скролла после обновления данных
  useEffect(() => {
    if (!isLoading && scrollContainerRef.current && scrollPositionRef.current > 0) {
      // Используем двойной requestAnimationFrame для гарантированного восстановления после рендера
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollPositionRef.current;
            scrollPositionRef.current = 0; // Сбрасываем сохраненную позицию
          }
        });
      });
    }
  }, [isLoading, categories, tags]);

  const loadData = async (preserveScroll = false) => {
    try {
      // Сохраняем позицию скролла перед обновлением
      if (preserveScroll && scrollContainerRef.current) {
        scrollPositionRef.current = scrollContainerRef.current.scrollTop;
      }

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

  const handleCategoryCreated = async (newCategory: Category) => {
    try {
      // Загружаем метки новой категории
      const allTags = await getAllTags();
      const categoryTags = allTags.filter(t => t.categoryId === newCategory.id);
      
      // Добавляем категорию и метки локально
      setCategories(prev => {
        const sorted = [...prev, newCategory].sort((a, b) => {
          if (a.order !== undefined && b.order !== undefined) {
            return a.order - b.order;
          }
          if (a.order !== undefined) return -1;
          if (b.order !== undefined) return 1;
          return a.dateCreated.getTime() - b.dateCreated.getTime();
        });
        return sorted;
      });
      setTags(prev => [...prev, ...categoryTags]);
    } catch (error) {
      console.error('Ошибка обновления состояния после создания категории:', error);
      // При ошибке перезагружаем данные
      await loadData(true);
    }
  };

  const handleCategoryUpdated = async () => {
    try {
      if (!editingCategoryId) return;
      
      // Загружаем только обновленную категорию и её метки
      const [allCategories, allTags] = await Promise.all([
        getAllCategories(),
        getAllTags()
      ]);
      
      const updatedCategory = allCategories.find(c => c.id === editingCategoryId);
      if (!updatedCategory) {
        await loadData(true);
        return;
      }
      
      const categoryTags = allTags.filter(t => t.categoryId === editingCategoryId);
      
      // Обновляем категорию и метки локально
      setCategories(prev => 
        prev.map(c => c.id === editingCategoryId ? updatedCategory : c)
      );
      setTags(prev => {
        // Удаляем старые метки категории и добавляем новые
        const withoutCategoryTags = prev.filter(t => t.categoryId !== editingCategoryId);
        return [...withoutCategoryTags, ...categoryTags];
      });
    } catch (error) {
      console.error('Ошибка обновления состояния после изменения категории:', error);
      // При ошибке перезагружаем данные
      await loadData(true);
    }
  };

  const handleCategoryDeleted = async () => {
    try {
      if (!editingCategoryId) return;
      
      // Удаляем категорию и связанные метки локально
      setCategories(prev => prev.filter(c => c.id !== editingCategoryId));
      setTags(prev => prev.filter(t => t.categoryId !== editingCategoryId));
    } catch (error) {
      console.error('Ошибка обновления состояния после удаления категории:', error);
      // При ошибке перезагружаем данные
      await loadData(true);
    }
  };

  const handleMoveCategoryUp = async (categoryId: string) => {
    const currentIndex = categories.findIndex(c => c.id === categoryId);
    if (currentIndex <= 0) return;

    // Сохраняем позицию скролла
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollTop;
    }

    const prevCategory = categories[currentIndex - 1];
    const currentCategory = categories[currentIndex];

    // Меняем местами order
    const currentOrder = currentCategory.order ?? currentIndex;
    const prevOrder = prevCategory.order ?? currentIndex - 1;

    await Promise.all([
      updateCategory(currentCategory.id, { order: prevOrder }),
      updateCategory(prevCategory.id, { order: currentOrder })
    ]);

    // Обновляем состояние локально без полной перезагрузки
    setCategories(prev => {
      const newCategories = [...prev];
      [newCategories[currentIndex - 1], newCategories[currentIndex]] = 
        [newCategories[currentIndex], newCategories[currentIndex - 1]];
      return newCategories;
    });

    // Восстанавливаем позицию скролла
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollPositionRef.current;
          scrollPositionRef.current = 0;
        }
      });
    });
  };

  const handleMoveCategoryDown = async (categoryId: string) => {
    const currentIndex = categories.findIndex(c => c.id === categoryId);
    if (currentIndex < 0 || currentIndex >= categories.length - 1) return;

    // Сохраняем позицию скролла
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollTop;
    }

    const nextCategory = categories[currentIndex + 1];
    const currentCategory = categories[currentIndex];

    // Меняем местами order
    const currentOrder = currentCategory.order ?? currentIndex;
    const nextOrder = nextCategory.order ?? currentIndex + 1;

    await Promise.all([
      updateCategory(currentCategory.id, { order: nextOrder }),
      updateCategory(nextCategory.id, { order: currentOrder })
    ]);

    // Обновляем состояние локально без полной перезагрузки
    setCategories(prev => {
      const newCategories = [...prev];
      [newCategories[currentIndex], newCategories[currentIndex + 1]] = 
        [newCategories[currentIndex + 1], newCategories[currentIndex]];
      return newCategories;
    });

    // Восстанавливаем позицию скролла
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollPositionRef.current;
          scrollPositionRef.current = 0;
        }
      });
    });
  };

  // ========== DRAG-AND-DROP ДЛЯ МЕТОК ==========
  
  const handleTagDragStart = (tagId: string) => {
    setDraggingTagId(tagId);
  };

  const handleTagDragEnd = () => {
    setDraggingTagId(null);
  };

  const handleTagDrop = async (tagId: string, targetCategoryId: string) => {
    // Сохраняем старое состояние для отката при ошибке
    let oldCategoryId: string | undefined;
    
    try {
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
      
      // Сохраняем старое состояние для отката при ошибке
      oldCategoryId = tag.categoryId;
      
      // Оптимистичное обновление UI - обновляем состояние сразу
      setTags(prevTags => 
        prevTags.map(t => 
          t.id === tagId ? { ...t, categoryId: targetCategoryId } : t
        )
      );
      
      // Перемещаем метку в базе данных
      await moveTagToCategory(tagId, targetCategoryId);
      
      // Показываем уведомление
      toast.success(`Метка "${tag.name}" перемещена в "${targetCategory.name}"`);
      
    } catch (error) {
      // Откатываем изменения при ошибке
      if (oldCategoryId !== undefined) {
        setTags(prevTags => 
          prevTags.map(t => 
            t.id === tagId ? { ...t, categoryId: oldCategoryId! } : t
          )
        );
      }
      
      // Перезагружаем данные для синхронизации
      await loadData(true);
      
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

