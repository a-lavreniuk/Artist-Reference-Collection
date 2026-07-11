import type { RefObject } from 'react';
import type { CardRecord } from '../../services/arcSchema';

export type CardDetailVideoPlayerHandle = {
  togglePlay: () => void;
  seekBySeconds: (deltaSec: number) => void;
  stepFrames: (frameCount: number) => void;
  adjustSpeed: (direction: 1 | -1) => void;
  copyFrame: () => Promise<void>;
  saveFrame: () => Promise<void>;
  setPreviewFrame: () => Promise<void>;
};

export type CardDetailVideoPlayerProps = {
  cardId: string;
  src: string;
  videoNote?: string | null;
  videoWidth?: number;
  videoHeight?: number;
  fileSizeBytes?: number;
  autoplay: boolean;
  onCardUpdated?: (card: CardRecord) => void;
  onToast?: (message: string) => void;
  onOpenInfo?: () => void;
  playerRef?: RefObject<CardDetailVideoPlayerHandle | null>;
};
