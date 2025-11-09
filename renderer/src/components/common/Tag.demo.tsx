/**
 * Демонстрация компонента Tag
 * Показывает все варианты и состояния меток
 */

import { Tag } from './Tag';
import './Tag.css';

export const TagDemo = () => {
  return (
    <div style={{ 
      padding: '40px', 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '40px',
      backgroundColor: 'var(--bg-primary)'
    }}>
      {/* Default стиль */}
      <section>
        <h2 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>
          Default стиль (на монотонном фоне)
        </h2>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <Tag variant="default">Минимализм</Tag>
          <Tag variant="default" count={42}>Архитектура</Tag>
          <Tag variant="default" count={150}>Пейзаж</Tag>
          <Tag variant="default" count={1234}>Популярное</Tag>
          <Tag variant="default" removable onRemove={() => console.log('Remove')}>
            С удалением
          </Tag>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <Tag variant="default" size="small">Маленький</Tag>
          <Tag variant="default" size="small" count={99}>
            С счетчиком
          </Tag>
        </div>
      </section>

      {/* Active стиль */}
      <section>
        <h2 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>
          Active стиль (выбранные метки)
        </h2>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <Tag variant="active">Активная метка</Tag>
          <Tag variant="active" count={42}>Архитектура</Tag>
          <Tag variant="active" count={1500}>Много контента</Tag>
          <Tag variant="active" removable onRemove={() => console.log('Remove')}>
            Удалить
          </Tag>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <Tag variant="active" size="small">Маленькая</Tag>
          <Tag variant="active" size="small" count={123}>
            С числом
          </Tag>
        </div>
      </section>

      {/* Blurred стиль */}
      <section>
        <h2 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>
          Blurred стиль (поверх изображений)
        </h2>
        
        <div 
          style={{ 
            position: 'relative',
            width: '400px',
            height: '300px',
            borderRadius: '8px',
            overflow: 'hidden',
            backgroundImage: 'url(https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            alignItems: 'flex-end',
            padding: '16px',
            gap: '8px',
            flexWrap: 'wrap'
          }}
        >
          <Tag variant="blurred">Природа</Tag>
          <Tag variant="blurred" count={89}>Горы</Tag>
          <Tag variant="blurred" count={2345}>Пейзаж</Tag>
          <Tag variant="blurred" removable onRemove={() => console.log('Remove')}>
            Закрыть
          </Tag>
        </div>
      </section>

      {/* Длинные очереди меток */}
      <section>
        <h2 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>
          Длинные очереди меток
        </h2>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxWidth: '600px' }}>
          <Tag variant="default" count={42}>Минимализм</Tag>
          <Tag variant="default" count={156}>Архитектура</Tag>
          <Tag variant="active" count={89}>Современное</Tag>
          <Tag variant="default" count={234}>Интерьер</Tag>
          <Tag variant="active" removable>Пейзаж</Tag>
          <Tag variant="default" count={1200}>Графика</Tag>
          <Tag variant="default" count={567}>Иллюстрация</Tag>
          <Tag variant="active" count={3456}>Популярное</Tag>
          <Tag variant="default">Черно-белое</Tag>
          <Tag variant="default" count={91}>Винтаж</Tag>
          <Tag variant="active" removable count={123}>
            Избранное
          </Tag>
          <Tag variant="default" count={45}>Абстракция</Tag>
        </div>
      </section>

      {/* Форматирование счетчиков */}
      <section>
        <h2 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>
          Форматирование счетчиков
        </h2>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <Tag variant="default" count={0}>Нет (0 скрыт)</Tag>
          <Tag variant="default" count={7}>Семь (7)</Tag>
          <Tag variant="default" count={42}>Сорок два (42)</Tag>
          <Tag variant="default" count={999}>Максимум (999)</Tag>
          <Tag variant="default" count={1000}>Тысяча (1.0K)</Tag>
          <Tag variant="default" count={1234}>Форматировано (1.2K)</Tag>
          <Tag variant="default" count={5678}>Много (5.7K)</Tag>
          <Tag variant="default" count={12345}>Очень много (12.3K)</Tag>
        </div>
      </section>
    </div>
  );
};

export default TagDemo;

