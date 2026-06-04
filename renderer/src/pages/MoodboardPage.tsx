import { useSearchParams } from 'react-router-dom';
import MoodboardBoardView from '../components/moodboard/MoodboardBoardView';
import MoodboardCardsView from '../components/moodboard/MoodboardCardsView';

export default function MoodboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = searchParams.get('mf') ?? 'cards';

  const setMode = (next: 'cards' | 'board') => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (next === 'cards') n.delete('mf');
        else n.set('mf', 'board');
        return n;
      },
      { replace: true }
    );
  };

  return (
    <>
      <div className="arc-page-actions arc-page-actions--start">
        <div className="tabs arc-moodboard-page-tabs" role="tablist" aria-label="Режим мудборда">
          <button
            type="button"
            role="tab"
            className={`tab-button${mode !== 'board' ? ' is-active' : ''}`}
            aria-selected={mode !== 'board'}
            onClick={() => setMode('cards')}
          >
            Карточки
          </button>
          <button
            type="button"
            role="tab"
            className={`tab-button${mode === 'board' ? ' is-active' : ''}`}
            aria-selected={mode === 'board'}
            onClick={() => setMode('board')}
          >
            Доска
          </button>
        </div>
      </div>
      {mode === 'board' ? <MoodboardBoardView /> : <MoodboardCardsView />}
    </>
  );
}
