import { Navigate, useSearchParams } from 'react-router-dom';
import MoodboardCardsView from '../components/moodboard/MoodboardCardsView';

export default function MoodboardPage() {
  const [searchParams] = useSearchParams();
  if (searchParams.get('mf') === 'board') {
    return <Navigate to="/board" replace />;
  }

  return <MoodboardCardsView />;
}
