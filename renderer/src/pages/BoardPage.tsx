import { EmptyState } from '../components/empty-state';
import { EMPTY_STATE_COPY } from '../content/emptyStates';
// MoodboardBoardView сохранён — вернуть после выхода раздела из разработки.
import MoodboardBoardView from '../components/moodboard/MoodboardBoardView';

const BOARD_IN_DEVELOPMENT = true;

export default function BoardPage() {
  if (!BOARD_IN_DEVELOPMENT) {
    return <MoodboardBoardView />;
  }

  return (
    <div className="arc-board-page--empty-stub arc-ui-kit-scope" data-btn-size="l">
      <EmptyState {...EMPTY_STATE_COPY.inDevelopmentBoard} fill />
    </div>
  );
}
