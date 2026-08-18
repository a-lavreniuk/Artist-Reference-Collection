import type { RefObject } from 'react';
import type { CardRecord } from '../../services/arcSchema';
import type { CardAnnotationV1 } from '@arc-main-shared/detailCardTemplate';
import type { AnnotationDraftRect } from './CardDetailAnnotationLayer';

export type CardDetailVideoPlayerHandle = {
  togglePlay: () => void;
  seekBySeconds: (deltaSec: number) => void;
  seekToMs: (ms: number) => void;
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
  commentMode?: boolean;
  annotations?: CardAnnotationV1[];
  selectedAnnotationId?: string | null;
  composerAnchorId?: string | null;
  draftRect?: AnnotationDraftRect | null;
  draftIndex?: number;
  onSelectAnnotation?: (id: string) => void;
  onCreateAnnotation?: (rect: AnnotationDraftRect) => void;
  onMoveAnnotation?: (id: string, x: number, y: number) => void;
  onCurrentMsChange?: (ms: number) => void;
};
