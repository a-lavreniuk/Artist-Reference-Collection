/**
 * Страница коллекций
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout';
import { Button } from '../components/common';
import { CollectionCard, CreateCollectionModal } from '../components/collections';
import { getAllCollections } from '../services/db';
import type { Collection } from '../types';
import './CollectionsPage.css';

export const CollectionsPage = () => {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Загрузка коллекций
  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      setIsLoading(true);
      const allCollections = await getAllCollections();
      setCollections(allCollections);
    } catch (error) {
      console.error('Ошибка загрузки коллекций:', error);
    } finally {
      setIsLoading(false);
    }
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
        showSearch={false}
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
            size="medium"
            onClick={() => setIsCreateModalOpen(true)}
          >
            Добавить коллекцию
          </Button>
        )
      }}
      showSearch={false}
    >
      {collections.length > 0 ? (
        <div className="collections-grid">
          {collections.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              onClick={handleCollectionClick}
            />
          ))}
        </div>
      ) : (
        <div className="layout__empty-state">
          <h3 className="layout__empty-title">Коллекций пока нет</h3>
          <p className="layout__empty-text text-m">
            Создайте первую коллекцию для организации карточек
          </p>
          <Button
            variant="primary"
            size="large"
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

