/**
 * Страница детального просмотра коллекции
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout';
import { useSearchNavigation } from '../hooks';
import { Button, Input } from '../components/common';
import { MasonryGrid, CardViewModal } from '../components/gallery';
import { getCollection, getAllCards, deleteCollection, updateCollection } from '../services/db';
import { logDeleteCollection, logRenameCollection } from '../services/history';
import type { Collection, Card, ViewMode, ContentFilter } from '../types';

export const CollectionDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { searchProps } = useSearchNavigation();
  
  const [collection, setCollection] = useState<Collection | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [viewMode, setViewMode] = useState<ViewMode>('standard');
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  
  const [viewingCard, setViewingCard] = useState<Card | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Состояние редактирования
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');

  // Загрузка коллекции и карточек
  useEffect(() => {
    if (id) {
      loadCollection(id);
    }
  }, [id]);

  const loadCollection = async (collectionId: string) => {
    try {
      setIsLoading(true);
      
      const coll = await getCollection(collectionId);
      if (!coll) {
        navigate('/collections');
        return;
      }
      
      setCollection(coll);
      
      // Загружаем карточки коллекции
      const allCards = await getAllCards();
      const collectionCards = allCards.filter(card => 
        coll.cardIds.includes(card.id)
      );
      setCards(collectionCards);
    } catch (error) {
      console.error('Ошибка загрузки коллекции:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Фильтрация карточек
  const filteredCards = useMemo(() => {
    let filtered = [...cards];

    if (contentFilter === 'images') {
      filtered = filtered.filter(card => card.type === 'image');
    } else if (contentFilter === 'videos') {
      filtered = filtered.filter(card => card.type === 'video');
    }

    return filtered;
  }, [cards, contentFilter]);

  // Подсчёт карточек
  const counts = useMemo(() => {
    const imageCards = cards.filter(c => c.type === 'image');
    const videoCards = cards.filter(c => c.type === 'video');
    
    return {
      all: cards.length,
      images: imageCards.length,
      videos: videoCards.length
    };
  }, [cards]);

  const handleDeleteCollection = async () => {
    if (!collection) return;
    
    if (!confirm(`Удалить коллекцию "${collection.name}"? Карточки останутся в системе.`)) {
      return;
    }

    try {
      await deleteCollection(collection.id);
      
      // Логируем удаление коллекции
      await logDeleteCollection(collection.name);
      
      navigate('/collections');
    } catch (error) {
      console.error('Ошибка удаления коллекции:', error);
    }
  };

  const handleRenameCollection = async () => {
    if (!collection) return;
    
    const newName = prompt('Новое название коллекции:', collection.name);
    
    if (!newName || newName.trim() === '' || newName.trim() === collection.name) {
      return;
    }

    try {
      const oldName = collection.name;
      await updateCollection(collection.id, { name: newName.trim() });
      
      // Логируем переименование
      await logRenameCollection(oldName, newName.trim());
      
      // Перезагружаем коллекцию
      await loadCollection(collection.id);
    } catch (error) {
      console.error('Ошибка переименования коллекции:', error);
    }
  };

  const handleCardClick = (card: Card) => {
    setViewingCard(card);
    setIsModalOpen(true);
  };

  const handleCardSelect = (card: Card, selected: boolean) => {
    if (selected) {
      setSelectedCards(prev => [...prev, card.id]);
    } else {
      setSelectedCards(prev => prev.filter(cardId => cardId !== card.id));
    }
  };

  if (isLoading) {
    return (
      <Layout
        headerProps={{
          title: 'Загрузка...'
        }}
        searchProps={searchProps}
      >
        <div className="layout__loading">
          <div className="layout__spinner" />
          <p className="layout__loading-text">Загрузка коллекции...</p>
        </div>
      </Layout>
    );
  }

  if (!collection) {
    return null;
  }

  return (
    <Layout
      headerProps={{
        title: collection.name,
        backButton: {
          label: 'Назад к коллекциям',
          onClick: () => navigate('/collections')
        },
        viewMode: {
          current: viewMode,
          onChange: setViewMode
        },
        contentFilter: {
          current: contentFilter,
          counts,
          onChange: setContentFilter
        },
        actions: (
          <>
            <Button 
              variant="secondary" 
              size="medium"
              onClick={handleRenameCollection}
            >
              Переименовать
            </Button>
            <Button
              variant="danger"
              size="medium"
              onClick={handleDeleteCollection}
            >
              Удалить коллекцию
            </Button>
          </>
        )
      }}
      showSearch={false}
    >
      <MasonryGrid
        cards={filteredCards}
        viewMode={viewMode}
        onCardClick={handleCardClick}
        onCardSelect={handleCardSelect}
        selectedCards={selectedCards}
      />

      <CardViewModal
        isOpen={isModalOpen}
        card={viewingCard}
        onClose={() => setIsModalOpen(false)}
        onCardUpdated={() => id && loadCollection(id)}
        onCardDeleted={() => id && loadCollection(id)}
        onSimilarCardClick={(card) => {
          setViewingCard(card);
        }}
      />
    </Layout>
  );
};

export default CollectionDetailPage;

