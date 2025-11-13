/**
 * Демо-страница для OnboardingScreen
 * Для тестирования редизайна экрана онбординга
 */

import { useState } from 'react';
import { OnboardingScreen } from './OnboardingScreen';
import './OnboardingScreen.css';

/**
 * Демо компонент OnboardingScreen
 */
export const OnboardingScreenDemo = () => {
  const [selectedAction, setSelectedAction] = useState<string>('');

  const handleDirectorySelected = async () => {
    console.log('📁 Пользователь выбрал папку');
    setSelectedAction('Выбрана папка для сохранения');
    
    // Симулируем задержку
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  const handleRestoreBackup = async () => {
    console.log('💾 Пользователь восстанавливает резервную копию');
    setSelectedAction('Восстановление резервной копии...');
    
    // Симулируем задержку
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  const mockRequestDirectory = async () => {
    console.log('🔍 Запрос выбора директории');
    // Симулируем API выбора папки
    await new Promise(resolve => setTimeout(resolve, 500));
    return { path: 'C:/Users/User/Documents/ARC' };
  };

  const handleReset = () => {
    setSelectedAction('');
  };

  console.log('🎨 OnboardingScreenDemo рендерится');

  return (
    <div style={{ 
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 9999,
      backgroundColor: 'var(--bg-primary, #f5f5f5)'
    }}>
      {/* Экран онбординга */}
      <OnboardingScreen
        onDirectorySelected={handleDirectorySelected}
        onRestoreBackup={handleRestoreBackup}
        requestDirectory={mockRequestDirectory}
      />

      {/* Панель управления демо */}
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          padding: '16px',
          background: 'rgba(0, 0, 0, 0.8)',
          borderRadius: '8px',
          color: 'white',
          fontSize: '14px',
          zIndex: 10000,
          maxWidth: '300px',
        }}
      >
        <div style={{ marginBottom: '12px', fontWeight: 'bold' }}>
          🎨 Демо Онбординга
        </div>
        
        {selectedAction && (
          <div
            style={{
              marginBottom: '12px',
              padding: '8px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
            }}
          >
            ✅ {selectedAction}
          </div>
        )}

        <button
          onClick={handleReset}
          style={{
            width: '100%',
            padding: '8px 16px',
            background: '#fff',
            color: '#000',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          🔄 Сбросить состояние
        </button>

        <div
          style={{
            marginTop: '12px',
            fontSize: '12px',
            opacity: 0.7,
            lineHeight: '1.4',
          }}
        >
          Проверьте:
          <br />
          • Сетка 2×2 с карточками
          <br />
          • Две кнопки действий
          <br />
          • Состояния загрузки
          <br />
          • Responsive на 1920-2560px
        </div>
      </div>
    </div>
  );
};

export default OnboardingScreenDemo;

