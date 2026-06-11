import { Navigate, useParams } from 'react-router-dom';
import { ARC_DETAIL_QUERY_CARD } from '../search/openCardUrl';

/** Legacy edit URL → gallery with overlay open. */
export default function GalleryCardEditRedirect() {
  const { cardId } = useParams<{ cardId: string }>();

  if (!cardId) {
    return <Navigate to="/gallery" replace />;
  }

  const search = `?${ARC_DETAIL_QUERY_CARD}=${encodeURIComponent(cardId)}`;
  return <Navigate to={`/gallery${search}`} replace />;
}
