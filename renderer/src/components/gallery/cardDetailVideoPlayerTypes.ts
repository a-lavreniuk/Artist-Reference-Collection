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
  autoplay: boolean;
  loop?: boolean;
  onLoopChange?: (next: boolean) => void;
  onCardUpdated?: (card: CardRecord) => void;
  onToast?: (message: string) => void;
  playerRef?: RefObject<CardDetailVideoPlayerHandle | null>;
  flushToQueue?: boolean;
};
