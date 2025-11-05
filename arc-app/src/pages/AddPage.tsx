/**
 * Страница добавления карточек
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout';
import { Button, Input } from '../components/common';
import { useFileSystem } from '../hooks';
import { getAllFilesFromDirectory, readFileAsDataURL, getFileInfo } from '../services/fileSystem';
import { addCard } from '../services/db';
import type { Card } from '../types';

export const AddPage = () => {
  const navigate = useNavigate();
  const { directoryHandle, requestDirectory } = useFileSystem();
  const [isScanning, setIsScanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleScanDirectory = async () => {
    if (!directoryHandle) {
      const handle = await requestDirectory();
      if (!handle) {
        setMessage('❌ Необходимо выбрать рабочую папку');
        return;
      }
    }

    try {
      setIsScanning(true);
      setMessage('🔍 Сканирование папки...');

      const files = await getAllFilesFromDirectory(directoryHandle!);
      setMessage(`📁 Найдено ${files.length} файлов. Импортирую...`);

      let imported = 0;
      for (const fileHandle of files) {
        try {
          const info = await getFileInfo(fileHandle);
          const dataUrl = await readFileAsDataURL(fileHandle);

          const card: Card = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            fileName: info.name,
            filePath: `/${info.name}`,
            type: info.type.startsWith('video/') ? 'video' : 'image',
            format: info.name.split('.').pop()?.toLowerCase() as any,
            dateAdded: new Date(),
            dateModified: new Date(info.lastModified),
            fileSize: info.size,
            thumbnailUrl: dataUrl,
            tags: [],
            collections: [],
            inMoodboard: false
          };

          await addCard(card);
          imported++;
          
          if (imported % 10 === 0) {
            setMessage(`📥 Импортировано ${imported} из ${files.length}...`);
          }
        } catch (error) {
          console.error('Ошибка импорта файла:', error);
        }
      }

      setMessage(`✅ Успешно импортировано ${imported} карточек!`);
      
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (error) {
      console.error('Ошибка сканирования:', error);
      setMessage('❌ Ошибка при сканировании папки');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <Layout
      headerProps={{
        title: 'Добавить карточки'
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
          <h3 className="h3" style={{ marginBottom: '16px' }}>📁 Импорт из рабочей папки</h3>
          <p className="text-m" style={{ marginBottom: '24px', color: 'var(--text-secondary)' }}>
            Сканирует вашу рабочую папку и импортирует все изображения и видео.
            <br />
            Поддерживаемые форматы: .jpg, .jpeg, .png, .webp, .mp4, .webm
          </p>
          
          <Button
            variant="primary"
            size="large"
            onClick={handleScanDirectory}
            loading={isScanning}
            fullWidth
          >
            {directoryHandle ? 'Сканировать рабочую папку' : 'Выбрать папку и сканировать'}
          </Button>

          {message && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: message.includes('✅') ? 'var(--color-green-100)' : 
                             message.includes('❌') ? 'var(--color-red-100)' : 
                             'var(--color-yellow-100)',
              borderRadius: 'var(--radius-s)',
              marginTop: '16px'
            }}>
              <p className="text-s">{message}</p>
            </div>
          )}
        </div>

        <div style={{ 
          padding: '24px', 
          backgroundColor: 'var(--bg-secondary)', 
          borderRadius: 'var(--radius-l)'
        }}>
          <h3 className="h3" style={{ marginBottom: '16px' }}>ℹ️ Как это работает</h3>
          <ul style={{ 
            listStyle: 'disc',
            paddingLeft: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <li className="text-m">Выбирается рабочая папка с медиафайлами</li>
            <li className="text-m">Приложение сканирует все подпапки</li>
            <li className="text-m">Находит изображения и видео</li>
            <li className="text-m">Создаёт карточки для каждого файла</li>
            <li className="text-m">После импорта можно добавлять метки и коллекции</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};

export default AddPage;

