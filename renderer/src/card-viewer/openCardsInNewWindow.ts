import type { CardContextMenuScope } from '../components/gallery/cardContextMenuTypes';

export type CardViewerOpenContext =
  | { kind: 'library' }
  | { kind: 'moodboard' }
  | { kind: 'collection'; name: string };

export function cardViewerScopeAllowsNavigation(scope: CardContextMenuScope): boolean {
  return scope.kind === 'collection' || scope.kind === 'moodboard-cards';
}

export function cardViewerContextFromScope(
  scope: CardContextMenuScope,
  collectionName?: string
): CardViewerOpenContext {
  if (scope.kind === 'moodboard-cards') return { kind: 'moodboard' };
  if (scope.kind === 'collection') {
    const name = collectionName?.trim();
    if (name) return { kind: 'collection', name };
  }
  return { kind: 'library' };
}

export function serializeCardViewerContext(context: CardViewerOpenContext): Record<string, string> {
  if (context.kind === 'moodboard') return { ctx: 'moodboard' };
  if (context.kind === 'collection') {
    return { ctx: 'collection', ctxName: context.name };
  }
  return { ctx: 'library' };
}

export type ResolveCardViewerOpenInput = {
  scope: CardContextMenuScope;
  feedOrder: readonly string[];
  cardId: string;
  selectedIds?: readonly string[];
  collectionName?: string;
};

export function resolveCardViewerOpenPayload(input: ResolveCardViewerOpenInput): {
  cardIds: string[];
  startIndex: number;
  context: CardViewerOpenContext;
} {
  const { scope, feedOrder, cardId, selectedIds, collectionName } = input;
  const context = cardViewerContextFromScope(scope, collectionName);

  if (!cardViewerScopeAllowsNavigation(scope)) {
    return { cardIds: [cardId], startIndex: 0, context };
  }

  const selected = selectedIds?.filter((id) => id.trim().length > 0) ?? [];
  const cardIds =
    selected.length > 1 ? orderIdsInFeed(feedOrder, selected) : [...feedOrder];

  if (cardIds.length === 0) {
    return { cardIds: [cardId], startIndex: 0, context };
  }

  const startIndex = Math.max(0, cardIds.indexOf(cardId));
  return { cardIds, startIndex, context };
}

export type OpenCardsInNewWindowInput = {
  cardIds: readonly string[];
  startIndex?: number;
  context?: CardViewerOpenContext;
};

export async function openCardsInNewWindow(input: OpenCardsInNewWindowInput): Promise<void>;
export async function openCardsInNewWindow(
  cardIds: readonly string[],
  startIndex?: number,
  context?: CardViewerOpenContext
): Promise<void>;
export async function openCardsInNewWindow(
  cardIdsOrInput: readonly string[] | OpenCardsInNewWindowInput,
  startIndex = 0,
  context: CardViewerOpenContext = { kind: 'library' }
): Promise<void> {
  const input: OpenCardsInNewWindowInput = Array.isArray(cardIdsOrInput)
    ? { cardIds: cardIdsOrInput, startIndex, context }
    : cardIdsOrInput;

  const ids = input.cardIds.filter((id) => id.trim().length > 0);
  if (ids.length === 0 || !window.arc?.openCardViewer) return;
  const index = Math.min(Math.max(0, input.startIndex ?? 0), ids.length - 1);
  await window.arc.openCardViewer({
    cardIds: [...ids],
    startIndex: index,
    context: input.context ?? { kind: 'library' }
  });
}

export async function openCardInNewWindowFromScope(input: ResolveCardViewerOpenInput): Promise<void> {
  const payload = resolveCardViewerOpenPayload(input);
  await openCardsInNewWindow({
    cardIds: payload.cardIds,
    startIndex: payload.startIndex,
    context: payload.context
  });
}

export function orderIdsInFeed(feedOrder: readonly string[], ids: readonly string[]): string[] {
  const wanted = new Set(ids);
  return feedOrder.filter((id) => wanted.has(id));
}

export function resolveFocusedGalleryCardId(): string | null {
  const active = document.activeElement;
  if (!(active instanceof Element)) return null;
  const tile = active.closest('[data-gallery-card-id]');
  const id = tile?.getAttribute('data-gallery-card-id')?.trim();
  return id || null;
}
