/**
 * Компонент для отображения истории действий пользователя
 * Показывает список действий с фильтрацией по периодам
 */

import { useState, useEffect } from 'react';
import { Button } from '../common';
import { getHistory, clearHistory } from '../../services/history';
import type { HistoryEntry, HistoryPeriod } from '../../types';
import './HistorySection.css';

export const HistorySection = () => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePeriod, setActivePeriod] = useState<HistoryPeriod>('all');
  const [filteredHistory, setFilteredHistory] = useState<HistoryEntry[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  // Загрузка истории при монтировании
  useEffect(() => {
    loadHistory();
  }, []);

  // Фильтрация при изменении периода или истории
  useEffect(() => {
    filterHistory();
  }, [history, activePeriod]);

  /**
   * Загрузить историю из файла
   */
  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await getHistory();
      
      // Преобразуем timestamp из string в Date
      const entries: HistoryEntry[] = data.map((item) => ({
        ...item,
        timestamp: new Date(item.timestamp)
      }));
      
      setHistory(entries);
      console.log('[HistorySection] Загружено записей:', entries.length);
    } catch (error) {
      console.error('[HistorySection] Ошибка загрузки истории:', error);
      setMessage('❌ Ошибка загрузки истории');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Фильтрация истории по выбранному периоду
   */
  const filterHistory = () => {
    const now = new Date();
    let filtered: HistoryEntry[] = [];

    switch (activePeriod) {
      case 'today': {
        // Сегодня (с начала дня)
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        filtered = history.filter((entry) => entry.timestamp >= startOfDay);
        break;
      }

      case 'week': {
        // За неделю
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        filtered = history.filter((entry) => entry.timestamp >= weekAgo);
        break;
      }

      case 'month': {
        // За месяц
        const monthAgo = new Date(now);
        monthAgo.setMonth(now.getMonth() - 1);
        filtered = history.filter((entry) => entry.timestamp >= monthAgo);
        break;
      }

      case 'all':
      default:
        // Вся история
        filtered = history;
        break;
    }

    setFilteredHistory(filtered);
  };

  /**
   * Очистить всю историю
   */
  const handleClearHistory = async () => {
    const confirmed = confirm(
      '⚠️ Очистить историю?\n\n' +
      'Это действие нельзя отменить.\n' +
      'Будут удалены все записи истории действий.'
    );

    if (!confirmed) {
      return;
    }

    try {
      await clearHistory();
      setHistory([]);
      setFilteredHistory([]);
      setMessage('✅ История очищена');
      setTimeout(() => setMessage(null), 2000);
    } catch (error) {
      console.error('[HistorySection] Ошибка очистки истории:', error);
      setMessage('❌ Ошибка очистки истории');
      setTimeout(() => setMessage(null), 2000);
    }
  };

  /**
   * Форматирование даты и времени
   */
  const formatDate = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${day}.${month}.${year} ${hours}:${minutes}`;
  };

  /**
   * Парсинг описания для выделения названий в кавычках
   * Возвращает массив фрагментов с флагом, нужно ли подчеркивание
   */
  const parseDescription = (description: string): Array<{ text: string; underline: boolean }> => {
    const parts: Array<{ text: string; underline: boolean }> = [];
    const regex = /«([^»]+)»/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(description)) !== null) {
      // Добавляем текст до кавычек
      if (match.index > lastIndex) {
        parts.push({
          text: description.substring(lastIndex, match.index),
          underline: false
        });
      }

      // Добавляем текст в кавычках с подчеркиванием
      parts.push({
        text: `«${match[1]}»`,
        underline: true
      });

      lastIndex = regex.lastIndex;
    }

    // Добавляем оставшийся текст
    if (lastIndex < description.length) {
      parts.push({
        text: description.substring(lastIndex),
        underline: false
      });
    }

    return parts;
  };

  if (loading) {
    return (
      <div className="history-section">
        <div className="history-section__loading">
          <p className="text-m">Загрузка истории...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="history-section">
      <h3 className="history-section__title h3">История изменений</h3>

      {/* Фильтры */}
      <div className="history-section__filters">
        <div className="history-section__filter-buttons">
          <Button
            variant={activePeriod === 'today' ? 'primary' : 'secondary'}
            size="small"
            onClick={() => setActivePeriod('today')}
          >
            Сегодня
          </Button>

          <Button
            variant={activePeriod === 'week' ? 'primary' : 'secondary'}
            size="small"
            onClick={() => setActivePeriod('week')}
          >
            За неделю
          </Button>

          <Button
            variant={activePeriod === 'month' ? 'primary' : 'secondary'}
            size="small"
            onClick={() => setActivePeriod('month')}
          >
            За месяц
          </Button>

          <Button
            variant={activePeriod === 'all' ? 'primary' : 'secondary'}
            size="small"
            onClick={() => setActivePeriod('all')}
          >
            Вся история
          </Button>
        </div>

        <Button
          variant="secondary"
          size="small"
          onClick={handleClearHistory}
          disabled={history.length === 0}
        >
          Очистить историю
        </Button>
      </div>

      {/* Сообщения */}
      {message && (
        <div
          className="history-section__message"
          style={{
            backgroundColor: message.includes('✅') 
              ? 'var(--color-green-100)' 
              : 'var(--color-red-100)'
          }}
        >
          <p className="text-s">{message}</p>
        </div>
      )}

      {/* Список записей истории */}
      {filteredHistory.length === 0 ? (
        <div className="history-section__empty">
          <p className="text-m" style={{ color: 'var(--text-secondary)' }}>
            {history.length === 0 
              ? 'История пуста' 
              : 'Нет записей за выбранный период'}
          </p>
        </div>
      ) : (
        <div className="history-section__container">
          {filteredHistory.map((entry, index) => {
            const descriptionParts = parseDescription(entry.description);
            
            return (
              <div key={entry.id}>
                <div className="history-section__item">
                  <p className="history-section__timestamp text-m">
                    {formatDate(entry.timestamp)}
                  </p>
                  <p className="history-section__description text-m">
                    {descriptionParts.map((part, idx) => (
                      part.underline ? (
                        <span key={idx} className="history-section__highlight">
                          {part.text}
                        </span>
                      ) : (
                        <span key={idx}>{part.text}</span>
                      )
                    ))}
                  </p>
                </div>

                {/* Разделитель (не показываем после последней записи) */}
                {index < filteredHistory.length - 1 && (
                  <div className="history-section__divider" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HistorySection;

