/**
 * Страница настроек
 */

import { useState, useEffect } from 'react';
import { Layout } from '../components/layout';
import { Button } from '../components/common';
import { useFileSystem } from '../hooks';
import { getStatistics, db } from '../services/db';
import type { AppStatistics } from '../types';

export const SettingsPage = () => {
  const { directoryHandle, requestDirectory } = useFileSystem();
  const [stats, setStats] = useState<AppStatistics | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
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

