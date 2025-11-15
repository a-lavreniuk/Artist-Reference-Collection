/**
 * Компонент AddCardFlow - процесс добавления карточек
 * Drag & Drop, очередь, настройка меток для каждого файла
 */

import { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import { Button, Input, Icon } from '../common';
import { getAllTags, getAllCategories, getAllCollections, addCard, addTag, getCollection, updateCollection } from '../../services/db';
import { logImportFiles } from '../../services/history';
import { useFileSystem } from '../../hooks';
import { useToast } from '../../hooks/useToast';
import { useAlert } from '../../hooks/useAlert';
import type { Card, Tag as TagType, Category, Collection } from '../../types';
import './AddCardFlow.css';

interface QueueFile {
  file: File;
  preview: string;
  configured: boolean;
  tags: string[];
  collections: string[];
}

// Мемоизированный компонент элемента очереди для оптимизации производительности
interface QueueItemProps {
  item: QueueFile;
  index: number;
  isActive: boolean;
  onSelect: (index: number) => void;
  onRemove: (index: number) => void;
  isDraggingRef?: React.MutableRefObject<boolean>;
}

const QueueItem = memo(({ item, index, isActive, onSelect, onRemove, isDraggingRef }: QueueItemProps) => {
  const handleClick = () => {
    if (isDraggingRef?.current) return;
    onSelect(index);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(index);
  };

  return (
    <div
      className={`add-card-flow__queue-item ${isActive ? 'add-card-flow__queue-item--active' : ''}`}
      onClick={handleClick}
    >
      {item.file.type.startsWith('video/') ? (
        <video src={item.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <img src={item.preview} alt="" loading="lazy" />
      )}
      {item.configured && (
        <div className="add-card-flow__queue-check">
          <Icon name="check" size={16} variant="border" />
        </div>
      )}
      <button
        className="add-card-flow__queue-remove"
        onClick={handleRemove}
      >
        <Icon name="x" size={16} variant="border" />
      </button>
    </div>
  );
});

QueueItem.displayName = 'QueueItem';

export interface AddCardFlowProps {
  /** Обработчик завершения */
  onComplete: (addedCount: number) => void;
  
  /** Обработчик отмены */
  onCancel: () => void;
  
  /** Callback для обновления состояния очереди */
  onQueueStateChange?: (hasQueue: boolean, configuredCount: number) => void;
  
  /** Callback для передачи handleFinish в родительский компонент */
  onFinishHandlerReady?: (handler: () => void) => void;
  
  /** Callback для передачи функции открытия файлового диалога */
  onOpenFileDialogReady?: (handler: () => void) => void;
}

export const AddCardFlow = ({ onComplete, onQueueStateChange, onFinishHandlerReady, onOpenFileDialogReady }: AddCardFlowProps) => {
  const toast = useToast();
  const alert = useAlert();
  const [queue, setQueue] = useState<QueueFile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  const [allTags, setAllTags] = useState<TagType[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allCollections, setAllCollections] = useState<Collection[]>([]);
  
  const [clipboard, setClipboard] = useState<{ tags: string[]; collections: string[] } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [collectionsSearchQuery, setCollectionsSearchQuery] = useState('');
  const [tagsSearchQuery, setTagsSearchQuery] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [showNewTagInput, setShowNewTagInput] = useState<string | null>(null);
  const [hasScroll, setHasScroll] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queueScrollRef = useRef<HTMLDivElement>(null);
  const queueDragStateRef = useRef<{ pointerId: number | null; startX: number; lastX: number }>({
    pointerId: null,
    startX: 0,
    lastX: 0
  });
  const queueDraggingRef = useRef(false);
  const queuePointerDownItemRef = useRef<HTMLElement | null>(null);
  
  // Получаем доступ к файловой системе
  const { directoryPath, hasPermission } = useFileSystem();

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

  // Загрузка данных при монтировании
  useEffect(() => {
    loadData();
  }, []);

  // Проверяем нужен ли скролл (с debounce для оптимизации)
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    const checkScroll = () => {
      if (queueScrollRef.current) {
        const needsScroll = queueScrollRef.current.scrollWidth > queueScrollRef.current.clientWidth;
        setHasScroll(needsScroll);
      }
    };

    // Debounce проверки скролла для оптимизации производительности
    const debouncedCheckScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(checkScroll, 100);
    };

    checkScroll();
    window.addEventListener('resize', debouncedCheckScroll);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', debouncedCheckScroll);
    };
  }, [queue]);

  const handleQueuePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;

    // КРИТИЧЕСКИ ВАЖНО: Игнорируем клики на кнопки, инпуты и textarea
    // Это позволяет выделять текст в инпутах без захвата pointer events
    if (target.closest('button') ||
        target.closest('input') ||
        target.closest('textarea') ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA') {
      console.log('[AddCardFlow] Игнорируем pointer на инпуте/кнопке');
      return;
    }

    const slider = queueScrollRef.current;
    if (!slider) return;

    queueDragStateRef.current.pointerId = event.pointerId;
    queueDragStateRef.current.startX = event.clientX;
    queueDragStateRef.current.lastX = event.clientX;
    queueDraggingRef.current = false;
    queuePointerDownItemRef.current = (event.target as HTMLElement).closest('.add-card-flow__queue-item') as HTMLElement | null;

    // КРИТИЧЕСКИ ВАЖНО: НЕ захватываем pointer для инпутов
    // setPointerCapture блокирует все pointer события, включая выделение текста
    if (slider.setPointerCapture) {
      slider.setPointerCapture(event.pointerId);
    }
    slider.classList.add('active');
  }, []);

  const handleQueuePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const slider = queueScrollRef.current;
    if (!slider) return;

    const state = queueDragStateRef.current;
    if (state.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - state.lastX;
    state.lastX = event.clientX;

    if (!queueDraggingRef.current && Math.abs(event.clientX - state.startX) > 3) {
      queueDraggingRef.current = true;
      queuePointerDownItemRef.current = null;
    }

    if (queueDraggingRef.current) {
      slider.scrollLeft -= deltaX;
      event.preventDefault();
    }
  }, []);

  const resetQueueDragState = useCallback(() => {
    queueDragStateRef.current.pointerId = null;
    queueDragStateRef.current.startX = 0;
    queueDragStateRef.current.lastX = 0;
  }, []);

  const handleQueuePointerEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const slider = queueScrollRef.current;
    if (!slider) return;

    const state = queueDragStateRef.current;
    if (state.pointerId !== event.pointerId) return;

    if (slider.hasPointerCapture?.(event.pointerId)) {
      slider.releasePointerCapture(event.pointerId);
    }
    slider.classList.remove('active');

    const wasDragging = queueDraggingRef.current;
    resetQueueDragState();

    if (wasDragging) {
      requestAnimationFrame(() => {
        queueDraggingRef.current = false;
      });
    } else {
      queueDraggingRef.current = false;

      const queueItem = queuePointerDownItemRef.current;
      if (queueItem && slider.contains(queueItem)) {
        const index = Array.from(slider.children).indexOf(queueItem);
        if (index !== -1 && index < queue.length) {
          setCurrentIndex(index);
        }
      }
    }

    queuePointerDownItemRef.current = null;
  }, [resetQueueDragState, queue.length]);

  const handleQueuePointerLeave = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const slider = queueScrollRef.current;
    if (!slider) return;

    const state = queueDragStateRef.current;
    if (state.pointerId !== event.pointerId) return;

    if (slider.hasPointerCapture?.(event.pointerId)) {
      slider.releasePointerCapture(event.pointerId);
    }
    slider.classList.remove('active');
    queueDraggingRef.current = false;
    resetQueueDragState();
    queuePointerDownItemRef.current = null;
  }, [resetQueueDragState]);

  // Мемоизированные вычисления для оптимизации производительности
  const currentFile = useMemo(() => queue[currentIndex], [queue, currentIndex]);
  
  const configuredCount = useMemo(() => {
    return queue.filter(f => f.configured).length;
  }, [queue]);

  // Обновление состояния очереди для header
  useEffect(() => {
    if (onQueueStateChange) {
      onQueueStateChange(queue.length > 0, configuredCount);
    }
  }, [queue.length, configuredCount, onQueueStateChange]);

  // Передаём handleFinish в родительский компонент
  useEffect(() => {
    if (onFinishHandlerReady) {
      onFinishHandlerReady(handleFinish);
    }
  }, [queue, directoryPath, hasPermission, onFinishHandlerReady]);

  // Передаём функцию открытия файлового диалога
  useEffect(() => {
    if (onOpenFileDialogReady) {
      const openDialog = () => fileInputRef.current?.click();
      onOpenFileDialogReady(openDialog);
    }
  }, [onOpenFileDialogReady]);

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
      alert.warning('Не найдено поддерживаемых файлов');
      return;
    }

    // Проверяем общий лимит (45 файлов в очереди)
    if (queue.length + files.length > 45) {
      alert.warning(`Максимум 45 файлов в очереди. Уже добавлено: ${queue.length}`);
      return;
    }

    await processFiles(files);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    
    const files = Array.from(e.target.files);
    
    // Проверяем общий лимит (45 файлов в очереди)
    if (queue.length + files.length > 45) {
      alert.warning(`Максимум 45 файлов в очереди. Уже добавлено: ${queue.length}`);
      // Сбрасываем значение input
      if (e.target) {
        e.target.value = '';
      }
      return;
    }

    await processFiles(files);
    
    // Сбрасываем значение input после обработки, чтобы можно было снова выбрать те же файлы
    if (e.target) {
      e.target.value = '';
    }
  };

  const processFiles = async (files: File[]) => {
    const newQueueItems: QueueFile[] = [];

    for (const file of files) {
      const preview = URL.createObjectURL(file);
      newQueueItems.push({
        file,
        preview,
        configured: false,
        tags: [],
        collections: []
      });
    }

    // Добавляем новые файлы к существующей очереди, а не заменяем её
    setQueue(prevQueue => {
      const wasEmpty = prevQueue.length === 0;
      const newQueue = [...prevQueue, ...newQueueItems];
      
      // Переключаемся на первый новый файл, если очередь была пуста
      if (wasEmpty) {
        setCurrentIndex(0);
      }
      
      return newQueue;
    });
  };

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
    alert.success('Настройки скопированы');
  };

  const handlePasteSettings = () => {
    if (!currentFile || !clipboard) return;

    const newQueue = [...queue];
    newQueue[currentIndex].tags = [...clipboard.tags];
    newQueue[currentIndex].collections = [...clipboard.collections];
    newQueue[currentIndex].configured = clipboard.tags.length > 0;
    setQueue(newQueue);
    
    alert.success('Настройки применены');
  };

  // Мемоизированные обработчики для оптимизации производительности
  const handleSelectQueueItem = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  const handleRemoveFromQueue = useCallback((index: number) => {
    setQueue(prevQueue => {
      const newQueue = prevQueue.filter((_, i) => i !== index);
      setCurrentIndex(prevIndex => {
        if (prevIndex >= newQueue.length) {
          return Math.max(0, newQueue.length - 1);
        }
        return prevIndex;
      });
      return newQueue;
    });
  }, []);

  const handleNext = useCallback(() => {
    // Просто листаем без проверки меток
    if (currentIndex < queue.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, queue.length]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const handleCreateTag = async (categoryId: string) => {
    if (!newTagName.trim()) return;

    // Проверка существования
    if (allTags.some(t => t.name.toLowerCase() === newTagName.toLowerCase())) {
      alert.warning('Метка с таким названием уже существует');
      return;
    }

    try {
      // const category = allCategories.find(c => c.id === categoryId);
      const tag: TagType = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: newTagName.trim(),
        categoryId,
        dateCreated: new Date(),
        cardCount: 0
      };

      await addTag(tag);
      setAllTags([...allTags, tag]);
      setNewTagName('');
      setShowNewTagInput(null);
      alert.success('Метка создана');
    } catch (error) {
      console.error('Ошибка создания метки:', error);
      alert.error('Не удалось создать метку');
    }
  };

  const handleFinish = async () => {
    // Проверяем сколько файлов настроено
    const configured = queue.filter(f => f.configured);
    const unconfigured = queue.filter(f => !f.configured);
    
    if (configured.length === 0) {
      alert.warning('Добавьте метки хотя бы к одной карточке');
      return;
    }

    // Если не все файлы настроены - спрашиваем подтверждение
    if (unconfigured.length > 0) {
      toast.showToast({
        title: 'Добавить карточки',
        message: `Настройки применены к ${configured.length} из ${queue.length} карточек. Оставшиеся ${unconfigured.length} карточек будут удалены из очереди. Продолжить?`,
        type: 'error',
        onConfirm: () => {
          // Продолжаем выполнение после подтверждения
          continueFinish();
        },
        confirmText: 'Продолжить',
        cancelText: 'Отмена'
      });
      return; // Выходим и ждем подтверждения
    }
    
    // Если все файлы настроены, продолжаем сразу
    continueFinish();
  };
  
  // Продолжение процесса добавления после подтверждения
  const continueFinish = async () => {
    const configured = queue.filter(f => f.configured);

    // Проверяем доступ к директории
    if (!directoryPath || !hasPermission) {
      alert.error('Нет доступа к рабочей папке. Перейдите в настройки и выберите папку');
      return;
    }

    try {
      setMessage('💾 Сохранение файлов в рабочую папку...');
      
      const createdCards: Card[] = [];
      
      // Проверяем наличие рабочей папки
      if (!directoryPath) {
        alert.error('Рабочая папка не настроена. Пожалуйста, выберите рабочую папку в настройках.');
        return;
      }
      
      console.log('[AddCardFlow] Начинаем сохранение, рабочая папка:', directoryPath);
      
      // Сохраняем только настроенные карточки
      for (let i = 0; i < configured.length; i++) {
        const item = configured[i];
        setMessage(`💾 Сохранение ${i + 1}/${configured.length}: ${item.file.name}`);
        
        try {
          // Читаем файл как ArrayBuffer
          const arrayBuffer = await item.file.arrayBuffer();
          
          console.log('[AddCardFlow] Сохранение файла:', item.file.name, 'в папку:', directoryPath);
          
          // Сохраняем файл в рабочую папку через Electron API
          const savedFilePath = await window.electronAPI.saveFileFromBuffer(
            arrayBuffer,
            item.file.name,
            directoryPath
          );
          console.log('[AddCardFlow] Файл сохранён:', savedFilePath);
          
          // Генерируем превью
          const thumbnailPath = await window.electronAPI.generateThumbnail(
            savedFilePath,
            directoryPath
          );
          console.log('[AddCardFlow] Превью создано:', thumbnailPath);
          
          // Проверяем существование файла превью перед чтением
          const thumbnailExists = await window.electronAPI.fileExists(thumbnailPath);
          console.log('[AddCardFlow] Превью существует:', thumbnailExists);
          
          // Получаем Data URL для превью (если существует)
          let thumbnailUrl = '';
          if (thumbnailExists) {
            thumbnailUrl = await window.electronAPI.getFileURL(thumbnailPath);
            console.log('[AddCardFlow] Data URL создан');
          } else {
            console.warn('[AddCardFlow] Превью не создано, будет использован placeholder');
            // Для видео без превью используем пустую строку - UI покажет placeholder
            thumbnailUrl = '';
          }

          // Создаём карточку с правильными путями
          const card: Card = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            fileName: item.file.name,
            filePath: savedFilePath, // Полный путь к файлу
            type: item.file.type.startsWith('video/') ? 'video' : 'image',
            format: item.file.name.split('.').pop()?.toLowerCase() as any,
            dateAdded: new Date(),
            dateModified: new Date(),
            fileSize: item.file.size,
            thumbnailUrl, // file:// URL для превью
            tags: item.tags,
            collections: item.collections,
            inMoodboard: false
          };

          await addCard(card);
          
          // Обновляем коллекции - добавляем ID карточки в каждую коллекцию
          for (const collectionId of item.collections) {
            const collection = await getCollection(collectionId);
            if (collection) {
              await updateCollection(collectionId, {
                cardIds: [...collection.cardIds, card.id]
              });
            }
          }
          
          createdCards.push(card);
        } catch (fileError: any) {
          console.error(`Ошибка сохранения файла ${item.file.name}:`, fileError);
          
          // Показываем ошибку через alert
          const errorMessage = fileError?.message || String(fileError);
          alert.error(`Ошибка сохранения файла ${item.file.name}: ${errorMessage}`);
          
          // Продолжаем с следующим файлом
          setMessage(`⚠️ Не удалось сохранить ${item.file.name}`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (createdCards.length === 0) {
        alert.error('Не удалось сохранить ни один файл. Проверьте консоль для подробностей.');
        return;
      }

      // Логируем импорт файлов
      await logImportFiles(createdCards.length);

      // Завершаем добавление - Alert покажется в AddPage
      setTimeout(() => onComplete(createdCards.length), 500);
    } catch (error: any) {
      console.error('Ошибка сохранения:', error);
      const errorMessage = error?.message || String(error);
      alert.error(`Ошибка сохранения карточек: ${errorMessage}`);
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
            <h2 className="add-card-flow__dropzone-title">Добавить изображение или видео...</h2>
            <p className="add-card-flow__dropzone-text">
              Можно перетащить файлы в это окно или нажать на кнопку.
              <br />
              Допускается загрузка нескольких файлов одновременно,
              <br />
              но не более 50-ти в очереди
            </p>
            <Button
              variant="primary"
              size="L"
              iconRight={<Icon name="plus" size={24} variant="border" />}
            >
              Добавить
            </Button>
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
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,.mp4,.webm"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      {/* Очередь файлов */}
      <div className="add-card-flow__queue">
        <div 
          ref={queueScrollRef}
          className={`add-card-flow__queue-scroll ${hasScroll ? 'add-card-flow__queue-scroll--has-scroll' : ''}`}
          onPointerDown={handleQueuePointerDown}
          onPointerMove={handleQueuePointerMove}
          onPointerUp={handleQueuePointerEnd}
          onPointerCancel={handleQueuePointerEnd}
          onPointerLeave={handleQueuePointerLeave}
        >
          {queue.map((item, index) => (
            <QueueItem
              key={index}
              item={item}
              index={index}
              isActive={index === currentIndex}
              onSelect={handleSelectQueueItem}
              onRemove={handleRemoveFromQueue}
              isDraggingRef={queueDraggingRef}
            />
          ))}
          
          {/* Пустая карточка для добавления еще файлов (до 45 файлов в очереди) */}
          {queue.length < 45 && (
            <button
              className="add-card-flow__queue-item add-card-flow__queue-item--add"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              aria-label="Добавить еще файлы"
              type="button"
            >
              <Icon name="plus" size={24} variant="border" />
            </button>
          )}
        </div>
        {/* Убрали счётчик [число] из [число] */}
      </div>

      {/* Разделитель - обычная линия (показывается только когда НЕТ скролла) */}
      {!hasScroll && <div className="add-card-flow__divider-line" />}

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

          {/* Блок 1: Шаблон - копирование и применение настроек */}
          <div className="add-card-flow__block add-card-flow__block--template">
            <div className="add-card-flow__block-header">
              <h3 className="add-card-flow__block-title">Шаблон</h3>
              <div className="add-card-flow__template-actions">
                <button 
                  className="add-card-flow__template-button"
                  onClick={handleCopySettings}
                  disabled={currentFile.tags.length === 0 && currentFile.collections.length === 0}
                  title="Копировать настройки"
                >
                  <Icon name="save" size={24} variant="border" />
                </button>
                <button 
                  className="add-card-flow__template-button"
                  onClick={handlePasteSettings}
                  disabled={!clipboard}
                  title="Применить настройки"
                >
                  <Icon name="download" size={24} variant="border" />
                </button>
              </div>
            </div>
            <p className="add-card-flow__block-description">
              Сохранить настройки для применения к другим файлам
            </p>
          </div>

          {/* Блок 2: Коллекции */}
          <div className="add-card-flow__block add-card-flow__block--collections">
            <div className="add-card-flow__block-header">
              <h3 className="add-card-flow__block-title">
                Коллекции
                {currentFile.collections.length > 0 && (
                  <span className="add-card-flow__block-counter">{currentFile.collections.length}</span>
                )}
              </h3>
            </div>
            <Input
              placeholder="Поиск коллекций..."
              value={collectionsSearchQuery}
              onChange={(e) => setCollectionsSearchQuery(e.target.value)}
              fullWidth
              className="add-card-flow__search-input"
              clearable
              onClear={() => setCollectionsSearchQuery('')}
            />
            <div className="add-card-flow__tags-list">
              {allCollections
                .filter(coll => 
                  collectionsSearchQuery === '' || 
                  coll.name.toLowerCase().includes(collectionsSearchQuery.toLowerCase())
                )
                .map((coll) => {
                  const isSelected = currentFile.collections.includes(coll.id);
                  return (
                    <button
                      key={coll.id}
                      className={`add-card-flow__tag-button ${isSelected ? 'add-card-flow__tag-button--selected' : ''}`}
                      onClick={() => handleCollectionToggle(coll.id)}
                    >
                      <span className="text-s">{coll.name}</span>
                      {isSelected && <Icon name="x" size={16} variant="border" />}
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Блок 3: Метки с категориями */}
          <div className="add-card-flow__block add-card-flow__block--tags">
            <div className="add-card-flow__block-header">
              <h3 className="add-card-flow__block-title">
                Метки
                {currentFile.tags.length > 0 && (
                  <span className="add-card-flow__block-counter">{currentFile.tags.length}</span>
                )}
              </h3>
            </div>
            <Input
              placeholder="Поиск меток..."
              value={tagsSearchQuery}
              onChange={(e) => setTagsSearchQuery(e.target.value)}
              fullWidth
              className="add-card-flow__search-input"
              clearable
              onClear={() => setTagsSearchQuery('')}
            />

            <div className="add-card-flow__categories">
              {allCategories.map((category) => {
                const categoryTags = allTags.filter(t => t.categoryId === category.id);
                const filteredTags = tagsSearchQuery 
                  ? categoryTags.filter(t => t.name.toLowerCase().includes(tagsSearchQuery.toLowerCase()))
                  : categoryTags;

                // Скрываем категорию если нет меток (или нет совпадений при поиске)
                if (filteredTags.length === 0) return null;

                return (
                  <div key={category.id} className="add-card-flow__category">
                    <p className="text-s" style={{ fontWeight: 'var(--font-weight-bold)', marginBottom: '8px' }}>
                      {category.name}
                    </p>
                    <div className="add-card-flow__tags-list" style={{ marginBottom: '8px' }}>
                      {filteredTags.map((tag) => {
                        const isSelected = currentFile.tags.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            className={`add-card-flow__tag-button ${isSelected ? 'add-card-flow__tag-button--selected' : ''}`}
                            onClick={() => handleTagToggle(tag.id)}
                          >
                            <span className="text-s">{tag.name}</span>
                            {isSelected && <Icon name="x" size={16} variant="border" />}
                          </button>
                        );
                      })}
                      <button
                        className="add-card-flow__add-tag-button"
                        onClick={() => setShowNewTagInput(showNewTagInput === category.id ? null : category.id)}
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
                        onClear={() => setNewTagName('')}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Навигация - показывается только если в очереди больше одного файла */}
          {queue.length > 1 && (
            <div className="add-card-flow__footer">
              <Button 
                variant="border" 
                size="L"
                iconOnly
                iconLeft={<Icon name="arrow-left" size={24} variant="border" />}
                onClick={handlePrevious} 
                disabled={currentIndex === 0}
                title="Назад"
              />

              <Button 
                variant="border" 
                size="L"
                iconOnly
                iconLeft={<Icon name="arrow-left" size={24} variant="border" style={{ transform: 'scaleX(-1)' }} />}
                onClick={handleNext}
                disabled={currentIndex >= queue.length - 1}
                title="Далее"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddCardFlow;

