/**
 * Компонент CardViewModal - модальное окно просмотра карточки
 * Отображает полноразмерное изображение/видео с метаданными
 */

import { useState, useEffect } from 'react';
import Masonry from 'react-masonry-css';
import { Modal } from '../common/Modal';
import { Button, Tag, Icon, Card as CardComponent, Input } from '../common';
import { LinkifiedText } from '../common/LinkifiedText';
import type { Card, Tag as TagType, Collection, Category } from '../../types';
import { updateCard, getAllTags, getAllCollections, getAllCategories, getCollection, updateCollection, addToMoodboard, removeFromMoodboard, deleteCard, getSimilarCards, addViewHistory, addTag, updateCategory, getMoodboard, db } from '../../services/db';
import { logDeleteCards } from '../../services/history';
import { useToast } from '../../hooks/useToast';
import { useAlert } from '../../hooks/useAlert';
import './CardViewModal.css';

export interface CardViewModalProps {
  /** Открыто ли модальное окно */
  isOpen: boolean;
  
  /** Карточка для отображения */
  card: Card | null;
  
  /** Обработчик закрытия */
  onClose: () => void;
  
  /** Обработчик обновления карточки */
  onCardUpdated?: () => void;
  
  /** Обработчик удаления карточки */
  onCardDeleted?: () => void;

  /** Обработчик клика по похожей карточке */
  onSimilarCardClick?: (card: Card) => void;
  
  /** Обработчик клика по коллекции */
  onCollectionClick?: (collectionId: string) => void;
  
  /** Обработчик клика по метке */
  onTagClick?: (tagId: string) => void;
}

/**
 * Компонент CardViewModal
 */
export const CardViewModal = ({
  isOpen,
  card,
  onClose,
  onCardUpdated,
  onCardDeleted,
  onSimilarCardClick,
  onCollectionClick,
  onTagClick
}: CardViewModalProps) => {
  const [allTags, setAllTags] = useState<TagType[]>([]);
  const [allCollections, setAllCollections] = useState<Collection[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [videoDataUrl, setVideoDataUrl] = useState<string | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [similarCards, setSimilarCards] = useState<Array<Card & { matchCount: number }>>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedTags, setEditedTags] = useState<string[]>([]);
  const [editedCollections, setEditedCollections] = useState<string[]>([]);
  const [editedDescription, setEditedDescription] = useState<string>('');
  const [collectionSearchQuery, setCollectionSearchQuery] = useState('');
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [showNewTagInput, setShowNewTagInput] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [isInMoodboard, setIsInMoodboard] = useState(false);
  
  const { showToast } = useToast();
  const alert = useAlert();
  
  // Загружаем статус мудборда при открытии модального окна
  useEffect(() => {
    if (card) {
      getMoodboard().then(moodboard => {
        setIsInMoodboard(moodboard.cardIds.includes(card.id));
      });
    }
  }, [card]);

  // Загрузка всех меток, коллекций и похожих карточек при открытии
  useEffect(() => {
    if (isOpen && card) {
      loadTags();
      loadCollections();
      loadCategories();
      loadSimilarCards();
      
      // Инициализируем редактируемые данные
      setEditedTags(card.tags);
      setEditedCollections(card.collections);
      setEditedDescription(card.description || '');
      setIsEditMode(false);
      setCollectionSearchQuery('');
      setTagSearchQuery('');
      setShowNewTagInput(null);
      setNewTagName('');
      
      // Добавляем карточку в историю просмотров
      addViewHistory(card.id).catch(error => {
        console.error('[CardViewModal] Ошибка сохранения в историю просмотров:', error);
      });
    }
  }, [isOpen, card?.id]);

  // Загрузка Data URL для видео при открытии
  useEffect(() => {
    if (isOpen && card && card.type === 'video' && window.electronAPI) {
      loadVideoDataUrl();
    }
    return () => {
      setVideoDataUrl(null);
    };
  }, [isOpen, card]);

  const loadVideoDataUrl = async () => {
    if (!card) return;
    
    try {
      setIsLoadingVideo(true);
      console.log('[CardViewModal] Загрузка Data URL для видео:', card.filePath);
      const dataUrl = await window.electronAPI.getFileURL(card.filePath);
      setVideoDataUrl(dataUrl);
      console.log('[CardViewModal] Data URL загружен');
    } catch (error) {
      console.error('[CardViewModal] Ошибка загрузки Data URL:', error);
    } finally {
      setIsLoadingVideo(false);
    }
  };

  const loadTags = async () => {
    try {
      const tags = await getAllTags();
      setAllTags(tags);
    } catch (error) {
      console.error('Ошибка загрузки меток:', error);
    }
  };

  const loadCollections = async () => {
    try {
      const collections = await getAllCollections();
      setAllCollections(collections);
    } catch (error) {
      console.error('Ошибка загрузки коллекций:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const categories = await getAllCategories();
      setAllCategories(categories);
    } catch (error) {
      console.error('Ошибка загрузки категорий:', error);
    }
  };

  const loadSimilarCards = async () => {
    if (!card) return;
    
    try {
      const similar = await getSimilarCards(card.id, 15);
      // Ограничиваем максимум 30 карточками
      const limitedSimilar = similar.slice(0, 30);
      setSimilarCards(limitedSimilar);
      console.log('[CardViewModal] Найдено похожих карточек:', similar.length, 'показано:', limitedSimilar.length);
    } catch (error) {
      console.error('Ошибка загрузки похожих карточек:', error);
    }
  };

  if (!card) {
    return null;
  }

  // Форматирование размера файла
  // const formatFileSize = (bytes: number): string => {
  //   if (bytes < 1024) return `${bytes} B`;
  //   if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  //   if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  //   return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  // };

  // Форматирование даты
  // const formatDate = (date: Date): string => {
  //   return new Date(date).toLocaleDateString('ru-RU', {
  //     year: 'numeric',
  //     month: 'long',
  //     day: 'numeric',
  //     hour: '2-digit',
  //     minute: '2-digit'
  //   });
  // };

  // Переключение мудборда
  const handleToggleMoodboard = async () => {
    if (!card) return;
    
    const moodboard = await getMoodboard();
    const currentIsInMoodboard = moodboard.cardIds.includes(card.id);
    console.log('[CardViewModal] Клик на кнопку мудборда для карточки:', card.id, 'текущий статус в мудборде:', currentIsInMoodboard);
    
    try {
      if (currentIsInMoodboard) {
        console.log('[CardViewModal] Удаляем из мудборда');
        await removeFromMoodboard(card.id);
        setIsInMoodboard(false);
        alert.info('Карточка удалена из мудборда');
      } else {
        console.log('[CardViewModal] Добавляем в мудборд');
        await addToMoodboard(card.id);
        setIsInMoodboard(true);
        alert.success('Карточка добавлена в мудборд');
      }
      
      console.log('[CardViewModal] Вызываем onCardUpdated');
      onCardUpdated?.();
    } catch (error) {
      console.error('[CardViewModal] Ошибка обновления мудборда:', error);
      alert.error('Ошибка обновления мудборда');
    }
  };

  // Удаление карточки
  const handleDelete = async () => {
    showToast({
      title: 'Удалить карточку',
      message: 'Вы уверены что хотите удалить карточку? Это действие необратимо',
      type: 'error',
      onConfirm: async () => {
        try {
          setIsDeleting(true);
          
          // Получаем название коллекции если карточка в коллекции
          let collectionName: string | undefined;
          if (card.collections.length > 0) {
            const collection = await getCollection(card.collections[0]);
            collectionName = collection?.name;
          }
          
          await deleteCard(card.id);
          
          // Логируем удаление карточки
          await logDeleteCards(1, collectionName);
          
          // Показываем успешное уведомление
          alert.success('Карточка удалена');
          
          onCardDeleted?.();
          onClose();
        } catch (error) {
          console.error('Ошибка удаления карточки:', error);
        } finally {
          setIsDeleting(false);
        }
      },
      confirmText: 'Удалить',
      cancelText: 'Отмена'
    });
  };

  // Удаление метки из карточки
  // const handleRemoveTag = async (tagId: string) => {
  //   try {
  //     const newTags = card.tags.filter(id => id !== tagId);
  //     await updateCard(card.id, { tags: newTags });
  //     onCardUpdated?.();
  //   } catch (error) {
  //     console.error('Ошибка удаления метки:', error);
  //   }
  // };

  // Добавление метки к карточке
  // const handleAddTag = async (tagId: string) => {
  //   try {
  //     if (card.tags.includes(tagId)) {
  //       return; // Метка уже добавлена
  //     }
  //     const newTags = [...card.tags, tagId];
  //     await updateCard(card.id, { tags: newTags });
  //     // setIsAddingTag(false);
  //     onCardUpdated?.();
  //   } catch (error) {
  //     console.error('Ошибка добавления метки:', error);
  //   }
  // };

  // Добавление коллекции к карточке
  // const handleAddCollection = async (collectionId: string) => {
  //   try {
  //     if (card.collections.includes(collectionId)) {
  //       return; // Коллекция уже добавлена
  //     }
  //     
  //     // Добавляем коллекцию к карточке
  //     const newCollections = [...card.collections, collectionId];
  //     await updateCard(card.id, { collections: newCollections });
  //     
  //     // Добавляем карточку в коллекцию
  //     const collection = await getCollection(collectionId);
  //     if (collection) {
  //       await updateCollection(collectionId, {
  //         cardIds: [...collection.cardIds, card.id]
  //       });
  //     }
  //     
  //     // setIsAddingCollection(false);
  //     onCardUpdated?.();
  //   } catch (error) {
  //     console.error('Ошибка добавления коллекции:', error);
  //   }
  // };

  // Удаление коллекции из карточки
  // const handleRemoveCollection = async (collectionId: string) => {
  //   try {
  //     // Удаляем коллекцию из карточки
  //     const newCollections = card.collections.filter(id => id !== collectionId);
  //     await updateCard(card.id, { collections: newCollections });
  //     
  //     // Удаляем карточку из коллекции
  //     const collection = await getCollection(collectionId);
  //     if (collection) {
  //       await updateCollection(collectionId, {
  //         cardIds: collection.cardIds.filter(id => id !== card.id)
  //       });
  //     }
  //     
  //     onCardUpdated?.();
  //   } catch (error) {
  //     console.error('Ошибка удаления коллекции:', error);
  //   }
  // };

  // Копирование ID в буфер
  const handleCopyId = async () => {
    if (window.electronAPI) {
      try {
        await window.electronAPI.copyToClipboard(card.id);
        alert.info('ID карточки скопирован');
      } catch (error) {
        console.error('Ошибка копирования ID:', error);
        alert.error('Не удалось скопировать ID');
      }
    }
  };

  // Открытие папки с файлом
  const handleOpenLocation = async () => {
    if (window.electronAPI) {
      try {
        await window.electronAPI.openFileLocation(card.filePath);
      } catch (error) {
        console.error('Ошибка открытия папки:', error);
        alert.error('Не удалось открыть папку');
      }
    }
  };

  // Экспорт файла
  const handleExport = async () => {
    if (window.electronAPI) {
      try {
        // Сначала проверяем существование файла
        const fileExists = await window.electronAPI.fileExists(card.filePath);
        if (!fileExists) {
          alert.error(
            `Файл не найден\n\n` +
            `Имя файла: ${card.fileName}\n` +
            `Путь: ${card.filePath}\n\n` +
            `Файл был удален или перемещен.\n` +
            `Проверьте целостность данных в настройках или восстановите файл из резервной копии.`
          );
          return;
        }
        
        const exportedPath = await window.electronAPI.exportFile(card.filePath, card.fileName);
        if (exportedPath) {
          alert.success(`Файл экспортирован:\n${exportedPath}`);
        }
      } catch (error) {
        console.error('Ошибка экспорта файла:', error);
        const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
        alert.error(`Не удалось экспортировать файл\n\n${errorMessage}`);
      }
    }
  };

  // Вход в режим редактирования
  const handleEnterEditMode = () => {
    setEditedTags([...card.tags]);
    setEditedCollections([...card.collections]);
    setEditedDescription(card.description || '');
    setIsEditMode(true);
  };

  // Отмена редактирования
  const handleCancelEdit = () => {
    setEditedTags([...card.tags]);
    setEditedCollections([...card.collections]);
    setEditedDescription(card.description || '');
    setCollectionSearchQuery('');
    setTagSearchQuery('');
    setShowNewTagInput(null);
    setNewTagName('');
    setIsEditMode(false);
  };

  // Сохранение изменений
  const handleSaveEdit = async () => {
    try {
      // Обновляем данные карточки
      await updateCard(card.id, {
        tags: editedTags,
        collections: editedCollections,
        description: editedDescription.trim() || undefined
      });
      
      // Обновляем связи коллекций
      // Удаляем карточку из старых коллекций
      for (const oldCollId of card.collections) {
        if (!editedCollections.includes(oldCollId)) {
          const coll = await getCollection(oldCollId);
          if (coll) {
            await updateCollection(oldCollId, {
              cardIds: coll.cardIds.filter(id => id !== card.id)
            });
          }
        }
      }
      
      // Добавляем карточку в новые коллекции
      for (const newCollId of editedCollections) {
        if (!card.collections.includes(newCollId)) {
          const coll = await getCollection(newCollId);
          if (coll) {
            await updateCollection(newCollId, {
              cardIds: [...coll.cardIds, card.id]
            });
          }
        }
      }
      
      setIsEditMode(false);
      showToast({ message: 'Изменения сохранены' });
      
      // Вызываем обновление - родительский компонент перезагрузит данные
      onCardUpdated?.();
    } catch (error) {
      console.error('Ошибка сохранения изменений:', error);
      showToast({ message: 'Ошибка сохранения изменений' });
    }
  };

  // Переключение метки
  const handleToggleTag = (tagId: string) => {
    if (editedTags.includes(tagId)) {
      setEditedTags(editedTags.filter(id => id !== tagId));
    } else {
      setEditedTags([...editedTags, tagId]);
    }
  };

  // Переключение коллекции
  const handleToggleCollection = (collectionId: string) => {
    if (editedCollections.includes(collectionId)) {
      setEditedCollections(editedCollections.filter(id => id !== collectionId));
    } else {
      setEditedCollections([...editedCollections, collectionId]);
    }
  };

  // Создание новой метки
  const handleCreateTag = async (categoryId: string) => {
    if (!newTagName.trim()) return;

    // Проверка существования
    const existingTags = await getAllTags();
    const duplicate = existingTags.find(t => 
      t.name.toLowerCase() === newTagName.trim().toLowerCase() && 
      t.categoryId === categoryId
    );

    if (duplicate) {
      alert.warning('Метка с таким названием уже существует в этой категории');
      return;
    }

    try {
      const tag: TagType = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: newTagName.trim(),
        categoryId,
        dateCreated: new Date(),
        cardCount: 0
      };

      const tagId = await addTag(tag);
      
      // Добавляем ID метки в категорию
      const category = await db.categories.get(categoryId);
      if (category) {
        await updateCategory(categoryId, {
          tagIds: [...category.tagIds, tagId]
        });
      }

      // Обновляем список меток
      await loadTags();
      
      // Автоматически добавляем новую метку к карточке
      setEditedTags([...editedTags, tagId]);
      setNewTagName('');
      setShowNewTagInput(null);
      alert.success('Метка создана и добавлена к карточке');
    } catch (error) {
      console.error('Ошибка создания метки:', error);
      alert.error('Не удалось создать метку');
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="large"
        showCloseButton={false}
        overlayClassName={!isEditMode && similarCards.length > 0 ? 'modal-overlay--scrollable' : ''}
      >
        <div className="card-view">
        {/* Верхняя панель управления */}
        <div className="card-view__toolbar">
          <div className="card-view__toolbar-row">
            <div className="card-view__toolbar-left">
              <button 
                className="card-view__icon-button" 
                onClick={handleDelete}
                disabled={isDeleting}
                title="Удалить карточку"
              >
                <Icon name="trash" size={24} variant="border" />
              </button>
            </div>
            
            <div className="card-view__toolbar-right">
              {isEditMode ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={handleCancelEdit}
                    iconLeft={<Icon name="x" size={24} variant="border" />}
                  >
                    Отмена
                  </Button>
                  <Button
                    variant="success"
                    onClick={handleSaveEdit}
                    iconLeft={<Icon name="save" size={24} variant="border" />}
                  >
                    Сохранить
                  </Button>
                </>
              ) : (
                <>
                  <button className="card-view__icon-button" onClick={handleToggleMoodboard} title={isInMoodboard ? 'Убрать из мудборда' : 'Добавить в мудборд'}>
                    <Icon name={isInMoodboard ? 'bookmark-minus' : 'bookmark-plus'} size={24} variant="border" />
                  </button>
                  <button className="card-view__icon-button" onClick={handleExport} title="Выгрузить изображение">
                    <Icon name="download" size={24} variant="border" />
                  </button>
                  <button className="card-view__icon-button" onClick={handleOpenLocation} title="Открыть местонахождение">
                    <Icon name="file-search" size={24} variant="border" />
                  </button>
                  <button className="card-view__icon-button" onClick={handleEnterEditMode} title="Редактировать">
                    <Icon name="pencil" size={24} variant="border" />
                  </button>
                  <button className="card-view__id-button" onClick={handleCopyId}>
                    <span className="card-view__id-text">{card.id}</span>
                    <Icon name="copy" size={24} variant="border" />
                  </button>
                </>
              )}
            </div>
          </div>
          
          {/* Разделитель */}
          <div className="card-view__divider"></div>
        </div>
        
        {/* Основное содержимое */}
        <div className="card-view__content">
          {/* Превью изображения/видео */}
          <div className="card-view__preview">
          {card.type === 'image' ? (
            <img
              src={card.thumbnailUrl || card.filePath}
              alt={card.fileName}
              className="card-view__image"
            />
          ) : (
            <>
              {isLoadingVideo ? (
                <div className="card-view__loading">
                  <p>Загрузка видео...</p>
                </div>
              ) : videoDataUrl ? (
                <video
                  src={videoDataUrl}
                  controls
                  className="card-view__video"
                />
              ) : (
                <div className="card-view__loading">
                  <p>Не удалось загрузить видео</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Информация о файле */}
        <div className="card-view__info">
          {/* Описание */}
          {(card.description || isEditMode) && (
            <div className="card-view__section">
              <div className="card-view__section-title-wrapper">
                <h4 className="card-view__section-title">Описание</h4>
              </div>
              {isEditMode ? (
                <>
                  <textarea
                    className="input card-view__description-textarea"
                    placeholder="Введите описание…"
                    value={editedDescription}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Ограничение до 2000 символов
                      const truncatedValue = value.length > 2000 ? value.substring(0, 2000) : value;
                      setEditedDescription(truncatedValue);
                    }}
                    maxLength={2000}
                    rows={4}
                  />
                  {editedDescription.length > 0 && (
                    <p className="text-s" style={{ 
                      color: 'var(--text-secondary)', 
                      marginTop: '8px',
                      textAlign: 'right'
                    }}>
                      {editedDescription.length} / 2000
                    </p>
                  )}
                </>
              ) : (
                card.description && (
                  <div className="card-view__description-content">
                    <LinkifiedText text={card.description} />
                  </div>
                )
              )}
            </div>
          )}

          {/* Коллекции */}
          <div className="card-view__section">
            <div className="card-view__section-title-wrapper">
              <h4 className="card-view__section-title">Коллекции</h4>
              <span className="card-view__section-count">{isEditMode ? editedCollections.length : card.collections.length}</span>
            </div>

            {isEditMode && (
              <Input
                placeholder="Поиск коллекций…"
                value={collectionSearchQuery}
                onChange={(e) => setCollectionSearchQuery(e.target.value)}
                fullWidth
                clearable
                onClear={() => setCollectionSearchQuery('')}
              />
            )}

            <div className="card-view__tags">
              {isEditMode ? (
                // Режим редактирования - показываем саджест
                allCollections
                  .filter(coll => 
                    collectionSearchQuery === '' || 
                    coll.name.toLowerCase().includes(collectionSearchQuery.toLowerCase())
                  )
                  .map((collection) => (
                    <Tag
                      key={collection.id}
                      variant={editedCollections.includes(collection.id) ? 'active' : 'default'}
                      removable={editedCollections.includes(collection.id)}
                      onClick={() => handleToggleCollection(collection.id)}
                      onRemove={() => handleToggleCollection(collection.id)}
                      role="button"
                    >
                      <span className="card-view__tag-name">{collection.name}</span>
                      <span className="card-view__tag-count">{collection.cardIds?.length || 0}</span>
                    </Tag>
                  ))
              ) : (
                // Режим просмотра
                card.collections.length > 0 ? (
                  card.collections.map((collectionId) => {
                    const collection = allCollections.find(c => c.id === collectionId);
                    return collection ? (
                      <Tag 
                        key={collectionId}
                        variant="default"
                        onClick={() => {
                          console.log('Клик на коллекцию:', collectionId, collection.name);
                          onCollectionClick?.(collectionId);
                        }}
                        role="button"
                      >
                        <span className="card-view__tag-name">{collection.name}</span>
                        <span className="card-view__tag-count">{collection.cardIds?.length || 0}</span>
                      </Tag>
                    ) : null;
                  })
                ) : (
                  <p className="text-s" style={{ color: 'var(--text-secondary)' }}>
                    Коллекций нет.
                  </p>
                )
              )}
            </div>
          </div>

          {/* Метки */}
          <div className={`card-view__section ${isEditMode ? 'card-view__section--tags-edit' : ''}`}>
            <div className="card-view__section-title-wrapper">
              <h4 className="card-view__section-title">Метки</h4>
              <span className="card-view__section-count">{isEditMode ? editedTags.length : card.tags.length}</span>
            </div>
            
            {isEditMode ? (
              <>
                <Input
                  placeholder="Поиск меток…"
                  value={tagSearchQuery}
                  onChange={(e) => setTagSearchQuery(e.target.value)}
                  fullWidth
                  clearable
                  onClear={() => setTagSearchQuery('')}
                />
                
                <div className="card-view__divider"></div>
                
                <div className="card-view__tags-scroll">
                  {allCategories
                    .map((category) => {
                      const categoryTags = allTags.filter(tag => tag.categoryId === category.id);
                      
                      // Если поиск пустой - показываем все метки
                      if (tagSearchQuery === '') {
                        return { category, tags: categoryTags };
                      }
                      
                      const query = tagSearchQuery.toLowerCase();
                      const categoryNameMatches = category.name.toLowerCase().includes(query);
                      
                      // Если название категории подходит - показываем ВСЕ метки категории
                      if (categoryNameMatches) {
                        return { category, tags: categoryTags };
                      }
                      
                      // Если название категории не подходит - фильтруем метки
                      const filteredTags = categoryTags.filter(tag => {
                        const nameMatch = tag.name.toLowerCase().includes(query);
                        const descriptionMatch = tag.description?.toLowerCase().includes(query) || false;
                        return nameMatch || descriptionMatch;
                      });
                      
                      if (filteredTags.length === 0) return null;
                      
                      return { category, tags: filteredTags };
                    })
                    .filter((item): item is { category: Category; tags: TagType[] } => item !== null)
                    .map(({ category, tags }) => (
                      <div key={category.id} className="card-view__category">
                        <h5 className="card-view__category-title">{category.name}</h5>
                        <div className="card-view__tags">
                          {tags.map((tag) => (
                            <Tag
                              key={tag.id}
                              variant={editedTags.includes(tag.id) ? 'active' : 'default'}
                              removable={editedTags.includes(tag.id)}
                              description={tag.description || tag.name}
                              onClick={() => handleToggleTag(tag.id)}
                              onRemove={() => handleToggleTag(tag.id)}
                              role="button"
                            >
                              {tag.name}
                            </Tag>
                          ))}
                          <button
                            className="card-view__add-tag-button"
                            onClick={() => setShowNewTagInput(showNewTagInput === category.id ? null : category.id)}
                            type="button"
                            title="Добавить метку"
                          >
                            <Icon name={showNewTagInput === category.id ? "x" : "plus"} size={16} variant="border" />
                          </button>
                        </div>
                        {showNewTagInput === category.id && (
                          <Input
                            placeholder="Название метки"
                            value={newTagName}
                            onChange={(e) => setNewTagName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newTagName.trim()) {
                                handleCreateTag(category.id);
                              }
                            }}
                            autoFocus
                            fullWidth
                            style={{ marginTop: '8px' }}
                            clearable
                            onClear={() => {
                              setNewTagName('');
                              setShowNewTagInput(null);
                            }}
                          />
                        )}
                      </div>
                    ))}
                </div>
              </>
            ) : (
              <div className="card-view__tags">
                {card.tags.length > 0 ? (
                  card.tags.map((tagId) => {
                    const tag = allTags.find(t => t.id === tagId);
                    return tag ? (
                      <Tag 
                        key={tagId} 
                        variant="default"
                        description={tag.description || tag.name}
                        onClick={() => {
                          console.log('Клик на метку:', tagId, tag.name);
                          onTagClick?.(tagId);
                        }}
                        role="button"
                      >
                        {tag.name}
                      </Tag>
                    ) : null;
                  })
                ) : (
                  <p className="text-s" style={{ color: 'var(--text-secondary)' }}>
                    Меток нет. Добавьте метки для категоризации.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        </div>

        {/* Похожие изображения */}
        {!isEditMode && similarCards.length > 0 && (
          <div className="card-view__similar">
            <div className="card-view__section-title-wrapper">
              <h4 className="card-view__section-title">Похожие изображения</h4>
              <span className="card-view__section-count">{similarCards.length}</span>
            </div>
            <Masonry
              breakpointCols={{
                default: 4,
                1920: 4,
                1400: 3,
                1200: 2
              }}
              className="card-view__similar-masonry"
              columnClassName="card-view__similar-column"
            >
              {similarCards.map((similarCard) => (
                <div key={similarCard.id} className="card-view__similar-item">
                  <CardComponent
                    card={similarCard}
                    onClick={() => onSimilarCardClick?.(similarCard)}
                    onMoodboardToggle={() => {}}
                    showActions={false}
                  />
                </div>
              ))}
            </Masonry>
          </div>
        )}
        </div>
      </Modal>
    </>
  );
};

export default CardViewModal;

