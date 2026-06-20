import type { HistoryEntityType, HistorySegment } from '../services/historyTypes';

type EntityRef = {
  entityType: HistoryEntityType;
  id: string;
  label: string;
};

export function historyQuotedEntity(
  prefix: string,
  entity: EntityRef,
  closingQuote = true
): { message: string; segments: HistorySegment[] } {
  const message = closingQuote ? `${prefix}${entity.label}»` : `${prefix}${entity.label}`;
  const segments: HistorySegment[] = [{ kind: 'text', text: prefix }];
  segments.push({ kind: 'entity', entityType: entity.entityType, id: entity.id, label: entity.label });
  if (closingQuote) segments.push({ kind: 'text', text: '»' });
  return { message, segments };
}

export function historyCardAction(prefix: string, cardId: string, cardLabel = 'карточка'): {
  message: string;
  segments: HistorySegment[];
} {
  const message = `${prefix}${cardLabel}`;
  return {
    message,
    segments: [
      { kind: 'text', text: prefix },
      { kind: 'entity', entityType: 'card', id: cardId, label: cardLabel }
    ]
  };
}
