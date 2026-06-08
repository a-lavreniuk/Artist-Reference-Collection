import { Navigate, useParams } from 'react-router-dom';

/** Legacy edit URL → gallery with overlay open. */
export default function GalleryCardEditRedirect() {
  const { cardId } = useParams<{ cardId: string }>();

  if (!cardId) {
    return <Navigate to="/gallery" replace />;
  }

  return <Navigate to="/gallery" replace state={{ openCardId: cardId }} />;
}
