export type HistoryEntityType = 'card' | 'collection' | 'category' | 'tag';

export type HistorySegment =
  | { kind: 'text'; text: string }
  | { kind: 'entity'; entityType: HistoryEntityType; id: string; label: string };

export type HistoryEntry = {
  time: string;
  message: string;
  segments?: HistorySegment[];
};
