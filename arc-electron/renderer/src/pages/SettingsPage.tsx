/**
 * Страница настроек
 */

import { useState, useEffect } from 'react';
import { Layout } from '../components/layout';
import { Button } from '../components/common';
import { useFileSystem } from '../hooks';
import { getStatistics, db, exportDatabase, importDatabase } from '../services/db';
import type { AppStatistics } from '../types';

export const SettingsPage = () => {
  const { directoryHandle, requestDirectory, directoryPath } = useFileSystem();
  const [stats, setStats] = useState<AppStatistics | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [backupParts, setBackupParts] = useState<1 | 2 | 4 | 8>(1);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
    
    // Подписываемся на прогресс backup
    if (window.electronAPI?.onBackupProgress) {
      window.electronAPI.onBackupProgress((data) => {
        setBackupProgress(data.percent);
      });
    }
  }, []);

  const loadStats = async () => {
    try {
      const newStats = await getStatistics();
      setStats(newStats);
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    }
  };

  const handleChangeDirectory = async () => {
    await requestDirectory();
    setMessage('✅ Рабочая папка обновлена');
    setTimeout(() => setMessage(null), 2000);
  };

  const handleClearCache = async () => {
    if (!confirm('Очистить весь кеш? Это удалит все данные из базы.')) {
      return;
    }

    try {
      await db.delete();
      await db.open();
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
        setBackupMessage(`✅ Backup создан! Размер: ${sizeMB} MB, файлов: ${response.filesCount}`);
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

      setRestoreMessage('✅ Восстановление завершено! Обновите страницу.');
      await loadStats();
      
      setTimeout(() => {
        // Перезагружаем страницу чтобы обновить все данные
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Ошибка восстановления:', error);
      setRestoreMessage('❌ Ошибка восстановления: ' + (error as Error).message);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <Layout
      headerProps={{
        title: 'Настройки'
      }}
      showSearch={false}
    >
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px' }}>
        {/* Хранилище */}
        <div style={{ 
          padding: '24px', 
          backgroundColor: 'var(--bg-secondary)', 
          borderRadius: 'var(--radius-l)',
          marginBottom: '24px'
        }}>
          <h3 className="h3" style={{ marginBottom: '16px' }}>💾 Хранилище</h3>
          
          <div style={{ marginBottom: '16px' }}>
            <p className="text-s" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Рабочая папка
            </p>
            <p className="text-m">
              {directoryHandle ? 'Папка выбрана' : 'Не выбрана'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <Button
              variant="secondary"
              onClick={handleChangeDirectory}
            >
              {directoryHandle ? 'Изменить папку' : 'Выбрать папку'}
            </Button>
            
            <Button
              variant="danger"
              onClick={handleClearCache}
            >
              Очистить базу данных
            </Button>
          </div>

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
              <div style={{ display: 'flex', gap: '8px' }}>
                {([1, 2, 4, 8] as const).map((num) => (
                  <Button
                    key={num}
                    variant={backupParts === num ? 'primary' : 'secondary'}
                    size="small"
                    onClick={() => setBackupParts(num)}
                    disabled={isCreatingBackup}
                  >
                    {num === 1 ? 'Одним файлом' : `${num} части`}
                  </Button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <Button
                variant="primary"
                onClick={handleCreateBackup}
                disabled={isCreatingBackup || isRestoring || !directoryPath}
              >
                {isCreatingBackup ? 'Создание...' : 'Создать backup'}
              </Button>

              <Button
                variant="secondary"
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

        {/* Статистика */}
        {stats && (
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
          </div>
        )}

        {/* Информация */}
        <div style={{ 
          padding: '24px', 
          backgroundColor: 'var(--color-yellow-100)', 
          borderRadius: 'var(--radius-l)',
          marginTop: '24px'
        }}>
          <p className="text-m">
            💡 <strong>Совет:</strong> Начните с создания категорий и меток в разделе "Метки", 
            затем добавьте карточки через раздел "Добавить".
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default SettingsPage;

