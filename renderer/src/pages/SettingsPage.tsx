/**
 * Страница настроек
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout';
import { useSearch } from '../contexts';
import { Button, Icon } from '../components/common';
import { HistorySection } from '../components/settings';
import { useFileSystem } from '../hooks';
// import { useToast } from '../hooks/useToast';
import { useAlert } from '../hooks/useAlert';
import { useDialog } from '../hooks/useDialog';
import { getStatistics, db, exportDatabase, importDatabase, getTopTags, getTopCollections, getUnderusedTags, deleteTag, recalculateTagCounts } from '../services/db';
import { logCreateBackup, logMoveStorage } from '../services/history';
import type { AppStatistics, Tag, Collection } from '../types';
import { WhatsNewModal } from '../components/common';
import { getLatestVersion } from '../data/changelog';
import type { VersionChange } from '../data/changelog';
import './SettingsPage.css';

type SettingsTab = 'storage' | 'statistics' | 'history';

type TagWithCategory = Tag & { categoryName: string };
type CollectionWithCount = Collection & { cardCount: number };

export const SettingsPage = () => {
  const navigate = useNavigate();
  const { searchProps, setSelectedTags } = useSearch();
  const { requestDirectory, directoryPath } = useFileSystem();
  // const toast = useToast();
  const alert = useAlert();
  const dialog = useDialog();
  const [activeTab, setActiveTab] = useState<SettingsTab>('storage');
  const [stats, setStats] = useState<AppStatistics | null>(null);
  const [topTags, setTopTags] = useState<TagWithCategory[]>([]);
  const [topCollections, setTopCollections] = useState<CollectionWithCount[]>([]);
  const [underusedTags, setUnderusedTags] = useState<TagWithCategory[]>([]);
  // const [message, setMessage] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string>('');
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [backupParts, setBackupParts] = useState<1 | 2 | 4 | 8 | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isCheckingIntegrity, setIsCheckingIntegrity] = useState(false);
  const [directorySizes, setDirectorySizes] = useState<{
    totalSize: number;
    imagesSize: number;
    videosSize: number;
    cacheSize: number;
    imageCount: number;
    videoCount: number;
  } | null>(null);
  const [isMovingDirectory, setIsMovingDirectory] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [whatsNewVersions, setWhatsNewVersions] = useState<VersionChange[]>([]);

  useEffect(() => {
    // Загружаем статистику и размеры при первом открытии или смене папки
    if (activeTab === 'storage' || activeTab === 'statistics') {
      loadStats();
      loadDirectorySizes();
    }
  }, [directoryPath, activeTab]);

  const loadStats = async () => {
    try {
      // Автоматически пересчитываем счётчики меток при открытии статистики
      // Это быстрая операция, которая гарантирует актуальность данных
      await recalculateTagCounts();
      
      const newStats = await getStatistics();
      setStats(newStats);
      
      // Загружаем топ метки и коллекции
      const tags = await getTopTags(10);
      const collections = await getTopCollections(10);
      const unused = await getUnderusedTags(3, 20);
      
      setTopTags(tags);
      setTopCollections(collections);
      setUnderusedTags(unused);
      
      // Загружаем версию приложения
      if (window.electronAPI?.getAppVersion) {
        const version = await window.electronAPI.getAppVersion();
        setAppVersion(version);
      }
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    }
  };


  const loadDirectorySizes = async () => {
    if (!directoryPath || !window.electronAPI?.getDirectorySize) {
      return;
    }

    try {
      const sizes = await window.electronAPI.getDirectorySize(directoryPath);
      setDirectorySizes(sizes);
      console.log('[Settings] Размеры загружены:', sizes);
    } catch (error) {
      console.error('[Settings] Ошибка загрузки размеров:', error);
    }
  };

  const handleChangeDirectory = async () => {
    const hasCards = stats && stats.totalCards > 0;
    
    if (!window.electronAPI) {
      alert.error('Electron API недоступен');
      return;
    }

    // Если есть карточки, предлагаем перенос через Dialog
    if (hasCards && directoryPath) {
      const confirmed = await dialog.confirm({
        title: 'Перенос рабочей папки',
        description: 
          `Текущая папка: ${directoryPath}\n` +
          `Карточек: ${stats.totalCards}\n\n` +
          'Система автоматически:\n' +
          '• Скопирует ВСЕ файлы в новую папку\n' +
          '• Обновит пути в базе данных\n' +
          '• Сохранит работоспособность карточек\n\n' +
          'Это может занять несколько минут.',
        confirmText: 'Перенести',
        cancelText: 'Отмена'
      });
      
      if (!confirmed) {
        return;
      }

      try {
        setIsMovingDirectory(true);
        alert.info('Перенос рабочей папки. Это может занять несколько минут...');

        // 1. Выбираем новую папку
        const newPath = await window.electronAPI.selectWorkingDirectory();
        
        if (!newPath) {
          setIsMovingDirectory(false);
          return;
        }

        if (newPath === directoryPath) {
          setIsMovingDirectory(false);
          alert.error('Выбрана та же папка');
          return;
        }

        // 2. Копируем все файлы
        const result = await window.electronAPI.moveWorkingDirectory(directoryPath, newPath);

        if (!result.success) {
          alert.error('Ошибка переноса файлов');
          setIsMovingDirectory(false);
          return;
        }

        // 3. Обновляем пути в базе данных
        const allCards = await db.cards.toArray();
        for (const card of allCards) {
          // Извлекаем относительный путь (год/месяц/день/файл)
          const match = card.filePath.match(/(\d{4}[\\/]\d{2}[\\/]\d{2}[\\/].+)$/);
          if (match) {
            const newFilePath = newPath + '\\' + match[1].replace(/\//g, '\\');
            await db.cards.update(card.id, { filePath: newFilePath });
          }
        }

        console.log(`[Settings] Обновлено путей: ${allCards.length}`);

        // 4. Обновляем рабочую папку в настройках через Electron API
        await window.electronAPI.saveSetting('workingDirectory', newPath);
        
        // 5. Логируем перенос хранилища
        const totalSize = directorySizes?.totalSize || 0;
        await logMoveStorage(totalSize);
        
        alert.success(`Перенос завершён! Скопировано файлов: ${result.copiedFiles}. Переход в галерею...`);
        
        setTimeout(() => {
          // Переходим в галерею для просмотра карточек
          navigate('/cards');
        }, 1500);
        
      } catch (error) {
        console.error('[Settings] Ошибка переноса папки:', error);
        alert.error('Ошибка переноса: ' + (error as Error).message);
      } finally {
        setIsMovingDirectory(false);
      }
    } else {
      // Если нет карточек, просто выбираем папку
      await requestDirectory();
      await loadDirectorySizes();
      alert.success('Рабочая папка установлена');
    }
  };

  const handleDeleteTag = async (tagId: string, tagName: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation(); // Предотвращаем клик на метку
    }
    
    const confirmed = await dialog.confirm({
      title: 'Удалить метку?',
      description: `Метка "${tagName}" будет удалена навсегда. Это действие необратимо.`,
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      variant: 'destructive'
    });
    
    if (!confirmed) {
      return;
    }

    try {
      await deleteTag(tagId);
      // Обновляем список
      await loadStats();
      alert.success('Метка удалена');
    } catch (error) {
      console.error('Ошибка удаления метки:', error);
      alert.error('Не удалось удалить метку');
    }
  };

  // Обработчик клика по метке - переход на страницу карточек с фильтром
  const handleTagClick = (tagId: string) => {
    setSelectedTags([tagId]);
    navigate('/cards');
  };

  // Обработчик клика по коллекции - переход на страницу коллекции
  const handleCollectionClick = (collectionId: string) => {
    navigate(`/collections/${collectionId}`);
  };

  // Вспомогательная функция для форматирования размера
  // const formatSize = (bytes: number): string => {
  //   const mb = bytes / 1024 / 1024;
  //   if (mb < 1) {
  //     return '< 1 МБ';
  //   } else if (mb < 1024) {
  //     return `${Math.round(mb)} МБ`;
  //   } else {
  //     const gb = mb / 1024;
  //     return `${gb.toFixed(1)} ГБ`;
  //   }
  // };

  // const handleClearCache = async () => {
  //   if (!confirm('Очистить весь кеш? Это удалит все данные из базы.')) {
  //     return;
  //   }

  //   try {
  //     // Получаем размер кэша перед очисткой
  //     const cacheSize = directorySizes?.cacheSize || 0;
  //     
  //     await db.delete();
  //     await db.open();
  //     
  //     // Логируем очистку кэша
  //     await logClearCache(cacheSize);
  //     
  //     alert.success('Кеш очищен');
  //     await loadStats();
  //   } catch (error) {
  //     alert.error('Не удалось очистить кеш');
  //     console.error('Ошибка очистки:', error);
  //   }
  // };

  const handleCreateBackup = async () => {
    if (!directoryPath) {
      alert.error('Сначала выберите рабочую папку');
      return;
    }

    if (backupParts === null) {
      alert.error('Выберите формат резервной копии');
      return;
    }

    if (!window.electronAPI) {
      alert.error('Electron API недоступен');
      return;
    }

    try {
      setIsCreatingBackup(true);
      alert.info('Создание резервной копии. Это может занять несколько минут...');

      // 1. Экспортируем базу данных
      const databaseJson = await exportDatabase();
      console.log('[Settings] База данных экспортирована');

      // 2. Генерируем имя файла с датой
      const date = new Date();
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const extension = backupParts === 1 ? '.zip' : '.arc';
      const fileName = `ARC_backup_${dateStr}${extension}`;
      
      // 3. Выбираем путь для сохранения через dialog
      const selectedPath = await window.electronAPI.selectBackupPath(fileName);

      if (!selectedPath) {
        setIsCreatingBackup(false);
        return;
      }

      // 4. Создаём backup с базой данных
      const response = await window.electronAPI.createBackup(
        selectedPath,
        directoryPath,
        backupParts!,
        databaseJson
      );

      if (response.success) {
        const sizeMB = Math.round(response.size / 1024 / 1024);
        
        // Логируем создание бэкапа
        await logCreateBackup(response.size, backupParts!);
        
        alert.success(`Резервная копия создана! Размер: ${sizeMB} MB, файлов: ${response.filesCount}`);
        
        // Открываем папку с backup в проводнике
        await window.electronAPI.openFileLocation(selectedPath);
      } else {
        alert.error('Ошибка создания резервной копии');
      }
    } catch (error) {
      console.error('Ошибка создания backup:', error);
      alert.error('Ошибка создания резервной копии');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleCheckIntegrity = async () => {
    try {
      setIsCheckingIntegrity(true);
      
      const { validateDatabase, fixIssues } = await import('../services/integrityCheck');
      const result = await validateDatabase();
      
      if (result.issues.length === 0) {
        alert.success('Проблем не найдено. База данных в порядке.');
        return;
      }
      
      const errors = result.issues.filter(i => i.severity === 'error');
      const warnings = result.issues.filter(i => i.severity === 'warning');
      
      // Формируем детальное сообщение
      let message = `Найдено проблем: ${result.issues.length}\n`;
      message += `• Ошибок: ${errors.length}\n`;
      message += `• Предупреждений: ${warnings.length}\n\n`;
      
      // Показываем детали каждой ошибки
      if (errors.length > 0) {
        message += '❌ ОШИБКИ:\n';
        errors.forEach((issue, index) => {
          message += `\n${index + 1}. ${issue.description}\n`;
        });
        message += '\n';
      }
      
      // Показываем детали предупреждений
      if (warnings.length > 0) {
        message += '⚠️ ПРЕДУПРЕЖДЕНИЯ:\n';
        warnings.forEach((issue, index) => {
          message += `\n${index + 1}. ${issue.description}\n`;
        });
        message += '\n';
      }
      
      if (warnings.length > 0) {
        // Используем dialog.confirm для показа результатов и предложения исправления
        const shouldFix = await dialog.confirm({
          title: 'Найдены проблемы с целостностью данных',
          description: message + '\nИсправить предупреждения автоматически?',
          confirmText: 'Исправить',
          cancelText: 'Отмена'
        });
        
        if (shouldFix) {
          const fixed = await fixIssues(warnings);
          let fixedMessage = `✅ Исправлено проблем: ${fixed}\n\n`;
          if (errors.length > 0) {
            fixedMessage += '❌ ОСТАЛИСЬ ОШИБКИ (требуют ручного вмешательства):\n';
            errors.forEach((issue, index) => {
              fixedMessage += `\n${index + 1}. ${issue.description}\n`;
            });
            // Показываем оставшиеся ошибки через dialog.info
            await dialog.info({
              title: 'Исправление завершено',
              description: fixedMessage
            });
          } else {
            alert.success(`Исправлено проблем: ${fixed}`);
          }
          await loadStats();
        } else {
          // Показываем результаты проверки через dialog.info
          await dialog.info({
            title: 'Результаты проверки целостности',
            description: message
          });
        }
      } else {
        // Только ошибки - показываем через dialog.info
        await dialog.info({
          title: 'Найдены ошибки в базе данных',
          description: message
        });
      }
    } catch (error) {
      console.error('Ошибка проверки целостности:', error);
      alert.error('Ошибка проверки целостности: ' + (error as Error).message);
    } finally {
      setIsCheckingIntegrity(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!window.electronAPI) {
      alert.error('Electron API недоступен');
      return;
    }

    const confirmRestore = confirm(
      'ВНИМАНИЕ!\n\n' +
      'Восстановление из резервной копии:\n' +
      '- Заменит ВСЕ текущие файлы\n' +
      '- Заменит ВСЮ базу данных\n' +
      '- Это действие НЕОБРАТИМО\n\n' +
      'Вы уверены?'
    );

    if (!confirmRestore) {
      return;
    }

    try {
      setIsRestoring(true);
      alert.info('Восстановление из резервной копии. Это может занять несколько минут...');

      // 1. Выбираем архив для восстановления
      const archivePath = await window.electronAPI.selectArchivePath();
      
      if (!archivePath) {
        setIsRestoring(false);
        return;
      }

      // 2. Выбираем целевую папку
      const targetPath = await window.electronAPI.selectWorkingDirectory();
      
      if (!targetPath) {
        setIsRestoring(false);
        return;
      }

      // 3. Восстанавливаем файлы и получаем БД
      const result = await window.electronAPI.restoreBackup(archivePath, targetPath);

      if (!result.success) {
        alert.error('Ошибка восстановления');
        setIsRestoring(false);
        return;
      }

      // 4. Импортируем базу данных с обновлением путей
      if (result.databaseJson) {
        await importDatabase(result.databaseJson, targetPath);
        console.log('[Settings] База данных импортирована с обновленными путями');
      }

      // 5. Обновляем рабочую папку в настройках через Electron API
      await window.electronAPI.saveSetting('workingDirectory', targetPath);
      console.log('[Settings] Рабочая папка обновлена:', targetPath);

      alert.success('Восстановление завершено! Переход в галерею...');
      await loadStats();
      
      setTimeout(() => {
        // Переходим в галерею для просмотра восстановленных карточек
        navigate('/cards');
      }, 1500);
    } catch (error) {
      console.error('Ошибка восстановления:', error);
      alert.error('Ошибка восстановления: ' + (error as Error).message);
    } finally {
      setIsRestoring(false);
    }
  };

  /**
   * Показать окно "Что нового?"
   */
  const handleShowWhatsNew = () => {
    const latestVersion = getLatestVersion();
    setWhatsNewVersions([latestVersion]);
    setShowWhatsNew(true);
  };

  /**
   * Закрыть окно "Что нового?"
   */
  const handleWhatsNewClose = () => {
    setShowWhatsNew(false);
  };

  // Формируем actions для header - кнопки переключения табов
  const tabActions = (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button
        className={`section-header__filter-button ${activeTab === 'storage' ? 'section-header__filter-button--active' : ''}`}
        onClick={() => setActiveTab('storage')}
      >
        <Icon name="server" size={24} variant={activeTab === 'storage' ? 'fill' : 'border'} />
        <span>Хранилище</span>
      </button>
      <button
        className={`section-header__filter-button ${activeTab === 'statistics' ? 'section-header__filter-button--active' : ''}`}
        onClick={() => setActiveTab('statistics')}
      >
        <Icon name="line-chart" size={24} variant={activeTab === 'statistics' ? 'fill' : 'border'} />
        <span>Статистика</span>
      </button>
      <button
        className={`section-header__filter-button ${activeTab === 'history' ? 'section-header__filter-button--active' : ''}`}
        onClick={() => setActiveTab('history')}
      >
        <Icon name="history" size={24} variant={activeTab === 'history' ? 'fill' : 'border'} />
        <span>История</span>
      </button>
    </div>
  );

  return (
    <Layout
      headerProps={{
        title: 'Настройки',
        actions: tabActions
      }}
      searchProps={searchProps}
    >
      {/* Табы перенесены в header */}

      {/* Таб: Хранилище */}
      {activeTab === 'storage' && (
        <div style={{ 
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-l, 16px)',
          width: '100%'
        }}>
            {/* Секция: Использование пространства */}
            {/* Карточки с размерами */}
            {directorySizes && (
              <div style={{ 
                display: 'flex',
                gap: 'var(--spacing-l, 16px)',
                width: '100%'
              }}>
                  {/* Карточка: Всего использовано */}
                  <div style={{
                    flex: '1 0 0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--spacing-xl, 24px)',
                    padding: 'var(--spacing-xl, 24px)',
                    border: '2px solid var(--border-default, #ebe9ee)',
                    borderRadius: 'var(--radius-l, 16px)',
                    minHeight: '1px',
                    minWidth: '1px'
                  }}>
                    <Icon name="hard-drive" size={24} variant="border" style={{ color: 'var(--icon-default, #93919a)' }} />
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--spacing-l, 16px)'
                    }}>
                      <h1 className="h1" style={{
                        fontFamily: 'var(--font-family-heading)',
                        fontSize: 'var(--font-size-h1, 40px)',
                        lineHeight: 'var(--line-height-h1, 40px)',
                        fontWeight: 'var(--font-weight-bold, 700)',
                        color: 'var(--text-primary, #3b3946)',
                        letterSpacing: '0px'
                      }}>
                        {Math.round(directorySizes.totalSize / 1024 / 1024)} мб
                      </h1>
                      <p className="text-m" style={{
                        fontFamily: 'var(--font-family-body)',
                        fontSize: 'var(--font-size-m, 16px)',
                        lineHeight: 'var(--line-height-m, 22px)',
                        fontWeight: 'var(--font-weight-light, 300)',
                        color: 'var(--text-secondary, #93919a)',
                        letterSpacing: '0px'
                      }}>
                        Всего использовано
                      </p>
                    </div>
                  </div>

                  {/* Карточка: Изображения */}
                  <div style={{
                    flex: '1 0 0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--spacing-xl, 24px)',
                    padding: 'var(--spacing-xl, 24px)',
                    border: '2px solid var(--border-default, #ebe9ee)',
                    borderRadius: 'var(--radius-l, 16px)',
                    minHeight: '1px',
                    minWidth: '1px'
                  }}>
                    <Icon name="image" size={24} variant="border" style={{ color: 'var(--icon-default, #93919a)' }} />
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--spacing-l, 16px)'
                    }}>
                      <h1 className="h1" style={{
                        fontFamily: 'var(--font-family-heading)',
                        fontSize: 'var(--font-size-h1, 40px)',
                        lineHeight: 'var(--line-height-h1, 40px)',
                        fontWeight: 'var(--font-weight-bold, 700)',
                        color: 'var(--text-primary, #3b3946)',
                        letterSpacing: '0px'
                      }}>
                        {Math.round(directorySizes.imagesSize / 1024 / 1024)} мб
                      </h1>
                      <p className="text-m" style={{
                        fontFamily: 'var(--font-family-body)',
                        fontSize: 'var(--font-size-m, 16px)',
                        lineHeight: 'var(--line-height-m, 22px)',
                        fontWeight: 'var(--font-weight-light, 300)',
                        color: 'var(--text-secondary, #93919a)',
                        letterSpacing: '0px'
                      }}>
                        Изображения
                      </p>
                    </div>
                  </div>

                  {/* Карточка: Видео */}
                  <div style={{
                    flex: '1 0 0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--spacing-xl, 24px)',
                    padding: 'var(--spacing-xl, 24px)',
                    border: '2px solid var(--border-default, #ebe9ee)',
                    borderRadius: 'var(--radius-l, 16px)',
                    minHeight: '1px',
                    minWidth: '1px'
                  }}>
                    <Icon name="play-circle" size={24} variant="border" style={{ color: 'var(--icon-default, #93919a)' }} />
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--spacing-l, 16px)'
                    }}>
                      <h1 className="h1" style={{
                        fontFamily: 'var(--font-family-heading)',
                        fontSize: 'var(--font-size-h1, 40px)',
                        lineHeight: 'var(--line-height-h1, 40px)',
                        fontWeight: 'var(--font-weight-bold, 700)',
                        color: 'var(--text-primary, #3b3946)',
                        letterSpacing: '0px'
                      }}>
                        {Math.round(directorySizes.videosSize / 1024 / 1024)} мб
                      </h1>
                      <p className="text-m" style={{
                        fontFamily: 'var(--font-family-body)',
                        fontSize: 'var(--font-size-m, 16px)',
                        lineHeight: 'var(--line-height-m, 22px)',
                        fontWeight: 'var(--font-weight-light, 300)',
                        color: 'var(--text-secondary, #93919a)',
                        letterSpacing: '0px'
                      }}>
                        Видео
                      </p>
                    </div>
                  </div>

                  {/* Карточка: Кэш */}
                  <div style={{
                    flex: '1 0 0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--spacing-xl, 24px)',
                    padding: 'var(--spacing-xl, 24px)',
                    border: '2px solid var(--border-default, #ebe9ee)',
                    borderRadius: 'var(--radius-l, 16px)',
                    minHeight: '1px',
                    minWidth: '1px'
                  }}>
                    <Icon name="eye" size={24} variant="border" style={{ color: 'var(--icon-default, #93919a)' }} />
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--spacing-l, 16px)'
                    }}>
                      <h1 className="h1" style={{
                        fontFamily: 'var(--font-family-heading)',
                        fontSize: 'var(--font-size-h1, 40px)',
                        lineHeight: 'var(--line-height-h1, 40px)',
                        fontWeight: 'var(--font-weight-bold, 700)',
                        color: 'var(--text-primary, #3b3946)',
                        letterSpacing: '0px'
                      }}>
                        {Math.round(directorySizes.cacheSize / 1024 / 1024)} мб
                      </h1>
                      <p className="text-m" style={{
                        fontFamily: 'var(--font-family-body)',
                        fontSize: 'var(--font-size-m, 16px)',
                        lineHeight: 'var(--line-height-m, 22px)',
                        fontWeight: 'var(--font-weight-light, 300)',
                        color: 'var(--text-secondary, #93919a)',
                        letterSpacing: '0px'
                      }}>
                        Кэш
                      </p>
                    </div>
                  </div>
                </div>
              )}

            {/* Три раздела в ряд: Локальное хранилище, Резервная копия и Проверка целостности */}
            <div style={{ 
              display: 'flex',
              gap: 'var(--spacing-l, 16px)',
              width: '100%'
            }}>
              {/* Раздел: Локальное хранилище */}
              <div style={{
                flex: '1 0 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-xl, 24px)',
                padding: 'var(--spacing-xl, 24px)',
                border: '2px solid var(--border-default, #ebe9ee)',
                borderRadius: 'var(--radius-l, 16px)',
                minHeight: '1px',
                minWidth: '1px'
              }}>
                <Icon name="hard-drive" size={24} variant="border" style={{ color: 'var(--icon-default, #93919a)' }} />
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-l, 16px)',
                  width: '100%'
                }}>
                  <h3 className="h3" style={{
                    fontFamily: 'var(--font-family-heading)',
                    fontSize: 'var(--font-size-h3, 28px)',
                    lineHeight: 'var(--line-height-h3, 28px)',
                    fontWeight: 'var(--font-weight-bold, 700)',
                    color: 'var(--text-primary, #3b3946)',
                    letterSpacing: '0px'
                  }}>
                    Локальное хранилище
                  </h3>
                  
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--spacing-l, 16px)',
                    fontFamily: 'var(--font-family-body)',
                    fontSize: 'var(--font-size-m, 16px)',
                    lineHeight: 'var(--line-height-m, 22px)',
                    fontWeight: 'var(--font-weight-light, 300)',
                    letterSpacing: '0px'
                  }}>
                    <p style={{
                      color: 'var(--text-primary, #3b3946)'
                    }}>
                      Папка на компьютере для автоматического сохранения загружаемых файлов:
                    </p>
                    <p style={{
                      color: 'var(--text-secondary, #93919a)'
                    }}>
                      {directoryPath || 'Не выбрана'}
                    </p>
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    gap: 'var(--spacing-s, 8px)',
                    marginTop: 'auto'
                  }}>
                    <Button
                      variant="primary"
                      size="L"
                      onClick={handleChangeDirectory}
                      disabled={isMovingDirectory}
                      iconRight={<Icon name="folder-output" size={24} variant="border" />}
                    >
                      Изменить
                    </Button>
                  </div>
                </div>
              </div>

              {/* Раздел: Резервная копия */}
              <div style={{
                flex: '1 0 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-xl, 24px)',
                padding: 'var(--spacing-xl, 24px)',
                border: '2px solid var(--border-default, #ebe9ee)',
                borderRadius: 'var(--radius-l, 16px)',
                minHeight: '1px',
                minWidth: '1px'
              }}>
                <Icon name="folder-input" size={24} variant="border" style={{ color: 'var(--icon-default, #93919a)' }} />
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-l, 16px)',
                  width: '100%'
                }}>
                  <h3 className="h3" style={{
                    fontFamily: 'var(--font-family-heading)',
                    fontSize: 'var(--font-size-h3, 28px)',
                    lineHeight: 'var(--line-height-h3, 28px)',
                    fontWeight: 'var(--font-weight-bold, 700)',
                    color: 'var(--text-primary, #3b3946)',
                    letterSpacing: '0px'
                  }}>
                    Резервная копия
                  </h3>
                  
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--spacing-l, 16px)',
                    width: '100%'
                  }}>
                  <p className="text-m" style={{
                    fontFamily: 'var(--font-family-body)',
                    fontSize: 'var(--font-size-m, 16px)',
                    lineHeight: 'var(--line-height-m, 22px)',
                    fontWeight: 'var(--font-weight-light, 300)',
                    color: 'var(--text-primary, #3b3946)',
                    letterSpacing: '0px'
                  }}>
                    Если база слишком большая, то можно разделить архив на несколько частей
                  </p>
                  
                  {/* Опции разделения архива */}
                  <div style={{
                    display: 'flex',
                    gap: 'var(--spacing-s, 8px)',
                    alignItems: 'center',
                    width: '100%',
                    flexWrap: 'wrap'
                  }}>
                    <Button
                      variant={backupParts === 1 ? 'primary' : 'secondary'}
                      size="S"
                      onClick={() => setBackupParts(1)}
                      disabled={isCreatingBackup}
                    >
                      Одним архивом
                    </Button>
                    {([2, 4, 8] as const).map((num) => {
                      const partSize = directorySizes ? directorySizes.totalSize / num : 0;
                      const sizeMB = Math.round(partSize / 1024 / 1024);
                      
                      return (
                        <Button
                          key={num}
                          variant={backupParts === num ? 'primary' : 'secondary'}
                          size="S"
                          onClick={() => setBackupParts(num)}
                          disabled={isCreatingBackup}
                        >
                          <span style={{ color: backupParts === num ? 'var(--text-light, #f5f4f7)' : 'var(--text-primary, #3b3946)' }}>{num}</span>
                          <span style={{ color: backupParts === num ? 'var(--text-light, #f5f4f7)' : 'var(--text-secondary, #93919a)' }}> {sizeMB} МБ</span>
                        </Button>
                      );
                    })}
                  </div>
                  
                  {/* Кнопки действий */}
                  <div style={{
                    display: 'flex',
                    gap: 'var(--spacing-l, 16px)'
                  }}>
                    <Button
                      variant="primary"
                      size="L"
                      onClick={handleCreateBackup}
                      disabled={isCreatingBackup || isRestoring || !directoryPath || backupParts === null}
                      iconRight={<Icon name="save" size={24} variant="border" />}
                    >
                      Сохранить
                    </Button>
                    <Button
                      variant="secondary"
                      size="L"
                      onClick={handleRestoreBackup}
                      disabled={isCreatingBackup || isRestoring}
                      iconRight={<Icon name="download" size={24} variant="border" />}
                    >
                      Восстановить
                    </Button>
                  </div>
                </div>
              </div>
              </div>

              {/* Раздел: Проверка целостности */}
              <div style={{
                flex: '1 0 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-xl, 24px)',
                padding: 'var(--spacing-xl, 24px)',
                border: '2px solid var(--border-default, #ebe9ee)',
                borderRadius: 'var(--radius-l, 16px)',
                minHeight: '1px',
                minWidth: '1px'
              }}>
                <Icon name="file-search" size={24} variant="border" style={{ color: 'var(--icon-default, #93919a)' }} />
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-l, 16px)',
                  width: '100%'
                }}>
                  <h3 className="h3" style={{
                    fontFamily: 'var(--font-family-heading)',
                    fontSize: 'var(--font-size-h3, 28px)',
                    lineHeight: 'var(--line-height-h3, 28px)',
                    fontWeight: 'var(--font-weight-bold, 700)',
                    color: 'var(--text-primary, #3b3946)',
                    letterSpacing: '0px'
                  }}>
                    Проверка
                  </h3>
                  
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--spacing-l, 16px)',
                    fontFamily: 'var(--font-family-body)',
                    fontSize: 'var(--font-size-m, 16px)',
                    lineHeight: 'var(--line-height-m, 22px)',
                    fontWeight: 'var(--font-weight-light, 300)',
                    letterSpacing: '0px'
                  }}>
                    <p style={{
                      color: 'var(--text-primary, #3b3946)'
                    }}>
                      Проверьте базу данных на наличие ошибок, таких как отсутствующие файлы или некорректные ссылки.
                    </p>
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    gap: 'var(--spacing-s, 8px)',
                    marginTop: 'auto'
                  }}>
                    <Button
                      variant="primary"
                      size="L"
                      onClick={handleCheckIntegrity}
                      disabled={isCheckingIntegrity || isCreatingBackup || isRestoring}
                      iconRight={<Icon name="search" size={24} variant="border" />}
                    >
                      {isCheckingIntegrity ? 'Проверка...' : 'Проверить целостность'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* {message && (
              <div style={{
                padding: '12px 16px',
                backgroundColor: message.includes('✅') ? 'var(--color-green-100)' : 'var(--color-red-100)',
                borderRadius: 'var(--radius-s)'
              }}>
                <p className="text-s">{message}</p>
              </div>
            )} */}


          </div>
        )}

        {/* Таб: Статистика */}
        {activeTab === 'statistics' && stats && (
          <div style={{ 
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-l, 16px)',
            width: '100%'
          }}>
            {/* 5 карточек статистики вверху */}
            <div style={{ 
              display: 'flex',
              gap: 'var(--spacing-l, 16px)',
              width: '100%'
            }}>
              {/* Карточка: Изображения */}
              <div style={{
                flex: '1 0 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-xl, 24px)',
                padding: 'var(--spacing-xl, 24px)',
                border: '2px solid var(--border-default, #ebe9ee)',
                borderRadius: 'var(--radius-l, 16px)',
                minHeight: '1px',
                minWidth: '1px'
              }}>
                <Icon name="image" size={24} variant="border" style={{ color: 'var(--icon-default, #93919a)' }} />
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-l, 16px)'
                }}>
                  <h1 className="h1" style={{
                    fontFamily: 'var(--font-family-heading)',
                    fontSize: 'var(--font-size-h1, 40px)',
                    lineHeight: 'var(--line-height-h1, 40px)',
                    fontWeight: 'var(--font-weight-bold, 700)',
                    color: 'var(--text-primary, #3b3946)',
                    letterSpacing: '0px'
                  }}>
                    {stats.imageCount.toLocaleString('ru-RU')}
                  </h1>
                  <p className="text-m" style={{
                    fontFamily: 'var(--font-family-body)',
                    fontSize: 'var(--font-size-m, 16px)',
                    lineHeight: 'var(--line-height-m, 22px)',
                    fontWeight: 'var(--font-weight-light, 300)',
                    color: 'var(--text-secondary, #93919a)',
                    letterSpacing: '0px'
                  }}>
                    Изображения
                  </p>
                </div>
              </div>

              {/* Карточка: Видео */}
              <div style={{
                flex: '1 0 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-xl, 24px)',
                padding: 'var(--spacing-xl, 24px)',
                border: '2px solid var(--border-default, #ebe9ee)',
                borderRadius: 'var(--radius-l, 16px)',
                minHeight: '1px',
                minWidth: '1px'
              }}>
                <Icon name="play-circle" size={24} variant="border" style={{ color: 'var(--icon-default, #93919a)' }} />
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-l, 16px)'
                }}>
                  <h1 className="h1" style={{
                    fontFamily: 'var(--font-family-heading)',
                    fontSize: 'var(--font-size-h1, 40px)',
                    lineHeight: 'var(--line-height-h1, 40px)',
                    fontWeight: 'var(--font-weight-bold, 700)',
                    color: 'var(--text-primary, #3b3946)',
                    letterSpacing: '0px'
                  }}>
                    {stats.videoCount.toLocaleString('ru-RU')}
                  </h1>
                  <p className="text-m" style={{
                    fontFamily: 'var(--font-family-body)',
                    fontSize: 'var(--font-size-m, 16px)',
                    lineHeight: 'var(--line-height-m, 22px)',
                    fontWeight: 'var(--font-weight-light, 300)',
                    color: 'var(--text-secondary, #93919a)',
                    letterSpacing: '0px'
                  }}>
                    Видео
                  </p>
                </div>
              </div>

              {/* Карточка: Коллекции */}
              <div style={{
                flex: '1 0 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-xl, 24px)',
                padding: 'var(--spacing-xl, 24px)',
                border: '2px solid var(--border-default, #ebe9ee)',
                borderRadius: 'var(--radius-l, 16px)',
                minHeight: '1px',
                minWidth: '1px'
              }}>
                <Icon name="folder-open" size={24} variant="border" style={{ color: 'var(--icon-default, #93919a)' }} />
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-l, 16px)'
                }}>
                  <h1 className="h1" style={{
                    fontFamily: 'var(--font-family-heading)',
                    fontSize: 'var(--font-size-h1, 40px)',
                    lineHeight: 'var(--line-height-h1, 40px)',
                    fontWeight: 'var(--font-weight-bold, 700)',
                    color: 'var(--text-primary, #3b3946)',
                    letterSpacing: '0px'
                  }}>
                    {stats.collectionCount.toLocaleString('ru-RU')}
                  </h1>
                  <p className="text-m" style={{
                    fontFamily: 'var(--font-family-body)',
                    fontSize: 'var(--font-size-m, 16px)',
                    lineHeight: 'var(--line-height-m, 22px)',
                    fontWeight: 'var(--font-weight-light, 300)',
                    color: 'var(--text-secondary, #93919a)',
                    letterSpacing: '0px'
                  }}>
                    Коллекции
                  </p>
                </div>
              </div>

              {/* Карточка: Метки */}
              <div style={{
                flex: '1 0 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-xl, 24px)',
                padding: 'var(--spacing-xl, 24px)',
                border: '2px solid var(--border-default, #ebe9ee)',
                borderRadius: 'var(--radius-l, 16px)',
                minHeight: '1px',
                minWidth: '1px'
              }}>
                <Icon name="tag" size={24} variant="border" style={{ color: 'var(--icon-default, #93919a)' }} />
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-l, 16px)'
                }}>
                  <h1 className="h1" style={{
                    fontFamily: 'var(--font-family-heading)',
                    fontSize: 'var(--font-size-h1, 40px)',
                    lineHeight: 'var(--line-height-h1, 40px)',
                    fontWeight: 'var(--font-weight-bold, 700)',
                    color: 'var(--text-primary, #3b3946)',
                    letterSpacing: '0px'
                  }}>
                    {stats.tagCount.toLocaleString('ru-RU')}
                  </h1>
                  <p className="text-m" style={{
                    fontFamily: 'var(--font-family-body)',
                    fontSize: 'var(--font-size-m, 16px)',
                    lineHeight: 'var(--line-height-m, 22px)',
                    fontWeight: 'var(--font-weight-light, 300)',
                    color: 'var(--text-secondary, #93919a)',
                    letterSpacing: '0px'
                  }}>
                    Метки
                  </p>
                </div>
              </div>

              {/* Карточка: Мудборд */}
              <div style={{
                flex: '1 0 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-xl, 24px)',
                padding: 'var(--spacing-xl, 24px)',
                border: '2px solid var(--border-default, #ebe9ee)',
                borderRadius: 'var(--radius-l, 16px)',
                minHeight: '1px',
                minWidth: '1px'
              }}>
                <Icon name="bookmark" size={24} variant="border" style={{ color: 'var(--icon-default, #93919a)' }} />
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-l, 16px)'
                }}>
                  <h1 className="h1" style={{
                    fontFamily: 'var(--font-family-heading)',
                    fontSize: 'var(--font-size-h1, 40px)',
                    lineHeight: 'var(--line-height-h1, 40px)',
                    fontWeight: 'var(--font-weight-bold, 700)',
                    color: 'var(--text-primary, #3b3946)',
                    letterSpacing: '0px'
                  }}>
                    {stats.moodboardCount}
                  </h1>
                  <p className="text-m" style={{
                    fontFamily: 'var(--font-family-body)',
                    fontSize: 'var(--font-size-m, 16px)',
                    lineHeight: 'var(--line-height-m, 22px)',
                    fontWeight: 'var(--font-weight-light, 300)',
                    color: 'var(--text-secondary, #93919a)',
                    letterSpacing: '0px'
                  }}>
                    Мудборд
                  </p>
                </div>
              </div>
            </div>

            {/* 3 секции списков внизу */}
            <div style={{ 
              display: 'flex',
              gap: 'var(--spacing-l, 16px)',
              width: '100%'
            }}>
              {/* Секция: Популярные метки */}
              <div style={{
                flex: '1 0 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-xl, 24px)',
                padding: 'var(--spacing-xl, 24px)',
                border: '2px solid var(--border-default, #ebe9ee)',
                borderRadius: 'var(--radius-l, 16px)',
                minHeight: '1px',
                minWidth: '1px'
              }}>
                <Icon name="trending-up" size={24} variant="border" style={{ color: 'var(--icon-default, #93919a)' }} />
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-l, 16px)',
                  width: '100%'
                }}>
                  <h3 className="h3" style={{
                    fontFamily: 'var(--font-family-heading)',
                    fontSize: 'var(--font-size-h3, 28px)',
                    lineHeight: 'var(--line-height-h3, 28px)',
                    fontWeight: 'var(--font-weight-bold, 700)',
                    color: 'var(--text-primary, #3b3946)',
                    letterSpacing: '0px'
                  }}>
                    Популярные метки
                  </h3>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--spacing-s, 8px)',
                    width: '100%'
                  }}>
                    {topTags.slice(0, 10).map((tag, index) => (
                      <div 
                        key={tag.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%'
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--spacing-l, 16px)'
                        }}>
                          <p className="text-m" style={{
                            fontFamily: 'var(--font-family-body)',
                            fontSize: 'var(--font-size-m, 16px)',
                            lineHeight: 'var(--line-height-m, 22px)',
                            fontWeight: 'var(--font-weight-light, 300)',
                            color: 'var(--text-secondary, #93919a)',
                            letterSpacing: '0px',
                            minWidth: '24px'
                          }}>
                            {(index + 1).toString().padStart(2, '0')}
                          </p>
                          <button 
                            onClick={() => handleTagClick(tag.id)}
                            className="settings-tag-button"
                          >
                            <p className="text-s">
                              {tag.name}
                            </p>
                          </button>
                        </div>
                        <p className="text-m" style={{
                          fontFamily: 'var(--font-family-body)',
                          fontSize: 'var(--font-size-m, 16px)',
                          lineHeight: 'var(--line-height-m, 22px)',
                          fontWeight: 'var(--font-weight-light, 300)',
                          color: 'var(--text-primary, #3b3946)',
                          letterSpacing: '0px'
                        }}>
                          {tag.cardCount}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Секция: Малоиспользуемые метки */}
              <div style={{
                flex: '1 0 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-xl, 24px)',
                padding: 'var(--spacing-xl, 24px)',
                border: '2px solid var(--border-default, #ebe9ee)',
                borderRadius: 'var(--radius-l, 16px)',
                minHeight: '1px',
                minWidth: '1px'
              }}>
                <Icon name="trending-down" size={24} variant="border" style={{ color: 'var(--icon-default, #93919a)' }} />
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-l, 16px)',
                  width: '100%'
                }}>
                  <h3 className="h3" style={{
                    fontFamily: 'var(--font-family-heading)',
                    fontSize: 'var(--font-size-h3, 28px)',
                    lineHeight: 'var(--line-height-h3, 28px)',
                    fontWeight: 'var(--font-weight-bold, 700)',
                    color: 'var(--text-primary, #3b3946)',
                    letterSpacing: '0px'
                  }}>
                    Малоиспользуемые метки
                  </h3>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--spacing-s, 8px)',
                    width: '100%'
                  }}>
                    {underusedTags.slice(0, 10).map((tag, index) => (
                      <div 
                        key={tag.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%'
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <p className="text-m" style={{
                            fontFamily: 'var(--font-family-body)',
                            fontSize: 'var(--font-size-m, 16px)',
                            lineHeight: 'var(--line-height-m, 22px)',
                            fontWeight: 'var(--font-weight-light, 300)',
                            color: 'var(--text-secondary, #93919a)',
                            letterSpacing: '0px',
                            minWidth: '24px',
                            marginRight: '12px'
                          }}>
                            {(index + 1).toString().padStart(2, '0')}
                          </p>
                          <button 
                            onClick={() => handleTagClick(tag.id)}
                            className="settings-tag-button"
                          >
                            <p className="text-s">
                              {tag.name}
                            </p>
                          </button>
                          <button
                            onClick={(e) => handleDeleteTag(tag.id, tag.name, e)}
                            className="settings-delete-button"
                            title="Удалить метку"
                          >
                            <Icon name="trash" size={16} variant="border" />
                          </button>
                        </div>
                        <p className="text-m" style={{
                          fontFamily: 'var(--font-family-body)',
                          fontSize: 'var(--font-size-m, 16px)',
                          lineHeight: 'var(--line-height-m, 22px)',
                          fontWeight: 'var(--font-weight-light, 300)',
                          color: 'var(--text-primary, #3b3946)',
                          letterSpacing: '0px'
                        }}>
                          {tag.cardCount}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Секция: Большие коллекции */}
              <div style={{
                flex: '1 0 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-xl, 24px)',
                padding: 'var(--spacing-xl, 24px)',
                border: '2px solid var(--border-default, #ebe9ee)',
                borderRadius: 'var(--radius-l, 16px)',
                minHeight: '1px',
                minWidth: '1px'
              }}>
                <Icon name="folder-open" size={24} variant="border" style={{ color: 'var(--icon-default, #93919a)' }} />
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-l, 16px)',
                  width: '100%'
                }}>
                  <h3 className="h3" style={{
                    fontFamily: 'var(--font-family-heading)',
                    fontSize: 'var(--font-size-h3, 28px)',
                    lineHeight: 'var(--line-height-h3, 28px)',
                    fontWeight: 'var(--font-weight-bold, 700)',
                    color: 'var(--text-primary, #3b3946)',
                    letterSpacing: '0px'
                  }}>
                    Большие коллекции
                  </h3>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--spacing-s, 8px)',
                    width: '100%'
                  }}>
                    {topCollections.slice(0, 10).map((collection, index) => (
                      <div 
                        key={collection.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%'
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--spacing-l, 16px)'
                        }}>
                          <p className="text-m" style={{
                            fontFamily: 'var(--font-family-body)',
                            fontSize: 'var(--font-size-m, 16px)',
                            lineHeight: 'var(--line-height-m, 22px)',
                            fontWeight: 'var(--font-weight-light, 300)',
                            color: 'var(--text-secondary, #93919a)',
                            letterSpacing: '0px',
                            minWidth: '24px'
                          }}>
                            {(index + 1).toString().padStart(2, '0')}
                          </p>
                          <button 
                            onClick={() => handleCollectionClick(collection.id)}
                            className="settings-tag-button"
                          >
                            <p className="text-s">
                              {collection.name}
                            </p>
                          </button>
                        </div>
                        <p className="text-m" style={{
                          fontFamily: 'var(--font-family-body)',
                          fontSize: 'var(--font-size-m, 16px)',
                          lineHeight: 'var(--line-height-m, 22px)',
                          fontWeight: 'var(--font-weight-light, 300)',
                          color: 'var(--text-primary, #3b3946)',
                          letterSpacing: '0px'
                        }}>
                          {collection.cardCount.toLocaleString('ru-RU')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

      {/* Таб: История */}
      {activeTab === 'history' && (
        <HistorySection />
      )}

      {/* Badge с версией - показывается на всех табах, кликабельный */}
      <div style={{
        position: 'fixed',
        bottom: 'var(--spacing-l, 16px)',
        right: 'var(--spacing-l, 16px)'
      }}>
        <button
          onClick={handleShowWhatsNew}
          className="settings-whats-new-button"
          title="Нажмите, чтобы посмотреть что нового"
        >
          <p className="text-s">
            v{appVersion}
          </p>
        </button>
      </div>

      {/* Модалка "Что нового?" */}
      <WhatsNewModal
        isOpen={showWhatsNew}
        onClose={handleWhatsNewClose}
        versions={whatsNewVersions}
      />
    </Layout>
  );
};

export default SettingsPage;

