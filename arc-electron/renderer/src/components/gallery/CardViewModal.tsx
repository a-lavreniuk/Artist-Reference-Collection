/**
 * Компонент CardViewModal - модальное окно просмотра карточки
 * Отображает полноразмерное изображение/видео с метаданными
 */

import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button, Tag } from '../common';
import type { Card, Tag as TagType, Collection } from '../../types';
import { updateCard, getAllTags, getAllCollections, getCollection, updateCollection, addToMoodboard, removeFromMoodboard, deleteCard } from '../../services/db';
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
}

/**
 * Компонент CardViewModal
 */
export const CardViewModal = ({
  isOpen,
  card,
  onClose,
  onCardUpdated,
  onCardDeleted
}: CardViewModalProps) => {
  const [allTags, setAllTags] = useState<TagType[]>([]);
  const [allCollections, setAllCollections] = useState<Collection[]>([]);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isAddingCollection, setIsAddingCollection] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [videoDataUrl, setVideoDataUrl] = useState<string | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);

  // Загрузка всех меток и коллекций при открытии
  useEffect(() => {
    if (isOpen) {
      loadTags();
      loadCollections();
    }
  }, [isOpen]);

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

  if (!card) {
    return null;
  }

  // Форматирование размера файла
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  // Форматирование даты
  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Переключение мудборда
  const handleToggleMoodboard = async () => {
    try {
      if (card.inMoodboard) {
        await removeFromMoodboard(card.id);
      } else {
        await addToMoodboard(card.id);
      }
      onCardUpdated?.();
    } catch (error) {
      console.error('Ошибка обновления мудборда:', error);
    }
  };

  // Удаление карточки
  const handleDelete = async () => {
    if (!confirm('Вы уверены, что хотите удалить эту карточку? Это действие необратимо.')) {
      return;
    }

    try {
      setIsDeleting(true);
      await deleteCard(card.id);
      onCardDeleted?.();
      onClose();
    } catch (error) {
      console.error('Ошибка удаления карточки:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Удаление метки из карточки
  const handleRemoveTag = async (tagId: string) => {
    try {
      const newTags = card.tags.filter(id => id !== tagId);
      await updateCard(card.id, { tags: newTags });
      onCardUpdated?.();
    } catch (error) {
      console.error('Ошибка удаления метки:', error);
    }
  };

  // Добавление метки к карточке
  const handleAddTag = async (tagId: string) => {
    try {
      if (card.tags.includes(tagId)) {
        return; // Метка уже добавлена
      }
      const newTags = [...card.tags, tagId];
      await updateCard(card.id, { tags: newTags });
      setIsAddingTag(false);
      onCardUpdated?.();
    } catch (error) {
      console.error('Ошибка добавления метки:', error);
    }
  };

  // Добавление коллекции к карточке
  const handleAddCollection = async (collectionId: string) => {
    try {
      if (card.collections.includes(collectionId)) {
        return; // Коллекция уже добавлена
      }
      
      // Добавляем коллекцию к карточке
      const newCollections = [...card.collections, collectionId];
      await updateCard(card.id, { collections: newCollections });
      
      // Добавляем карточку в коллекцию
      const collection = await getCollection(collectionId);
      if (collection) {
        await updateCollection(collectionId, {
          cardIds: [...collection.cardIds, card.id]
        });
      }
      
      setIsAddingCollection(false);
      onCardUpdated?.();
    } catch (error) {
      console.error('Ошибка добавления коллекции:', error);
    }
  };

  // Удаление коллекции из карточки
  const handleRemoveCollection = async (collectionId: string) => {
    try {
      // Удаляем коллекцию из карточки
      const newCollections = card.collections.filter(id => id !== collectionId);
      await updateCard(card.id, { collections: newCollections });
      
      // Удаляем карточку из коллекции
      const collection = await getCollection(collectionId);
      if (collection) {
        await updateCollection(collectionId, {
          cardIds: collection.cardIds.filter(id => id !== card.id)
        });
      }
      
      onCardUpdated?.();
    } catch (error) {
      console.error('Ошибка удаления коллекции:', error);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="large"
      title={`ID: ${card.id}`}
    >
      <div className="card-view">
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
          <div className="card-view__section">
            <h4 className="card-view__section-title">Информация</h4>
            <div className="card-view__metadata">
              <div className="card-view__metadata-item">
                <span className="text-s">Тип:</span>
                <span className="text-m">{card.type === 'image' ? 'Изображение' : 'Видео'}</span>
              </div>
              <div className="card-view__metadata-item">
                <span className="text-s">Формат:</span>
                <span className="text-m">{card.format.toUpperCase()}</span>
              </div>
              <div className="card-view__metadata-item">
                <span className="text-s">Размер:</span>
                <span className="text-m">{formatFileSize(card.fileSize)}</span>
              </div>
              {card.width && card.height && (
                <div className="card-view__metadata-item">
                  <span className="text-s">Разрешение:</span>
                  <span className="text-m">{card.width} × {card.height}</span>
                </div>
              )}
              <div className="card-view__metadata-item">
                <span className="text-s">Добавлено:</span>
                <span className="text-m">{formatDate(card.dateAdded)}</span>
              </div>
            </div>
          </div>

          {/* Метки */}
          <div className="card-view__section">
            <div className="card-view__section-header">
              <h4 className="card-view__section-title">Метки</h4>
              <Button
                variant="ghost"
                size="small"
                onClick={() => setIsAddingTag(!isAddingTag)}
              >
                {isAddingTag ? 'Отмена' : '+ Добавить'}
              </Button>
            </div>
            
            <div className="card-view__tags">
              {card.tags.length > 0 ? (
                card.tags.map((tagId) => {
                  const tag = allTags.find(t => t.id === tagId);
                  return tag ? (
                    <Tag
                      key={tagId}
                      variant="active"
                      removable
                      onRemove={() => handleRemoveTag(tagId)}
                      color={tag.color}
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

            {/* UI добавления метки */}
            {isAddingTag && (
              <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {allTags
                  .filter(tag => !card.tags.includes(tag.id))
                  .map(tag => (
                    <Tag
                      key={tag.id}
                      variant="default"
                      onClick={() => handleAddTag(tag.id)}
                      color={tag.color}
                      role="button"
                    >
                      {tag.name}
                    </Tag>
                  ))}
              </div>
            )}
          </div>

          {/* Коллекции */}
          <div className="card-view__section">
            <div className="card-view__section-header">
              <h4 className="card-view__section-title">Коллекции</h4>
              <Button
                variant="ghost"
                size="small"
                onClick={() => setIsAddingCollection(!isAddingCollection)}
              >
                {isAddingCollection ? 'Отмена' : '+ Добавить'}
              </Button>
            </div>

            <div className="card-view__tags">
              {card.collections.length > 0 ? (
                card.collections.map((collectionId) => {
                  const collection = allCollections.find(c => c.id === collectionId);
                  return collection ? (
                    <Tag
                      key={collectionId}
                      variant="active"
                      removable
                      onRemove={() => handleRemoveCollection(collectionId)}
                    >
                      {collection.name}
                    </Tag>
                  ) : null;
                })
              ) : (
                <p className="text-s" style={{ color: 'var(--text-secondary)' }}>
                  Коллекций нет.
                </p>
              )}
            </div>

            {/* UI добавления коллекции */}
            {isAddingCollection && (
              <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {allCollections
                  .filter(coll => !card.collections.includes(coll.id))
                  .map(coll => (
                    <Tag
                      key={coll.id}
                      variant="default"
                      onClick={() => handleAddCollection(coll.id)}
                      role="button"
                    >
                      {coll.name}
                    </Tag>
                  ))}
              </div>
            )}
          </div>

          {/* Действия */}
          <div className="card-view__actions">
            <Button
              variant={card.inMoodboard ? 'secondary' : 'primary'}
              fullWidth
              onClick={handleToggleMoodboard}
              iconLeft={
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.04L12 21.35Z"
                    fill={card.inMoodboard ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              }
            >
              {card.inMoodboard ? 'Убрать из мудборда' : 'Добавить в мудборд'}
            </Button>
            
            <Button
              variant="danger"
              fullWidth
              onClick={handleDelete}
              loading={isDeleting}
              iconLeft={
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 6H5H21M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
            >
              Удалить карточку
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default CardViewModal;

