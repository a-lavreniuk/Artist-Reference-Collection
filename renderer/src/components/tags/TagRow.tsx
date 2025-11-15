/**
 * Компонент TagRow - строка редактирования метки
 * Содержит два поля: название и описание, а также кнопку удаления
 */

import { useState, useEffect, useRef } from 'react';
import { Input } from '../common';
import { Icon } from '../common';
import type { Tag } from '../../types';
import './TagRow.css';

export interface TagRowProps {
  /** Существующая метка (для режима редактирования) */
  tag?: Tag;
  
  /** Режим: редактирование существующей метки или добавление новой */
  mode?: 'edit' | 'add';
  
  /** Значения полей (для новых меток) */
  initialName?: string;
  initialDescription?: string;
  
  /** Обработчик изменения значений */
  onChange?: (name: string, description: string) => void;
  
  /** Обработчик удаления метки */
  onRemove?: () => void;
  
  /** Ошибка валидации названия */
  nameError?: string;
  
  /** Ошибка валидации описания */
  descriptionError?: string;
  
  /** Автофокус на поле названия */
  autoFocus?: boolean;
}

/**
 * Компонент TagRow
 */
export const TagRow = ({
  tag,
  mode = tag ? 'edit' : 'add',
  initialName = '',
  initialDescription = '',
  onChange,
  onRemove,
  nameError,
  descriptionError,
  autoFocus = false
}: TagRowProps) => {
  const [name, setName] = useState(tag?.name || initialName);
  const [description, setDescription] = useState(tag?.description || initialDescription);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Инициализация значений при изменении tag
  useEffect(() => {
    if (tag) {
      setName(tag.name);
      setDescription(tag.description || '');
    }
  }, [tag]);

  // Автофокус при добавлении новой строки
  useEffect(() => {
    if (autoFocus && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [autoFocus]);

  // Уведомление об изменении значений
  useEffect(() => {
    onChange?.(name, description);
  }, [name, description, onChange]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDescription(e.target.value);
  };

  const handleRemove = () => {
    onRemove?.();
  };

  return (
    <div className="tag-row">
      <div className="tag-row__fields">
        <div className="tag-row__field tag-row__field--name">
          <Input
            ref={nameInputRef}
            placeholder="Название метки…"
            value={name}
            onChange={handleNameChange}
            error={nameError}
            fullWidth
            style={{ height: '44px' }}
          />
        </div>
        <div className="tag-row__field tag-row__field--description">
          <Input
            placeholder="Описание метки…"
            value={description}
            onChange={handleDescriptionChange}
            error={descriptionError}
            fullWidth
            style={{ height: '44px' }}
          />
        </div>
        <button
          type="button"
          className="tag-row__remove"
          onClick={handleRemove}
          aria-label="Удалить метку"
          title="Удалить метку"
        >
          <Icon name="x" size={16} variant="border" />
        </button>
      </div>
    </div>
  );
};

export default TagRow;

