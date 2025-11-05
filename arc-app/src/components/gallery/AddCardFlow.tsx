/**
 * Компонент AddCardFlow - процесс добавления карточек
 * Drag & Drop, очередь, настройка меток для каждого файла
 */

import { useState, useRef } from 'react';
import { Button, Tag, Input } from '../common';
import { getAllTags, getAllCategories, getAllCollections, addCard, addTag } from '../../services/db';
import type { Card, Tag as TagType, Category, Collection } from '../../types';
import './AddCardFlow.css';

interface QueueFile {
  file: File;
  preview: string;
  configured: boolean;
  tags: string[];
  collections: string[];
}

export interface AddCardFlowProps {
  /** Обработчик завершения */
  onComplete: (cards: Card[]) => void;
  
  /** Обработчик отмены */
  onCancel: () => void;
}

export const AddCardFlow = ({ onComplete, onCancel }: AddCardFlowProps) => {
  const [queue, setQueue] = useState<QueueFile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  const [allTags, setAllTags] = useState<TagType[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allCollections, setAllCollections] = useState<Collection[]>([]);
  
  const [clipboard, setClipboard] = useState<{ tags: string[]; collections: string[] } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [showNewTagInput, setShowNewTagInput] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Загрузка данных при монтировании
  useState(() => {
    loadData();
  });

  const loadData = async () => {
    const [tags, categories, collections] = await Promise.all([
      getAllTags(),
      getAllCategories(),
      getAllCollections()
    ]);
    setAllTags(tags);
    setAllCategories(categories);
    setAllCollections(collections);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter(file => {
      const ext = file.name.toLowerCase();
      return ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.png') || 
             ext.endsWith('.webp') || ext.endsWith('.mp4') || ext.endsWith('.webm');
    });

    if (files.length === 0) {
      setMessage('❌ Не найдено поддерживаемых файлов');
      return;
    }

    if (files.length > 50) {
      setMessage('❌ Максимум 50 файлов за раз');
      return;
    }

    await processFiles(files);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    
    const files = Array.from(e.target.files);
    if (files.length > 50) {
      setMessage('❌ Максимум 50 файлов за раз');
      return;
    }

    await processFiles(files);
  };

  const processFiles = async (files: File[]) => {
    const newQueue: QueueFile[] = [];

    for (const file of files) {
      const preview = URL.createObjectURL(file);
      newQueue.push({
        file,
        preview,
        configured: false,
        tags: [],
        collections: []
      });
    }

    setQueue(newQueue);
    setCurrentIndex(0);
  };

  const currentFile = queue[currentIndex];

  const handleTagToggle = (tagId: string) => {
    if (!currentFile) return;

    const newQueue = [...queue];
    const current = newQueue[currentIndex];
    
    if (current.tags.includes(tagId)) {
      current.tags = current.tags.filter(id => id !== tagId);
    } else {
      current.tags.push(tagId);
    }
    
    current.configured = current.tags.length > 0;
    setQueue(newQueue);
  };

  const handleCollectionToggle = (collectionId: string) => {
    if (!currentFile) return;

    const newQueue = [...queue];
    const current = newQueue[currentIndex];
    
    if (current.collections.includes(collectionId)) {
      current.collections = current.collections.filter(id => id !== collectionId);
    } else {
      current.collections.push(collectionId);
    }
    
    setQueue(newQueue);
  };

  const handleCopySettings = () => {
    if (!currentFile) return;
    
    setClipboard({
      tags: [...currentFile.tags],
      collections: [...currentFile.collections]
    });
    setMessage('✅ Настройки скопированы');
    setTimeout(() => setMessage(null), 2000);
  };

  const handlePasteSettings = () => {
    if (!currentFile || !clipboard) return;

    const newQueue = [...queue];
    newQueue[currentIndex].tags = [...clipboard.tags];
    newQueue[currentIndex].collections = [...clipboard.collections];
    newQueue[currentIndex].configured = clipboard.tags.length > 0;
    setQueue(newQueue);
    
    setMessage('✅ Настройки применены');
    setTimeout(() => setMessage(null), 2000);
  };

  const handleNext = () => {
    if (!currentFile?.configured) {
      setMessage('❌ Добавьте хотя бы одну метку');
      return;
    }
    
    if (currentIndex < queue.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleRemoveFromQueue = (index: number) => {
    const newQueue = queue.filter((_, i) => i !== index);
    setQueue(newQueue);
    
    if (currentIndex >= newQueue.length) {
      setCurrentIndex(Math.max(0, newQueue.length - 1));
    }
  };

  const handleCreateTag = async (categoryId: string) => {
    if (!newTagName.trim()) return;

    // Проверка существования
    if (allTags.some(t => t.name.toLowerCase() === newTagName.toLowerCase())) {
      setMessage('❌ Метка с таким названием уже существует');
      return;
    }

    try {
      const category = allCategories.find(c => c.id === categoryId);
      const tag: TagType = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: newTagName.trim(),
        categoryId,
        color: category?.color,
        dateCreated: new Date(),
        cardCount: 0
      };

      await addTag(tag);
      setAllTags([...allTags, tag]);
      setNewTagName('');
      setShowNewTagInput(null);
      setMessage('✅ Метка создана');
      setTimeout(() => setMessage(null), 2000);
    } catch (error) {
      console.error('Ошибка создания метки:', error);
      setMessage('❌ Ошибка создания метки');
    }
  };

  const handleFinish = async () => {
    // Проверяем все ли файлы настроены
    const unconfigured = queue.filter(f => !f.configured);
    if (unconfigured.length > 0) {
      const index = queue.findIndex(f => !f.configured);
      setCurrentIndex(index);
      setMessage('❌ Не все файлы настроены. Добавьте метки.');
      return;
    }

    try {
      setMessage('💾 Сохранение карточек...');
      
      const createdCards: Card[] = [];
      
      for (const item of queue) {
        const card: Card = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          fileName: item.file.name,
          filePath: `/${item.file.name}`,
          type: item.file.type.startsWith('video/') ? 'video' : 'image',
          format: item.file.name.split('.').pop()?.toLowerCase() as any,
          dateAdded: new Date(),
          dateModified: new Date(),
          fileSize: item.file.size,
          thumbnailUrl: item.preview,
          tags: item.tags,
          collections: item.collections,
          inMoodboard: false
        };

        await addCard(card);
        createdCards.push(card);
      }

      setMessage(`✅ Добавлено ${createdCards.length} карточек!`);
      setTimeout(() => onComplete(createdCards), 1000);
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      setMessage('❌ Ошибка сохранения карточек');
    }
  };

  // Пустое состояние - drag & drop область
  if (queue.length === 0) {
    return (
      <div className="add-card-flow">
        <div
          className={`add-card-flow__dropzone ${isDragging ? 'add-card-flow__dropzone--dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="add-card-flow__dropzone-content">
            <svg width="96" height="96" viewBox="0 0 24 24" fill="none">
              <path
                d="M21 15V19C21 19.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V16M17 8L12 3M12 3L7 8M12 3V15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h3 className="h3">Перетащите файлы сюда</h3>
            <p className="text-m" style={{ color: 'var(--text-secondary)' }}>
              или нажмите чтобы выбрать файлы
            </p>
            <p className="text-s" style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>
              Поддерживаются: JPG, PNG, WEBP, MP4, WEBM (до 50 файлов)
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.mp4,.webm"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>
      </div>
    );
  }

  // Состояние настройки
  return (
    <div className="add-card-flow">
      {/* Очередь файлов */}
      <div className="add-card-flow__queue">
        <div className="add-card-flow__queue-scroll">
          {queue.map((item, index) => (
            <div
              key={index}
              className={`add-card-flow__queue-item ${index === currentIndex ? 'add-card-flow__queue-item--active' : ''}`}
              onClick={() => setCurrentIndex(index)}
            >
              <img src={item.preview} alt="" />
              {item.configured && (
                <div className="add-card-flow__queue-check">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M13 4L6 11L3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
              <button
                className="add-card-flow__queue-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFromQueue(index);
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        <p className="text-s" style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
          {queue.filter(f => f.configured).length} из {queue.length} настроено
        </p>
      </div>

      {/* Основной контент */}
      <div className="add-card-flow__main">
        {/* Превью */}
        <div className="add-card-flow__preview">
          {currentFile.file.type.startsWith('video/') ? (
            <video src={currentFile.preview} controls className="add-card-flow__media" />
          ) : (
            <img src={currentFile.preview} alt="" className="add-card-flow__media" />
          )}
        </div>

        {/* Настройки */}
        <div className="add-card-flow__settings">
          <div className="add-card-flow__header">
            <h4 className="h4">{currentFile.file.name}</h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button size="small" variant="secondary" onClick={handleCopySettings}>
                Копировать
              </Button>
              <Button size="small" variant="secondary" onClick={handlePasteSettings} disabled={!clipboard}>
                Применить
              </Button>
            </div>
          </div>

          {message && (
            <div style={{
              padding: '8px 12px',
              backgroundColor: message.includes('✅') ? 'var(--color-green-100)' : 'var(--color-red-100)',
              borderRadius: 'var(--radius-xs)',
              marginBottom: '12px'
            }}>
              <p className="text-s">{message}</p>
            </div>
          )}

          {/* Коллекции */}
          <div className="add-card-flow__section">
            <h4 className="text-m" style={{ fontWeight: 'var(--font-weight-bold)', marginBottom: '12px' }}>
              Коллекции
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {allCollections.map((coll) => (
                <Tag
                  key={coll.id}
                  variant={currentFile.collections.includes(coll.id) ? 'active' : 'default'}
                  onClick={() => handleCollectionToggle(coll.id)}
                  role="button"
                >
                  {coll.name}
                </Tag>
              ))}
            </div>
          </div>

          {/* Метки */}
          <div className="add-card-flow__section">
            <h4 className="text-m" style={{ fontWeight: 'var(--font-weight-bold)', marginBottom: '12px' }}>
              Метки {currentFile.tags.length === 0 && <span style={{ color: 'var(--text-error)' }}>*</span>}
            </h4>
            
            <Input
              placeholder="Поиск меток..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              fullWidth
              style={{ marginBottom: '16px' }}
            />

            <div className="add-card-flow__categories">
              {allCategories.map((category) => {
                const categoryTags = allTags.filter(t => t.categoryId === category.id);
                const filteredTags = searchQuery 
                  ? categoryTags.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  : categoryTags;

                if (filteredTags.length === 0 && !searchQuery) return null;

                return (
                  <div key={category.id} className="add-card-flow__category">
                    <p className="text-s" style={{ fontWeight: 'var(--font-weight-bold)', marginBottom: '8px' }}>
                      {category.name}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                      {filteredTags.map((tag) => (
                        <Tag
                          key={tag.id}
                          variant={currentFile.tags.includes(tag.id) ? 'active' : 'default'}
                          onClick={() => handleTagToggle(tag.id)}
                          color={tag.color}
                          role="button"
                        >
                          {tag.name}
                        </Tag>
                      ))}
                    </div>
                    
                    {showNewTagInput === category.id ? (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <Input
                          placeholder="Название метки"
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          size="medium"
                          autoFocus
                        />
                        <Button size="small" variant="primary" onClick={() => handleCreateTag(category.id)}>
                          Добавить
                        </Button>
                        <Button size="small" variant="ghost" onClick={() => { setShowNewTagInput(null); setNewTagName(''); }}>
                          ✕
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="small"
                        variant="ghost"
                        onClick={() => setShowNewTagInput(category.id)}
                      >
                        + Новая метка
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Навигация */}
          <div className="add-card-flow__footer">
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="ghost" onClick={onCancel}>
                Отмена
              </Button>
              <Button variant="secondary" onClick={handlePrevious} disabled={currentIndex === 0}>
                ← Назад
              </Button>
            </div>
            
            <p className="text-s" style={{ color: 'var(--text-secondary)' }}>
              {currentIndex + 1} из {queue.length}
            </p>

            <div style={{ display: 'flex', gap: '8px' }}>
              {currentIndex < queue.length - 1 ? (
                <Button variant="primary" onClick={handleNext}>
                  Далее →
                </Button>
              ) : (
                <Button variant="success" onClick={handleFinish}>
                  Завершить
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddCardFlow;

