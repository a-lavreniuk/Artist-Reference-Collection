export type CardContextMenuScope =
  | { kind: 'library' }
  | { kind: 'collection'; collectionId: string }
  | { kind: 'moodboard-cards' }
  | { kind: 'trash' };

export type CardContextMenuActions = {
  onOpen: () => void;
  onToggleMoodboard: () => void;
  onOpenCollections: () => void;
  onFindSimilar: () => void;
  onOpenSourceFolder: () => void;
  onSendToTrash: () => void;
  onRestore?: () => void;
  onPermanentDelete?: () => void;
  onRemoveFromCollection?: () => void;
  onRemoveFromMoodboard?: () => void;
};

export type BuildCardContextMenuRowsInput = {
  scope: CardContextMenuScope;
  inMoodboard: boolean;
  hasSourcePath: boolean;
  actions: CardContextMenuActions;
};
