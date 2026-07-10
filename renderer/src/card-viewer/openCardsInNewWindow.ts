import type { CardContextMenuScope } from '../components/gallery/cardContextMenuTypes';

export function cardViewerScopeAllowsNavigation(scope: CardContextMenuScope): boolean {
  return scope.kind === 'collection' || scope.kind === 'moodboard-cards';
}

export type ResolveCardViewerOpenInput = {
  scope: CardContextMenuScope;
  feedOrder: readonly string[];
  cardId: string;
  selectedIds?: readonly string[];
};

export function resolveCardViewerOpenPayload(input: ResolveCardViewerOpenInput): {
  cardIds: string[];
  startIndex: number;
} {
  const { scope, feedOrder, cardId, selectedIds } = input;

  if (!cardViewerScopeAllowsNavigation(scope)) {
    return { cardIds: [cardId], startIndex: 0 };
  }

  const selected = selectedIds?.filter((id) => id.trim().length > 0) ?? [];
  const cardIds =
    selected.length > 1 ? orderIdsInFeed(feedOrder, selected) : [...feedOrder];

  if (cardIds.length === 0) {
    return { cardIds: [cardId], startIndex: 0 };
  }

  const startIndex = Math.max(0, cardIds.indexOf(cardId));
  return { cardIds, startIndex };
}

export async function openCardsInNewWindow(cardIds: readonly string[], startIndex = 0): Promise<void> {
  const ids = cardIds.filter((id) => id.trim().length > 0);
  if (ids.length === 0 || !window.arc?.openCardViewer) return;
  const index = Math.min(Math.max(0, startIndex), ids.length - 1);
  await window.arc.openCardViewer({ cardIds: [...ids], startIndex: index });
}

export async function openCardInNewWindowFromScope(input: ResolveCardViewerOpenInput): Promise<void> {
  const payload = resolveCardViewerOpenPayload(input);
  await openCardsInNewWindow(payload.cardIds, payload.startIndex);
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
