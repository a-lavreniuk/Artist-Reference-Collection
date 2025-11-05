/**
 * Страница настроек
 */

import { useState } from 'react';
import { Layout } from '../components/layout';
import { Button } from '../components/common';
import { initializeMockData } from '../utils/mockData';
import { getStatistics } from '../services/db';
import type { AppStatistics } from '../types';

export const SettingsPage = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [stats, setStats] = useState<AppStatistics | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleGenerateMockData = async () => {
    try {
      setIsGenerating(true);
      setMessage(null);
      
      await initializeMockData(50);
      
      // Получаем статистику
      const newStats = await getStatistics();
      setStats(newStats);
      setMessage('✅ Тестовые данные успешно созданы! Обновите страницу карточек.');
    } catch (error) {
      console.error('Ошибка генерации данных:', error);
      setMessage('❌ Ошибка при создании тестовых данных');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLoadStats = async () => {
    try {
      const newStats = await getStatistics();
      setStats(newStats);
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
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
        <div style={{ 
          padding: '24px', 
          backgroundColor: 'var(--bg-secondary)', 
          borderRadius: 'var(--radius-l)',
          marginBottom: '24px'
        }}>
          <h3 className="h3" style={{ marginBottom: '16px' }}>🧪 Тестовые данные</h3>
          <p className="text-m" style={{ marginBottom: '24px', color: 'var(--text-secondary)' }}>
            Сгенерируйте тестовые данные для проверки работы приложения.
            <br />
            Будет создано: 4 категории, 20 меток, 50 карточек, 3 коллекции.
          </p>
          
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <Button
              variant="primary"
              onClick={handleGenerateMockData}
              loading={isGenerating}
            >
              Создать тестовые данные
            </Button>
            
            <Button
              variant="secondary"
              onClick={handleLoadStats}
            >
              Показать статистику
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
      </div>
    </Layout>
  );
};

export default SettingsPage;

