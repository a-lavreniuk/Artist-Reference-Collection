/**
 * Страница коллекций
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout';
import { Button, Icon } from '../components/common';
import { CollectionCard, CreateCollectionModal } from '../components/collections';
import { getAllCollections, getAllCards } from '../services/db';
import { useSearch } from '../contexts';
import type { Collection, Card } from '../types';
import './CollectionsPage.css';

export const CollectionsPage = () => {
  const navigate = useNavigate();
  const { searchProps } = useSearch();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Загрузка коллекций и карточек
  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      setIsLoading(true);
      const [allCollections, allCards] = await Promise.all([
        getAllCollections(),
        getAllCards()
      ]);
      setCollections(allCollections);
      setCards(allCards);
    } catch (error) {
      console.error('Ошибка загрузки коллекций:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Функция для подсчёта статистики по типам файлов в коллекции
  const getCollectionStats = (collection: Collection) => {
    const collectionCards = cards.filter(card => collection.cardIds.includes(card.id));
    const imageCount = collectionCards.filter(card => card.type === 'image').length;
    const videoCount = collectionCards.filter(card => card.type === 'video').length;
    return { imageCount, videoCount };
  };

  // Функция для получения превью коллекции
  const getCollectionThumbnails = (collection: Collection): string[] => {
    // Получаем карточки коллекции в порядке добавления (последние первыми)
    const collectionCards = collection.cardIds
      .map(id => cards.find(card => card.id === id))
      .filter((card): card is Card => card !== undefined)
      .reverse(); // Последние добавленные первыми
    
    // Берём первые 3 и возвращаем их thumbnails или filePath
    return collectionCards
      .slice(0, 3)
      .map(card => card.thumbnailUrl || card.filePath);
  };

  const handleCollectionClick = (collection: Collection) => {
    navigate(`/collections/${collection.id}`);
  };

  const handleCollectionCreated = () => {
    loadCollections();
  };

  if (isLoading) {
    return (
      <Layout
        headerProps={{
          title: 'Коллекции'
        }}
        searchProps={searchProps}
      >
        <div className="layout__loading">
          <div className="layout__spinner" />
          <p className="layout__loading-text">Загрузка коллекций...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      headerProps={{
        title: 'Коллекции',
        actions: (
          <Button
            variant="primary"
            size="L"
            iconLeft={<Icon name="folder-plus" size={24} variant="border" />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            Добавить коллекцию
          </Button>
        )
      }}
      searchProps={searchProps}
    >
      {collections.length > 0 ? (
        <div className="collections-grid">
          {collections.map((collection) => {
            const { imageCount, videoCount } = getCollectionStats(collection);
            const thumbnails = getCollectionThumbnails(collection);
            
            // Создаём временную коллекцию с актуальными thumbnails
            const collectionWithThumbnails = {
              ...collection,
              thumbnails
            };
            
            return (
              <CollectionCard
                key={collection.id}
                collection={collectionWithThumbnails}
                imageCount={imageCount}
                videoCount={videoCount}
                onClick={handleCollectionClick}
              />
            );
          })}
        </div>
      ) : (
        <div className="layout__empty-state">
          <h3 className="layout__empty-title">Коллекций пока нет</h3>
          <p className="layout__empty-text text-m">
            Создайте первую коллекцию для организации карточек
          </p>
          <Button
            variant="primary"
            size="L"
            iconLeft={<Icon name="folder-plus" size={24} variant="border" />}
            onClick={() => setIsCreateModalOpen(true)}
            style={{ marginTop: '16px' }}
          >
            Создать коллекцию
          </Button>
        </div>
      )}

      {/* Модальное окно создания коллекции */}
      <CreateCollectionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCollectionCreated={handleCollectionCreated}
      />
    </Layout>
  );
};

export default CollectionsPage;

