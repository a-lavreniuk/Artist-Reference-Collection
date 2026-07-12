import type { CardViewerOpenContext } from './openCardsInNewWindow';

export type CardViewerLaunchParams = {
  cardIds: string[];
  startIndex: number;
  context: CardViewerOpenContext;
};

function parseContext(params: URLSearchParams): CardViewerOpenContext {
  const kind = params.get('ctx');
  if (kind === 'moodboard') return { kind: 'moodboard' };
  if (kind === 'collection') {
    const rawName = params.get('ctxName');
    if (rawName) {
      try {
        const name = decodeURIComponent(rawName).trim();
        if (name) return { kind: 'collection', name };
      } catch {
        const name = rawName.trim();
        if (name) return { kind: 'collection', name };
      }
    }
  }
  return { kind: 'library' };
}

export function parseCardViewerLaunch(search: string): CardViewerLaunchParams {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const cardIds = (params.get('cards') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const rawIndex = Number(params.get('index') ?? 0);
  const startIndex = Number.isFinite(rawIndex) ? Math.max(0, Math.floor(rawIndex)) : 0;
  return {
    cardIds,
    startIndex: cardIds.length === 0 ? 0 : Math.min(startIndex, cardIds.length - 1),
    context: parseContext(params)
  };
}
