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
import { getStatistics, db, exportDatabase, importDatabase, getTopTags, getTopCollections, getUnderusedTags, deleteTag, recalculateTagCounts } from '../services/db';
import { logCreateBackup, logClearCache, logMoveStorage } from '../services/history';
import type { AppStatistics, Tag, Collection } from '../types';

type SettingsTab = 'storage' | 'statistics' | 'history';

type TagWithCategory = Tag & { categoryName: string };
type CollectionWithCount = Collection & { cardCount: number };

export const SettingsPage = () => {
  const navigate = useNavigate();
  const { searchProps } = useSearch();
  const { directoryHandle, requestDirectory, directoryPath } = useFileSystem();
  const [activeTab, setActiveTab] = useState<SettingsTab>('storage');
  const [stats, setStats] = useState<AppStatistics | null>(null);
  const [topTags, setTopTags] = useState<TagWithCategory[]>([]);
  const [topCollections, setTopCollections] = useState<CollectionWithCount[]>([]);
  const [underusedTags, setUnderusedTags] = useState<TagWithCategory[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [backupParts, setBackupParts] = useState<1 | 2 | 4 | 8>(1);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [directorySizes, setDirectorySizes] = useState<{
    totalSize: number;
    imagesSize: number;
    videosSize: number;
    cacheSize: number;
    imageCount: number;
    videoCount: number;
  } | null>(null);
  const [isMovingDirectory, setIsMovingDirectory] = useState(false);
  const [moveProgress, setMoveProgress] = useState(0);
  const [moveMessage, setMoveMessage] = useState<string | null>(null);

  useEffect(() => {
    // Загружаем статистику и размеры при первом открытии или смене папки
    if (activeTab === 'storage' || activeTab === 'statistics') {
      loadStats();
      loadDirectorySizes();
    }
    
    // Подписываемся на прогресс backup
    if (window.electronAPI?.onBackupProgress) {
      window.electronAPI.onBackupProgress((data) => {
        setBackupProgress(data.percent);
      });
    }
    
    // Подписываемся на прогресс переноса папки
    if (window.electronAPI?.onMoveDirectoryProgress) {
      window.electronAPI.onMoveDirectoryProgress((data) => {
        setMoveProgress(data.percent);
      });
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
      setMessage('❌ Electron API недоступен');
      return;
    }

    // Если есть карточки, предлагаем перенос
    if (hasCards && directoryPath) {
      const confirmed = confirm(
        '📦 Перенос рабочей папки\n\n' +
        `Текущая папка: ${directoryPath}\n` +
        `Карточек: ${stats.totalCards}\n\n` +
        'Система автоматически:\n' +
        '✅ Скопирует ВСЕ файлы в новую папку\n' +
        '✅ Обновит пути в базе данных\n' +
        '✅ Сохранит работоспособность карточек\n\n' +
        'Это может занять несколько минут.\n\n' +
        'Продолжить?'
      );
      
      if (!confirmed) {
        return;
      }

      try {
        setIsMovingDirectory(true);
        setMoveProgress(0);
        setMoveMessage('🔄 Выбор новой папки...');

        // 1. Выбираем новую папку
        const newPath = await window.electronAPI.selectWorkingDirectory();
        
        if (!newPath) {
          setIsMovingDirectory(false);
          setMoveMessage(null);
          return;
        }

        if (newPath === directoryPath) {
          setIsMovingDirectory(false);
          setMoveMessage('❌ Выбрана та же папка');
          setTimeout(() => setMoveMessage(null), 2000);
          return;
        }

        setMoveMessage(`🔄 Копирование файлов из\n${directoryPath}\nв\n${newPath}`);

        // 2. Копируем все файлы
        const result = await window.electronAPI.moveWorkingDirectory(directoryPath, newPath);

        if (!result.success) {
          setMoveMessage('❌ Ошибка переноса файлов');
          setIsMovingDirectory(false);
          return;
        }

        setMoveMessage('🔄 Обновление путей в базе данных...');

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

        // 4. Обновляем рабочую папку в настройках (правильный ключ!)
        localStorage.setItem('arc_working_directory', newPath);
        
        // 5. Логируем перенос хранилища
        const totalSize = directorySizes?.totalSize || 0;
        await logMoveStorage(totalSize);
        
        setMoveMessage(`✅ Перенос завершён! Скопировано файлов: ${result.copiedFiles}. Переход в галерею...`);
        
        setTimeout(() => {
          // Переходим в галерею для просмотра карточек
          navigate('/cards');
        }, 1500);
        
      } catch (error) {
        console.error('[Settings] Ошибка переноса папки:', error);
        setMoveMessage('❌ Ошибка переноса: ' + (error as Error).message);
      } finally {
        setIsMovingDirectory(false);
      }
    } else {
      // Если нет карточек, просто выбираем папку
      await requestDirectory();
      await loadDirectorySizes();
      setMessage('✅ Рабочая папка установлена');
      setTimeout(() => setMessage(null), 2000);
    }
  };

  const handleDeleteTag = async (tagId: string, tagName: string) => {
    if (!confirm(`Удалить метку "${tagName}"? Это действие необратимо.`)) {
      return;
    }

    try {
      await deleteTag(tagId);
      // Обновляем список
      await loadStats();
      setMessage('✅ Метка удалена');
      setTimeout(() => setMessage(null), 2000);
    } catch (error) {
      console.error('Ошибка удаления метки:', error);
      setMessage('❌ Ошибка удаления метки');
      setTimeout(() => setMessage(null), 2000);
    }
  };

  // Вспомогательная функция для форматирования размера
  const formatSize = (bytes: number): string => {
    const mb = bytes / 1024 / 1024;
    if (mb < 1) {
      return '< 1 МБ';
    } else if (mb < 1024) {
      return `${Math.round(mb)} МБ`;
    } else {
      const gb = mb / 1024;
      return `${gb.toFixed(1)} ГБ`;
    }
  };

  const handleClearCache = async () => {
    if (!confirm('Очистить весь кеш? Это удалит все данные из базы.')) {
      return;
    }

    try {
      // Получаем размер кэша перед очисткой
      const cacheSize = directorySizes?.cacheSize || 0;
      
      await db.delete();
      await db.open();
      
      // Логируем очистку кэша
      await logClearCache(cacheSize);
      
      setMessage('✅ Кеш очищен');
      await loadStats();
      setTimeout(() => setMessage(null), 2000);
    } catch (error) {
      console.error('Ошибка очистки:', error);
      setMessage('❌ Ошибка очистки кеша');
    }
  };

  const handleCreateBackup = async () => {
    if (!directoryPath) {
      setBackupMessage('❌ Сначала выберите рабочую папку');
      setTimeout(() => setBackupMessage(null), 3000);
      return;
    }

    if (!window.electronAPI) {
      setBackupMessage('❌ Electron API недоступен');
      return;
    }

    try {
      setIsCreatingBackup(true);
      setBackupProgress(0);
      setBackupMessage('🔄 Экспорт базы данных...');

      // 1. Экспортируем базу данных
      const databaseJson = await exportDatabase();
      console.log('[Settings] База данных экспортирована');

      setBackupMessage('🔄 Выбор места сохранения...');

      // 2. Генерируем имя файла с датой
      const date = new Date();
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const extension = backupParts === 1 ? '.zip' : '.arc';
      const fileName = `ARC_backup_${dateStr}${extension}`;
      
      // 3. Выбираем путь для сохранения через dialog
      const selectedPath = await window.electronAPI.selectBackupPath(fileName);

      if (!selectedPath) {
        setIsCreatingBackup(false);
        setBackupMessage(null);
        return;
      }

      setBackupMessage('🔄 Создание архива...');

      // 4. Создаём backup с базой данных
      const response = await window.electronAPI.createBackup(
        selectedPath,
        directoryPath,
        backupParts,
        databaseJson
      );

      if (response.success) {
        const sizeMB = Math.round(response.size / 1024 / 1024);
        
        // Логируем создание бэкапа
        await logCreateBackup(response.size, backupParts);
        
        setBackupMessage(`✅ Backup создан! Размер: ${sizeMB} MB, файлов: ${response.filesCount}`);
        
        // Открываем папку с backup в проводнике
        await window.electronAPI.openFileLocation(selectedPath);
        
        setTimeout(() => setBackupMessage(null), 5000);
      } else {
        setBackupMessage('❌ Ошибка создания backup');
      }
    } catch (error) {
      console.error('Ошибка создания backup:', error);
      setBackupMessage('❌ Ошибка создания backup');
    } finally {
      setIsCreatingBackup(false);
      setBackupProgress(0);
    }
  };

  const handleRestoreBackup = async () => {
    if (!window.electronAPI) {
      setRestoreMessage('❌ Electron API недоступен');
      return;
    }

    const confirmRestore = confirm(
      '⚠️ ВНИМАНИЕ!\n\n' +
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
      setRestoreMessage('🔄 Выбор архива...');

      // 1. Выбираем архив для восстановления
      const archivePath = await window.electronAPI.selectArchivePath();
      
      if (!archivePath) {
        setIsRestoring(false);
        setRestoreMessage(null);
        return;
      }

      setRestoreMessage('🔄 Восстановление файлов...');

      // 2. Выбираем целевую папку
      const targetPath = await window.electronAPI.selectWorkingDirectory();
      
      if (!targetPath) {
        setIsRestoring(false);
        setRestoreMessage(null);
        return;
      }

      // 3. Восстанавливаем файлы и получаем БД
      const result = await window.electronAPI.restoreBackup(archivePath, targetPath);

      if (!result.success) {
        setRestoreMessage('❌ Ошибка восстановления');
        setIsRestoring(false);
        return;
      }

      setRestoreMessage('🔄 Восстановление базы данных...');

      // 4. Импортируем базу данных с обновлением путей
      if (result.databaseJson) {
        await importDatabase(result.databaseJson, targetPath);
        console.log('[Settings] База данных импортирована с обновленными путями');
      }

      // 5. Обновляем рабочую папку в настройках (правильный ключ!)
      localStorage.setItem('arc_working_directory', targetPath);
      console.log('[Settings] Рабочая папка обновлена в localStorage:', targetPath);

      setRestoreMessage('✅ Восстановление завершено! Переход в галерею...');
      await loadStats();
      
      setTimeout(() => {
        // Переходим в галерею для просмотра восстановленных карточек
        navigate('/cards');
      }, 1500);
    } catch (error) {
      console.error('Ошибка восстановления:', error);
      setRestoreMessage('❌ Ошибка восстановления: ' + (error as Error).message);
    } finally {
      setIsRestoring(false);
    }
  };

  // Формируем actions для header - кнопки переключения табов
  const tabActions = (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button
        className={`section-header__view-button ${activeTab === 'storage' ? 'section-header__view-button--active' : ''}`}
        onClick={() => setActiveTab('storage')}
        title="Хранилище"
        style={{ width: '56px', height: '56px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: activeTab === 'storage' ? 'var(--color-grayscale-800)' : 'transparent', border: activeTab === 'storage' ? 'none' : '2px solid var(--color-grayscale-100)', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.15s' }}
      >
        <Icon name="server" size={24} variant={activeTab === 'storage' ? 'fill' : 'border'} />
      </button>
      <button
        className={`section-header__view-button ${activeTab === 'statistics' ? 'section-header__view-button--active' : ''}`}
        onClick={() => setActiveTab('statistics')}
        title="Статистика"
        style={{ width: '56px', height: '56px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: activeTab === 'statistics' ? 'var(--color-grayscale-800)' : 'transparent', border: activeTab === 'statistics' ? 'none' : '2px solid var(--color-grayscale-100)', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.15s' }}
      >
        <Icon name="line-chart" size={24} variant={activeTab === 'statistics' ? 'fill' : 'border'} />
      </button>
      <button
        className={`section-header__view-button ${activeTab === 'history' ? 'section-header__view-button--active' : ''}`}
        onClick={() => setActiveTab('history')}
        title="История"
        style={{ width: '56px', height: '56px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: activeTab === 'history' ? 'var(--color-grayscale-800)' : 'transparent', border: activeTab === 'history' ? 'none' : '2px solid var(--color-grayscale-100)', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.15s' }}
      >
        <Icon name="history" size={24} variant={activeTab === 'history' ? 'fill' : 'border'} />
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
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px' }}>
        {/* Табы перенесены в header */}

        {/* Таб: Хранилище */}
        {activeTab === 'storage' && (
          <div style={{ 
            padding: '24px', 
            backgroundColor: 'var(--bg-secondary)', 
            borderRadius: 'var(--radius-l)',
            marginBottom: '24px'
          }}>
            <h3 className="h3" style={{ marginBottom: '24px' }}>💾 Хранилище</h3>
          
          {/* Путь к рабочей папке */}
          <div style={{ 
            marginBottom: '24px',
            padding: '16px',
            backgroundColor: 'var(--bg-primary)',
            borderRadius: 'var(--radius-m)',
            border: '1px solid var(--border-default)'
          }}>
            <p className="text-s" style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Рабочая папка
            </p>
            <p className="text-m" style={{ 
              fontFamily: 'monospace',
              wordBreak: 'break-all'
            }}>
              {directoryPath || 'Не выбрана'}
            </p>
          </div>

          {/* Размеры файлов */}
          {directorySizes && (
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
              marginBottom: '24px'
            }}>
              <div style={{
                padding: '16px',
                backgroundColor: 'var(--bg-primary)',
                borderRadius: 'var(--radius-m)',
                border: '1px solid var(--border-default)'
              }}>
                <p className="text-s" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Всего занято
                </p>
                <p className="text-l" style={{ fontWeight: 'var(--font-weight-bold)' }}>
                  {Math.round(directorySizes.totalSize / 1024 / 1024)} МБ
                </p>
              </div>

              <div style={{
                padding: '16px',
                backgroundColor: 'var(--bg-primary)',
                borderRadius: 'var(--radius-m)',
                border: '1px solid var(--border-default)'
              }}>
                <p className="text-s" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Изображения
                </p>
                <p className="text-l" style={{ fontWeight: 'var(--font-weight-bold)' }}>
                  {Math.round(directorySizes.imagesSize / 1024 / 1024)} МБ
                </p>
                <p className="text-s" style={{ color: 'var(--text-secondary)' }}>
                  {directorySizes.imageCount} файлов
                </p>
              </div>

              <div style={{
                padding: '16px',
                backgroundColor: 'var(--bg-primary)',
                borderRadius: 'var(--radius-m)',
                border: '1px solid var(--border-default)'
              }}>
                <p className="text-s" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Видео
                </p>
                <p className="text-l" style={{ fontWeight: 'var(--font-weight-bold)' }}>
                  {Math.round(directorySizes.videosSize / 1024 / 1024)} МБ
                </p>
                <p className="text-s" style={{ color: 'var(--text-secondary)' }}>
                  {directorySizes.videoCount} файлов
                </p>
              </div>

              <div style={{
                padding: '16px',
                backgroundColor: 'var(--bg-primary)',
                borderRadius: 'var(--radius-m)',
                border: '1px solid var(--border-default)'
              }}>
                <p className="text-s" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Кэш превью
                </p>
                <p className="text-l" style={{ fontWeight: 'var(--font-weight-bold)' }}>
                  {Math.round(directorySizes.cacheSize / 1024 / 1024)} МБ
                </p>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <Button
              variant="secondary"
              size="L"
              onClick={handleChangeDirectory}
              disabled={isMovingDirectory}
            >
              {isMovingDirectory ? 'Перенос...' : (directoryHandle ? 'Перенести папку' : 'Выбрать папку')}
            </Button>
            
            <Button
              variant="error"
              size="L"
              onClick={handleClearCache}
              disabled={isMovingDirectory}
            >
              Очистить базу данных
            </Button>
          </div>

          {/* Прогресс переноса */}
          {isMovingDirectory && (
            <div style={{ marginTop: '16px' }}>
              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: 'var(--color-grayscale-200)',
                borderRadius: 'var(--radius-s)',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${moveProgress}%`,
                  height: '100%',
                  backgroundColor: 'var(--bg-button-primary)',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <p className="text-s" style={{ marginTop: '8px', textAlign: 'center' }}>
                {moveProgress}%
              </p>
            </div>
          )}

          {/* Сообщение о переносе */}
          {moveMessage && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: moveMessage.includes('✅') ? 'var(--color-green-100)' : moveMessage.includes('🔄') ? 'var(--color-yellow-100)' : 'var(--color-red-100)',
              borderRadius: 'var(--radius-s)',
              marginTop: '16px',
              whiteSpace: 'pre-line'
            }}>
              <p className="text-s">{moveMessage}</p>
            </div>
          )}

          {message && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: message.includes('✅') ? 'var(--color-green-100)' : 'var(--color-red-100)',
              borderRadius: 'var(--radius-s)',
              marginTop: '16px'
            }}>
              <p className="text-s">{message}</p>
            </div>
          )}

          {/* Резервное копирование */}
          <div style={{ 
            marginTop: '32px',
            paddingTop: '24px',
            borderTop: '1px solid var(--border-default)'
          }}>
            <h4 className="text-l" style={{ marginBottom: '12px', fontWeight: 'var(--font-weight-bold)' }}>
              💾 Резервное копирование
            </h4>
            <p className="text-s" style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Создайте полную резервную копию всех файлов и базы данных
            </p>

            {/* Выбор количества частей */}
            <div style={{ marginBottom: '16px' }}>
              <p className="text-s" style={{ marginBottom: '8px', fontWeight: 'var(--font-weight-bold)' }}>
                Разбиение архива:
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {([1, 2, 4, 8] as const).map((num) => {
                  const partSize = directorySizes ? directorySizes.totalSize / num : 0;
                  const sizeLabel = directorySizes ? ` (${formatSize(partSize)})` : '';
                  
                  return (
                    <Button
                      key={num}
                      variant={backupParts === num ? 'primary' : 'secondary'}
                      size="S"
                      onClick={() => setBackupParts(num)}
                      disabled={isCreatingBackup}
                    >
                      {num === 1 ? `Одним файлом${sizeLabel}` : `${num} части${sizeLabel}`}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <Button
                variant="primary"
                size="L"
                onClick={handleCreateBackup}
                disabled={isCreatingBackup || isRestoring || !directoryPath}
              >
                {isCreatingBackup ? 'Создание...' : 'Создать backup'}
              </Button>

              <Button
                variant="secondary"
                size="L"
                onClick={handleRestoreBackup}
                disabled={isCreatingBackup || isRestoring}
              >
                {isRestoring ? 'Восстановление...' : 'Восстановить'}
              </Button>
            </div>

            {isCreatingBackup && (
              <div style={{ marginTop: '16px' }}>
                <div style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: 'var(--color-grayscale-200)',
                  borderRadius: 'var(--radius-s)',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${backupProgress}%`,
                    height: '100%',
                    backgroundColor: 'var(--bg-button-primary)',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                <p className="text-s" style={{ marginTop: '8px', textAlign: 'center' }}>
                  {backupProgress}%
                </p>
              </div>
            )}

            {backupMessage && (
              <div style={{
                padding: '12px 16px',
                backgroundColor: backupMessage.includes('✅') ? 'var(--color-green-100)' : backupMessage.includes('🔄') ? 'var(--color-yellow-100)' : 'var(--color-red-100)',
                borderRadius: 'var(--radius-s)',
                marginTop: '16px'
              }}>
                <p className="text-s">{backupMessage}</p>
              </div>
            )}

            {restoreMessage && (
              <div style={{
                padding: '12px 16px',
                backgroundColor: restoreMessage.includes('✅') ? 'var(--color-green-100)' : restoreMessage.includes('🔄') ? 'var(--color-yellow-100)' : 'var(--color-red-100)',
                borderRadius: 'var(--radius-s)',
                marginTop: '16px'
              }}>
                <p className="text-s">{restoreMessage}</p>
              </div>
            )}
          </div>
          </div>
        )}

        {/* Таб: Статистика */}
        {activeTab === 'statistics' && stats && (
          <div style={{ 
            padding: '24px', 
            backgroundColor: 'var(--bg-secondary)', 
            borderRadius: 'var(--radius-l)' 
          }}>
            <h3 className="h3" style={{ marginBottom: '16px' }}>📊 Статистика</h3>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(2, 1fr)', 
              gap: '16px' 
            }}>
              <div>
                <p className="text-s" style={{ marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Всего карточек
                </p>
                <p className="h2">{stats.totalCards}</p>
              </div>
              
              <div>
                <p className="text-s" style={{ marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Изображений
                </p>
                <p className="h2">{stats.imageCount}</p>
              </div>
              
              <div>
                <p className="text-s" style={{ marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Видео
                </p>
                <p className="h2">{stats.videoCount}</p>
              </div>
              
              <div>
                <p className="text-s" style={{ marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Коллекций
                </p>
                <p className="h2">{stats.collectionCount}</p>
              </div>
              
              <div>
                <p className="text-s" style={{ marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Меток
                </p>
                <p className="h2">{stats.tagCount}</p>
              </div>
              
              <div>
                <p className="text-s" style={{ marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Категорий
                </p>
                <p className="h2">{stats.categoryCount}</p>
              </div>
            </div>

            {/* Топ метки */}
            {topTags.length > 0 && (
              <div style={{ marginTop: '32px' }}>
                <h4 className="text-l" style={{ marginBottom: '16px', fontWeight: 'var(--font-weight-bold)' }}>
                  🏆 Самые используемые метки
                </h4>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: '12px' 
                }}>
                  {topTags.map((tag, index) => (
                    <div 
                      key={tag.id}
                      style={{
                        padding: '12px 16px',
                        backgroundColor: 'var(--bg-primary)',
                        borderRadius: 'var(--radius-m)',
                        border: '1px solid var(--border-default)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <span style={{ 
                          marginRight: '8px',
                          color: 'var(--text-secondary)',
                          fontWeight: 'var(--font-weight-bold)'
                        }}>
                          #{index + 1}
                        </span>
                        <span className="text-m" style={{ fontWeight: 'var(--font-weight-bold)' }}>
                          {tag.name}
                        </span>
                        <p className="text-s" style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {tag.categoryName}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p className="text-l" style={{ fontWeight: 'var(--font-weight-bold)' }}>
                          {tag.cardCount}
                        </p>
                        <p className="text-s" style={{ color: 'var(--text-secondary)' }}>
                          карточек
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Топ коллекции */}
            {topCollections.length > 0 && (
              <div style={{ marginTop: '32px' }}>
                <h4 className="text-l" style={{ marginBottom: '16px', fontWeight: 'var(--font-weight-bold)' }}>
                  📚 Самые большие коллекции
                </h4>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: '12px' 
                }}>
                  {topCollections.map((collection, index) => (
                    <div 
                      key={collection.id}
                      style={{
                        padding: '12px 16px',
                        backgroundColor: 'var(--bg-primary)',
                        borderRadius: 'var(--radius-m)',
                        border: '1px solid var(--border-default)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ 
                          marginRight: '8px',
                          color: 'var(--text-secondary)',
                          fontWeight: 'var(--font-weight-bold)'
                        }}>
                          #{index + 1}
                        </span>
                        <span className="text-m" style={{ fontWeight: 'var(--font-weight-bold)' }}>
                          {collection.name}
                        </span>
                        {collection.description && (
                          <p className="text-s" style={{ 
                            color: 'var(--text-secondary)', 
                            marginTop: '2px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {collection.description}
                          </p>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', marginLeft: '12px' }}>
                        <p className="text-l" style={{ fontWeight: 'var(--font-weight-bold)' }}>
                          {collection.cardCount}
                        </p>
                        <p className="text-s" style={{ color: 'var(--text-secondary)' }}>
                          карточек
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Малоиспользуемые метки */}
            {underusedTags.length > 0 && (
              <div style={{ marginTop: '32px' }}>
                <h4 className="text-l" style={{ marginBottom: '8px', fontWeight: 'var(--font-weight-bold)' }}>
                  🔍 Малоиспользуемые метки
                </h4>
                <p className="text-s" style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Метки с малым количеством использований (≤3 карточки)
                </p>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: '12px' 
                }}>
                  {underusedTags.map((tag) => (
                    <div 
                      key={tag.id}
                      style={{
                        padding: '12px 16px',
                        backgroundColor: 'var(--bg-primary)',
                        borderRadius: 'var(--radius-m)',
                        border: '1px solid var(--border-default)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <span className="text-m" style={{ fontWeight: 'var(--font-weight-bold)' }}>
                          {tag.name}
                        </span>
                        <p className="text-s" style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {tag.categoryName} • {tag.cardCount} карточек
                        </p>
                      </div>
                      <Button
                        variant="error"
                        size="S"
                        onClick={() => handleDeleteTag(tag.id, tag.name)}
                      >
                        Удалить
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Таб: История */}
        {activeTab === 'history' && (
          <HistorySection />
        )}
      </div>
    </Layout>
  );
};

export default SettingsPage;

