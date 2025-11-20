/**
 * Страница детального просмотра коллекции
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout';
import { useSearch } from '../contexts';
import { Button, Icon } from '../components/common';
import { MasonryGrid, CardViewModal } from '../components/gallery';
import { EditCollectionModal } from '../components/collections';
import { getCollection, getAllCards, deleteCollection, addToMoodboard, removeFromMoodboard, getMoodboard } from '../services/db';
import { logDeleteCollection } from '../services/history';
import { useToast } from '../hooks/useToast';
import { useAlert } from '../hooks/useAlert';
import type { Collection, Card, ViewMode, ContentFilter } from '../types';

export const CollectionDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { searchProps, setSelectedTags } = useSearch();
  const toast = useToast();
  const alert = useAlert();
  
  const [collection, setCollection] = useState<Collection | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [viewMode, setViewMode] = useState<ViewMode>('standard');
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  
  const [viewingCard, setViewingCard] = useState<Card | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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
    
    toast.showToast({
      title: 'Удалить коллекцию',
      message: `Вы уверены что хотите удалить коллекцию "${collection.name}"? Карточки останутся в системе`,
      type: 'error',
      onConfirm: async () => {
        try {
          await deleteCollection(collection.id);
          
          // Логируем удаление коллекции
          await logDeleteCollection(collection.name);
          
          // Показываем успешное уведомление
          alert.success(`Коллекция "${collection.name}" удалена`);
          
          navigate('/collections');
        } catch (error) {
          console.error('Ошибка удаления коллекции:', error);
        }
      },
      confirmText: 'Удалить',
      cancelText: 'Отмена'
    });
  };

  const handleRenameCollection = () => {
    if (!collection) return;
    setIsEditModalOpen(true);
  };

  const handleCollectionUpdated = async () => {
    if (id) {
      await loadCollection(id);
      toast.success('Коллекция переименована');
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

  // Обработчик добавления/удаления из мудборда
  const handleMoodboardToggle = async (card: Card) => {
    try {
      const moodboard = await getMoodboard();
      const isInMoodboard = moodboard.cardIds.includes(card.id);
      
      if (isInMoodboard) {
        await removeFromMoodboard(card.id);
      } else {
        await addToMoodboard(card.id);
      }
      // Перезагружаем карточки коллекции
      if (id) {
        await loadCollection(id);
      }
    } catch (error) {
      console.error('Ошибка переключения мудборда:', error);
    }
  };

  // Обработчик клика на коллекцию
  const handleCollectionClick = (collectionId: string) => {
    setIsModalOpen(false);
    navigate(`/collections/${collectionId}`);
  };

  // Обработчик клика на метку
  const handleTagClick = (tagId: string) => {
    setIsModalOpen(false);
    setSelectedTags([tagId]);
    navigate('/cards');
  };

  // Обработчик обновления карточки
  const handleCardUpdated = async () => {
    if (id) {
      await loadCollection(id);
      
      // Обновляем viewingCard если она открыта
      if (viewingCard) {
        const allCards = await getAllCards();
        const updatedCard = allCards.find(c => c.id === viewingCard.id);
        if (updatedCard) {
          setViewingCard(updatedCard);
        }
      }
    }
  };

  // Обработчик удаления карточки
  const handleCardDeleted = async () => {
    if (id) {
      await loadCollection(id);
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
              variant="border" 
              size="L"
              iconOnly
              iconLeft={<Icon name="pencil" size={24} variant="border" />}
              onClick={handleRenameCollection}
              title="Переименовать коллекцию"
            />
            <Button 
              variant="border" 
              size="L"
              iconOnly
              iconLeft={<Icon name="trash" size={24} variant="border" />}
              onClick={handleDeleteCollection}
              title="Удалить коллекцию"
            />
          </>
        )
      }}
      searchProps={searchProps}
    >
      <MasonryGrid
        cards={filteredCards}
        viewMode={viewMode}
        onCardClick={handleCardClick}
        onCardSelect={handleCardSelect}
        onMoodboardToggle={handleMoodboardToggle}
        selectedCards={selectedCards}
      />

      <CardViewModal
        isOpen={isModalOpen}
        card={viewingCard}
        onClose={() => setIsModalOpen(false)}
        onCardUpdated={handleCardUpdated}
        onCardDeleted={handleCardDeleted}
        onSimilarCardClick={(card) => {
          setViewingCard(card);
        }}
        onCollectionClick={handleCollectionClick}
        onTagClick={handleTagClick}
      />

      <EditCollectionModal
        isOpen={isEditModalOpen}
        collection={collection}
        onClose={() => setIsEditModalOpen(false)}
        onCollectionUpdated={handleCollectionUpdated}
      />
    </Layout>
  );
};

export default CollectionDetailPage;

