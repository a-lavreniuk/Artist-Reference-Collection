/**
 * Компонент AddCardFlow - процесс добавления карточек
 * Drag & Drop, очередь, настройка меток для каждого файла
 */

import { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import { Button, Input, Icon, Tooltip } from '../common';
import { getAllTags, getAllCategories, getAllCollections, addCard, addTag, getCollection, updateCollection } from '../../services/db';
import { logImportFiles } from '../../services/history';
import { useFileSystem } from '../../hooks';
import { useAlert } from '../../hooks/useAlert';
import type { Card, Tag as TagType, Category, Collection } from '../../types';
import './AddCardFlow.css';

interface QueueFile {
  file: File;
  preview: string;
  configured: boolean;
  tags: string[];
  collections: string[];
  description?: string; // Описание карточки
  width?: number;  // Ширина изображения
  height?: number; // Высота изображения
  originalFilePath?: string; // Путь к исходному временному файлу (для удаления после сохранения)
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
  
  /** Начальные файлы для импорта (пути) */
  initialFiles?: string[];
  
  /** Callback для обновления состояния очереди */
  onQueueStateChange?: (hasQueue: boolean, configuredCount: number) => void;
  
  /** Callback для передачи handleFinish в родительский компонент */
  onFinishHandlerReady?: (handler: () => void) => void;
  
  /** Callback для передачи функции открытия файлового диалога */
  onOpenFileDialogReady?: (handler: () => void) => void;
}

export const AddCardFlow = ({ onComplete, onQueueStateChange, onFinishHandlerReady, onOpenFileDialogReady, initialFiles }: AddCardFlowProps) => {
  const alert = useAlert();
  
  // Загружаем очередь из sessionStorage при инициализации
  // ВАЖНО: Сохраняются только файлы с originalFilePath (из браузерного расширения),
  // так как File объекты из drag-and-drop нельзя восстановить после перезагрузки
  const loadQueueFromStorage = (): QueueFile[] => {
    try {
      const stored = sessionStorage.getItem('addCardQueuePaths');
      if (stored) {
        const paths: string[] = JSON.parse(stored);
        console.log('[AddCardFlow] Найдены пути файлов для восстановления:', paths.length);
        // Пути будут обработаны в useEffect через initialFiles механизм
        return [];
      }
    } catch (error) {
      console.error('[AddCardFlow] Ошибка загрузки очереди из sessionStorage:', error);
    }
    return [];
  };

  const loadCurrentIndexFromStorage = (): number => {
    try {
      const stored = sessionStorage.getItem('addCardCurrentIndex');
      if (stored) {
        return parseInt(stored, 10) || 0;
      }
    } catch (error) {
      console.error('[AddCardFlow] Ошибка загрузки currentIndex из sessionStorage:', error);
    }
    return 0;
  };

  const [queue, setQueue] = useState<QueueFile[]>(loadQueueFromStorage);
  const [currentIndex, setCurrentIndex] = useState(loadCurrentIndexFromStorage);
  const [isDragging, setIsDragging] = useState(false);
  
  const [allTags, setAllTags] = useState<TagType[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allCollections, setAllCollections] = useState<Collection[]>([]);
  
  const [clipboard, setClipboard] = useState<{ tags: string[]; collections: string[] } | null>(null);
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

  // Сохраняем пути файлов из браузерного расширения в sessionStorage
  // Файлы из drag-and-drop не сохраняются, так как их нельзя восстановить
  useEffect(() => {
    if (queue.length > 0) {
      try {
        // Сохраняем только пути файлов с originalFilePath
        const pathsToStore = queue
          .filter(item => item.originalFilePath)
          .map(item => item.originalFilePath) as string[];
        
        if (pathsToStore.length > 0) {
          sessionStorage.setItem('addCardQueuePaths', JSON.stringify(pathsToStore));
          console.log('[AddCardFlow] Пути файлов сохранены в sessionStorage:', pathsToStore.length);
        } else {
          sessionStorage.removeItem('addCardQueuePaths');
        }
      } catch (error) {
        console.error('[AddCardFlow] Ошибка сохранения путей в sessionStorage:', error);
      }
    } else {
      // Если очередь пуста, удаляем из хранилища
      sessionStorage.removeItem('addCardQueuePaths');
      sessionStorage.removeItem('addCardCurrentIndex');
    }
  }, [queue]);

  // Сохраняем currentIndex в sessionStorage при изменениях
  useEffect(() => {
    if (queue.length > 0) {
      sessionStorage.setItem('addCardCurrentIndex', currentIndex.toString());
    }
  }, [currentIndex, queue.length]);

  // Проверяем существование файлов при монтировании компонента
  useEffect(() => {
    const checkQueueFiles = async () => {
      if (queue.length === 0) return;

      const validQueue: QueueFile[] = [];
      const missingFiles: string[] = [];

      for (const item of queue) {
        // Проверяем существование файла, если есть originalFilePath
        if (item.originalFilePath) {
          try {
            const exists = await window.electronAPI.fileExists(item.originalFilePath);
            if (exists) {
              validQueue.push(item);
            } else {
              missingFiles.push(item.file.name);
              console.warn('[AddCardFlow] Файл не найден:', item.originalFilePath);
            }
          } catch (error) {
            console.error('[AddCardFlow] Ошибка проверки файла:', error);
            // Если ошибка проверки, оставляем файл в очереди
            validQueue.push(item);
          }
        } else {
          // Если нет originalFilePath, файл добавлен через drag-and-drop и хранится в памяти
          validQueue.push(item);
        }
      }

      // Если есть отсутствующие файлы, показываем предупреждение и обновляем очередь
      if (missingFiles.length > 0) {
        alert.warning(
          `Не найдено файлов: ${missingFiles.length}. Они были удалены из очереди.`
        );
        setQueue(validQueue);
        // Корректируем currentIndex если нужно
        if (currentIndex >= validQueue.length && validQueue.length > 0) {
          setCurrentIndex(validQueue.length - 1);
        }
      }
    };

    checkQueueFiles();
  }, []); // Запускаем только один раз при монтировании

  /**
   * Извлекает размеры изображения из File объекта
   */
  const getImageDimensions = (file: File): Promise<{ width: number; height: number } | null> => {
    return new Promise((resolve) => {
      // Проверяем, что это изображение
      if (!file.type.startsWith('image/')) {
        resolve(null);
        return;
      }

      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight
        });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };

      img.src = url;
    });
  };

  // Обработка начальных файлов (импорт из браузера)
  useEffect(() => {
    const loadInitialFiles = async () => {
      if (!initialFiles || initialFiles.length === 0) return;

      try {
        console.log('[AddCardFlow] Загрузка начальных файлов:', initialFiles.length);
        const newQueueItems: QueueFile[] = [];
        
        for (const filePath of initialFiles) {
          try {
            // Получаем Data URL через Electron API (обходим ограничение file://)
            const dataUrl = await window.electronAPI.getFileURL(filePath);
            
            // Конвертируем Data URL в Blob
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            
            // Создаем File объект
            const fileName = filePath.split(/[/\\]/).pop() || 'image.jpg';
            const file = new File([blob], fileName, { type: blob.type });
            
            const preview = URL.createObjectURL(file);
            
            // Извлекаем размеры для изображений
            let width: number | undefined;
            let height: number | undefined;
            
            if (file.type.startsWith('image/')) {
              const dimensions = await getImageDimensions(file);
              if (dimensions) {
                width = dimensions.width;
                height = dimensions.height;
              }
            }

            newQueueItems.push({
              file,
              preview,
              configured: false,
              tags: [],
              collections: [],
              description: '',
              width,
              height,
              originalFilePath: filePath // Сохраняем путь для последующего удаления
            });
          } catch (error) {
            console.error(`Ошибка загрузки файла ${filePath}:`, error);
          }
        }
        
        if (newQueueItems.length > 0) {
          // Добавляем новые файлы к существующей очереди
          setQueue(prevQueue => {
            const wasEmpty = prevQueue.length === 0;
            const newQueue = [...prevQueue, ...newQueueItems];
            
            // Переключаемся на первый новый файл, если очередь была пуста
            if (wasEmpty) {
              setCurrentIndex(0);
            }
            
            return newQueue;
          });
        }
      } catch (error) {
        console.error('Ошибка обработки начальных файлов:', error);
      }
    };

    loadInitialFiles();
  }, [initialFiles]);

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
      
      // Извлекаем размеры для изображений
      let width: number | undefined;
      let height: number | undefined;
      
      if (file.type.startsWith('image/')) {
        const dimensions = await getImageDimensions(file);
        if (dimensions) {
          width = dimensions.width;
          height = dimensions.height;
        }
      }

      newQueueItems.push({
        file,
        preview,
        configured: true, // Карточка всегда считается настроенной (можно добавить без меток)
        tags: [],
        collections: [],
        description: '',
        width,
        height
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
    
    // Карточка всегда считается настроенной (можно добавить без меток)
    current.configured = true;
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

  const handleDescriptionChange = (value: string) => {
    if (!currentFile) return;

    // Ограничение до 2000 символов
    const truncatedValue = value.length > 2000 ? value.substring(0, 2000) : value;

    const newQueue = [...queue];
    newQueue[currentIndex].description = truncatedValue;
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
    // Карточка всегда считается настроенной (можно добавить без меток)
    newQueue[currentIndex].configured = true;
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
    // Все карточки считаются настроенными (можно добавить без меток)
    // Продолжаем сразу без проверок
    continueFinish();
  };
  
  // Продолжение процесса добавления
  const continueFinish = async () => {
    // Все карточки в очереди считаются настроенными (можно добавить без меток)
    const configured = queue;

    // Проверяем доступ к директории
    if (!directoryPath || !hasPermission) {
      alert.error('Нет доступа к рабочей папке. Перейдите в настройки и выберите папку');
      return;
    }

    try {
      alert.info(`Сохранение ${configured.length} ${configured.length === 1 ? 'карточки' : 'карточек'}. Это может занять некоторое время...`);
      
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
        
        try {
          let savedFilePath: string;
          
          // Если файл был импортирован из браузера (есть originalFilePath), перемещаем его
          if (item.originalFilePath) {
            console.log('[AddCardFlow] Перемещение файла из временной папки:', item.originalFilePath);
            savedFilePath = await window.electronAPI.moveFileToWorkingDir(
              item.originalFilePath,
              directoryPath
            );
            console.log('[AddCardFlow] Файл перемещён:', savedFilePath);
          } else {
            // Иначе используем старый способ - читаем в буфер и сохраняем
            const arrayBuffer = await item.file.arrayBuffer();
            console.log('[AddCardFlow] Сохранение файла:', item.file.name, 'в папку:', directoryPath);
            savedFilePath = await window.electronAPI.saveFileFromBuffer(
              arrayBuffer,
              item.file.name,
              directoryPath
            );
            console.log('[AddCardFlow] Файл сохранён:', savedFilePath);
          }
          
          // Генерируем превью (новый формат возвращает объект с путями)
          const thumbnailResult = await window.electronAPI.generateThumbnail(
            savedFilePath,
            directoryPath
          );
          
          // Обрабатываем новый формат (объект) или старый (строка для обратной совместимости)
          let blurThumbnailUrl = '';
          let thumbnailUrlCompact = '';
          let thumbnailUrlStandard = '';
          let thumbnailUrl = ''; // Legacy для обратной совместимости
          
          if (typeof thumbnailResult === 'object' && thumbnailResult !== null) {
            // Новый формат: объект с путями к разным размерам превью
            // Проверяем существование файлов превью
            if (thumbnailResult.blur) {
              const blurExists = await window.electronAPI.fileExists(thumbnailResult.blur);
              if (blurExists) {
                blurThumbnailUrl = await window.electronAPI.getFileURL(thumbnailResult.blur);
              }
            }
            
            if (thumbnailResult.compact) {
              const compactExists = await window.electronAPI.fileExists(thumbnailResult.compact);
              if (compactExists) {
                thumbnailUrlCompact = await window.electronAPI.getFileURL(thumbnailResult.compact);
              }
            }
            
            if (thumbnailResult.standard) {
              const standardExists = await window.electronAPI.fileExists(thumbnailResult.standard);
              if (standardExists) {
                thumbnailUrlStandard = await window.electronAPI.getFileURL(thumbnailResult.standard);
                thumbnailUrl = thumbnailUrlStandard; // Для обратной совместимости
              }
            }
          } else {
            // Старый формат: строка с путем (обратная совместимость)
            const thumbnailExists = await window.electronAPI.fileExists(thumbnailResult);
            if (thumbnailExists) {
              thumbnailUrl = await window.electronAPI.getFileURL(thumbnailResult);
              thumbnailUrlStandard = thumbnailUrl; // Используем как standard превью
            }
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
            width: item.width,  // Ширина изображения
            height: item.height, // Высота изображения
            thumbnailUrl, // Legacy для обратной совместимости
            blurThumbnailUrl, // Blur превью для placeholder
            thumbnailUrlCompact, // Превью для компактного режима
            thumbnailUrlStandard, // Превью для стандартного режима
            tags: item.tags,
            collections: item.collections,
            description: item.description?.trim() || undefined // Сохраняем описание, если оно не пустое
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
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (createdCards.length === 0) {
        alert.error('Не удалось сохранить ни один файл. Проверьте консоль для подробностей.');
        return;
      }

      // Логируем импорт файлов
      await logImportFiles(createdCards.length);

      // Файлы уже перемещены в рабочую папку (не удалены), поэтому ничего дополнительно делать не нужно

      // Очищаем sessionStorage после успешного добавления
      sessionStorage.removeItem('addCardQueuePaths');
      sessionStorage.removeItem('addCardCurrentIndex');
      console.log('[AddCardFlow] Очередь очищена из sessionStorage после успешного добавления');

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
            accept=".jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,.tif,.heic,.heif,.jxl,.cr2,.nef,.dng,.arw,.orf,.rw2,.pdf,.mp4,.webm,.mov,.avi,.mkv,.flv,.wmv,.mpeg,.mpg,.m2v,.3gp,.ts,.mts,.m4v,.ogv,.vob,.rmvb,.swf"
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
        accept=".jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,.tif,.heic,.heif,.jxl,.cr2,.nef,.dng,.arw,.orf,.rw2,.pdf,.mp4,.webm,.mov,.avi,.mkv,.flv,.wmv,.mpeg,.mpg,.m2v,.3gp,.ts,.mts,.m4v,.ogv,.vob,.rmvb,.swf"
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
          {/* Блок 1: Шаблон и Описание - объединены по горизонтали */}
          <div className="add-card-flow__block-row">
            {/* Блок шаблона */}
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

            {/* Блок описания */}
            <div className="add-card-flow__block add-card-flow__block--description">
              <div className="add-card-flow__block-header">
                <h3 className="add-card-flow__block-title">Описание</h3>
              </div>
              <textarea
                className="input add-card-flow__description-textarea"
                placeholder="Введите описание…"
                value={currentFile.description || ''}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                maxLength={2000}
                rows={4}
              />
              {(currentFile.description?.length || 0) > 0 && (
                <p className="text-s" style={{ 
                  color: 'var(--text-secondary)', 
                  marginTop: '8px',
                  textAlign: 'right'
                }}>
                  {(currentFile.description?.length || 0)} / 2000
                </p>
              )}
            </div>
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
                  ? categoryTags.filter(t => {
                      const queryLower = tagsSearchQuery.toLowerCase();
                      const nameMatch = t.name.toLowerCase().includes(queryLower);
                      const descriptionMatch = t.description?.toLowerCase().includes(queryLower) || false;
                      return nameMatch || descriptionMatch;
                    })
                  : categoryTags;

                // Скрываем категорию если нет меток (или нет совпадений при поиске)
                if (filteredTags.length === 0) return null;

                // Сортируем метки по алфавиту (а→я, a→z)
                const sortedTags = [...filteredTags].sort((a, b) => {
                  return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
                });

                return (
                  <div key={category.id} className="add-card-flow__category">
                    <p className="text-s" style={{ fontWeight: 'var(--font-weight-bold)', marginBottom: '8px' }}>
                      {category.name}
                    </p>
                    <div className="add-card-flow__tags-list" style={{ marginBottom: '8px' }}>
                      {sortedTags.map((tag) => {
                        const isSelected = currentFile.tags.includes(tag.id);
                        const tooltipContent = tag.description || tag.name;
                        return (
                          <Tooltip
                            key={tag.id}
                            content={tooltipContent}
                            delay={500}
                            position="top"
                          >
                            <button
                              className={`add-card-flow__tag-button ${isSelected ? 'add-card-flow__tag-button--selected' : ''}`}
                              onClick={() => handleTagToggle(tag.id)}
                            >
                              <span className="text-s">{tag.name}</span>
                              {isSelected && <Icon name="x" size={16} variant="border" />}
                            </button>
                          </Tooltip>
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

        </div>
      </div>
    </div>
  );
};

export default AddCardFlow;

