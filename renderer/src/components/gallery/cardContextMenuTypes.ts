import type { CardRecord } from '../../services/arcSchema';

export type CardContextMenuScope =
  | { kind: 'library' }
  | { kind: 'collection'; collectionId: string }
  | { kind: 'moodboard-cards' }
  | { kind: 'trash' };

export type CardContextMenuActions = {
  onOpen: () => void;
  onOpenInNewWindow: () => void;
  onToggleMoodboard: () => void;
  onOpenCollections: () => void;
  onFindSimilar: () => void;
  onOpenSourceFolder: () => void;
  onSendToTrash: () => void;
  onPickPreviewFrame?: () => void;
  onToggleCardSelection?: () => void;
  onRestore?: () => void;
  onPermanentDelete?: () => void;
  onRemoveFromCollection?: () => void;
  onRemoveFromMoodboard?: () => void;
};

export type BuildCardContextMenuRowsInput = {
  scope: CardContextMenuScope;
  inMoodboard: boolean;
  hasSourcePath: boolean;
  cardType?: CardRecord['type'];
  cardFormat?: string;
  actions: CardContextMenuActions;
  bulkSelectionCount?: number;
  selectionModeActive?: boolean;
  menuCardIsSelected?: boolean;
  onStartMultiSelect?: () => void;
};
