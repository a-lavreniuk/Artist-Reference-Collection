/**
 * Страница детального просмотра коллекции
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout';
import { useSearch } from '../contexts';
import { Button, Icon } from '../components/common';
import { MasonryGrid, CardViewModal } from '../components/gallery';
import { EditCollectionModal } from '../components/collections';
import { getCollection, getCardsByIds, deleteCollection, addToMoodboard, removeFromMoodboard, getMoodboard, getCard } from '../services/db';
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

  // Ref для сохранения позиции скролла
  const scrollPositionRef = useRef<number>(0);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  // Инициализация ref для контейнера скролла
  useEffect(() => {
    scrollContainerRef.current = document.querySelector('.layout__content') as HTMLElement;
  }, []);

  // Загрузка коллекции и карточек
  useEffect(() => {
    if (id) {
      loadCollection(id);
    }
  }, [id]);

  // Восстановление позиции скролла после обновления данных
  useEffect(() => {
    if (!isLoading && scrollContainerRef.current && scrollPositionRef.current > 0) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollPositionRef.current;
            scrollPositionRef.current = 0;
          }
        });
      });
    }
  }, [isLoading, cards]);

  const loadCollection = async (collectionId: string) => {
    try {
      setIsLoading(true);
      
      const coll = await getCollection(collectionId);
      if (!coll) {
        navigate('/collections');
        return;
      }
      
      setCollection(coll);
      
      // Загружаем карточки коллекции через bulkGet (оптимизированная загрузка)
      const collectionCards = await getCardsByIds(coll.cardIds);
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
    try {
      if (!id || !collection) return;
      
      // Загружаем только обновленную коллекцию
      const updatedCollection = await getCollection(id);
      if (!updatedCollection) {
        await loadCollection(id);
        return;
      }
      
      // Обновляем коллекцию локально
      setCollection(updatedCollection);
      toast.success('Коллекция переименована');
    } catch (error) {
      console.error('Ошибка обновления состояния после переименования коллекции:', error);
      // При ошибке перезагружаем данные
      if (id) {
        await loadCollection(id);
      }
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
      // Мудборд не влияет на коллекцию, поэтому не нужно перезагружать коллекцию
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
    try {
      if (!viewingCard) return;
      
      // Загружаем обновленную карточку
      const updatedCard = await getCard(viewingCard.id);
      if (!updatedCard) {
        // Если карточка не найдена, возможно она была удалена
        if (id) {
          await loadCollection(id);
        }
        return;
      }
      
      // Обновляем карточку в списке локально
      setCards(prev => 
        prev.map(c => c.id === updatedCard.id ? updatedCard : c)
      );
      
      // Обновляем viewingCard если она открыта
      setViewingCard(updatedCard);
    } catch (error) {
      console.error('Ошибка обновления состояния после изменения карточки:', error);
      // При ошибке перезагружаем данные
      if (id) {
        await loadCollection(id);
      }
    }
  };

  // Обработчик удаления карточки
  const handleCardDeleted = async () => {
    try {
      if (!viewingCard || !collection) return;
      
      // Удаляем карточку из списка локально
      setCards(prev => prev.filter(c => c.id !== viewingCard.id));
      
      // Обновляем коллекцию - удаляем ID карточки
      const updatedCollection = {
        ...collection,
        cardIds: collection.cardIds.filter(id => id !== viewingCard.id)
      };
      setCollection(updatedCollection);
      
      // Закрываем модальное окно
      setIsModalOpen(false);
      setViewingCard(null);
    } catch (error) {
      console.error('Ошибка обновления состояния после удаления карточки:', error);
      // При ошибке перезагружаем данные
      if (id) {
        await loadCollection(id);
      }
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
        emptyStateText="Ещё не добавлено ни одной карточки…"
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

