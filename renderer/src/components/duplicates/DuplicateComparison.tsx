/**
 * Компонент для сравнения двух изображений-дублей
 * Показывает два изображения рядом с информацией о файлах
 */

import { useState } from 'react';
import { Button, Icon } from '../common';
import type { Card } from '../../types';
import './DuplicateComparison.css';

interface DuplicateComparisonProps {
  card1: Card;
  card2: Card;
  similarity: number;
  onDelete: (cardId: string) => Promise<void>;
  isDeleting: boolean;
  currentIndex: number;
  totalCount: number;
}

/**
 * Форматирует размер файла в читаемый вид
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

/**
 * Форматирует размеры изображения
 */
function formatDimensions(width?: number, height?: number): string {
  if (!width || !height) return 'Неизвестно';
  return `${width}×${height}`;
}

/**
 * Получает расширение файла (формат)
 */
function getFileFormat(fileName: string): string {
  const ext = fileName.split('.').pop()?.toUpperCase();
  return ext || 'Неизвестно';
}

export const DuplicateComparison = ({
  card1,
  card2,
  similarity,
  onDelete,
  isDeleting,
  currentIndex,
  totalCount
}: DuplicateComparisonProps) => {
  const [image1Loaded, setImage1Loaded] = useState(false);
  const [image2Loaded, setImage2Loaded] = useState(false);
  const [image1Error, setImage1Error] = useState(false);
  const [image2Error, setImage2Error] = useState(false);

  const handleDelete1 = async () => {
    await onDelete(card1.id);
  };

  const handleDelete2 = async () => {
    await onDelete(card2.id);
  };

  return (
    <div className="duplicate-comparison">
      <div className="duplicate-comparison__header">
        <p className="duplicate-comparison__counter text-m">
          {currentIndex} из {totalCount}
        </p>
        <p className="duplicate-comparison__similarity text-m">
          Схожесть: {similarity}%
        </p>
      </div>

      <div className="duplicate-comparison__content">
        {/* Левое изображение */}
        <div className="duplicate-comparison__side">
          <div className="duplicate-comparison__image-container">
            {!image1Loaded && !image1Error && (
              <div className="duplicate-comparison__skeleton skeleton" />
            )}
            {image1Error && (
              <div className="duplicate-comparison__error">
                <Icon name="image" size={48} variant="border" />
                <p>Не удалось загрузить</p>
              </div>
            )}
            {!image1Error && (
              <img
                src={card1.thumbnailUrl || card1.filePath}
                alt={card1.fileName}
                className="duplicate-comparison__image"
                onLoad={() => setImage1Loaded(true)}
                onError={() => setImage1Error(true)}
                loading="eager"
              />
            )}
          </div>

          <div className="duplicate-comparison__info text-l">
            <span>{getFileFormat(card1.fileName)}</span>
            <span>{formatDimensions(card1.width, card1.height)}</span>
            <span>{formatFileSize(card1.fileSize)}</span>
            <span className="duplicate-comparison__path">{card1.filePath}</span>
          </div>

          <Button
            variant="secondary"
            size="L"
            iconRight={<Icon name="trash" size={24} variant="border" />}
            onClick={handleDelete1}
            disabled={isDeleting}
            loading={isDeleting}
          >
            Удалить
          </Button>
        </div>

        {/* Правое изображение */}
        <div className="duplicate-comparison__side">
          <div className="duplicate-comparison__image-container">
            {!image2Loaded && !image2Error && (
              <div className="duplicate-comparison__skeleton skeleton" />
            )}
            {image2Error && (
              <div className="duplicate-comparison__error">
                <Icon name="image" size={48} variant="border" />
                <p>Не удалось загрузить</p>
              </div>
            )}
            {!image2Error && (
              <img
                src={card2.thumbnailUrl || card2.filePath}
                alt={card2.fileName}
                className="duplicate-comparison__image"
                onLoad={() => setImage2Loaded(true)}
                onError={() => setImage2Error(true)}
                loading="eager"
              />
            )}
          </div>

          <div className="duplicate-comparison__info text-l">
            <span>{getFileFormat(card2.fileName)}</span>
            <span>{formatDimensions(card2.width, card2.height)}</span>
            <span>{formatFileSize(card2.fileSize)}</span>
            <span className="duplicate-comparison__path">{card2.filePath}</span>
          </div>

          <Button
            variant="secondary"
            size="L"
            iconRight={<Icon name="trash" size={24} variant="border" />}
            onClick={handleDelete2}
            disabled={isDeleting}
            loading={isDeleting}
          >
            Удалить
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DuplicateComparison;

