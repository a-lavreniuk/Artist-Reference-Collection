import type { CardRecord } from '../../services/arcSchema';
import GalleryThumb from './GalleryThumb';
import { gallerySkeletonStyle } from './gallerySkeleton';

type Props = {
  card: CardRecord;
  src: string | null | undefined;
  onPick: () => void;
};

export default function CardDetailSimilarThumb({ card, src, onPick }: Props) {
  return (
    <button type="button" className="arc-gallery-card-wrap arc-card-similar-tile panel elevation-sunken" onClick={onPick}>
      {src ? (
        <GalleryThumb card={card} src={src} />
      ) : (
        <div className="arc-gallery-skeleton arc-card-similar-skeleton" style={gallerySkeletonStyle(card)} aria-hidden />
      )}
    </button>
  );
}
